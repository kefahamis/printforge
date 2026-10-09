"""Tests for the helpers that do not need a site. Run with `python -m unittest` from the
app folder, or through `bench run-tests --app printforge`."""

import base64
import importlib.util
import os
import unittest

# Loaded by path so this also runs where Frappe (and so the `printforge` package's other
# modules) cannot be imported.
_spec = importlib.util.spec_from_file_location(
	"printforge_utils", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "utils.py")
)
utils = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(utils)

PNG = base64.b64encode(b"\x89PNG fake image bytes").decode()
OTHER = base64.b64encode(b"\x89PNG a different image").decode()


class TestReplaceDataImages(unittest.TestCase):
	def test_each_distinct_image_is_saved_once_and_replaced_everywhere(self):
		saved = []

		def save(file_name, content):
			saved.append((file_name, content))
			return "/files/" + file_name

		html = f'<img src="data:image/png;base64,{PNG}"><img src="data:image/png;base64,{OTHER}">'
		design = f'{{"customUrl": "data:image/png;base64,{PNG}"}}'
		(html, design), moved = utils.replace_data_images([html, design], save)

		self.assertTrue(moved)
		self.assertEqual(len(saved), 2)
		self.assertNotIn("data:image", html + design)
		self.assertIn(saved[0][0], design)
		self.assertEqual(saved[0][1], b"\x89PNG fake image bytes")

	def test_same_bytes_give_the_same_file_name(self):
		self.assertEqual(utils.image_file_name(b"abc", "png"), utils.image_file_name(b"abc", "png"))
		self.assertTrue(utils.image_file_name(b"abc", "jpeg").endswith(".jpg"))

	def test_svg_is_left_embedded(self):
		svg = "data:image/svg+xml;base64," + base64.b64encode(b"<svg onload='x()'/>").decode()
		(html,), moved = utils.replace_data_images([f'<img src="{svg}">'], lambda *a: self.fail("svg must not be stored"))
		self.assertFalse(moved)
		self.assertIn(svg, html)

	def test_nothing_to_do(self):
		(html, none), moved = utils.replace_data_images(['<img src="/files/logo.png">', None], lambda *a: "x")
		self.assertFalse(moved)
		self.assertEqual(none, "")


class TestStoredFileNames(unittest.TestCase):
	def test_finds_only_printforge_files(self):
		name = utils.image_file_name(b"abc", "png")
		text = f'<img src="/files/{name}"><img src="/files/company-logo.png">'
		self.assertEqual(utils.stored_file_names(text, None), {name})


class TestFieldsFromMeta(unittest.TestCase):
	FIELDS = [
		{"fieldname": "customer", "label": "Customer", "fieldtype": "Link"},
		{"fieldname": "sb1", "label": "Details", "fieldtype": "Section Break"},
		{"fieldname": "grand_total", "label": None, "fieldtype": "Currency"},
		{"fieldname": "items", "label": "Items", "fieldtype": "Table", "options": "Sales Invoice Item"},
	]
	CHILD = [
		{"fieldname": "item_name", "label": "Item Name", "fieldtype": "Data"},
		{"fieldname": "cb", "fieldtype": "Column Break"},
		{"fieldname": "amount", "label": "Amount", "fieldtype": "Currency"},
	]

	def test_skips_layout_fields_and_falls_back_to_the_fieldname(self):
		fields = utils.fields_from_meta(self.FIELDS)
		self.assertEqual([f["name"] for f in fields], ["customer", "grand_total", "items"])
		self.assertEqual(fields[1]["label"], "grand_total")
		self.assertTrue(fields[2]["isChild"])

	def test_link_fields_name_the_doctype_they_point_at(self):
		fields = utils.fields_from_meta([{"fieldname": "customer", "fieldtype": "Link", "options": "Customer"}, *self.FIELDS[2:]])
		self.assertEqual(fields[0]["link"], "Customer")
		self.assertNotIn("link", fields[1])

	def test_select_fields_list_their_values(self):
		fields = utils.fields_from_meta([{"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "\nDraft\nPaid\n Overdue \n"}])
		self.assertEqual(fields[0]["options"], ["Draft", "Paid", "Overdue"])

	def test_child_tables_carry_their_columns(self):
		asked = []

		def child_fields(doctype):
			asked.append(doctype)
			return self.CHILD

		items = utils.fields_from_meta(self.FIELDS, child_fields)[2]
		self.assertEqual(asked, ["Sales Invoice Item"])
		self.assertEqual([c["name"] for c in items["columns"]], ["item_name", "amount"])


class TestFieldsFromReportColumns(unittest.TestCase):
	def test_dict_and_string_columns(self):
		scrub = lambda s: s.lower().replace(" ", "_")
		fields = utils.fields_from_report_columns(
			[{"fieldname": "account", "label": "Account", "fieldtype": "Link"}, "Opening Balance:Currency/currency:120", "Remarks", {"label": "no fieldname"}],
			scrub,
		)
		self.assertEqual(
			[(f["name"], f["fieldtype"]) for f in fields],
			[("account", "Link"), ("opening_balance", "Currency"), ("remarks", "Data")],
		)

	def test_no_columns(self):
		self.assertEqual(utils.fields_from_report_columns(None, str), [])


class TestCodes(unittest.TestCase):
	def test_qr_draws_one_square_per_dark_module_inside_a_quiet_border(self):
		svg = utils.matrix_svg([[1, 0], [0, 1]], 96, quiet=2)
		self.assertIn('width="96" height="96" viewBox="0 0 6 6"', svg)
		self.assertEqual(svg.count("h1v1h-1z"), 2)
		self.assertIn("M2 2h1v1h-1z", svg)
		self.assertIn("M3 3h1v1h-1z", svg)

	def test_barcode_merges_runs_of_bars_and_stretches_to_the_width(self):
		svg = utils.bars_svg("1101", 200, 60, quiet=0)
		self.assertIn('width="200" height="60" viewBox="0 0 4 1" preserveAspectRatio="none"', svg)
		self.assertIn("M0 0h2v1h-2z", svg)
		self.assertIn("M3 0h1v1h-1z", svg)

	def test_barcode_keeps_a_blank_margin_on_both_sides(self):
		svg = utils.bars_svg("11", 200, 60)
		self.assertIn('viewBox="0 0 22 1"', svg)
		self.assertIn("M10 0h2v1h-2z", svg)
		self.assertNotIn("<div", svg)

	def test_barcode_text_sits_under_the_bars_and_is_escaped(self):
		html = utils.bars_svg("101", 200, 60, "A<1>")
		self.assertIn('height="47"', html)
		self.assertIn("A&lt;1&gt;", html)


if __name__ == "__main__":
	unittest.main()

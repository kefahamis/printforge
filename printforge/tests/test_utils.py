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


if __name__ == "__main__":
	unittest.main()

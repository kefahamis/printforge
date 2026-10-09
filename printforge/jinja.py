"""Functions PrintForge's formats call while a document is printed (see `jinja` in hooks.py).

Both return inline SVG, which the PDF step draws as sharp vectors at any size and needs no
image file for.
"""

from html import escape

from printforge.utils import bars_svg, matrix_svg

BARCODE_TYPES = {"code128", "code39", "ean13", "ean8", "upca"}


def _note(message, width, height):
	"""Shown in place of a code that cannot be drawn, so the reason is on the page."""
	return (
		f'<div style="width:{int(width)}px;min-height:{int(height)}px;border:1px dashed #999999;'
		f'font-size:8px;line-height:1.3;color:#666666;padding:2px;overflow:hidden;">{escape(message)}</div>'
	)


def printforge_qr(value, size=96):
	"""A QR code holding `value`, `size` px square."""
	import pyqrcode  # ships with Frappe, which uses it for two-factor setup

	value = "" if value is None else str(value).strip()
	if not value:
		return ""
	try:
		try:
			code = pyqrcode.create(value, error="M")
		except (ValueError, UnicodeError):
			code = pyqrcode.create(value, error="M", encoding="utf-8")
	except Exception:
		return _note("This value is too long for a QR code.", size, size)
	return matrix_svg(code.code, size)


def printforge_barcode(value, symbology="code128", width=220, height=64, show_text=1):
	"""A barcode holding `value`."""
	value = "" if value is None else str(value).strip()
	if not value:
		return ""
	try:
		import barcode
	except ImportError:
		return _note("Barcodes need the python-barcode package: run bench setup requirements.", width, height)

	symbology = symbology if symbology in BARCODE_TYPES else "code128"
	try:
		code = barcode.get(symbology, value)
		modules = "".join(code.build())
		# EAN and UPC add a check digit; print the number as it is encoded
		text = code.get_fullcode() if show_text else ""
	except Exception:
		return _note(f"{value} cannot be printed as {symbology.upper()}.", width, height)
	return bars_svg(modules, width, height, text if int(show_text or 0) else "")

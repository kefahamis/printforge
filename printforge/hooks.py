app_name = "printforge"
app_title = "PrintForge"
app_publisher = "Tagrit"
app_description = "Visual print format designer for Frappe / ERPNext"
app_email = ""
app_license = "MIT"

# The launcher tile and app switcher entry; only people who can use the builder see it.
add_to_apps_screen = [
	{
		"name": "printforge",
		"logo": "/assets/printforge/images/logo.svg",
		"title": "PrintForge",
		"route": "/printforge",
		"has_permission": "printforge.api.has_app_permission",
	}
]

# Adds "Edit in PrintForge" to Print Formats that were made in the builder.
doctype_js = {"Print Format": "public/js/print_format.js"}

# The design a Print Format was built from is kept in a hidden custom field on it.
after_install = "printforge.install.after_install"
after_migrate = ["printforge.install.after_migrate"]

# QR codes and barcodes in published formats are drawn by these when a document is printed.
jinja = {"methods": ["printforge.jinja.printforge_qr", "printforge.jinja.printforge_barcode"]}

# Earlier versions are kept per format, so they go when the format does.
doc_events = {"Print Format": {"on_trash": "printforge.api.delete_versions"}}

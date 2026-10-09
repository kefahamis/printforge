app_name = "printforge"
app_title = "PrintForge"
app_publisher = "Tagrit"
app_description = "Visual print format designer for Frappe / ERPNext"
app_email = ""
app_license = "MIT"

# Adds "Edit in PrintForge" to Print Formats that were made in the builder.
doctype_js = {"Print Format": "public/js/print_format.js"}

# The design a Print Format was built from is kept in a hidden custom field on it.
after_install = "printforge.install.ensure_custom_fields"
after_migrate = ["printforge.install.ensure_custom_fields"]

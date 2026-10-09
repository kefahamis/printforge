// Print Format form: link formats made in PrintForge back to the builder.
frappe.ui.form.on("Print Format", {
	refresh(frm) {
		if (frm.is_new() || !frm.doc.printforge_design) return;
		frm.add_custom_button(__("Edit in PrintForge"), () => {
			window.open("/printforge?format=" + encodeURIComponent(frm.doc.name), "_blank");
		});
		frm.set_intro(
			__("This format was made in PrintForge. Changes to the HTML here are overwritten the next time it is published from PrintForge."),
			"orange"
		);
	},
});

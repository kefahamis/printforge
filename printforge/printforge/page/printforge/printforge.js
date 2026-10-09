// Desk entry point (/app/printforge). The builder ships its own global styles, so it
// runs in a same-origin frame instead of being mounted into the desk DOM.
frappe.pages["printforge"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("PrintForge"),
		single_column: true,
	});
	$(wrapper)
		.find(".layout-main-section")
		.css({ padding: 0 })
		.html('<iframe src="/printforge" title="PrintForge" style="display:block;width:100%;height:calc(100vh - 150px);min-height:560px;border:0;"></iframe>');
};

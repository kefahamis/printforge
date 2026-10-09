# PrintForge

A visual designer for Frappe / ERPNext print formats. You lay out a document on an A4
canvas, and PrintForge publishes it to the site as a Print Format that can be chosen
when printing.

It runs in two ways:

- **As a Frappe app** — opens inside the desk at `/app/printforge` and publishes
  straight to the site's Print Format list.
- **Standalone** — a plain Vite app for working on the builder itself. There is no
  Publish button; you copy or download the generated Jinja instead.

## Install on a Frappe site

You need a working bench and a site. The built front-end bundle is already in
`printforge/public/dist/`, so Node is not required just to install.

```bash
# from the bench directory
bench get-app /path/to/printforge        # or a git URL
bench --site yoursite install-app printforge
bench build --app printforge
bench restart                            # production; `bench start` picks it up in development
```

Installing adds one hidden custom field, `printforge_design`, to the Print Format
doctype. It holds the editable design so a published format can be reopened later.

Then open `/app/printforge` on the site. It needs write access to Print Format, which
by default means the System Manager role.

### Check after the first install

The Frappe side was written without a bench to run it on, so confirm these on a real
site before relying on it:

1. `/printforge` loads the builder full-screen, and `/app/printforge` shows it framed
   inside the desk.
2. Publish the starter invoice, open a Sales Invoice, pick the new format, and
   download the PDF. Check the table and the totals block line up as they do in the
   builder.
3. Check the PDF margins. Publishing writes the design's page padding to the Print
   Format's margin fields; Frappe versions without those fields use Print Settings
   instead.

## Using it

1. **New** — pick the doctype the format is for.
2. **Doctype tab → Load fields from site** — pulls the doctype's real fields.
3. Design the page. **Preview** fills it with sample data.
4. **Publish** — name the Print Format, optionally make it the default for the
   doctype. After the first publish the button becomes **Update Print Format**.
5. **History** lists the formats published from PrintForge; click one to reopen it.

Publishing will not overwrite a standard Print Format, or one that was not made in
PrintForge. Use a different name in that case.

Published formats use the site's print font. The builder canvas shows Geist, so
letterforms and line breaks can differ slightly from the PDF.

## Updating

```bash
cd apps/printforge && git pull           # or copy the new files in
bench --site yoursite migrate
bench build --app printforge
bench restart
```

## Developing the builder

Requires Node 18 or newer.

```bash
npm install
npm run dev              # standalone, http://localhost:5173
npm run build:frappe     # rebuild printforge/public/dist/printforge.js
```

After `npm run build:frappe`, run `bench build --app printforge` on the bench (or
reload, if the app folder is the one the bench uses) to serve the new bundle.

The standalone dev server has no site behind it, so Publish, Load fields from site
and the site list in History only appear when the builder is opened through Frappe.

## Layout

| Path | What it is |
| --- | --- |
| `src/App.jsx` | The builder (React) |
| `printforge/api.py` | Site API: publish, list and open designs, doctype fields |
| `printforge/install.py` | Creates the `printforge_design` custom field |
| `printforge/www/printforge.*` | The full-screen builder page at `/printforge` |
| `printforge/printforge/page/printforge/` | Desk page at `/app/printforge` |
| `printforge/public/dist/` | Built bundle served by the site |
| `render_pdf.py` | Standalone helper: renders a file in `designs/` to PDF with wkhtmltopdf |

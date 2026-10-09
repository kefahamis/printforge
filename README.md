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
3. Check the PDF margins and that nothing is cut off on the right. The design's
   margins are written into the format's CSS as a `.print-format { margin-*: … }`
   rule, which is where Frappe's wkhtmltopdf step reads them from, and also into the
   Print Format's margin fields for newer PDF generators.
4. In the builder, open Preview, enter a real document name and press Render. That
   runs the unsaved design through the site's own print pipeline.
5. If you use a repeating header or footer, print a document long enough to reach a
   second page and check the header does not overlap the content. The margins are
   sized from how Frappe lays out its header and footer pages, which could only be
   read from its source here, not run.
6. If you make a report format, pick it in the report's Print dialog and check the
   rows and totals.

## Using it

1. **New** — type any doctype on the site and load its fields, pick a report, or
   start from a preset.
2. Design the page. Set paper, margins and letter head in the Page panel (shown when
   nothing is selected).
3. **Preview** fills it with sample data; enter a document name there to render a
   real one.
4. **Publish** — name the Print Format, optionally make it the default for the
   doctype. After the first publish the button becomes **Update Print Format**.
5. **History** lists the formats published from PrintForge; click one to reopen it.

Publishing will not overwrite a standard Print Format, or one that was not made in
PrintForge. Use a different name in that case.

### How a design maps onto Frappe's print system

- **Fields.** A bare `{{ doc.field }}` is published as `doc.get_formatted("field")`, so
  currency, dates and numbers print the way the desk shows them. Add a filter or write
  any other expression and it is left exactly as typed.
- **Company logo.** The default image element looks the logo up on the Company record.
- **Letter head.** Off by default: the design prints as drawn. Turn on *Use the site's
  letter head and footer* in the Page panel to add them the way a standard format does,
  including page numbers when *Repeat Header and Footer* is on in Print Settings.
- **Repeating header and footer.** Select a top-level element on the first page and
  choose *Repeat as the page header* (or footer). It is printed in the margin of every
  page, the margin grows to fit it, and it takes the place of the site's letter head
  there. *Page numbers at the bottom of every page* is a separate Page-panel option.
- **Paper.** Paper size, orientation and margins are set in the Page panel.
- **Font.** The page is drawn in the site's print font (Print Settings), and published
  formats inherit it.
- **Images.** Images added in the builder are moved into the site's public files on
  publish instead of being embedded in the format.
- **Print Format form.** Formats made here get an *Edit in PrintForge* button. Editing
  their HTML by hand is overwritten on the next publish.

### Report formats

Pick a report in **New** to design a print format for it. The format then appears in
that report's Print dialog. Frappe fills report formats in the browser rather than on
the server, so a few things differ from document formats:

- The table lists the report's rows, one column per report column, formatted the way
  the report grid formats them. Total rows are bold.
- Text can use `{{ title }}`, `{{ filters.from_date }}` and the like. `doc` does not
  exist in a report.
- Letter head comes from the report's own Print dialog; the repeat, page-number and
  company-logo options do not apply.
- There is no live preview. Publish, then print the report.
- Columns can only be loaded automatically for reports that run without filters. For
  the rest, type the column names into the field list.

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
npm test                 # exporter, design-tree and editor tests
npm run lint
npm run build:frappe     # rebuild printforge/public/dist/
```

After `npm run build:frappe`, run `bench build --app printforge` on the bench (or
reload, if the app folder is the one the bench uses) to serve the new bundle.

The standalone dev server has no site behind it, so Publish, Load fields from site
and the site list in History only appear when the builder is opened through Frappe.

## Layout

| Path | What it is |
| --- | --- |
| `src/App.jsx` | The editor shell: state, toolbar, canvas, publishing |
| `src/components/` | Canvas elements, side panels, dialogs, form controls |
| `src/tree.js` | Design-tree operations, element defaults, starter designs |
| `src/exporter.js` | Design → Print Format HTML (Jinja, or Frappe's browser templates for reports) |
| `src/frappe.js` | Calls to the site API |
| `src/styles.js`, `src/doctypes.js` | Editor stylesheet; preset doctype list |
| `src/*.test.js(x)` | Tests |
| `printforge/api.py` | Site API: publish, preview with a document, open designs, doctypes, reports and fields |
| `printforge/public/js/print_format.js` | *Edit in PrintForge* button on the Print Format form |
| `printforge/install.py` | Creates the `printforge_design` custom field |
| `printforge/www/printforge.*` | The full-screen builder page at `/printforge` |
| `printforge/printforge/page/printforge/` | Desk page at `/app/printforge` |
| `printforge/public/dist/` | Built bundle served by the site |
| `render_pdf.py` | Standalone helper: renders a file in `designs/` to PDF with wkhtmltopdf |

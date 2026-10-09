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

Installing does three things to the site:

- adds one hidden custom field, `printforge_design`, to the Print Format doctype. It
  holds the editable design so a published format can be reopened later;
- creates a **Print Designer** role that can read, create and change Print Formats, so
  someone can design formats without being a System Manager. This is granted once; if
  you later narrow or remove it in the Role Permission Manager, it stays that way;
- installs `python-barcode`, which draws barcodes when a document is printed. If you
  copied the app in by hand rather than with `bench get-app`, run
  `bench setup requirements`.

Then open `/app/printforge` on the site, or use the PrintForge tile on the launcher. It
needs write access to Print Format: the System Manager or Print Designer role. The tile
is only shown to people who have it.

### Check after the first install

The PDF output has been checked with wkhtmltopdf 0.12.6 (the engine Frappe uses) driven
with Frappe v15's own options, stylesheet and header/footer template: page scale,
margins, repeating header and footer, page numbers and the site letter head all came
out as designed. What has not been run is the app inside a real site, so confirm:

1. `/printforge` loads the builder full-screen, and `/app/printforge` shows it framed
   inside the desk.
2. Publishing creates the Print Format, and it can be picked when printing.
3. In Preview, enter a real document name and press **Render**, then **PDF**. Both go
   through the site's own print pipeline with the unsaved design.
4. A Print Format made here shows **Edit in PrintForge** on its form.
5. If you make a report format, pick it in the report's Print dialog and check the
   rows and totals.

Items 1 to 3 have since been run on a Frappe 16.36 / ERPNext 16.37 site with
wkhtmltopdf, along with a three-page document with a repeating header, footer and page
numbers, QR codes, barcodes, custom receipt and label paper, the watermark, the
ready-made designs for Sales Invoice, Quotation, Purchase Order, Payment Entry and Item,
and version history. Report formats (item 5), and the Delivery Note and Salary Slip
designs with a real document, have not.

Newer Frappe branches add a Chrome-based PDF generator; the layout here is built for
wkhtmltopdf.

## Using it

1. **New** — pick a ready-made design (tax invoice, quotation, purchase order, delivery
   note, payment receipt, payslip, till receipt, item label, carton labels), or type any
   doctype on the site and load its fields, pick a report, or start from a preset.
2. Design the page. Set paper, margins and letter head in the Page panel (shown when
   nothing is selected).
3. **Preview** fills it with sample data; enter a document name there to render a
   real one.
4. **Publish** — name the Print Format, optionally make it the default for the
   doctype. After the first publish the button becomes **Update Print Format**.
5. **History** lists the formats published from PrintForge; click one to reopen it.
   **Earlier versions** shows the designs it had before each republish (the last 15 are
   kept). Open one and press **Update Print Format** to put it back.

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
- **Conditions.** Any element can have a *Show only if* test, such as
  `doc.discount_amount`; it is printed only when that is set or true.
- **Draft and cancelled.** DRAFT or CANCELLED is printed above unsubmitted documents,
  as standard formats do and subject to the same Print Settings option. It can be
  switched off in the Page panel.
- **Translation.** Plain wording (labels, column headings) is sent through Frappe's
  translator, so it follows the print language. Text containing markup or template
  tags is left as typed.
- **Paper.** Paper size, orientation and margins are set in the Page panel. Dashed red
  lines on the canvas show roughly where each printed page ends.
- **Font.** By default the page is drawn in the site's print font (Print Settings) and
  published formats inherit it. A design can pick one of a few fonts every PDF server
  has instead.
- **Images.** Images added in the builder are moved into the site's public files on
  publish, attached to the Print Format, and removed again once the design stops using
  them. SVG images stay embedded.
- **Child tables.** Loading a doctype's fields also loads the columns of its child
  tables, offered as suggestions when setting up a table.
- **Two people, one format.** Publishing over a copy that changed on the site since you
  opened it stops and asks before replacing it.
- **Print Format form.** Formats made here get an *Edit in PrintForge* button. Editing
  their HTML by hand is overwritten on the next publish.

### Elements and page options

- **QR code and barcode.** Each encodes a field of the document (`doc.name` by default)
  or fixed text, and prints nothing while that value is empty. Point a QR code at the
  field that holds your tax authority link (for example an eTIMS URL) to print it on
  invoices. Barcodes can be Code 128, Code 39, EAN-13, EAN-8 or UPC-A. Both are drawn by
  the site as vectors when the document is printed, so the canvas shows a stand-in.
- **Show only if.** Any element can be printed only when a field is set or a condition
  is true, e.g. `doc.discount_amount` or `doc.status == "Paid"`.
- **Repeat for each row.** A container can be printed once per row of a child table,
  optionally starting a new page after each one. Inside it use `{{ item.field }}`. This
  is how one label per item is made.
- **Insert a field.** The list under a text element is searchable. A link field opens
  to the fields of the document it points at (the customer's tax ID from an invoice,
  say), and *Ready-made* has values such as the amount in words, today's date and who
  printed it.
- **Blocks.** The Insert panel has ready blocks: taxes table, payment schedule, bank and
  M-Pesa details, amount in words, signatures, stamp area, QR code with caption, and a
  block per item row. The bank and paybill lines are plain text for you to fill in.
- **Receipts and labels.** Besides A3/A4/A5/Letter/Legal, the Page panel has a custom
  size in millimetres with presets for 80 mm and 58 mm receipt rolls and common label
  sizes. A receipt's height is fixed, as the PDF step needs one; set it to suit.
- **Watermark.** DRAFT / CANCELLED by document status, or your own text (COPY), printed
  faintly across every page. It is placed once per page height, so on a document whose
  page breaks are forced it can sit higher or lower from page to page.
- **Several elements at once.** Shift+click adds to the selection. The group can be
  copied, cut, pasted (Ctrl+C / X / V, also into another design), duplicated, deleted
  and nudged. Lining up and even spacing apply to elements placed freely in the same
  container; elements in a flow layout are arranged by their container.

Plain wording in a design is printed through Frappe's translator, so labels follow the
language chosen in the print dialog wherever the site has a translation.

### Report formats

Pick a report in **New** to design a print format for it. The format then appears in
that report's Print dialog. Frappe fills report formats in the browser rather than on
the server, so a few things differ from document formats:

- The table lists the report's rows, one column per report column, formatted the way
  the report grid formats them. Total rows are bold.
- Text can use `{{ title }}`, `{{ filters.from_date }}` and the like. `doc` does not
  exist in a report.
- Letter head comes from the report's own Print dialog; the repeat, page-number,
  watermark and company-logo options do not apply, and QR codes and barcodes are left
  out.
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
python -m unittest printforge/tests/test_utils.py   # site-independent Python helpers
npm run build:frappe     # rebuild printforge/public/dist/
```

After `npm run build:frappe`, run `bench build --app printforge` on the bench (or
reload, if the app folder is the one the bench uses) to serve the new bundle.

The standalone dev server has no site behind it, so Publish, Load fields from site
and the site list in History only appear when the builder is opened through Frappe.

Designs are autosaved in the browser and can be kept in its saved list with **Save**.
Browser storage is small; if it fills up the editor says so and keeps working, and
publishing or exporting as JSON is then the way to keep the work.

## Layout

| Path | What it is |
| --- | --- |
| `src/App.jsx` | The editor shell: state, toolbar, canvas, publishing |
| `src/components/` | Canvas elements, side panels, dialogs, form controls |
| `src/tree.js` | Design-tree operations, element defaults, starter designs |
| `src/templates.js` | Ready-made designs and blocks |
| `src/exporter.js` | Design → Print Format HTML (Jinja, or Frappe's browser templates for reports) |
| `src/frappe.js` | Calls to the site API |
| `src/styles.js`, `src/doctypes.js` | Editor stylesheet; preset doctype list |
| `src/*.test.js(x)` | Tests |
| `printforge/api.py` | Site API: publish, preview (HTML and PDF), open designs and earlier versions, doctypes, reports and fields |
| `printforge/jinja.py` | QR code and barcode functions that published formats call when printing |
| `printforge/printforge/doctype/printforge_version/` | Earlier designs of each published format |
| `printforge/utils.py` | Helpers that need no site; tested in `printforge/tests/` |
| `.github/workflows/ci.yml` | Lint, tests and build on every push |
| `printforge/public/js/print_format.js` | *Edit in PrintForge* button on the Print Format form |
| `printforge/install.py` | Creates the `printforge_design` custom field and the Print Designer role |
| `printforge/www/printforge.*` | The full-screen builder page at `/printforge` |
| `printforge/printforge/page/printforge/` | Desk page at `/app/printforge` |
| `printforge/public/dist/` | Built bundle served by the site |
| `render_pdf.py` | Standalone helper: renders a file in `designs/` to PDF with wkhtmltopdf |

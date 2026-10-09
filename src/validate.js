// Checks a design against the doctype (or report) it is for before it is published.
// Errors block publishing; warnings are shown and left to the user.

import { lintJinja } from './linter.js';
import { getSettings } from './exporter.js';

// Fields Frappe provides on every document, valid even if not in the field list.
const META_FIELDS = new Set([
  'name', 'doctype', 'owner', 'creation', 'modified', 'modified_by',
  'docstatus', 'idx', 'company', 'letter_head', 'currency', 'status',
  'amended_from', 'naming_series', 'remarks', 'select_print_heading', 'meta',
]);
// Document methods the generated template calls; not fields.
const DOC_METHODS = new Set(['get_formatted', 'get', 'get_value', 'as_dict']);

/** Every `doc.field` the template reads, whether directly or through the formatter. */
export function referencedFields(html) {
  const fields = new Set();
  for (const m of (html || "").matchAll(/\bdoc\.get_formatted\("([A-Za-z_]\w*)"/g)) fields.add(m[1]);
  for (const m of (html || "").matchAll(/\bdoc\.([A-Za-z_]\w*)/g)) if (!DOC_METHODS.has(m[1])) fields.add(m[1]);
  return fields;
}

export function validateDesign(tree, doctype, docFields, html, formatName) {
  const issues = [];
  const error = message => issues.push({ severity: 'error', message });
  const warning = message => issues.push({ severity: 'warning', message });
  const report = getSettings(tree).printFor === "Report";

  // 1. Format name must be a valid Frappe document name
  if (!formatName.trim()) error('Print Format name is required.');
  else if (/[<>/\\#?%]/.test(formatName)) error('Print Format name contains invalid characters (< > / \\ # ? %).');

  // 2. Design must not be empty
  if (!tree.pages.some(p => (p.roots || []).length > 0)) error('The design is empty. Add at least one element.');

  // 3. Template structure
  for (const e of lintJinja(html)) error(`Line ${e.line} of the generated template: ${e.message}`);

  const known = new Set((docFields || []).map(f => f.name));
  const childTables = new Set((docFields || []).filter(f => f.isChild).map(f => f.name));

  // 4. Field references should exist on the target doctype. Without a field list there is
  // nothing to check against.
  if (!report && known.size > 0) {
    for (const f of referencedFields(html)) {
      if (!known.has(f) && !META_FIELDS.has(f)) warning(`"doc.${f}" is not in the field list for ${doctype}. Check it exists on the site.`);
    }
  }

  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'table') {
      // 5. Tables must bind to a real child table and have usable columns
      const cf = node.childField || 'items';
      if (!report && childTables.size > 0 && !childTables.has(cf)) error(`A table reads "doc.${cf}", which is not a child table of ${doctype}.`);
      if (!(node.columns || []).length) error('A table has no columns.');
      for (const c of (node.columns || [])) {
        if (c.kind === "calc") { if (!(c.expr || "").trim()) error(`Table column "${c.label || '(unnamed)'}" has no calculation.`); }
        else if (!c.field?.trim()) error(`Table column "${c.label || '(unnamed)'}" has no field.`);
        else if (!/^[A-Za-z_]\w*$/.test(c.field.trim())) error(`Table column "${c.label || c.field}" has a field name that is not valid: "${c.field}".`);
        else if (report && known.size > 0 && !known.has(c.field.trim())) warning(`Table column "${c.label || c.field}" reads "${c.field}", which is not in the column list for the ${doctype} report.`);
      }
    }
    if (node.type === 'text' && /\{\{\s*\}\}/.test(node.content || '')) error('A text element contains an empty {{ }} expression.');
    if (node.type === 'image' && node.logoType === 'custom' && node.customUrl && !/^(https?:|data:|\/)/.test(node.customUrl)) {
      warning('An image URL is not absolute. It may not resolve when the site renders the format.');
    }
  }

  return issues;
}

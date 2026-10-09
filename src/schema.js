// Versioned design files: what is autosaved, kept in the saved list, exported as JSON and
// stored on the site with a published Print Format.
//
// Version history:
//  1 — original: no `version` field, `docFields` may lack `label`
//  2 — `version`, `savedAt` and `assets` always present; every docField has a label

import { migrateTree } from './tree.js';

export const CURRENT_VERSION = 2;

/** Build a versioned design file from the editor's state, ready to stringify. */
export function serializeDesign(tree, doctype, docFields, assets, extra = {}) {
  return {
    version: CURRENT_VERSION,
    tree,
    doctype,
    docFields: docFields ?? [],
    assets: assets ?? [],
    savedAt: new Date().toISOString(),
    ...extra,
  };
}

/** Checks the required top-level shape of a parsed JSON blob. */
export function validateDesignFile(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['File is empty or not valid JSON.'] };

  if (!raw.tree || typeof raw.tree !== 'object') {
    errors.push('Missing required field: tree');
  } else {
    if (!raw.tree.nodes || typeof raw.tree.nodes !== 'object') errors.push('tree.nodes must be an object');
    if (!Array.isArray(raw.tree.pages)) errors.push('tree.pages must be an array');
    else if (raw.tree.pages.length === 0) errors.push('Design must have at least one page');
  }
  if (!raw.doctype || typeof raw.doctype !== 'string') errors.push('Missing required field: doctype');

  return { ok: errors.length === 0, errors };
}

/** Upgrades an older design blob to the current schema. Returns a new object. */
export function migrateDesign(raw) {
  const out = { ...raw };
  // Files written before versioning used strings such as "1.1"
  const version = typeof out.version === 'number' ? out.version : 1;
  if (version < 2) {
    out.version = 2;
    if (Array.isArray(out.docFields)) out.docFields = out.docFields.map(f => ({ ...f, label: f.label ?? f.name ?? '' }));
    if (!Array.isArray(out.assets)) out.assets = [];
    if (!out.savedAt) out.savedAt = new Date().toISOString();
  }
  return out;
}

/**
 * Full loading pipeline: validate → migrate → migrateTree. Throws an Error with a
 * readable message on a malformed file, so callers can show it as is. Fields the editor
 * adds around a design (its link to a published Print Format, its id in the saved list)
 * are passed through untouched.
 */
export function loadDesignFile(raw) {
  const validation = validateDesignFile(raw);
  if (!validation.ok) throw new Error('Invalid design file:\n• ' + validation.errors.join('\n• '));

  const migrated = migrateDesign(raw);
  return {
    ...migrated,
    tree: migrateTree(migrated.tree),
    docFields: migrated.docFields ?? [],
    assets: migrated.assets ?? [],
  };
}

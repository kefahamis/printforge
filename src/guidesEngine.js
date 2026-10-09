// Smart-guides engine backed by Rust/WASM (rust/guides-wasm), with the JS calcGuides as
// fallback while the module loads or if it fails.
//
// The JS path re-walks the tree (a findParent per box) on every mousemove. Here the box
// list is flattened once per drag session and cached; per-move work is a single WASM
// call over a Float64Array.

import { calcGuides, findParent, getGlobalBox } from './tree.js';
import { pageDims } from './exporter.js';

let wasm = null;

import('./wasm/guides/guides_wasm.js')
  .then(async (mod) => { await mod.default(); wasm = mod; })
  .catch(() => { /* not available (old browser, test environment): the JS path is used */ });

let session = null;
// A drag emits calls every frame; anything older than this is a new drag (elements may
// have moved or changed since), so re-flatten.
const SESSION_TTL_MS = 150;

function flatten(tree, targetId, pageIdx) {
  const boxes = [];
  const page = tree.pages[pageIdx];
  const collect = (ids) => {
    for (const id of (ids || [])) {
      if (id === targetId) continue;
      const b = getGlobalBox(tree, id);
      // sizes can be CSS strings such as "100%"; those have no fixed edge to align to
      if (b) boxes.push(b.x, b.y, Number(b.w) || 0, Number(b.h) || 0);
      const el = tree.nodes[id];
      if (el?.children?.length) collect(el.children);
    }
  };
  if (page) collect(page.roots);
  const pg = pageDims(tree);
  boxes.push(0, 0, pg.w, pg.h);             // page frame
  boxes.push(pg.w / 2, pg.h / 2, 0, 0);     // page centre
  const parentId = findParent(tree, targetId);
  const pBox = (parentId && getGlobalBox(tree, parentId)) || { x: 0, y: 0 };
  return { targetId, pageIdx, others: new Float64Array(boxes), px: pBox.x, py: pBox.y, lastUsed: Date.now() };
}

export function calcGuidesFast(tree, targetId, box, pageIdx) {
  if (!wasm) return calcGuides(tree, targetId, box, pageIdx);

  const now = Date.now();
  if (!session || session.targetId !== targetId || session.pageIdx !== pageIdx || now - session.lastUsed > SESSION_TTL_MS) {
    session = flatten(tree, targetId, pageIdx);
  }
  session.lastUsed = now;

  const res = wasm.calc_guides(box.x + session.px, box.y + session.py, box.w, box.h, session.others);
  const hCount = res[0];
  return {
    h: Array.from(res.slice(1, 1 + hCount)),
    v: Array.from(res.slice(1 + hCount)),
  };
}

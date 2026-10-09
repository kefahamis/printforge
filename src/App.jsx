import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSettings, pageDims, getPathData, repeatRoots, pageContentHeight, marginMm, toPrintFormatHtml, toStandaloneHtml } from './exporter.js';
import { snap, uid, treeUpd, treeAdd, treeRemove, migrateTree, treeMove, rmFromParent, findParent, isDesc, cloneTree, mkT, mkPath, FACS, buildTree, buildReportTree, buildSampleInvoiceTree } from './tree.js';
import { injectStyles } from './styles.js';
import { FRAPPE, frappeCall, frappePdf } from './frappe.js';
import { SmartGuides } from './components/atoms.jsx';
import { CNode, Ruler } from './components/Canvas.jsx';
import { Breadcrumb, Props, LeftPanel } from './components/Panels.jsx';
import { ErrorGuardian, NewDesignModal, DesignHistoryModal, PublishModal } from './components/Modals.jsx';
import { TemplateGallery, CommandPalette, ContextMenu, UndoSnackbar, Toast, Tips, EmptyState, StandalonePublishModal } from './components/Overlays.jsx';
import { serializeDesign, loadDesignFile } from './schema.js';
import { validateDesign } from './validate.js';

// ── App ───────────────────────────────────────────────────────────────────────
function MainApp() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pf_theme") || "dark");
  useEffect(() => { try { localStorage.setItem("pf_theme", theme); } catch (e) { /* storage full: the theme just is not remembered */ } }, [theme]);

  // Load persistence or default
  const savedState = useMemo(() => {
    try {
      const s = localStorage.getItem("pf_current");
      return s ? loadDesignFile(JSON.parse(s)) : null; // validate + migrate
    } catch (e) { return null; }
  }, []);

  const [tree, setTreeState] = useState(() => savedState?.tree || migrateTree(buildTree()));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  // The latest tree, readable from handlers that outlive a render (a drag in progress)
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const setTree = useCallback((next) => { treeRef.current = next; setTreeState(next); }, []);
  // While a drag or resize is in progress, history keeps the tree from before it began,
  // so however many frames it takes, it is one undo step.
  const gestureBase = useRef(null);
  const gesture = useMemo(() => ({ begin: () => { if (!gestureBase.current) gestureBase.current = treeRef.current; } }), []);

  const record = useCallback((nextTree) => {
    const before = gestureBase.current || treeRef.current;
    gestureBase.current = null;
    setPast(p => [...p.slice(-49), before]);
    setFuture([]);
    setTree(nextTree);
  }, [setTree]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture(f => [tree, ...f]);
    setPast(p => p.slice(0, -1));
    setTree(prev);
  }, [past, tree]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(p => [...p, tree]);
    setFuture(f => f.slice(1));
    setTree(next);
  }, [future, tree]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [penMode, setPenMode] = useState(false); // false, 'drawing', 'editing'
  const [doctype, setDoctype] = useState(savedState?.doctype || "Sales Invoice");
  const [activeGuides, setActiveGuides] = useState({ h: [], v: [] });
  const [docFields, setDocFields] = useState(savedState?.docFields || [
    { name: "name", label: "Invoice #" }, { name: "customer_name", label: "Customer" }, { name: "address_display", label: "Address" },
    { name: "posting_date", label: "Date" }, { name: "due_date", label: "Due Date" }, { name: "currency", label: "Currency" },
    { name: "net_total", label: "Net Total" }, { name: "tax_amount", label: "Tax" }, { name: "grand_total", label: "Grand Total" },
    { name: "company", label: "Company" }, { name: "company_address_display", label: "Company Address" },
    { name: "items", label: "Items", isChild: true }, { name: "taxes", label: "Taxes", isChild: true },
  ]);
  const [assets, setAssets] = useState(savedState?.assets || []);
  // Name of the Print Format on the site this design was published to or opened from
  const [printFormat, setPrintFormat] = useState(savedState?.printFormat || "");
  const [showPublish, setShowPublish] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [leftTab, setLeftTab] = useState(null);
  const [density, setDensity] = useState(() => { try { return localStorage.getItem("pf_density") || "comfortable"; } catch (e) { return "comfortable"; } });
  const [seenTips, setSeenTips] = useState(() => { try { return localStorage.getItem("pf_tips") === "seen"; } catch (e) { return true; } });
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* storage full: not remembered */ } };
  useEffect(() => { if (toast?.type === "success") { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);
  // The site's timestamp for that Print Format when it was last read or written here
  const [siteModified, setSiteModified] = useState(savedState?.siteModified || "");
  // Identifies this design in the browser's saved list, so two designs for one doctype stay separate
  const [designId, setDesignId] = useState(savedState?.designId || uid);

  // Browser storage is small (about 5 MB) and images are large; a failed write must not take the editor down
  const [storageFull, setStorageFull] = useState(false);
  const store = useCallback((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  // Auto-Save Effect
  useEffect(() => {
    setStorageFull(!store("pf_current", serializeDesign(tree, doctype, docFields, assets, { printFormat, siteModified, designId })));
  }, [tree, doctype, docFields, assets, printFormat, siteModified, designId, store]);

  const [zoom, setZoom] = useState(0.76);
  const [showCode, setShowCode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const printRef = useRef(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const handleScroll = (e) => {
    setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop });
  };
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // What gets stored in the Print Format; also what the Jinja tab shows and copies
  // Measured heights of the elements that repeat on every page; they size the page margins
  const [heights, setHeights] = useState({});
  useEffect(() => {
    const ids = [...repeatRoots(tree, "header"), ...repeatRoots(tree, "footer")];
    const h = {};
    for (const id of ids) {
      const n = document.querySelector('[data-pf-node="' + id + '"]');
      if (!n) return; // canvas not on screen (Jinja view): keep the last measurement
      h[id] = n.offsetHeight;
    }
    setHeights(prev => JSON.stringify(prev) === JSON.stringify(h) ? prev : h);
  }, [tree, showCode, preview]);
  const jinja = useMemo(() => toPrintFormatHtml(tree, { heights }), [tree, heights]);
  const isReport = getSettings(tree).printFor === "Report";
  const contentH = pageContentHeight(tree, { heights });
  const pg = pageDims(tree);
  const settings = getSettings(tree);
  const updateSettings = (ch) => record({ ...tree, settings: { ...settings, ...ch } });
  useEffect(() => { injectStyles(theme, pg, density); }, [theme, pg.w, pg.h, density]);

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    setPreview(true);
    setShowExportMenu(false);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  }, []);

  const handleExportImage = useCallback(async (format) => {
    if (!printRef.current) return;
    setIsPrinting(true);
    setPreview(true);
    setShowExportMenu(false);

    // Allow UI to settle
    await new Promise(r => setTimeout(r, 150));

    try {
      const node = printRef.current;
      const options = {
        backgroundColor: '#ffffff',
        width: pg.w,
        height: pg.h,
        style: {
          transform: 'none',
          borderRadius: '0',
          boxShadow: 'none'
        }
      };

      let dataUrl;
      const fileName = `${doctype.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${format}`;

      if (format === 'png') {
        dataUrl = await (await import('html-to-image')).toPng(node, options);
      } else {
        dataUrl = await (await import('html-to-image')).toJpeg(node, { ...options, quality: 0.95 });
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsPrinting(false);
    }
  }, [doctype, printRef]);

  const [activePathPoints, setActivePathPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragPointIdx, setDragPointIdx] = useState(-1);
  const [editPointIdx, setEditPointIdx] = useState(-1);
  const [selPointIdx, setSelPointIdx] = useState(-1);
  const [editHandle, setEditHandle] = useState(null); // 'p', 'c1', 'c2'

  const getCanvasCoords = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handlePenMouseDown = (e) => {
    if (penMode !== 'drawing') return;
    const raw = getCanvasCoords(e);
    const s = showGrid ? snap : (v => v);
    const pos = { x: s(raw.x), y: s(raw.y) };

    if (activePathPoints.length > 2) {
      const first = activePathPoints[0];
      const dist = Math.sqrt((pos.x - first.x) ** 2 + (pos.y - first.y) ** 2);
      if (dist < 10) {
        finishPath(true);
        return;
      }
    }

    const newPoint = { x: pos.x, y: pos.y, c1: { x: pos.x, y: pos.y }, c2: { x: pos.x, y: pos.y } };
    const newPoints = [...activePathPoints, newPoint];
    setActivePathPoints(newPoints);
    setDragPointIdx(newPoints.length - 1);
    setIsDrawing(true);
  };

  const handlePenMouseMove = (e) => {
    if (!isDrawing || dragPointIdx === -1) return;
    const pos = getCanvasCoords(e);
    const points = [...activePathPoints];
    const p = points[dragPointIdx];

    const dx = pos.x - p.x;
    const dy = pos.y - p.y;

    p.c2 = { x: pos.x, y: pos.y };
    p.c1 = { x: p.x - dx, y: p.y - dy };

    setActivePathPoints(points);
  };

  const handlePenMouseUp = () => {
    setIsDrawing(false);
    setDragPointIdx(-1);
    setEditPointIdx(-1);
    setEditHandle(null);
  };

  const finishPath = (closed = false) => {
    if (activePathPoints.length < 2) {
      setPenMode(false);
      setActivePathPoints([]);
      return;
    }

    const xs = activePathPoints.flatMap(p => [p.x, p.c1.x, p.c2.x]);
    const ys = activePathPoints.flatMap(p => [p.y, p.c1.y, p.c2.y]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const w = Math.max(20, maxX - minX);
    const h = Math.max(20, maxY - minY);

    const normalizedPoints = activePathPoints.map(p => ({
      x: p.x - minX, y: p.y - minY,
      c1: { x: p.c1.x - minX, y: p.c1.y - minY },
      c2: { x: p.c2.x - minX, y: p.c2.y - minY }
    }));

    const el = mkPath(minX, minY, normalizedPoints);
    el.w = w; el.h = h; el.closed = closed;

    const newTree = treeAdd(tree, el, null, activePageIdx);
    record(newTree);
    setPenMode(false);
    setActivePathPoints([]);
    setSel(el.id);
  };
  // 'saving', 'saved', null


  const addEl = useCallback((type, ov = {}) => {
    try {
      const f = FACS[type] || mkT;
      const el = { ...f(60, 80), ...ov };
      const selNode = sel ? tree.nodes[sel] : null;
      const parentId = selNode && ["container", "rect", "circle", "triangle"].includes(selNode.type) ? sel : null;
      record(treeAdd(tree, parentId ? { ...el, _flow: selNode.mode === "flow" } : el, parentId, activePageIdx));
      // When nesting, the container stays selected so the next insert goes in too
      if (!parentId) setSel(el.id);
    } catch (e) {
      console.error("Critical error adding element:", e);
    }
  }, [activePageIdx, tree, record, sel]);
  const addPage = useCallback(() => {
    record({ ...tree, pages: [...(tree.pages || []), { id: uid(), name: "Page " + ((tree.pages || []).length + 1), roots: [] }] });
  }, [tree, record]);

  const delPage = useCallback((idx) => {
    const ps = (tree.pages || []);
    if (ps.length <= 1) return;
    const pages = ps.filter((_, i) => i !== idx);
    record({ ...tree, pages });
    setActivePageIdx(Math.max(0, idx - 1));
  }, [tree, record]);

  const dupPage = useCallback((idx) => {
    const ps = (tree.pages || []);
    const page = ps[idx];
    if (!page) return;
    const newRoots = [];
    const newNodes = { ...tree.nodes };
    (page.roots || []).forEach(rid => {
      const [nid, nodes] = cloneTree(tree.nodes, rid);
      newRoots.push(nid);
      Object.assign(newNodes, nodes);
    });
    const newPage = { id: uid(), name: page.name + " (Copy)", roots: newRoots };
    const pages = [...tree.pages];
    pages.splice(idx + 1, 0, newPage);
    record({ ...tree, nodes: newNodes, pages });
    setActivePageIdx(idx + 1);
  }, [tree, record]);

  const addChild = useCallback((pid, type) => {
    try {
      if (!pid) return;
      const f = FACS[type] || mkT;
      const el = { ...f(0, 0), _flow: true };
      record(treeAdd(tree, el, pid));
      setSel(el.id);
    } catch (e) {
      console.error("Critical error adding child:", e);
    }
  }, [tree, record]);
  const updatePage = useCallback((idx, ch) => {
    const pages = [...tree.pages];
    pages[idx] = { ...pages[idx], ...ch };
    record({ ...tree, pages });
  }, [tree, record]);

  const updateEl = useCallback((id, ch, noRecord = false) => {
    const newTree = treeUpd(treeRef.current, id, ch);
    if (!noRecord) record(newTree);
    else setTree(newTree);
  }, [record, setTree]);
  const [snackbar, setSnackbar] = useState(null);
  const deleteEl = useCallback(id => {
    const el = tree.nodes[id];
    if (!el) return;
    record(treeRemove(tree, id));
    setSel(null);
    setSnackbar({ message: "Deleted " + (el.type === "container" && (el.children || []).length ? "a container and what was in it" : "a " + el.type + " element") });
  }, [tree, record]);
  const dupEl = useCallback(id => {
    const pid = findParent(tree, id);
    const [nid, newNodes] = cloneTree(tree.nodes, id);
    const m = { ...tree.nodes, ...newNodes };
    if (pid) {
      const p = m[pid];
      record({ ...tree, nodes: { ...m, [pid]: { ...p, children: [...(p.children || []), nid] } } });
    } else {
      const page = tree.pages[activePageIdx];
      const idx = page.roots.indexOf(id);
      const r = [...page.roots];
      r.splice(idx + 1, 0, nid);
      const pages = [...tree.pages];
      pages[activePageIdx] = { ...page, roots: r };
      record({ ...tree, nodes: m, pages });
    }
    setSel(nid);
  }, [tree, record, activePageIdx]);

  const zOrder = useCallback((id, dir) => {
    const pid = findParent(tree, id);
    if (pid) {
      const p = tree.nodes[pid];
      const kids = [...(p.children || [])];
      const i = kids.indexOf(id);
      if (i < 0) return;
      if (dir === "up" && i < kids.length - 1) [kids[i], kids[i + 1]] = [kids[i + 1], kids[i]];
      if (dir === "down" && i > 0) [kids[i], kids[i - 1]] = [kids[i - 1], kids[i]];
      if (dir === "front") kids.push(kids.splice(i, 1)[0]);
      if (dir === "back") kids.unshift(kids.splice(i, 1)[0]);
      record({ ...tree, nodes: { ...tree.nodes, [pid]: { ...p, children: kids } } });
    } else {
      const page = tree.pages[activePageIdx];
      const r = [...(page.roots || [])];
      const i = r.indexOf(id);
      if (i < 0) return;
      if (dir === "up" && i < r.length - 1) [r[i], r[i + 1]] = [r[i + 1], r[i]];
      if (dir === "down" && i > 0) [r[i], r[i - 1]] = [r[i - 1], r[i]];
      if (dir === "front") r.push(r.splice(i, 1)[0]);
      if (dir === "back") r.unshift(r.splice(i, 1)[0]);
      const pages = [...tree.pages];
      pages[activePageIdx] = { ...page, roots: r };
      record({ ...tree, pages });
    }
  }, [tree, record, activePageIdx]);

  const handleDrop = useCallback((dragId, targetId) => {
    if (!dragId || !targetId || dragId === targetId) return;
    if (isDesc(tree.nodes, dragId, targetId)) return;
    record(treeMove(tree, dragId, targetId));
    setSel(dragId);
  }, [tree, record]);

  useEffect(() => {
    const h = e => {
      const isMod = e.metaKey || e.ctrlKey;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      if (isMod && e.key.toLowerCase() === "k") { e.preventDefault(); setShowPalette(true); return; }
      if (!isMod && !typing && e.key.toLowerCase() === "v") { e.preventDefault(); setMoveMode(m => !m); return; }
      if (isMod && e.key.toLowerCase() === "z") {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault(); return;
      }
      if (isMod && e.key.toLowerCase() === "y") {
        redo(); e.preventDefault(); return;
      }

      if (!sel) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const el = tree.nodes[sel]; if (!el) return;
      const s = e.shiftKey ? 8 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (penMode === 'editing' && selPointIdx !== -1 && sel && tree.nodes[sel]) {
          const el = tree.nodes[sel];
          if (el.points && el.points.length > 2) {
            const pts = el.points.filter((_, i) => i !== selPointIdx);
            updateEl(sel, { points: pts });
            setSelPointIdx(-1);
            return;
          }
        }
        deleteEl(sel); return;
      }
      if (e.key === "ArrowLeft") { updateEl(sel, { x: (el.x || 0) - s }); e.preventDefault(); }
      if (e.key === "ArrowRight") { updateEl(sel, { x: (el.x || 0) + s }); e.preventDefault(); }
      if (e.key === "ArrowUp") { updateEl(sel, { y: (el.y || 0) - s }); e.preventDefault(); }
      if (e.key === "ArrowDown") { updateEl(sel, { y: (el.y || 0) + s }); e.preventDefault(); }
      if (isMod && e.key === "d") { dupEl(sel); e.preventDefault(); }
      if (e.key === "Escape") { const p = findParent(tree, sel); setSel(p || null); }
    };
    const mv = e => {
      if (penMode === 'editing' && editPointIdx !== -1 && sel && tree.nodes[sel]) {
        const el = tree.nodes[sel];
        const rect = document.querySelector('.pf-print-area').getBoundingClientRect();
        const px = (e.clientX - rect.left) / zoom;
        const py = (e.clientY - rect.top) / zoom;

        const pts = [...(el.points || [])];
        const p = pts[editPointIdx];
        if (!p) return;

        const dx = px - (editHandle === 'p' ? p.x : editHandle === 'c1' ? p.c1.x : p.c2.x);
        const dy = py - (editHandle === 'p' ? p.y : editHandle === 'c1' ? p.c1.y : p.c2.y);

        if (editHandle === 'p') {
          p.x += dx; p.y += dy;
          p.c1.x += dx; p.c1.y += dy;
          p.c2.x += dx; p.c2.y += dy;
        } else if (editHandle === 'c1') {
          p.c1.x += dx; p.c1.y += dy;
        } else if (editHandle === 'c2') {
          p.c2.x += dx; p.c2.y += dy;
        }
        updateEl(sel, { points: pts }, true);
      }
    };
    const mu = () => {
      if (penMode === 'editing' && editPointIdx !== -1) {
        record(tree);
      }
      setEditPointIdx(-1);
      // We keep selPointIdx for deletion
      setEditHandle(null);
    };

    window.addEventListener("keydown", h);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", mu);
    };
  }, [sel, tree, deleteEl, updateEl, dupEl, undo, redo, penMode, editPointIdx, editHandle, zoom]);

  const copy = () => { navigator.clipboard.writeText(jinja); setCopied(true); setTimeout(() => setCopied(false), 2200); };

  const openContextMenu = (e, nodeId) => {
    const items = nodeId ? [
      { id: "dup", label: "Duplicate", kbd: "Ctrl+D", run: () => dupEl(nodeId) },
      { id: "del", label: "Delete", kbd: "Del", run: () => deleteEl(nodeId) },
      "sep",
      { id: "front", label: "Bring to front", run: () => zOrder(nodeId, "front") },
      { id: "back", label: "Send to back", run: () => zOrder(nodeId, "back") },
      "sep",
      { id: "parent", label: "Select its container", kbd: "Esc", disabled: !findParent(tree, nodeId), run: () => setSel(findParent(tree, nodeId)) },
    ] : [
      { id: "page", label: "Add page", run: () => addPage() },
      { id: "gallery", label: "Start from a template", run: () => setShowGallery(true) },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const commands = [
    { id: "new", label: "New design", hint: "Pick a doctype or report", run: () => setShowNewModal(true) },
    { id: "gallery", label: "Template gallery", hint: "Invoice, purchase order, delivery note", run: () => setShowGallery(true) },
    { id: "history", label: "Open a saved design", run: () => setShowHistoryModal(true) },
    { id: "save", label: "Save to this browser", run: () => saveDesign() },
    { id: "publish", label: FRAPPE ? (printFormat ? "Update the Print Format" : "Publish as a Print Format") : "Publish to an ERPNext site", run: () => setShowPublish(true) },
    { id: "copy", label: "Copy the Print Format HTML", run: () => copy() },
    { id: "json", label: "Export design as JSON", run: () => exportJSON() },
    { id: "edit", label: "Edit view", run: () => { setPreview(false); setShowCode(false); } },
    { id: "preview", label: "Preview", run: () => { setPreview(true); setShowCode(false); } },
    { id: "code", label: "Show the generated template", run: () => { setShowCode(true); setPreview(false); } },
    { id: "doc", label: "Document type and fields", run: () => { setPreview(false); setShowCode(false); setLeftTab({ tab: "doc" }); } },
    { id: "move", label: moveMode ? "Turn the Move tool off" : "Turn the Move tool on", kbd: "V", run: () => setMoveMode(m => !m) },
    { id: "grid", label: showGrid ? "Hide the grid" : "Show the grid", run: () => setShowGrid(g => !g) },
    { id: "rulers", label: showRulers ? "Hide the rulers" : "Show the rulers", run: () => setShowRulers(r => !r) },
    { id: "theme", label: theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme", run: () => setTheme(t => t === "dark" ? "light" : "dark") },
    { id: "density", label: density === "compact" ? "Comfortable spacing" : "Compact spacing", hint: "Panel density", run: () => { const d = density === "compact" ? "comfortable" : "compact"; setDensity(d); remember("pf_density", d); } },
    { id: "undo", label: "Undo", kbd: "Ctrl+Z", run: () => undo() },
    { id: "redo", label: "Redo", kbd: "Ctrl+Y", run: () => redo() },
  ];
  const newDesign = () => setShowNewModal(true);
  // Move tool: pull an element out of its container and pin it at its current place on the
  // page. The drag that follows commits it, as one undo step with the move itself.
  const detachToFree = useCallback((id, x, y) => {
    const base = treeRef.current;
    const node = base.nodes[id];
    if (!node) return;
    gesture.begin();
    let t = rmFromParent(base, id);
    t = treeAdd(t, node, null, activePageIdx);
    t = treeUpd(t, id, { x: snap(x), y: snap(y), _free: true, w: typeof node.w === "number" ? node.w : 240 });
    setTree(t);
    setSel(id);
  }, [activePageIdx, gesture, setTree]);

  const applyTemplate = (t) => {
    record(migrateTree(t.build()));
    setDoctype(t.doctype);
    setDocFields(t.docFields);
    setSel(null);
    setActivePageIdx(0);
    setPrintFormat("");
    setSiteModified("");
    setDesignId(uid());
    setShowGallery(false);
  };

  const handleCreateNew = (dt, fs, printFor = "DocType") => {
    setDoctype(dt);
    setDocFields(fs);
    if (printFor === "Report") {
      setTree(buildReportTree(fs));
    } else if (dt.includes("Sample Invoice")) {
      setTree(buildSampleInvoiceTree());
    } else {
      setTree({ nodes: {}, pages: [{ id: uid(), name: "Page 1", roots: [] }] });
    }
    setSel(null);
    setActivePageIdx(0);
    setPrintFormat("");
    setSiteModified("");
    setDesignId(uid());
    setShowNewModal(false);
  };

  const publish = async (name, makeDefault, overwrite = false) => {
    const pad = tree.pages[0]?.padding ?? 40;
    const res = await frappeCall("publish", {
      print_format: name,
      doctype,
      html: jinja,
      print_for: isReport ? "Report" : "DocType",
      design: JSON.stringify(serializeDesign(tree, doctype, docFields, assets)),
      make_default: makeDefault ? 1 : 0,
      margin_mm: Math.round(pad * 25.4 / 96 * 10) / 10,
      // Only vouch for the site's copy if it is the format this design came from
      expected_modified: name === printFormat ? siteModified : "",
      overwrite: overwrite ? 1 : 0
    });
    setPrintFormat(res.name);
    setSiteModified(res.modified || "");
    if (res.design) {
      // The site moved embedded images into its file store; keep working from those URLs
      const d = JSON.parse(res.design);
      setTree(migrateTree(d.tree));
      setAssets(d.assets || []);
    }
    return res;
  };

  // Preview against a real document, rendered by the site's own print pipeline
  const [live, setLive] = useState({ name: "", recent: [], result: null, pdf: null, busy: false, error: "" });
  const renderLivePdf = async (name) => {
    if (!name.trim()) return;
    setLive(l => ({ ...l, busy: true, error: "" }));
    try {
      const pdf = await frappePdf("preview_pdf", { doctype, docname: name.trim(), html: jinja });
      setLive(l => { if (l.pdf) URL.revokeObjectURL(l.pdf); return { ...l, busy: false, result: null, pdf }; });
    } catch (e) {
      setLive(l => ({ ...l, busy: false, error: e.message }));
    }
  };
  useEffect(() => {
    if (!FRAPPE || !preview || isReport) return;
    frappeCall("recent_docs", { doctype }).then(recent => setLive(l => ({ ...l, recent: recent || [] })), () => { });
  }, [preview, doctype]);
  const renderLive = async (name) => {
    if (!name.trim()) return;
    setLive(l => ({ ...l, busy: true, error: "" }));
    try {
      const r = await frappeCall("preview", { doctype, docname: name.trim(), html: jinja });
      const page = `<!doctype html><html><head><meta charset="utf-8">${r.css_url ? `<link rel="stylesheet" href="${r.css_url}">` : ""}<style>${r.style}</style><style>body{margin:0}</style></head><body><div class="print-format-gutter"><div class="print-format">${r.html}</div></div></body></html>`;
      setLive(l => ({ ...l, busy: false, result: page, pdf: null }));
    } catch (e) {
      setLive(l => ({ ...l, busy: false, error: e.message }));
    }
  };

  const loadSiteDesign = (name, data, modified = "") => {
    setTree(migrateTree(data.tree));
    setDoctype(data.doctype);
    setDocFields(data.docFields || []);
    setAssets(data.assets || []);
    setPrintFormat(name);
    setSiteModified(modified);
    setDesignId(uid());
    setSel(null);
    setActivePageIdx(0);
    setShowHistoryModal(false);
  };

  // /printforge?format=<Print Format> opens that format's design (used by the button on the Print Format form)
  useEffect(() => {
    const name = FRAPPE && new URLSearchParams(window.location.search).get("format");
    if (!name) return;
    frappeCall("get_design", { print_format: name }).then(d => loadSiteDesign(d.name, JSON.parse(d.design), d.modified), e => alert(e.message));
  }, []);

  const saveDesign = useCallback(() => {
    setSaveStatus("saving");
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    const existingIdx = history.findIndex(h => h.id === designId);
    const newEntry = {
      id: designId,
      name: printFormat || doctype,
      doctype,
      tree,
      docFields,
      assets,
      printFormat,
      siteModified,
      updatedAt: Date.now(),
      nodeCount: Object.keys(tree.nodes).length
    };

    if (existingIdx >= 0) history[existingIdx] = newEntry;
    else history.unshift(newEntry);

    const ok = store("pf_history", history);
    setTimeout(() => { setSaveStatus(ok ? "saved" : "full"); setTimeout(() => setSaveStatus(null), ok ? 2000 : 6000); }, 300);
  }, [tree, doctype, docFields, assets, printFormat, siteModified, designId, store]);

  const loadDesign = (entry) => {
    setTree(migrateTree(entry.tree));
    setDoctype(entry.doctype || entry.name);
    setDocFields(entry.docFields || []);
    setAssets(entry.assets || []);
    setPrintFormat(entry.printFormat || "");
    setSiteModified(entry.siteModified || "");
    setDesignId(entry.id || uid());
    setSel(null);
    setShowHistoryModal(false);
  };

  const deleteSaved = (id) => {
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    store("pf_history", history.filter(h => h.id !== id));
  };

  const downloadJinja = () => {
    const blob = new Blob([toStandaloneHtml(tree, doctype, { heights })], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doctype.toLowerCase().replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = serializeDesign(tree, doctype, docFields, assets);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doctype.toLowerCase().replace(/\s+/g, "_")}.pf.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        let raw;
        try { raw = JSON.parse(re.target.result); } catch (err) { throw new Error("The file is not valid JSON."); }
        const d = loadDesignFile(raw);
        record(d.tree);
        setDoctype(d.doctype);
        setDocFields(d.docFields);
        setAssets(d.assets);
        setPrintFormat("");
        setSiteModified("");
        setDesignId(uid());
        setSel(null);
        setActivePageIdx(0);
        setToast({ type: "success", title: "Design imported", body: d.doctype + " · " + Object.keys(d.tree.nodes).length + " elements" });
      } catch (err) {
        setToast({ type: "error", title: "Could not import " + file.name, body: err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset for next import
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--b0)", color: "var(--t0)" }}>
      <div id="pf-editor-ui" style={{ height: 44, background: "var(--b1)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", paddingInline: 12, flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 14 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>PrintForge</span>
          {FRAPPE && <span style={{ fontSize: 11, color: "var(--t2)" }}>{FRAPPE.site}</span>}
          <button className="tb" title="Document type and fields" onClick={() => { setPreview(false); setShowCode(false); setLeftTab({ tab: "doc" }); }} style={{ gap: 4, color: "var(--t1)" }}>
            <span style={{ color: "var(--t2)" }}>/</span>{doctype}
          </button>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 10 }} />
        <button className="tb" onClick={newDesign} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          New
        </button>
        <button className="tb" onClick={() => setShowHistoryModal(true)} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          History
        </button>
        <button className="tb" onClick={() => document.getElementById('json-import').click()} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Import
          <input type="file" id="json-import" accept=".json" onChange={importJSON} style={{ display: "none" }} />
        </button>
        <div style={{ display: "flex", gap: 2, marginRight: 10 }}>
          <button className="ib" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)" style={{ opacity: past.length === 0 ? .3 : 1, cursor: past.length === 0 ? "default" : "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a5 5 0 0 1 5 5v3" /></svg>
          </button>
          <button className="ib" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)" style={{ opacity: future.length === 0 ? .3 : 1, cursor: future.length === 0 ? "default" : "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a5 5 0 0 0-5 5v3" /></svg>
          </button>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 10 }} />
        <div style={{ display: "flex", gap: 1 }}>
          <button className={"tb" + (!preview && !showCode ? " on" : "")} onClick={() => { setPreview(false); setShowCode(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            Edit
          </button>
          <button className={"tb" + (preview ? " on" : "")} onClick={() => { setPreview(true); setShowCode(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            Preview
          </button>
          <button className={"tb" + (showCode ? " on" : "")} onClick={() => { setShowCode(true); setPreview(false); }} style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            Jinja
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <button className={"ib" + (moveMode ? " on" : "")} onClick={() => setMoveMode(m => !m)} aria-pressed={moveMode} title="Move tool (V): drag any element. Elements inside a layout are pulled out and pinned where you drop them." style={{ marginRight: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg>
        </button>
        <button className="ib" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ marginRight: 8 }}>
          {theme === "dark" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--b3)", borderRadius: "var(--r4)", border: "1px solid var(--bd)", marginRight: 8 }}>
          <button onClick={() => setZoom(z => Math.max(.25, +(z - .1).toFixed(2)))} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>−</button>
          <span style={{ fontSize: 11, color: "var(--t1)", minWidth: 34, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + .1).toFixed(2)))} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>+</button>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 8 }} />
        <button className="tb" onClick={saveDesign} style={{ border: "1px solid var(--bd)", color: saveStatus === "saved" ? "var(--gn)" : saveStatus === "full" ? "var(--rd)" : undefined }}>
          {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : saveStatus === "full" ? "Not saved: browser storage is full" : "Save"}
        </button>
        <div style={{ position: "relative" }}>
          <button className={"tb" + (showExportMenu ? " on" : "")} onClick={() => setShowExportMenu(!showExportMenu)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>

          {showExportMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, width: 140, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)", zIndex: 1000, padding: 4 }} onMouseLeave={() => setShowExportMenu(false)}>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={handlePrint}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                As PDF
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={() => handleExportImage('png')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                As PNG
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={() => handleExportImage('jpg')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                As JPG
              </button>
              <div style={{ height: 1, background: "var(--bd)", margin: "4px 0" }} />
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={downloadJinja}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                As Jinja (HTML)
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={exportJSON}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                As Design (JSON)
              </button>
              {!FRAPPE && <>
                <div style={{ height: 1, background: "var(--bd)", margin: "4px 0" }} />
                <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={() => { setShowExportMenu(false); setShowPublish(true); }}>To an ERPNext site…</button>
              </>}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginInline: 8 }} />
        {FRAPPE ? <>
          <button className="tb" onClick={copy} style={{ border: "1px solid var(--bd)", marginRight: 8, minWidth: 84, justifyContent: "center" }}>
            {copied ? "Copied" : "Copy Jinja"}
          </button>
          <button onClick={() => setShowPublish(true)} title={printFormat ? "Published as " + printFormat : "Publish as a Print Format on " + FRAPPE.site} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--ac)", color: "#fff" }}>
            {printFormat ? "Update Print Format" : "Publish"}
          </button>
        </> : <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--ac)", color: "#fff", minWidth: 84, justifyContent: "center" }}>
          {copied ? "Copied" : "Copy Jinja"}
        </button>}
      </div>
      <Breadcrumb tree={tree} selected={sel} onSelect={setSel} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!preview && !showCode && <LeftPanel assets={assets} setAssets={setAssets} onAdd={addEl} onSetTrace={(src) => {
          updatePage(activePageIdx, { backgroundImg: src, bgOpacity: 0.3 });
          setSel(null); // Show page props
        }} onAddTemplate={(fn) => {
          const comps = fn();
          const root = comps[0];
          let updatedTree = treeAdd(tree, root, null, activePageIdx);
          for (let i = 1; i < comps.length; i++) {
            updatedTree.nodes[comps[i].id] = comps[i];
          }
          record(updatedTree);
          setSel(root.id);
        }} doctype={doctype} setDoctype={setDoctype} docFields={docFields} setDocFields={setDocFields} tree={tree} selected={sel} onSelect={setSel} penMode={penMode} setPenMode={setPenMode} onDrop={handleDrop} openTab={leftTab} />}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {FRAPPE && preview && isReport && (
            <div style={{ padding: "6px 12px", background: "var(--b1)", borderBottom: "1px solid var(--bd)", flexShrink: 0, fontSize: 11, color: "var(--t1)" }}>Report formats are filled in by the report itself. Publish, then use Print on the {doctype} report to see it with data.</div>
          )}
          {FRAPPE && preview && !isReport && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--b1)", borderBottom: "1px solid var(--bd)", flexShrink: 0, fontSize: 11, color: "var(--t1)" }}>
              <span>Preview with a real {doctype}</span>
              <input className="pi mono" list="pf-recent-docs" value={live.name} onChange={e => setLive(l => ({ ...l, name: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") renderLive(live.name); }} placeholder="Document name" style={{ width: 220 }} />
              <datalist id="pf-recent-docs">{live.recent.map(n => <option key={n} value={n} />)}</datalist>
              <button className="bcb" disabled={live.busy || !live.name.trim()} onClick={() => renderLive(live.name)}>{live.busy ? "Rendering" : "Render"}</button>
              <button className="bcb" disabled={live.busy || !live.name.trim()} onClick={() => renderLivePdf(live.name)}>PDF</button>
              {(live.result || live.pdf) && <button className="bcb" onClick={() => setLive(l => ({ ...l, result: null, pdf: null, error: "" }))}>Back to sample data</button>}
              {live.error && <span style={{ color: "var(--rd)" }}>{live.error}</span>}
              <div style={{ flex: 1 }} />
              {(live.result || live.pdf) && <span style={{ color: "var(--t2)" }}>{live.pdf ? "The PDF the site produces for this document" : "Rendered by the site, as the print view will show it"}</span>}
            </div>
          )}
          {FRAPPE && preview && !isReport && live.pdf && <iframe title="PDF preview" src={live.pdf} style={{ flex: 1, width: "100%", border: 0 }} />}
          {FRAPPE && preview && !isReport && !live.pdf && live.result && <iframe title="Print preview" srcDoc={live.result} style={{ flex: 1, width: "100%", border: 0, background: "#d1d8dd" }} />}
          {!preview && !showCode && showRulers && <Ruler type="h" zoom={zoom} scrollPos={scrollPos.x} mousePos={mousePos} />}
          <div style={{ display: FRAPPE && preview && !isReport && (live.result || live.pdf) ? "none" : "flex", flex: 1, overflow: "hidden" }}>
            {!preview && !showCode && showRulers && <Ruler type="v" zoom={zoom} scrollPos={scrollPos.y} mousePos={mousePos} />}

            <div className="cv" onScroll={handleScroll} style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 40, position: "relative" }} onClick={() => setSel(null)}>
              {showCode
                ? <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
                  <pre style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7, color: "var(--t0)", whiteSpace: "pre-wrap", padding: 4 }}>
                    {jinja.split("\n").map((line, i) => (
                      <div key={i} style={{ display: "flex" }}>
                        <span style={{ minWidth: 36, color: "var(--t2)", userSelect: "none", fontSize: 10, paddingTop: 1, textAlign: "right", paddingRight: 16 }}>{i + 1}</span>
                        <span style={{ color: line.startsWith("{%") ? "var(--gn)" : line.includes("{{") ? "var(--ac)" : line.startsWith("<") ? "var(--t1)" : "var(--t0)" }}>{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>
                : <div style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 60,
                  padding: "100px 0 200px 0",
                  transform: isPrinting ? "none" : "scale(" + zoom + ")",
                  transformOrigin: "top center",
                  transition: "transform .15s"
                }}>
                  {!preview && !showCode && !isPrinting && showGrid && (
                    <div className="pf-grid" style={{
                      position: "absolute",
                      inset: "-3000px",
                      "--gc": "var(--bd)",
                      "--gs": gridSize + "px",
                      backgroundPosition: `calc(50% - ${pg.w / 2}px) 100px`,
                      zIndex: -1
                    }} />
                  )}
                  {penMode === 'drawing' && (
                    <div
                      onMouseDown={handlePenMouseDown}
                      onMouseMove={handlePenMouseMove}
                      onMouseUp={handlePenMouseUp}
                      style={{ position: "absolute", inset: "-2000px", zIndex: 2000, cursor: "crosshair" }}
                    >
                      <svg style={{ width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
                        <g transform="translate(2000, 2000)">
                          <path d={getPathData(activePathPoints)} fill="none" stroke="var(--ac)" strokeWidth="2" strokeDasharray="4 2" />
                          {activePathPoints.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="var(--b1)" stroke="var(--ac)" strokeWidth="1.5" />
                              {isDrawing && dragPointIdx === i && (
                                <>
                                  <line x1={p.c1.x} y1={p.c1.y} x2={p.c2.x} y2={p.c2.y} stroke="var(--t2)" strokeWidth="1" strokeDasharray="2" />
                                  <circle cx={p.c1.x} cy={p.c1.y} r="3" fill="var(--ac)" opacity=".5" />
                                  <circle cx={p.c2.x} cy={p.c2.y} r="3" fill="var(--ac)" />
                                </>
                              )}
                            </g>
                          ))}
                        </g>
                      </svg>
                    </div>
                  )}
                  {tree.pages.map((page, pidx) => (
                    <div key={page.id} style={{ flexShrink: 0, position: "relative" }}>
                      {!isPrinting && <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 6, display: "flex", justifyContent: "space-between", paddingInline: 2 }}>
                        <span>{settings.pageSize} {settings.orientation.toLowerCase()} · {pg.w}x{pg.h}px · {page.name}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={(e) => { e.stopPropagation(); dupPage(pidx); }} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 9 }}>Duplicate</button>
                          {tree.pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); delPage(pidx); }} style={{ background: "none", border: "none", color: "var(--rd)", cursor: "pointer", fontSize: 9 }}>Delete</button>}
                        </div>
                      </div>}
                      <div
                        ref={pidx === 0 ? printRef : null}
                        className="pf-print-area"
                        onMouseDown={() => setActivePageIdx(pidx)}
                        style={{ position: "relative", width: pg.w, minHeight: pg.h, ...(settings.font ? { fontFamily: settings.font } : {}), background: "#ffffff", boxShadow: isPrinting ? "none" : "0 0 0 1px rgba(0,0,0,.1),0 2px 8px rgba(0,0,0,.12)", padding: page.padding ?? 40, display: "flex", flexDirection: "column", outline: !preview && !showCode && activePageIdx === pidx ? "1px solid var(--ac)" : "none" }}
                        onClick={e => { if (e.target === e.currentTarget) setSel(null); }}
                        onContextMenu={e => { if (preview || showCode) return; e.preventDefault(); openContextMenu(e, null); }}>
                        {!preview && !showCode && !isPrinting && showGrid && (
                          <div className="pf-grid" style={{ "--gc": "rgba(0,0,0,.04)", "--gs": gridSize + "px" }} />
                        )}
                        {!preview && !showCode && !isPrinting && (
                          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                            {Array.from({ length: 12 }, (_, k) => <div key={k} title="Roughly where a printed page ends" style={{ position: "absolute", left: 0, right: 0, top: (page.padding ?? 40) + (k + 1) * contentH, borderTop: "1px dashed rgba(217,72,77,.6)" }} />)}
                          </div>
                        )}
                        {page?.backgroundImg && !isPrinting && (
                          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: page.bgOpacity ?? 0.3 }}>
                            <img src={page.backgroundImg} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                        )}
                        {page.roots.map(id => <CNode key={id} nodeId={id} tree={tree} selected={sel} onSelect={setSel} onUpdate={updateEl} onDrop={handleDrop} zoom={zoom} depth={0} flow={true} preview={preview} onActive={() => setActivePageIdx(pidx)} pageIdx={pidx} onGuides={setActiveGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} moveMode={moveMode} onDetach={detachToFree} onContextMenu={openContextMenu} gesture={gesture} />)}
                        {!preview && !showCode && !isPrinting && page.roots.length === 0 && <EmptyState onGallery={() => setShowGallery(true)} />}
                        {activePageIdx === pidx && <SmartGuides guides={activeGuides} />}
                      </div>
                    </div>
                  ))}
                  {!preview && !showCode && !isPrinting && (
                    <button onClick={addPage} style={{ margin: "20px 0 60px 0", padding: "8px 16px", background: "transparent", border: "1px dashed var(--bh)", color: "var(--t1)", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      Add page
                    </button>
                  )}
                </div>}
            </div>
          </div>
        </div>

        {!showCode && !preview && <div style={{ width: 258, background: "var(--b1)", borderLeft: "1px solid var(--bd)", overflowY: "auto", flexShrink: 0 }}>
          <Props
            tree={tree} selected={sel} docFields={docFields} onUpdate={updateEl} onDelete={deleteEl} onDup={dupEl} onZOrder={zOrder} onAddChild={addChild}
            showRulers={showRulers} setShowRulers={setShowRulers} showGrid={showGrid} setShowGrid={setShowGrid} gridSize={gridSize} setGridSize={setGridSize}
            activePageIdx={activePageIdx} onUpdatePage={updatePage} onUpdateSettings={updateSettings}
            penMode={penMode} setPenMode={setPenMode}
            selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx}
          />
        </div>}
      </div>
      <div style={{ height: 22, background: "var(--b0)", borderTop: "1px solid var(--bd)", display: "flex", alignItems: "center", paddingInline: 12, gap: 16, flexShrink: 0, fontSize: 10, color: "var(--t2)" }}>
        <span>{doctype}</span>
        {storageFull && <span style={{ color: "var(--rd)" }}>Not being autosaved in this browser: storage is full. {FRAPPE ? "Publish" : "Export as JSON"} to keep your work.</span>}
        <span>{Object.keys(tree.nodes).length} elements</span>
        <div style={{ flex: 1 }} />
        <span>A4 · wkhtmltopdf</span>
      </div>
      {showGallery && <TemplateGallery onCancel={() => setShowGallery(false)} onSelect={applyTemplate} />}
      {showPalette && <CommandPalette commands={commands} onCancel={() => setShowPalette(false)} />}
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      {snackbar && <UndoSnackbar message={snackbar.message} onUndo={() => { undo(); setSnackbar(null); }} onDismiss={() => setSnackbar(null)} />}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      {!seenTips && !showNewModal && !showGallery && <Tips onDismiss={() => { setSeenTips(true); remember("pf_tips", "seen"); }} />}
      {showNewModal && <NewDesignModal onCancel={() => setShowNewModal(false)} onCreate={handleCreateNew} />}
      {showHistoryModal && <DesignHistoryModal onCancel={() => setShowHistoryModal(false)} onLoad={loadDesign} onDelete={deleteSaved} onLoadSite={loadSiteDesign} />}
      {showPublish && FRAPPE && <PublishModal doctype={doctype} isReport={isReport} initialName={printFormat} onCancel={() => setShowPublish(false)} onPublish={publish} validate={name => validateDesign(tree, doctype, docFields, jinja, name)} />}
      {showPublish && !FRAPPE && <StandalonePublishModal doctype={doctype} isReport={isReport} html={jinja} marginMm={marginMm(tree)} issues={validateDesign(tree, doctype, docFields, jinja, "x")} onClose={() => setShowPublish(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorGuardian>
      <MainApp />
    </ErrorGuardian>
  );
}

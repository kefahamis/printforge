import { useState } from 'react';
import { getPathData } from '../exporter.js';
import { snap, dc, isDesc, SAMPLE_DATA, subst, COMPANY_LOGO_EXPR } from '../tree.js';
import { calcGuidesFast } from '../guidesEngine.js';
import { FakeQR, FakeBars } from './atoms.jsx';

// ── Resize handles ────────────────────────────────────────────────────────────
// A drag or resize updates the design on every frame without recording history, then
// commits once on release, so the whole gesture is a single undo step.
export function RH({ el, onUpdate, zoom, preview, tree, pageIdx, onGuides, gesture }) {
  const mk = dir => e => {
    e.stopPropagation();
    e.preventDefault();
    const ox = e.clientX, oy = e.clientY, { x: ix, y: iy, w: iw, h: ih } = el;
    let last = null, frame = 0;
    const scaled = (nw, nh) => el.type === 'path' ? {
      points: (el.points || []).map(p => ({
        x: p.x * nw / iw, y: p.y * nh / ih,
        c1: { x: p.c1.x * nw / iw, y: p.c1.y * nh / ih },
        c2: { x: p.c2.x * nw / iw, y: p.c2.y * nh / ih }
      }))
    } : {};
    const mv = ev => {
      const dx = (ev.clientX - ox) / zoom, dy = (ev.clientY - oy) / zoom;
      let nx = ix, ny = iy, nw = iw, nh = ih;
      if (dir.includes("e")) nw = Math.max(20, iw + dx);
      if (dir.includes("s")) nh = Math.max(8, ih + dy);
      if (dir.includes("w")) { nw = Math.max(20, iw - dx); nx = ix + (iw - nw); }
      if (dir.includes("n")) { nh = Math.max(8, ih - dy); ny = iy + (ih - nh); }
      if (!last && gesture) gesture.begin();
      last = { x: nx, y: ny, w: nw, h: nh };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        onUpdate(el.id, { ...last, ...scaled(last.w, last.h) }, true);
        if (onGuides) onGuides(calcGuidesFast(tree, el.id, last, pageIdx));
      });
    };
    const up = () => {
      cancelAnimationFrame(frame);
      if (onGuides) onGuides({ h: [], v: [] });
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
      if (!last) return;
      const w = snap(last.w), h = snap(last.h);
      onUpdate(el.id, { x: snap(last.x), y: snap(last.y), w, h, ...scaled(w, h) });
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  return <>{preview ? null : ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(d => <div key={d} className={"rh rh-" + d} onMouseDown={mk(d)} />)}</>;
}

// ── Canvas node ───────────────────────────────────────────────────────────────
export function CNode({ nodeId, tree, selected, multi = [], onSelect, onUpdate, onDrop, zoom, depth, flow, preview, onActive, pageIdx, onGuides, penMode, setPenMode, editPointIdx, setEditPointIdx, selPointIdx, setSelPointIdx, editHandle, setEditHandle, moveMode, onDetach, onContextMenu, gesture }) {
  const [over, setOver] = useState(false);
  const el = tree.nodes[nodeId];
  if (!el) return null;

  const isPrimary = selected === nodeId;
  const isSel = isPrimary || multi.includes(nodeId);
  const isCont = el.type === "container";
  const isEmpty = isCont && (el.children || []).length === 0;
  const isFlow = el.mode === "flow";
  const color = dc(depth);

  // `detached`: the Move tool has just pulled this element out of its container; the
  // tree in this closure predates that, so guides are skipped and the drop always commits.
  const startDrag = (e, ex, ey, detached = false) => {
    const ox = e.clientX, oy = e.clientY;
    let last = null, frame = 0;
    const mv = ev => {
      if (!last && gesture) gesture.begin();
      last = { x: ex + (ev.clientX - ox) / zoom, y: ey + (ev.clientY - oy) / zoom };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        onUpdate(nodeId, last, true);
        if (onGuides && !detached) onGuides(calcGuidesFast(tree, nodeId, { ...last, w: el.w, h: el.h }, pageIdx));
      });
    };
    const up = () => {
      cancelAnimationFrame(frame);
      if (onGuides) onGuides({ h: [], v: [] });
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
      if (last || detached) onUpdate(nodeId, { x: snap((last || { x: ex }).x), y: snap((last || { y: ey }).y) });
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };

  const pinned = !!el._free;
  const onMD = e => {
    if (preview || e.button === 2 || e.target.classList.contains("rh")) return;
    e.stopPropagation(); onSelect(nodeId, e);
    if (onActive) onActive();
    // Shift+click only adds to or removes from the selection
    if (e.shiftKey) return;
    if (flow && !pinned) {
      if (!moveMode || !onDetach) return;
      // Move tool: pull the element out of the flow and pin it where it currently sits on the page
      const host = e.currentTarget, pageEl = host.closest('.pf-print-area');
      if (!pageEl) return;
      const hr = host.getBoundingClientRect(), pr = pageEl.getBoundingClientRect();
      const gx = (hr.left - pr.left) / zoom, gy = (hr.top - pr.top) / zoom;
      onDetach(nodeId, gx, gy);
      startDrag(e, gx, gy, true);
      return;
    }
    startDrag(e, el.x || 0, el.y || 0);
  };

  const label = (el.type === "container" ? (el.layout || "container") + " (" + ((el.children || []).length) + ")" : (el.type || "element")) + (el.repeatFor ? " · each " + el.repeatFor : "");

  // Natural Flow Logic for Canvas View
  const isRoot = tree.pages.some(p => (p.roots || []).includes(nodeId));
  const isFlowWrapper = (isRoot || flow) && !pinned;
  const isShape = ["rect", "circle", "triangle", "line", "image", "qr", "barcode"].includes(el.type);

  const baseStyle = isFlowWrapper
    ? { position: "relative", cursor: "move", userSelect: "none", flexShrink: 0, width: isRoot && !isShape ? "100%" : el.w, ...(el.margin != null ? { margin: el.margin } : {}) }
    : { position: "absolute", left: el.x, top: el.y, width: el.w, cursor: "move", userSelect: "none", ...(pinned ? { zIndex: 2 } : {}) };

  let body = null;
  const canHold = ["container", "rect", "circle", "triangle"].includes(el.type);
  const layoutStyles = el.layout === "flex" ? { display: "flex", flexDirection: el.flexDir, flexWrap: el.flexWrap, justifyContent: el.justifyContent, alignItems: el.alignItems, gap: el.gap } : el.layout === "grid" ? { display: "grid", gridTemplateColumns: el.gridCols, columnGap: el.colGap, rowGap: el.rowGap } : {};

  if (el.type === "text") {
    const txt = (preview ? subst(el.content) : el.content) + (!el.isRich && (el.content2 || "").trim() ? " / " + el.content2.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;") : "");
    body = <div dangerouslySetInnerHTML={{ __html: txt }} style={{ minHeight: el.h, fontSize: el.isRich ? "inherit" : el.fontSize, fontWeight: el.isRich ? "inherit" : el.fontWeight, color: el.isRich ? "inherit" : el.color, textAlign: el.isRich ? "inherit" : el.align, fontStyle: el.isRich ? "inherit" : (el.italic ? "italic" : "normal"), lineHeight: el.isRich ? "inherit" : el.lineHeight, background: el.bg, padding: el.padding, borderRadius: el.borderRadius, whiteSpace: el.isRich ? "normal" : "pre-wrap", overflow: "hidden", wordBreak: "break-word", ...(flow ? { width: "100%" } : {}) }} />;
  } else if (el.type === "rect") {
    body = (
      <div style={{ height: "100%", background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px " + (el.style || "solid") + " " + el.stroke : "none", borderRadius: el.borderRadius, opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} multi={multi} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} moveMode={moveMode} onDetach={onDetach} onContextMenu={onContextMenu} gesture={gesture} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "circle") {
    body = (
      <div style={{ height: "100%", background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px " + (el.style || "solid") + " " + el.stroke : "none", borderRadius: "50%", opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} multi={multi} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} moveMode={moveMode} onDetach={onDetach} onContextMenu={onContextMenu} gesture={gesture} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "triangle") {
    body = (
      <div style={{ height: "100%", background: el.fill, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} multi={multi} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} moveMode={moveMode} onDetach={onDetach} onContextMenu={onContextMenu} gesture={gesture} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "path") {
    body = (
      <div style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <svg width={el.w} height={el.h} viewBox={`0 0 ${el.w} ${el.h}`} style={{ width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
          <path d={getPathData(el.points, el.closed)} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} opacity={el.opacity} />
        </svg>
      </div>
    );
  } else if (el.type === "line") {
    body = <div style={{ borderTop: el.thickness + "px " + (el.style || "solid") + " " + el.color }} />;
  } else if (el.type === "image") {
    const showCustom = el.logoType === "custom" && el.customUrl;
    body = preview ? (
      <div style={{ height: el.h, background: el.fallbackBg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {showCustom ? <img src={el.customUrl} style={{ width: "100%", height: "100%", objectFit: el.objectFit }} /> : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1" opacity=".2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        )}
      </div>
    ) : (
      <div style={{ height: el.h, background: el.fallbackBg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6, border: "1px dashed #c4c4c4", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        {showCustom ? <img src={el.customUrl} style={{ width: "100%", height: "100%", objectFit: el.objectFit, opacity: .6 }} /> : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        )}
        <span style={{ fontSize: 9, color: "#666", fontFamily: "var(--mono)", background: "rgba(255,255,255,.8)", padding: "2px 4px", borderRadius: 3, position: "relative", zIndex: 1 }}>{el.logoType !== "company" ? "Custom image" : el.jinjaExpr === COMPANY_LOGO_EXPR ? "Company logo" : el.jinjaExpr}</span>
      </div>
    );
  } else if (el.type === "shared") {
    body = <div style={{ minHeight: el.h, border: "1px dashed #9a8fb0", background: "rgba(127,90,200,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6b5bd2", fontFamily: "var(--mono)" }}>{preview ? "" : "shared block: " + (el.block || "none")}</div>;
  } else if (el.type === "qr") {
    body = <div style={{ height: el.h, display: "flex" }}><FakeQR size={Math.min(el.w, el.h)} /></div>;
  } else if (el.type === "barcode") {
    body = <div style={{ height: el.h, overflow: "hidden" }}><FakeBars w={el.w} h={el.h} text={el.showText === false ? "" : (el.source === "text" ? el.value : preview ? subst("{{ " + el.value + " }}") : el.value)} /></div>;
  } else if (el.type === "table") {
    const cols = el.columns || [];
    const rows = preview ? SAMPLE_DATA.items : [{}, {}, {}];
    body = (
      <div style={{ overflow: "hidden", height: el.h }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead><tr style={{ background: el.headerBg, color: el.headerColor }}>
            {cols.map((c, i) => c ? <th key={c.id || i} style={{ width: c.width, textAlign: c.align, padding: "7px 10px", fontSize: el.headerFontSize, fontWeight: 600 }}>{c.label}{(c.label2 || "").trim() ? " / " + c.label2.trim() : ""}</th> : null)}
          </tr></thead>
          <tbody>{rows.map((row, i) => <tr key={i} style={{ background: i % 2 === 0 ? el.rowBg : el.rowAltBg }}>
            {cols.map((c, j) => c ? (
              <td key={c.id || j} style={{ textAlign: c.align, padding: "6px 10px", fontSize: el.fontSize, color: el.rowColor, borderBottom: "1px solid " + el.borderColor }}>
                {preview && !c.kind ? subst("{{item." + c.field + "}}", row) : <span style={{ opacity: .3, fontSize: 9, fontFamily: "var(--mono)" }}>{c.kind === "calc" ? "= " + (c.expr || "") : c.kind === "image" ? "image: " + c.field : c.kind === "barcode" ? "barcode: " + c.field : "item." + c.field}</span>}
              </td>
            ) : null)}
          </tr>)}
            {(el.footerRows || []).map((fr, i) => <tr key={"f" + i}>
              {cols.length > 1 && <td colSpan={cols.length - 1} style={{ textAlign: "right", padding: "6px 10px", fontSize: el.fontSize, color: el.rowColor, fontWeight: 600 }}>{fr.label}</td>}
              <td style={{ textAlign: "right", padding: "6px 10px", fontSize: el.fontSize, color: el.rowColor, fontWeight: 600 }}>{preview ? subst("{{ " + fr.expr + " }}") : <span style={{ opacity: .5, fontSize: 9, fontFamily: "var(--mono)" }}>{fr.expr}</span>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    );
  } else if (el.type === "container") {
    body = (
      <div style={{ height: flow ? "auto" : el.h, minHeight: el.h, background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px solid " + el.stroke : preview ? "none" : "1px dashed #d0d0d0", borderRadius: el.borderRadius, opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...(isFlow ? layoutStyles : {}) }}>
        {!preview && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: color, opacity: .4, pointerEvents: "none" }} />}
        {depth < 30 ? (el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} multi={multi} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={isFlow} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} moveMode={moveMode} onDetach={onDetach} onContextMenu={onContextMenu} gesture={gesture} />) : <div style={{ fontSize: 8, color: "red" }}>Max depth</div>}
        {!preview && <div className={"dz" + (over ? " over" : isEmpty ? " hint" : "")} />}
        {isEmpty && !over && !preview && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          <span style={{ fontSize: 9, color: "#9a9a9a", fontFamily: "var(--mono)" }}>drop here</span>
        </div>}
      </div>
    );
  }

  return (
    <div className={"elw" + (isSel && !preview ? " sel" : "")} data-pf-node={nodeId} style={{ ...baseStyle, ...(el.hidden ? (preview ? { display: "none" } : { opacity: .25 }) : {}), ...(el.locked && !preview ? { pointerEvents: "none" } : {}) }}
      onMouseDown={onMD}
      onContextMenu={e => { if (preview || !onContextMenu) return; e.preventDefault(); e.stopPropagation(); onSelect(nodeId); onContextMenu(e, nodeId); }}
      onClick={e => e.stopPropagation()}
      onDragOver={e => { if (!canHold || preview) return; e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { if (!canHold || preview) return; e.preventDefault(); e.stopPropagation(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id && id !== nodeId && !isDesc(tree.nodes, id, nodeId)) onDrop(id, nodeId); }}
      draggable={!flow && !preview && !moveMode && !pinned}
      onDragStart={e => { if (preview) return; e.dataTransfer.setData("text/plain", nodeId); e.stopPropagation(); }}>
      {!preview && <div className="chip" style={{ background: color }}>{label}</div>}
      {body}
      {selected && penMode === 'editing' && el.type === 'path' && (
        <svg style={{ position: "absolute", inset: 0, width: el.w, height: el.h, overflow: "visible", pointerEvents: "none", zIndex: 1000 }}>
          {el.points.map((p, i) => (
            <g key={i}>
              <line x1={p.x} y1={p.y} x2={p.c1.x} y2={p.c1.y} stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeDasharray="2" />
              <line x1={p.x} y1={p.y} x2={p.c2.x} y2={p.c2.y} stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeDasharray="2" />
              <circle cx={p.x} cy={p.y} r={selPointIdx === i ? "5" : "4"} fill={selPointIdx === i ? "var(--rd)" : "var(--ac)"} stroke={selPointIdx === i ? "#fff" : "none"} strokeWidth="1.5" style={{ pointerEvents: "auto", cursor: "move" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('p'); }} />
              <circle cx={p.c1.x} cy={p.c1.y} r="3" fill="#fff" stroke="var(--ac)" strokeWidth="1" style={{ pointerEvents: "auto", cursor: "crosshair" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('c1'); }} />
              <circle cx={p.c2.x} cy={p.c2.y} r="3" fill="#fff" stroke="var(--ac)" strokeWidth="1" style={{ pointerEvents: "auto", cursor: "crosshair" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('c2'); }} />
            </g>
          ))}
        </svg>
      )}
      {isSel && !preview && !penMode && <div className="sel-ring" style={{ borderColor: color }} />}
      {isPrimary && !multi.length && !preview && <RH el={el} onUpdate={onUpdate} zoom={zoom} preview={preview} tree={tree} pageIdx={pageIdx} onGuides={onGuides} gesture={gesture} />}
    </div>
  );
}

export function Ruler({ type, zoom, scrollPos, mousePos }) {
  const isH = type === 'h';
  const len = isH ? 1200 : 1600; // Large enough to cover scroll
  const step = 100;
  const subticks = 10;

  const markers = [];
  for (let i = 0; i <= len; i += step / subticks) {
    const isMajor = i % step === 0;
    const pos = i * zoom;
    markers.push(
      <div key={i} className="pf-ruler-marker" style={{
        [isH ? 'left' : 'top']: pos,
        [isH ? 'width' : 'height']: 1,
        [isH ? 'height' : 'width']: isMajor ? 8 : 4,
        [isH ? 'bottom' : 'right']: 0
      }} />
    );
    if (isMajor) {
      markers.push(
        <div key={i + 'l'} className="pf-ruler-label" style={{
          [isH ? 'left' : 'top']: pos + 3,
          [isH ? 'bottom' : 'right']: 2
        }}>{i}</div>
      );
    }
  }

  return (
    <div className={`pf-ruler pf-ruler-${type}`} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative', [isH ? 'width' : 'height']: len * zoom, [isH ? 'height' : 'width']: '100%', transform: `translate${isH ? 'X' : 'Y'}(${-scrollPos}px)` }}>
        {markers}
      </div>
    </div>
  );
}

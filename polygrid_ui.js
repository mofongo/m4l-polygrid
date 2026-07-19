// polygrid_ui.js — jsui renderer for the polygrid polymeter sequencer.
// Max jsui (ES5). Renders 4 tracks per "page" (stack) of the 8-track state.
// Task 4 = render only. Interaction (clicks/drag) added in Task 5.

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

// one outlet: tagged messages (edit <track>, mute <track> <v>, ...) routed in the patch
outlets = 1;

// ---- state (mirror of dict polygrid_state; seeded to defaults) ----
var NTRACK = 8;
var steps = [
	[1,0,0,0,0], [1,0,0], [1,0,0,0,0,0,0,0], [1,0,0,0],
	[1,0,0,0,0,0], [1,0,0,0,0,0,0], [1,0,0,0,0,0,0,0,0,0,0,0], [1,0]
];
var count  = [5,3,8,4,6,7,12,2];
var note   = [60,64,67,71,72,67,62,59];
var length = [1.0,0.5,1.0,0.5,0.75,1.0,1.0,0.5];
var offset = [0.0,0.0,0.0,0.25,0.0,0.0,0.0,0.5];
var mute   = [0,0,0,0,0,0,0,0];
var solo   = [0,0,0,0,0,0,0,0];
var playhead = [-1,-1,-1,-1,-1,-1,-1,-1];
var page = 0;        // 0 -> tracks 0..3, 1 -> tracks 4..7
var selected = -1;
var GRID = 16;

// ---- preset browser ----
var view = "grid";   // "grid" | "presets"
var presets = [];    // each: { name, tr: [ {note,steps,length,offset,mute,solo}, ...8 ] }
var selPreset = -1;

// ---- layout ----
var INFO_W = 92;
var PAD = 6;

var NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function noteName(n){ return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 2); }

function roundRect(x, y, w, h, r) {
	if (r > h/2) r = h/2;
	if (r > w/2) r = w/2;
	if (r < 0) r = 0;
	mgraphics.move_to(x+r, y);
	mgraphics.line_to(x+w-r, y);
	mgraphics.arc(x+w-r, y+r, r, -Math.PI/2, 0);
	mgraphics.line_to(x+w, y+h-r);
	mgraphics.arc(x+w-r, y+h-r, r, 0, Math.PI/2);
	mgraphics.line_to(x+r, y+h);
	mgraphics.arc(x+r, y+h-r, r, Math.PI/2, Math.PI);
	mgraphics.line_to(x, y+r);
	mgraphics.arc(x+r, y+r, r, Math.PI, Math.PI*1.5);
	mgraphics.close_path();
}

function paint() {
	var w = this.box.rect[2] - this.box.rect[0];
	var h = this.box.rect[3] - this.box.rect[1];

	// background
	mgraphics.set_source_rgba(0.086, 0.086, 0.094, 1);
	mgraphics.rectangle(0, 0, w, h);
	mgraphics.fill();

	if (view == "presets") { paintGallery(w, h); return; }

	var rowH = h / 4;
	var laneX = INFO_W;
	var laneW = w - INFO_W - PAD;
	if (laneW < 10) laneW = 10;
	var cellW = laneW / GRID;

	var anySolo = false;
	for (var k = 0; k < NTRACK; k++) { if (solo[k]) { anySolo = true; break; } }

	for (var r = 0; r < 4; r++) {
		var ti = page * 4 + r;
		var y = r * rowH;
		var muted = (mute[ti] == 1);
		var dimmed = muted || (anySolo && solo[ti] == 0);   // not audible -> dim

		// row separator
		if (r > 0) {
			mgraphics.set_source_rgba(0.047, 0.047, 0.055, 1);
			mgraphics.rectangle(0, y-1, w, 2);
			mgraphics.fill();
		}

		// mute square
		var msz = 16;
		var mx = 6, my = y + rowH/2 - msz/2;
		if (muted) mgraphics.set_source_rgba(1.0, 0.6, 0.1, 1);
		else mgraphics.set_source_rgba(0.14, 0.10, 0.05, 1);
		roundRect(mx, my, msz, msz, 4);
		mgraphics.fill();

		// solo indicator (small cream dot in the gap before the label)
		if (solo[ti]) {
			mgraphics.set_source_rgba(0.95, 0.92, 0.83, 1);
			mgraphics.ellipse(mx + msz + 1, my + msz/2 - 2, 4, 4);
			mgraphics.fill();
		}

		// note label
		mgraphics.set_source_rgba(0.85, 0.85, 0.87, 1);
		mgraphics.select_font_face("Arial");
		mgraphics.set_font_size(10);
		mgraphics.move_to(mx + msz + 8, y + rowH/2 + 3);
		mgraphics.show_text(noteName(note[ti]) + "  " + count[ti]);

		// grid lines
		mgraphics.set_source_rgba(1, 1, 1, 0.05);
		for (var g = 1; g < GRID; g++) {
			mgraphics.rectangle(laneX + g*cellW, y+PAD, 1, rowH-2*PAD);
			mgraphics.fill();
		}

		// pill block
		var blkX = laneX + offset[ti]*laneW;
		var blkW = length[ti]*laneW;
		var n = count[ti];
		var gap = 2;
		var pillW = (blkW - (n-1)*gap) / n;
		if (pillW < 1) pillW = 1;
		var pillH = rowH - 2*PAD - 4;
		var pillY = y + PAD + 2;
		for (var s = 0; s < n; s++) {
			var px = blkX + s*(pillW+gap);
			var on = (steps[ti][s] == 1);
			var head = (playhead[ti] == s);
			if (head && on) mgraphics.set_source_rgba(0.95, 0.92, 0.83, 1);
			else if (head) mgraphics.set_source_rgba(0.27, 0.27, 0.29, 1);
			else if (on) mgraphics.set_source_rgba(dimmed?0.36:1.0, dimmed?0.25:0.6, dimmed?0.09:0.1, 1);
			else mgraphics.set_source_rgba(dimmed?0.10:0.2, dimmed?0.10:0.2, dimmed?0.11:0.2, 1);
			roundRect(px, pillY, pillW, pillH, 4);
			mgraphics.fill();
		}

		// selection outline
		if (selected == ti) {
			mgraphics.set_source_rgba(0.95, 0.92, 0.83, 1);
			mgraphics.set_line_width(1.5);
			roundRect(blkX-2, pillY-2, blkW+4, pillH+4, 5);
			mgraphics.stroke();
		}
	}
}

// ---- preset gallery rendering ----
// Shared tile geometry for paint + hit-test. Tiles shrink so every preset is
// always visible: 4 cols up to 8 presets (4x2), then more cols, then more rows.
function galleryLayout(w, h, n) {
	var pad = 6;
	var cols = (n <= 8) ? 4 : Math.min(8, Math.ceil(n / 2));
	var rows = Math.max(1, Math.ceil(n / cols));
	var tileH = (h - pad * (rows + 1)) / rows;
	return {
		pad: pad, cols: cols, rows: rows,
		tileW: (w - pad * (cols + 1)) / cols,
		tileH: tileH,
		xs: Math.max(9, Math.min(14, tileH - 4))   // per-tile delete button size
	};
}

function paintGallery(w, h) {
	if (presets.length == 0) {
		mgraphics.set_source_rgba(0.5, 0.5, 0.5, 1);
		mgraphics.select_font_face("Arial");
		mgraphics.set_font_size(11);
		mgraphics.move_to(14, 26);
		mgraphics.show_text("No presets yet — hit Save to capture the current grid.");
		return;
	}
	var L = galleryLayout(w, h, presets.length);
	var tileW = L.tileW, tileH = L.tileH, pad = L.pad;
	var showLabel = tileH >= 30;
	for (var i = 0; i < presets.length; i++) {
		var cx = pad + (i % L.cols) * (tileW + pad);
		var cy = pad + Math.floor(i / L.cols) * (tileH + pad);
		if (i == selPreset) mgraphics.set_source_rgba(0.14, 0.10, 0.04, 1);
		else mgraphics.set_source_rgba(0.11, 0.11, 0.12, 1);
		roundRect(cx, cy, tileW, tileH, 6);
		mgraphics.fill();
		if (i == selPreset) {
			mgraphics.set_source_rgba(1.0, 0.6, 0.1, 1);
			mgraphics.set_line_width(1.5);
			roundRect(cx, cy, tileW, tileH, 6);
			mgraphics.stroke();
		}
		var p = presets[i];
		var trH = (tileH - (showLabel ? 20 : 8)) / NTRACK;
		var laneW = tileW - 10;
		for (var t = 0; t < NTRACK; t++) {
			var st = p.tr[t];
			var ry = cy + 4 + t * trH;
			var bx = cx + 5 + st.offset * laneW;
			var bw = st.length * laneW;
			var nn = st.steps.length;
			var pw = bw / nn;
			for (var s2 = 0; s2 < nn; s2++) {
				if (st.steps[s2]) mgraphics.set_source_rgba(1.0, 0.6, 0.1, 1);
				else mgraphics.set_source_rgba(0.22, 0.22, 0.23, 1);
				mgraphics.rectangle(bx + s2*pw, ry, (pw > 1 ? pw-0.5 : pw), trH-0.5);
				mgraphics.fill();
			}
		}
		if (showLabel) {
			mgraphics.set_source_rgba(0.85, 0.85, 0.87, 1);
			mgraphics.select_font_face("Arial");
			mgraphics.set_font_size(9);
			mgraphics.move_to(cx + 5, cy + tileH - 6);
			mgraphics.show_text(p.name);
		}
		var xs = L.xs;
		var xx = cx + tileW - xs - 3, xy = cy + 3;
		mgraphics.set_source_rgba(0, 0, 0, 0.55);
		roundRect(xx, xy, xs, xs, 3);
		mgraphics.fill();
		mgraphics.set_source_rgba(0.72, 0.72, 0.74, 1);
		mgraphics.set_line_width(1.2);
		var g = xs * 0.28;
		mgraphics.move_to(xx + g, xy + g); mgraphics.line_to(xx + xs - g, xy + xs - g);
		mgraphics.move_to(xx + xs - g, xy + g); mgraphics.line_to(xx + g, xy + xs - g);
		mgraphics.stroke();
	}
}

// ---- preset ops ----
function setview(v) { view = v; mgraphics.redraw(); }
function snapshotState() {
	var tr = [];
	for (var i = 0; i < NTRACK; i++)
		tr.push({ note: note[i], steps: steps[i].slice(), length: length[i], offset: offset[i], mute: mute[i], solo: solo[i] });
	return tr;
}
function savepreset() {
	presets.push({ name: "preset " + (presets.length + 1), tr: snapshotState() });
	selPreset = presets.length - 1;
	view = "presets";
	persist();
	mgraphics.redraw();
}
function loadpreset(idx) {
	if (idx < 0 || idx >= presets.length) return;
	var p = presets[idx];
	for (var i = 0; i < NTRACK; i++) {
		var t = p.tr[i];
		note[i] = t.note; steps[i] = t.steps.slice();
		length[i] = t.length; offset[i] = t.offset;
		mute[i] = t.mute; solo[i] = t.solo;
		count[i] = steps[i].length;
		emitPoly(i);
	}
	selPreset = idx;
	view = "grid";
	persist();
	mgraphics.redraw();
}
function loadsel() { loadpreset(selPreset); }
function delpreset() {
	if (selPreset < 0 || selPreset >= presets.length) return;
	presets.splice(selPreset, 1);
	if (selPreset >= presets.length) selPreset = presets.length - 1;
	persist();
	mgraphics.redraw();
}

// ---- persistence ----
// Two layers:
//  1. dict polygrid_state @embed 1 — device-level defaults, saved only when the
//     .amxd itself is saved in Max. NOT saved with the Live set.
//  2. "blob <json>" out the outlet → pattr polygrid_save (@parameter_enable,
//     stored-only) — per-Live-set state. pattr autorestores on set load and the
//     patch feeds it back in as "restoreblob <json>". The pattr layer wins:
//     once a blob has been restored, the (earlier-saved, device-level) dict
//     restore is skipped so it can't stomp per-set state.
var blobLoaded = false;

function persist() {
	try {
		var blob = JSON.stringify({ tracks: snapshotState(), presets: presets });
		var d = new Dict("polygrid_state");
		d.clear();
		d.set("blob", blob);
		outlet(0, "blob", blob);
	} catch (e) { post("polygrid persist error: " + e + "\n"); }
}
function applyState(st) {
	if (st.tracks) {
		for (var i = 0; i < NTRACK && i < st.tracks.length; i++) {
			var t = st.tracks[i];
			note[i] = t.note; steps[i] = t.steps.slice();
			length[i] = t.length; offset[i] = t.offset;
			mute[i] = t.mute; solo[i] = t.solo;
			count[i] = steps[i].length;
			emitPoly(i);
		}
	}
	if (st.presets) presets = st.presets;
	mgraphics.redraw();
}
function restore() {
	try {
		if (blobLoaded) return;               // per-set blob already applied; don't stomp it
		var d = new Dict("polygrid_state");
		var s = d.get("blob");
		if (!s) return;                       // nothing stored yet (first load)
		applyState(JSON.parse(s));
	} catch (e) { post("polygrid restore error: " + e + "\n"); }
}
function restoreblob(s) {
	try {
		if (!s || s === "") return;
		applyState(JSON.parse(s));
		blobLoaded = true;
	} catch (e) { post("polygrid restoreblob error: " + e + "\n"); }
}

// ---- inlet message handlers ----
// loadstate <track> <note> <mute> <solo> <count> <length> <offset> <s0 s1 ...>
function loadstate(t, nn, mu, so, cc, ln, of) {
	note[t] = nn; mute[t] = mu; solo[t] = so;
	count[t] = cc; length[t] = ln; offset[t] = of;
	var arr = [];
	for (var i = 7; i < arguments.length; i++) arr.push(arguments[i]);
	if (arr.length > 0) steps[t] = arr;
	mgraphics.redraw();
}
// ---- mouse interaction ----
// Returns [trackIndex, zone, stepIndex] for a pixel position.
// zone: "mute" | "info" | "pill" | "lane"
function hitTest(x, y) {
	var w = this.box.rect[2] - this.box.rect[0];
	var h = this.box.rect[3] - this.box.rect[1];
	var rowH = h / 4;
	var row = Math.floor(y / rowH);
	if (row < 0) row = 0;
	if (row > 3) row = 3;
	var ti = page * 4 + row;
	var y0 = row * rowH;

	if (x < INFO_W) {
		var msz = 16, mx = 6, my = y0 + rowH/2 - msz/2;
		if (x >= mx && x <= mx+msz && y >= my && y <= my+msz) return [ti, "mute", -1];
		return [ti, "info", -1];
	}

	var laneX = INFO_W;
	var laneW = w - INFO_W - PAD;
	var blkX = laneX + offset[ti]*laneW;
	var blkW = length[ti]*laneW;
	var n = count[ti];
	var gap = 2;
	var pillW = (blkW - (n-1)*gap) / n;
	var rel = x - blkX;
	if (rel >= 0 && x <= blkX + blkW) {
		var si = Math.floor(rel / (pillW + gap));
		if (si >= 0 && si < n) return [ti, "pill", si];
	}
	return [ti, "lane", -1];
}

// drag state (persists across onclick -> ondrag calls)
var dragTi = -1, dragMode = "", dragStartX = 0;
var dragStartOff = 0, dragStartLen = 0, dragRight = 0;
var dragToggledSi = -1, dragUndone = false;

function laneMetrics() {
	var w = this.box.rect[2] - this.box.rect[0];
	return { laneX: INFO_W, laneW: (w - INFO_W - PAD) };
}
function clampSnap(v, lo, hi) {
	v = Math.round(v * GRID) / GRID;    // snap to 1/16
	if (v < lo) v = lo;
	if (v > hi) v = hi;
	return v;
}
function emitPoly(t) { outlet(0, "poly", t, length[t], offset[t], count[t]); }

function onclick(x, y, but, cmd, shift, caps, option, ctrl) {
	if (view == "presets") {
		var w = this.box.rect[2] - this.box.rect[0];
		var h = this.box.rect[3] - this.box.rect[1];
		var L = galleryLayout(w, h, presets.length);
		var col = Math.floor((x - L.pad) / (L.tileW + L.pad));
		var row = Math.floor((y - L.pad) / (L.tileH + L.pad));
		if (col >= 0 && col < L.cols && row >= 0 && row < L.rows) {
			var idx = row * L.cols + col;
			if (idx >= 0 && idx < presets.length) {
				// corner ✕ deletes; hit-test it before the load fallthrough
				var cx = L.pad + col * (L.tileW + L.pad);
				var cy = L.pad + row * (L.tileH + L.pad);
				var xs = L.xs;
				if (x >= cx + L.tileW - xs - 5 && x <= cx + L.tileW - 1 &&
					y >= cy + 1 && y <= cy + xs + 5) {
					presets.splice(idx, 1);
					if (selPreset == idx) selPreset = -1;
					else if (selPreset > idx) selPreset--;
					persist();
					mgraphics.redraw();
				} else {
					loadpreset(idx);
				}
			}
		}
		return;
	}
	var hit = hitTest.call(this, x, y);
	dragTi = hit[0];
	var zone = hit[1], si = hit[2];
	selected = dragTi;
	dragStartX = x;
	dragStartOff = offset[dragTi];
	dragStartLen = length[dragTi];
	dragRight = offset[dragTi] + length[dragTi];
	dragToggledSi = -1;
	dragUndone = false;

	// determine drag mode by proximity to block edges
	dragMode = "";
	var m = laneMetrics.call(this);
	var blkX = m.laneX + offset[dragTi]*m.laneW;
	var blkW = length[dragTi]*m.laneW;
	var EDGE = 7;
	if (zone == "pill" || zone == "lane") {
		if (Math.abs(x - blkX) <= EDGE) dragMode = "resizeL";
		else if (Math.abs(x - (blkX+blkW)) <= EDGE) dragMode = "resizeR";
		else if (x >= blkX && x <= blkX+blkW) dragMode = "move";
	}

	// immediate click actions
	if (zone == "mute") {
		mute[dragTi] = mute[dragTi] ? 0 : 1;
		outlet(0, "mute", dragTi, mute[dragTi]);
	} else if (zone == "pill" && dragMode == "move") {
		steps[dragTi][si] = steps[dragTi][si] ? 0 : 1;
		dragToggledSi = si;
		outlet(0, "step", dragTi, si, steps[dragTi][si]);
	}
	outlet(0, "select", dragTi);
	persist();
	mgraphics.redraw();
}

function ondrag(x, y, but, cmd, shift, caps, option, ctrl) {
	if (but != 1) { dragMode = ""; return; }   // only act while button held
	if (dragTi < 0 || dragMode == "") return;
	var m = laneMetrics.call(this);
	var dx = (x - dragStartX) / m.laneW;
	var no = dragStartOff, nl = dragStartLen;
	if (dragMode == "resizeR") nl = clampSnap(dragStartLen + dx, 1/GRID, 1 - dragStartOff);
	else if (dragMode == "resizeL") { no = clampSnap(dragStartOff + dx, 0, dragRight - 1/GRID); nl = dragRight - no; }
	else if (dragMode == "move") no = clampSnap(dragStartOff + dx, 0, 1 - dragStartLen);

	if (no != offset[dragTi] || nl != length[dragTi]) {
		// a real move/resize: undo the mousedown pill-toggle once
		if (dragToggledSi >= 0 && !dragUndone) {
			steps[dragTi][dragToggledSi] = steps[dragTi][dragToggledSi] ? 0 : 1;
			outlet(0, "step", dragTi, dragToggledSi, steps[dragTi][dragToggledSi]);
			dragUndone = true;
		}
		offset[dragTi] = no;
		length[dragTi] = nl;
		emitPoly(dragTi);
		persist();
		mgraphics.redraw();
	}
}

function setstep(t, s) {
	playhead[t] = s;
	// MIDI gating (jsui is authoritative): emit a note when this step is active + audible
	if (s >= 0 && steps[t][s] == 1) {
		var anySolo = false;
		for (var i = 0; i < NTRACK; i++) { if (solo[i]) { anySolo = true; break; } }
		var audible = (mute[t] == 0) && (!anySolo || solo[t] == 1);
		if (audible) outlet(0, "note", note[t]);
	}
	mgraphics.redraw();
}
function select(t) { selected = t; mgraphics.redraw(); }
function setpage(p) { page = p; mgraphics.redraw(); }
function clear() {
	for (var i = 0; i < NTRACK; i++)
		for (var j = 0; j < steps[i].length; j++) steps[i][j] = 0;
	persist();
	mgraphics.redraw();
}

// mute / solo / clear-row on the selected track (rail buttons)
function mutesel() { if (selected >= 0) { mute[selected] = mute[selected] ? 0 : 1; persist(); mgraphics.redraw(); } }
function solosel() { if (selected >= 0) { solo[selected] = solo[selected] ? 0 : 1; persist(); mgraphics.redraw(); } }
function clearrow() {
	if (selected < 0) return;
	var s = steps[selected];
	for (var j = 0; j < s.length; j++) s[j] = 0;
	persist();
	mgraphics.redraw();
}

// change the selected track's MIDI note by a semitone delta (from +/- buttons)
function setnote(delta) {
	var t = selected;
	if (t < 0) return;
	note[t] = note[t] + delta;
	if (note[t] < 0) note[t] = 0;
	if (note[t] > 127) note[t] = 127;
	persist();
	mgraphics.redraw();
}

// push/pop/double/halve on the selected track (step-count ops)
function op(which) {
	var t = selected;
	if (t < 0) return;
	var s = steps[t];
	if (which == "push") {
		if (s.length < 32) s.push(0);
	} else if (which == "pop") {
		if (s.length > 1) s.pop();
	} else if (which == "double") {
		if (s.length <= 16) {
			var d = [];
			for (var i = 0; i < s.length; i++) { d.push(s[i]); d.push(0); }  // hits -> even indices
			steps[t] = d;
		}
	} else if (which == "halve") {
		if (s.length > 1) {
			var h = [];
			for (var i = 0; i < s.length; i += 2) h.push(s[i]);            // keep even indices
			steps[t] = h;
		}
	}
	count[t] = steps[t].length;
	emitPoly(t);
	persist();
	mgraphics.redraw();
}

//! PrintForge smart-guides engine.
//!
//! Mirrors `calcGuides` in src/core/tree.ts, but operates on a flat box list
//! so the tree walk happens once per drag (in JS) instead of on every
//! mousemove. The 9-point alignment comparison runs here in WASM.
//!
//! `others` layout: [x, y, w, h] * N, with the page frame and page-center
//! pseudo-boxes appended by the JS wrapper.

use wasm_bindgen::prelude::*;

const THRESHOLD: f64 = 5.0;

/// Computes alignment guides for a dragged box against pre-flattened boxes.
/// Returns [h_count, h..., v...] as a single array (guides are page-global,
/// rounded, deduplicated).
#[wasm_bindgen]
pub fn calc_guides(tx: f64, ty: f64, tw: f64, th: f64, others: &[f64]) -> Vec<f64> {
    let tcx = tx + tw / 2.0;
    let tcy = ty + th / 2.0;
    let tr = tx + tw;
    let tb = ty + th;

    let mut h: Vec<f64> = Vec::new();
    let mut v: Vec<f64> = Vec::new();

    for o in others.chunks_exact(4) {
        let (ox, oy, ow, oh) = (o[0], o[1], o[2], o[3]);
        let ocx = ox + ow / 2.0;
        let ocy = oy + oh / 2.0;
        let orr = ox + ow;
        let ob = oy + oh;

        for t in [ty, tb, tcy] {
            for cand in [oy, ob, ocy] {
                if (t - cand).abs() < THRESHOLD {
                    push_unique(&mut h, cand.round());
                }
            }
        }
        for t in [tx, tr, tcx] {
            for cand in [ox, orr, ocx] {
                if (t - cand).abs() < THRESHOLD {
                    push_unique(&mut v, cand.round());
                }
            }
        }
    }

    let mut out = Vec::with_capacity(1 + h.len() + v.len());
    out.push(h.len() as f64);
    out.extend_from_slice(&h);
    out.extend_from_slice(&v);
    out
}

fn push_unique(list: &mut Vec<f64>, val: f64) {
    if !list.contains(&val) {
        list.push(val);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_edge_alignment() {
        // other box at x=100; target left edge at 102 (within threshold 5)
        let others = [100.0, 200.0, 50.0, 50.0];
        let res = calc_guides(102.0, 500.0, 40.0, 40.0, &others);
        let h_count = res[0] as usize;
        let v: &[f64] = &res[1 + h_count..];
        assert!(v.contains(&100.0));
    }

    #[test]
    fn no_guides_when_far() {
        let others = [100.0, 100.0, 50.0, 50.0];
        let res = calc_guides(500.0, 500.0, 40.0, 40.0, &others);
        assert_eq!(res, vec![0.0]);
    }

    #[test]
    fn dedupes_guides() {
        // two boxes sharing the same left edge produce one guide
        let others = [100.0, 0.0, 50.0, 50.0, 100.0, 300.0, 80.0, 20.0];
        let res = calc_guides(101.0, 500.0, 40.0, 40.0, &others);
        let h_count = res[0] as usize;
        let v: Vec<f64> = res[1 + h_count..].to_vec();
        assert_eq!(v.iter().filter(|&&x| x == 100.0).count(), 1);
    }
}

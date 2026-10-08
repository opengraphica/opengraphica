// TODO - remove this when most of functionality is complete.
#![allow(warnings)]

extern crate console_error_panic_hook;

use std::panic;
use std::rc::Rc;
use std::cell::{ Cell, RefCell };
use std::collections::HashMap;
use std::vec::Vec;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use wasm_bindgen_futures::{ spawn_local, JsFuture };

use kurbo::simplify;

fn is_nearly_integer(x: f32) -> bool {
    x.is_finite() && (x - x.round()).abs() <= 1e-5
}

#[wasm_bindgen]
pub fn path_to_polyline(
    path_transfer: &[f64],
) -> Vec<f64> {
    let path = path_transfer.chunks_exact(8)
        .map(|record| {
            let [v0, v1, v2, v3, v4, v5, v6, v7] = record else {
                unreachable!("chunks_exact(8) always yields 8 values");
            };
            if (*v0 == 0.0_f64) {
                kurbo::PathEl::MoveTo(
                    kurbo::Point::new(*v1, *v2),
                )
            } else if (*v0 == 1.0_f64) {
                kurbo::PathEl::LineTo(
                    kurbo::Point::new(*v1, *v2),
                )
            } else if (*v0 == 2.0_f64) {
                kurbo::PathEl::QuadTo(
                    kurbo::Point::new(*v1, *v2),
                    kurbo::Point::new(*v3, *v4),
                )
            } else if (*v0 == 3.0_f64) {
                kurbo::PathEl::CurveTo(
                    kurbo::Point::new(*v1, *v2),
                    kurbo::Point::new(*v3, *v4),
                    kurbo::Point::new(*v5, *v6),
                )
            } else {
                kurbo::PathEl::ClosePath
            }
         });
    let mut polyline = kurbo::BezPath::new();
    kurbo::flatten(path, 0.25, |el| polyline.push(el));

    let mut coords = Vec::new();

    for el in polyline.elements() {
        match *el {
            kurbo::PathEl::MoveTo(p) | kurbo::PathEl::LineTo(p) => {
                coords.extend([p.x, p.y]);
            }
            kurbo::PathEl::ClosePath => {}
            _ => unreachable!("expected a flattened path"),
        }
    }

    coords
}

#[wasm_bindgen]
pub fn polyline_to_bezier(

) {
    // https://docs.rs/kurbo/latest/kurbo/simplify/fn.simplify_bezpath.html
    // simplify::simplify_bezpath
}
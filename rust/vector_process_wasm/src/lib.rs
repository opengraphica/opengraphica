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

fn is_nearly_integer(x: f32) -> bool {
    x.is_finite() && (x - x.round()).abs() <= 1e-5
}

#[wasm_bindgen]
pub fn path_contains_path(
    a: &str,
    b: &str,
) -> bool {
    let Ok(a) = svg_path_ops::pt::PathTransformer::parse(a) else {
        return false;
    };
    let Ok(b) = svg_path_ops::pt::PathTransformer::parse(b) else {
        return false;
    };
    let a = a.measure();
    let b = b.measure();
    let Some(point_inside_b) = b.interior_point(svg_path_ops::FillRule::NonZero) else {
        return false;
    };
    a.contains(point_inside_b, svg_path_ops::FillRule::NonZero)
}

#[wasm_bindgen]
pub fn path_to_polyline(
    path: &str,
) -> String {
    let flattened = svg_path_ops::pt::PathTransformer::parse(&path)
        .unwrap().measure().flatten(0.25);
    let d = svg_path_ops::write_path(
        &flattened,
        &svg_path_ops::WriteOptions {
            precision: Some(3),
            compact: true,
        },
    );
    d
}

#[wasm_bindgen]
pub fn simplify_path(
    path: &str,
) -> String {
    let simplified = svg_path_ops::pt::PathTransformer::parse(&path)
        .unwrap().measure().simplify(0.5, 60.0);
    let d = svg_path_ops::write_path(
        &simplified,
        &svg_path_ops::WriteOptions {
            precision: Some(3),
            compact: true,
        },
    );
    d
}
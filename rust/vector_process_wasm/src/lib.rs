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

mod state;
use state::{ StoredPathState };

thread_local! {
    static STORED_PATH_STATE: RefCell<Option<StoredPathState>> = RefCell::new(None);
}

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

#[wasm_bindgen]
pub fn create_brush_stroke(
    path: &str,
) -> usize {

    let path_transformer = svg_path_ops::pt::PathTransformer::parse(&path).unwrap();
    let mut index: usize = 0;

    STORED_PATH_STATE.with(|cell| {
        if let Ok(mut state) = cell.try_borrow_mut() {
            let path_state = state.get_or_insert_with(StoredPathState::default);

            path_state.path_transformers_iterator += 1;
            index = path_state.path_transformers_iterator;
            path_state.path_transformers.insert(index, path_transformer);
        }
    });

    index
}

#[wasm_bindgen]
pub fn move_brush_stroke(
    stroke_index: usize,
    path: &str,
) {

    let new_path_transformer = svg_path_ops::pt::PathTransformer::parse(&path).unwrap();

    STORED_PATH_STATE.with(|cell| {
        if let Ok(mut state) = cell.try_borrow_mut() {
            let path_state = state.get_or_insert_with(StoredPathState::default);

            if let Some(mut path_transformer) = path_state.path_transformers.get_mut(&stroke_index) {
                let options = svg_path_ops::BooleanOptions::default();
                path_transformer.union(&new_path_transformer, &options);
            }
        }
    });

}

#[wasm_bindgen]
pub fn stop_brush_stroke(
    stroke_index: usize,
) -> String {

    STORED_PATH_STATE.with(|cell| {
        if let Ok(mut state) = cell.try_borrow_mut() {
            let path_state = state.get_or_insert_with(StoredPathState::default);

            if let Some(path_transformer) = path_state.path_transformers.remove(&stroke_index) {
                return path_transformer.to_string_with(
                    &svg_path_ops::WriteOptions {
                        precision: Some(3),
                        compact: true,
                    }
                );
            }
        }

        String::from("")
    })

}

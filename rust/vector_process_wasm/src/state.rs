use std::collections::HashMap;

#[derive(Default)]
pub struct StoredPathState {
    pub path_transformers_iterator: usize,
    pub path_transformers: HashMap<usize, svg_path_ops::pt::PathTransformer>,
}
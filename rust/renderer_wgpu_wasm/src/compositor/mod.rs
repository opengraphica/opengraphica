pub mod brush_preview;
pub mod brush_stroke;
pub mod pipeline_helpers;

pub use brush_preview::BrushPreview;

pub struct Compositor {
    pub brush_preview: BrushPreview,
}

impl Compositor {
    pub fn new(device: &wgpu::Device) -> Self {
        let brush_preview = BrushPreview::new(device);

        Self {
            brush_preview,
        }
    }
}

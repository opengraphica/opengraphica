use glam::Mat4;
use bytemuck::{ Pod, Zeroable };

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct BackgroundImageUniform {
    pub size: [f32; 2],
    pub _padding: [f32; 2],
    pub color: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct BrushCompositorUniform {
    pub dst_offset_and_size: [f32; 4],
    pub brush_alpha_concentration: [f32; 2],
    pub selection_mask_enabled: u32,
    pub blending_mode: u32,
    pub selection_mask_transform: [[f32; 4]; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct BrushStrokeUniform {
    pub tile_offset_and_size: [f32; 4],
    pub brush_transform: [[f32; 4]; 4],
    pub brush_hardness_and_padding: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct CopyTileUniform {
    pub tile_offset_and_size: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Debug, Pod, Zeroable)]
pub struct RasterLayerUniform {
    pub tile_offset_scale: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct SampleBrushColorUniform {
    pub tile_offset_and_size: [f32; 4],
    pub brush_color: [f32; 4],
    pub blending_persistence_bearing_concentration: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct TransformUniform {
    pub matrix: [[f32; 4]; 4],
}

impl From<&Mat4> for TransformUniform {
    fn from(mat4: &Mat4) -> Self {
        TransformUniform {
            matrix: mat4.to_cols_array_2d(),
        }
    }
}

impl From<Mat4> for TransformUniform {
    fn from(mat4: Mat4) -> Self {
        TransformUniform {
            matrix: mat4.to_cols_array_2d(),
        }
    }
}
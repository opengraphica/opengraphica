use glam::Mat4;

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct BackgroundImageUniform {
    pub size: [f32; 2],
    pub _padding: [f32; 2],
    pub color: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
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
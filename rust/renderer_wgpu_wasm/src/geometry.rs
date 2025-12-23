
#[repr(C)]
#[derive(Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex {
    position: [f32; 2],
    uv: [f32; 2],
}

impl Vertex {
    pub fn layout() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x2,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x2,
                },
            ],
        }
    }
}

pub fn rectangle_vertices(width: u32, height: u32) -> [Vertex; 6] {
    let x: f32 = 0.0;
    let y: f32 = 0.0;
    let x2: f32 = width as f32;
    let y2: f32 = height as f32;

    [
        Vertex { position: [x,  y], uv: [0.0, 0.0] },
        Vertex { position: [x2, y2], uv: [1.0, 1.0] },
        Vertex { position: [x2, y], uv: [1.0, 0.0] },

        Vertex { position: [x,  y], uv: [0.0, 0.0] },
        Vertex { position: [x,  y2], uv: [0.0, 1.0] },
        Vertex { position: [x2, y2], uv: [1.0, 1.0] },
    ]
}

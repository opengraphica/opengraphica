

pub trait Drawable {
    fn draw(&self, pass: &mut wgpu::RenderPass);
}

pub struct LayerPassStep {
    pub mesh_controller_id: u32,
    pub order: u32,
}

pub struct RendererState {
    pub surface: wgpu::Surface<'static>,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub config: wgpu::SurfaceConfiguration,
    pub projection_matrix: glam::Mat4,
    pub view_matrix: glam::Mat4,
    pub quad_vertex_buffer: wgpu::Buffer,
    pub depth_stencil_texture: wgpu::Texture,
    pub depth_stencil_view: wgpu::TextureView,
    pub image_boundary_mask_enabled: bool,
    pub image_background: crate::image_background::ImageBackground,
    pub mesh_controllers: std::collections::HashMap<u32, Box<
        dyn crate::layers::base::mesh_controller::MeshController
    >>,
    pub layer_passes: std::vec::Vec<LayerPassStep>,
}

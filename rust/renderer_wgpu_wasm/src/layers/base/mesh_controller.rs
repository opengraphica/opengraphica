use std::convert::TryFrom;

pub trait MeshController {
    fn set_name(&mut self, name: &str);
    fn get_name(&self) -> &str;
    fn set_size(&mut self, width: u32, height: u32);
    fn get_width(&self) -> u32;
    fn get_height(&self) -> u32;
    fn set_model_transform(&mut self, model_transform: &[f32]);
    fn set_view_transform(&mut self, view_transform: &glam::Mat4);
    fn set_visible(&mut self, visible: bool);
    fn get_visible(&self) -> bool;
    fn set_order(&mut self, order: u32);
    fn get_order(&self) -> u32;
    fn set_source_image_data(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        width: u32,
        height: u32,
        format: u8,
        buffer: &[u8]
    );
    fn draw(
        &mut self,
        queue: &wgpu::Queue,
        pass: &mut wgpu::RenderPass,
    );
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MeshControllerType {
    Gradient = 0,
    Raster = 1,
    RasterSequence = 2,
    Text = 3,
    Vector = 4,
    Video = 5,
}

impl TryFrom<u8> for MeshControllerType {
    type Error = u8;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Gradient),
            1 => Ok(Self::Raster),
            2 => Ok(Self::RasterSequence),
            3 => Ok(Self::Text),
            4 => Ok(Self::Vector),
            5 => Ok(Self::Video),
            other => Err(other),
        }
    }
}
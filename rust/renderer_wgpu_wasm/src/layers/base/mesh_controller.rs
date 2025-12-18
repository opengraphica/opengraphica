use std::convert::TryFrom;

pub trait MeshController {
    fn set_name(&mut self, name: &str);
    fn set_size(&mut self, width: u32, height: u32);
    fn set_transform(&mut self, transform: &[f32]);
    fn set_visible(&mut self, visible: bool);
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
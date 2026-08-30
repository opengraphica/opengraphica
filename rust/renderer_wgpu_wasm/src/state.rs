use wasm_bindgen::prelude::*;
use core::{ fmt, str::FromStr };
use std::rc::Rc;
use std::cell::RefCell;

pub struct WorkingFileLayerFilter {
    name: String,
    disabled: Option<bool>,
    params: std::collections::HashMap<String, crate::JsValue>,
    mask_id: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkingFileLayerBlendingMode {
    Normal,
    Dissolve,
    ColorErase,
    Erase,
    Merge,
    Split,
    LightenOnly,
    LumaLightenOnly,
    Screen,
    Dodge,
    LinearDodge,
    Addition,
    DarkenOnly,
    LumaDarkenOnly,
    Multiply,
    Burn,
    LinearBurn,
    Overlay,
    SoftLight,
    HardLight,
    VividLight,
    PinLight,
    LinearLight,
    HardMix,
    Difference,
    Exclusion,
    Subtract,
    GrainExtract,
    GrainMerge,
    Divide,
    Hue,
    Chroma,
    Color,
    Lightness,
    Luminance,
}
impl fmt::Display for WorkingFileLayerBlendingMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Normal => "normal",
            Self::Dissolve => "dissolve",
            Self::ColorErase => "colorErase",
            Self::Erase => "erase",
            Self::Merge => "merge",
            Self::Split => "split",
            Self::LightenOnly => "lightenOnly",
            Self::LumaLightenOnly => "lumaLightenOnly",
            Self::Screen => "screen",
            Self::Dodge => "dodge",
            Self::LinearDodge => "linearDodge",
            Self::Addition => "addition",
            Self::DarkenOnly => "darkenOnly",
            Self::LumaDarkenOnly => "lumaDarkenOnly",
            Self::Multiply => "multiply",
            Self::Burn => "burn",
            Self::LinearBurn => "linearBurn",
            Self::Overlay => "overlay",
            Self::SoftLight => "softLight",
            Self::HardLight => "hardLight",
            Self::VividLight => "vividLight",
            Self::PinLight => "pinLight",
            Self::LinearLight => "linearLight",
            Self::HardMix => "hardMix",
            Self::Difference => "difference",
            Self::Exclusion => "exclusion",
            Self::Subtract => "subtract",
            Self::GrainExtract => "grainExtract",
            Self::GrainMerge => "grainMerge",
            Self::Divide => "divide",
            Self::Hue => "hue",
            Self::Chroma => "chroma",
            Self::Color => "color",
            Self::Lightness => "lightness",
            Self::Luminance => "luminance",
        };

        f.write_str(value)
    }
}
impl FromStr for WorkingFileLayerBlendingMode {
    type Err = ();
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "normal" => Ok(Self::Normal),
            "dissolve" => Ok(Self::Dissolve),
            "colorErase" => Ok(Self::ColorErase),
            "erase" => Ok(Self::Erase),
            "merge" => Ok(Self::Merge),
            "split" => Ok(Self::Split),
            "lightenOnly" => Ok(Self::LightenOnly),
            "lumaLightenOnly" => Ok(Self::LumaLightenOnly),
            "screen" => Ok(Self::Screen),
            "dodge" => Ok(Self::Dodge),
            "linearDodge" => Ok(Self::LinearDodge),
            "addition" => Ok(Self::Addition),
            "darkenOnly" => Ok(Self::DarkenOnly),
            "lumaDarkenOnly" => Ok(Self::LumaDarkenOnly),
            "multiply" => Ok(Self::Multiply),
            "burn" => Ok(Self::Burn),
            "linearBurn" => Ok(Self::LinearBurn),
            "overlay" => Ok(Self::Overlay),
            "softLight" => Ok(Self::SoftLight),
            "hardLight" => Ok(Self::HardLight),
            "vividLight" => Ok(Self::VividLight),
            "pinLight" => Ok(Self::PinLight),
            "linearLight" => Ok(Self::LinearLight),
            "hardMix" => Ok(Self::HardMix),
            "difference" => Ok(Self::Difference),
            "exclusion" => Ok(Self::Exclusion),
            "subtract" => Ok(Self::Subtract),
            "grainExtract" => Ok(Self::GrainExtract),
            "grainMerge" => Ok(Self::GrainMerge),
            "divide" => Ok(Self::Divide),
            "hue" => Ok(Self::Hue),
            "chroma" => Ok(Self::Chroma),
            "color" => Ok(Self::Color),
            "lightness" => Ok(Self::Lightness),
            "luminance" => Ok(Self::Luminance),
            _ => Err(()),
        }
    }
}

#[wasm_bindgen]
pub struct ImageData {
    pub width: u32,
    pub height: u32,
    pub format: u8,
    buffer: Vec<u8>,
}

#[wasm_bindgen]
impl ImageData {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, format: u8, buffer: Vec<u8>) -> ImageData {
        ImageData { width, height, format, buffer }
    }

    #[wasm_bindgen(getter)]
    pub fn buffer(&self) -> Vec<u8> {
        self.buffer.clone()
    }
}

pub struct LayerPassStep {
    pub mesh_controller_id: u32,
    pub order: u32,
}

pub struct RendererState {
    pub adapter: wgpu::Adapter,
    pub surface: wgpu::Surface<'static>,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub config: wgpu::SurfaceConfiguration,
    pub projection_matrix: glam::Mat4,
    pub view_matrix: glam::Mat4,
    pub quad_vertex_buffer: wgpu::Buffer,
    pub depth_stencil_texture: wgpu::Texture,
    pub depth_stencil_view: wgpu::TextureView,
    pub image_width: u32,
    pub image_height: u32,
    pub image_boundary_mask_enabled: bool,
    pub mipmap_generator: crate::mipmap_generator::MipmapGenerator,
    pub compositor: Rc<RefCell<crate::compositor::Compositor>>,
    pub image_background: crate::image_background::ImageBackground,
    pub mesh_controllers: std::collections::HashMap<u32, Box<
        dyn crate::layers::base::mesh_controller::MeshController
    >>,
    pub layer_passes: std::vec::Vec<LayerPassStep>,
}

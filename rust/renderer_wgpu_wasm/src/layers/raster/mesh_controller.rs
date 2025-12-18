use crate::layers::base::mesh_controller::{ MeshController };

pub struct RasterMeshController {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub transform: [f32; 16],
    pub visible: bool,
}

impl MeshController for RasterMeshController {
    fn set_name(&mut self, name: &str) {
        self.name = name.to_string();
    }

    fn set_size(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    fn set_transform(&mut self, transform: &[f32]) {
        self.transform = transform.try_into().expect("Transform must be of length 16");
    }

    fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }
}

impl RasterMeshController {
    pub fn new() -> RasterMeshController {
        RasterMeshController {
            name: "".to_string(),
            width: 1,
            height: 1,
            transform: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
            visible: true,
        }
    }
}
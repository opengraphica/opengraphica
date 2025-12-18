extern crate console_error_panic_hook;

use glam::Mat4;
use std::panic;
use std::cell::{ Cell, RefCell };
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use wasm_bindgen_futures::{ spawn_local, JsFuture };
use wgpu::util::DeviceExt;
use wgpu::web_sys::{ HtmlCanvasElement, OffscreenCanvas };
use wgpu::web_sys::console;
use wgpu::web_sys::js_sys;

mod image_background;
mod layers;
use layers::base::mesh_controller::{ MeshControllerType };
use layers::raster::mesh_controller::{ RasterMeshController };
mod geometry;
mod state;
use state::RendererState;
mod uniform;

thread_local! {
    static SCHEDULED_CREATE_LAYER_PASSES: Cell<bool> = Cell::new(false);
    static RENDERER_STATE: RefCell<Option<RendererState>> = RefCell::new(None);
}

#[wasm_bindgen]
pub fn initialize(
    canvas: JsValue,
    image_width: u32,
    image_height: u32,
    view_width: u32,
    view_height: u32,
) -> js_sys::Promise {
    panic::set_hook(Box::new(console_error_panic_hook::hook));

    future_to_promise(async move {
        let instance_descriptor = wgpu::InstanceDescriptor {
            backends: wgpu::Backends::GL,
            // backends: wgpu::Backends::BROWSER_WEBGPU,
            ..wgpu::InstanceDescriptor::default()
        };
        let instance = wgpu::Instance::new(&instance_descriptor);

        let surface_target: wgpu::SurfaceTarget = if canvas.is_instance_of::<HtmlCanvasElement>() {
            wgpu::SurfaceTarget::Canvas(canvas.dyn_into::<HtmlCanvasElement>().unwrap())
        } else if canvas.is_instance_of::<OffscreenCanvas>() {
            wgpu::SurfaceTarget::OffscreenCanvas(canvas.dyn_into::<OffscreenCanvas>().unwrap())
        } else {
            panic!("Canvas is neither HtmlCanvasElement nor OffscreenCanvas");
        };

        let surface = instance
            .create_surface(surface_target)
            .map_err(|e| JsValue::from_str(&format!("create_surface failed: {:?}", e)))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("request_adapter failed: {:?}", e)))?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: None,
                    required_limits: wgpu::Limits {
                        max_texture_dimension_2d: 8192,
                        ..wgpu::Limits::downlevel_webgl2_defaults()
                    },
                    ..wgpu::DeviceDescriptor::default()
                }
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("request_device failed: {:?}", e)))?;

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            width: view_width,
            height: view_height,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode: wgpu::CompositeAlphaMode::Opaque,
            view_formats: vec![],
            desired_maximum_frame_latency: 0,
        };
        surface.configure(&device, &config);

        let canvas_view_scale = Mat4::from_scale(glam::vec3(2.0 / view_width as f32, -2.0 / view_height as f32, 1.0));
        let canvas_view_translate = Mat4::from_translation(glam::vec3(-1.0, 1.0, 0.0));
        let canvas_view_matrix = canvas_view_translate * canvas_view_scale;

        let quad_vertices = geometry::rectangle_vertices(1, 1);
        let quad_vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Reusable Quad Vertices"),
            contents: bytemuck::cast_slice(&quad_vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let image_background = crate::image_background::ImageBackground::new(
            &device, image_width, image_height
        );

        let mesh_controllers = HashMap::new();

        RENDERER_STATE.with(|s| *s.borrow_mut() = Some(
            RendererState {
                surface,
                device,
                queue,
                config,
                canvas_view_matrix,
                quad_vertex_buffer,
                image_background,
                mesh_controllers,
            }
        ));

        create_layer_passes();

        debug_render();

        console::log_1(&"Hello world".into());

        Ok(JsValue::UNDEFINED)
    })
}

#[wasm_bindgen]
pub fn resize(
    image_width: u32,
    image_height: u32,
    view_width: u32,
    view_height: u32,
) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let surface = &renderer_state.surface;
        let device = &renderer_state.device;
        let queue = &renderer_state.queue;
        let mut config = renderer_state.config.clone();

        let canvas_view_scale = Mat4::from_scale(glam::vec3(2.0 / view_width as f32, -2.0 / view_height as f32, 1.0));
        let canvas_view_translate = Mat4::from_translation(glam::vec3(-1.0, 1.0, 0.0));
        let canvas_view_matrix = canvas_view_translate * canvas_view_scale;
        renderer_state.canvas_view_matrix = canvas_view_matrix;

        let image_background = &mut renderer_state.image_background;

        config.width = view_width;
        config.height = view_height;
        surface.configure(&device, &config);

        image_background.resize(queue, image_width, image_height);
    });
}

#[wasm_bindgen]
pub fn set_background_color(
    r: f32,
    g: f32,
    b: f32,
    alpha: f32,
) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let queue = &renderer_state.queue;
        let image_background = &mut renderer_state.image_background;
    
        image_background.set_color(queue, r, g, b, alpha);
    });
}

#[wasm_bindgen]
pub fn set_view_transform(
    transform: &[f32]
) {
    assert!(transform.len() == 16);

    RENDERER_STATE.with(|s| {
        let renderer_state = s.borrow();
        let renderer_state = renderer_state.as_ref().unwrap();

        let queue = &renderer_state.queue;

        let canvas_view_matrix = &renderer_state.canvas_view_matrix;
        let view_transform_matrix = Mat4::from_cols_array(transform.try_into().unwrap());
        let view_matrix = canvas_view_matrix * view_transform_matrix;

        let image_background = &renderer_state.image_background;
        image_background.set_transform(queue, &view_matrix);
    });
}

#[wasm_bindgen]
pub fn set_layer_order() {
    // TODO
    create_layer_passes();
}

#[wasm_bindgen]
pub fn queue_create_layer_passes() {
    SCHEDULED_CREATE_LAYER_PASSES.with(|flag| {
        if flag.get() {
            return;
        }
        flag.set(true);

        spawn_local(async {
            JsFuture::from(js_sys::Promise::resolve(&JsValue::UNDEFINED))
                .await.unwrap();

            create_layer_passes();
        });
    });
}

#[wasm_bindgen]
pub fn render() {
    debug_render();
}

fn debug_render() {
    RENDERER_STATE.with(|s| {
        let renderer_state = s.borrow();
        let renderer_state = renderer_state.as_ref().unwrap();

        let surface = &renderer_state.surface;
        let device = &renderer_state.device;
        let queue = &renderer_state.queue;
        
        let quad_vertex_buffer = &renderer_state.quad_vertex_buffer;
        let image_background = &renderer_state.image_background;

        let frame = surface
            .get_current_texture()
            .expect("Failed to acquire next swap chain texture");

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Clear Encoder"),
        });

        // Begin a render pass to clear the frame
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Clear RenderPass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.0,
                            g: 0.0,
                            b: 0.0,
                            a: 0.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });

            pass.set_vertex_buffer(0, quad_vertex_buffer.slice(..));

            image_background.draw(&mut pass);
            // pass.set_pipeline(&image_background.pipeline);
            // pass.set_bind_group(0, &image_background.bind_group, &[]);
            // pass.set_vertex_buffer(0, image_background.vertex_buffer.slice(..));
            // pass.draw(0..6, 0..1);
        } // _rpass drops here and ends the pass

        // Submit the commands
        queue.submit(Some(encoder.finish()));

        // Present the frame
        frame.present();

    });
}

#[wasm_bindgen]
pub fn add_mesh_controller(id: u32, controllerType: u8) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        let mesh_controller_option = match MeshControllerType::try_from(controllerType).expect("Invalid controller type") {
            MeshControllerType::Raster => Some(RasterMeshController::new()),
            _ => None,
        };

        if let Some(mesh_controller) = mesh_controller_option {
            mesh_controllers.insert(id, Box::new(mesh_controller));
        }

        queue_create_layer_passes();
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_name(id: u32, name: &str) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
            mesh_controller.set_name(name);
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_size(id: u32, width: u32, height: u32) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
            mesh_controller.set_size(width, height);
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_transform(id: u32, transform: &[f32]) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
            mesh_controller.set_transform(transform);
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_visible(id: u32, visible: bool) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
            mesh_controller.set_visible(visible);
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_source_image_data(
    id: u32,
    width: u32,
    height: u32,
    format: u8,
    buffer: &[u8]
) {

}

#[wasm_bindgen]
pub fn reorder_mesh_controller(id: u32, order: u32) {

}

#[wasm_bindgen]
pub fn remove_mesh_controller(id: u32) {
    RENDERER_STATE.with(|s| {
        let mut renderer_state = s.borrow_mut();
        let renderer_state = renderer_state.as_mut().unwrap();

        let mesh_controllers = &mut renderer_state.mesh_controllers;

        mesh_controllers.remove(&id);

        queue_create_layer_passes();
    });
}

pub fn create_layer_passes() {
    SCHEDULED_CREATE_LAYER_PASSES.with(|f| f.set(false));

    
}
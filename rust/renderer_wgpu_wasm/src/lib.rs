extern crate console_error_panic_hook;

use std::panic;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use wgpu::web_sys::{ HtmlCanvasElement, OffscreenCanvas };
use wgpu::web_sys::console;
use wgpu::web_sys::js_sys;

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
                    // features: wgpu::Features::empty(),
                    // limits: wgpu::Limits::default(),
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
            alpha_mode: wgpu::CompositeAlphaMode::Auto,
            view_formats: vec![],
            desired_maximum_frame_latency: 0,
        };
        surface.configure(&device, &config);

        debug_render(surface, device, queue);

        console::log_1(&"Hello world".into());

        Ok(JsValue::NULL)
    })
}

#[wasm_bindgen]
pub fn add(a: u32, b: u32) -> u32 {
    a + b
}

fn debug_render(surface: wgpu::Surface, device: wgpu::Device, queue: wgpu::Queue) {
    let frame = surface
        .get_current_texture()
        .expect("Failed to acquire next swap chain texture");

    let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("Clear Encoder"),
    });

    // Begin a render pass to clear the frame
    {
        let _rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Clear RenderPass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: 0.2,
                        g: 0.6,
                        b: 0.9,
                        a: 1.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
                depth_slice: None,
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });
    } // _rpass drops here and ends the pass

    // Submit the commands
    queue.submit(Some(encoder.finish()));

    // Present the frame
    frame.present();
}
// TODO - remove this when most of functionality is complete.
#![allow(warnings)]

extern crate console_error_panic_hook;

use glam::Mat4;
use std::panic;
use std::rc::Rc;
use std::cell::{ Cell, RefCell };
use std::collections::HashMap;
use std::vec::Vec;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use wasm_bindgen_futures::{ spawn_local, JsFuture };
use wgpu::util::DeviceExt;
use wgpu::web_sys::{ HtmlCanvasElement, OffscreenCanvas };
use wgpu::web_sys::console;
use wgpu::web_sys::js_sys;

mod compositor;
use compositor::brush_preview::{ BrushPreview, RendererBrushStrokePreviewSettings };
mod image_background;
mod layers;
use layers::base::mesh_controller::{ MeshController, MeshControllerType };
use layers::raster::mesh_controller::{ RasterMeshController };
mod geometry;
mod mipmap_generator;
mod rng;
mod state;
use state::{ ImageData, LayerPassStep, RendererState, WorkingFileLayerFilter };
mod uniform;
mod wgpu_util;

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
            ..wgpu::InstanceDescriptor::new_without_display_handle()
        };
        let instance = wgpu::Instance::new(instance_descriptor);

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
                apply_limit_buckets: false,
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("request_adapter failed: {:?}", e)))?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: None,
                    required_limits: wgpu::Limits {
                        max_texture_dimension_2d: 2048,
                        ..wgpu::Limits::downlevel_webgl2_defaults()
                    },
                    ..wgpu::DeviceDescriptor::default()
                }
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("request_device failed: {:?}", e)))?;
        
        let surface_capabilities = surface.get_capabilities(&adapter);

        let surface_format = surface_capabilities.formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_capabilities.formats[0]);
        
        let max_dimension = device.limits().max_texture_dimension_2d as f32;
        let requested_width = view_width as f32;
        let requested_height = view_height as f32;
        let scale = (max_dimension / requested_width)
            .min(max_dimension / requested_height)
            .min(1.0);
        let view_width_limited = ((requested_width * scale).floor() as u32).max(1);
        let view_height_limited = ((requested_height * scale).floor() as u32).max(1);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            color_space: wgpu::SurfaceColorSpace::Srgb,
            width: view_width_limited,
            height: view_height_limited,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode: wgpu::CompositeAlphaMode::Opaque,
            view_formats: vec![],
            desired_maximum_frame_latency: 0,
        };
        surface.configure(&device, &config);

        let projection_scale = Mat4::from_scale(glam::vec3(2.0 / view_width_limited as f32, -2.0 / view_height_limited as f32, 1.0));
        let projection_translate = Mat4::from_translation(glam::vec3(-1.0, 1.0, 0.0));
        let projection_matrix = projection_translate * projection_scale;
        let view_matrix = Mat4::IDENTITY;

        let quad_vertices = geometry::rectangle_vertices(1, 1);
        let quad_vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Reusable Quad Vertices"),
            contents: bytemuck::cast_slice(&quad_vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let depth_stencil_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Stencil Texture"),
            size: wgpu::Extent3d {
                width: view_width_limited,
                height: view_height_limited,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth24PlusStencil8,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let depth_stencil_view = depth_stencil_texture.create_view(&Default::default());

        let mipmap_generator = crate::mipmap_generator::MipmapGenerator::new(&device, wgpu::TextureFormat::Rgba8UnormSrgb);
        let compositor = Rc::new(RefCell::new(crate::compositor::Compositor::new(&device)));

        let image_background = crate::image_background::ImageBackground::new(
            &device, image_width, image_height
        );

        let mesh_controllers = HashMap::new();
        let layer_passes = Vec::new();

        RENDERER_STATE.with(|s| *s.borrow_mut() = Some(
            RendererState {
                adapter,
                surface,
                device,
                queue,
                config,
                projection_matrix,
                view_matrix,
                quad_vertex_buffer,
                depth_stencil_texture,
                depth_stencil_view,
                image_width,
                image_height,
                image_boundary_mask_enabled: false,
                mipmap_generator,
                compositor,
                image_background,
                mesh_controllers,
                layer_passes,
            }
        ));

        create_layer_passes();

        render();

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
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            renderer_state.image_width = image_width;
            renderer_state.image_height = image_height;

            let surface = &renderer_state.surface;
            let device = &renderer_state.device;
            let queue = &renderer_state.queue;
            let mut config = renderer_state.config.clone();

            let canvas_view_scale = Mat4::from_scale(glam::vec3(2.0 / view_width as f32, -2.0 / view_height as f32, 1.0));
            let canvas_view_translate = Mat4::from_translation(glam::vec3(-1.0, 1.0, 0.0));
            let projection_matrix = canvas_view_translate * canvas_view_scale;
            renderer_state.projection_matrix = projection_matrix;

            let image_background = &mut renderer_state.image_background;

            let max_dimension = device.limits().max_texture_dimension_2d as f32;
            let requested_width = view_width as f32;
            let requested_height = view_height as f32;
            let scale = (max_dimension / requested_width)
                .min(max_dimension / requested_height)
                .min(1.0);
            config.width = ((requested_width * scale).floor() as u32).max(1);
            config.height = ((requested_height * scale).floor() as u32).max(1);
            surface.configure(&device, &config);

            let depth_stencil_texture = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Depth Stencil Texture"),
                size: wgpu::Extent3d {
                    width: config.width,
                    height: config.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                view_formats: &[],
            });
            let depth_stencil_view = depth_stencil_texture.create_view(&Default::default());
            renderer_state.depth_stencil_view = depth_stencil_view;

            image_background.resize(queue, image_width, image_height);
        } else {
            console::warn_1(&"renderer_wgpu_wasm.resize() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn enable_image_boundary_mask(enabled: bool) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            renderer_state.image_boundary_mask_enabled = enabled;
        } else {
            console::warn_1(&"renderer_wgpu_wasm.enable_image_boundary_mask() aborted due to busy render state.".into());
        }
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
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let queue = &renderer_state.queue;
            let image_background = &mut renderer_state.image_background;
        
            image_background.set_color(queue, r, g, b, alpha);
        } else {
            console::warn_1(&"renderer_wgpu_wasm.set_background_color() aborted due to busy render state.".into());
        }
    });
}

// #[wasm_bindgen]
// pub fn set_masks(masks: HashMap<u32, WorkingFileLayerMask>) {}

// #[wasm_bindgen]
// pub fn set_selection_mask(
//     image: Vec<u8>,
//     image_width: u32,
//     image_height: u32,
//     offset_x: u32,
//     offset_y: u32,
// ) {}

#[wasm_bindgen]
pub fn set_view_transform(
    transform: &[f32],
) {
    assert!(transform.len() == 16);

    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let queue = &renderer_state.queue;

            let projection_matrix = &renderer_state.projection_matrix;
            let view_transform_matrix = Mat4::from_cols_array(transform.try_into().unwrap());
            let view_matrix = projection_matrix * view_transform_matrix;
            renderer_state.view_matrix = view_matrix;

            apply_view_matrix(renderer_state, view_matrix);
        } else {
            console::warn_1(&"renderer_wgpu_wasm.set_view_transform() aborted due to busy render state.".into());
        }
    });
}
pub fn apply_view_matrix(
    renderer_state: &mut RendererState,
    view_matrix: glam::Mat4,
) {
    let queue = &renderer_state.queue;

    let image_background = &renderer_state.image_background;
    image_background.set_transform(queue, &view_matrix);

    let mesh_controllers = &mut renderer_state.mesh_controllers;
    for mesh_controller in mesh_controllers.values_mut() {
        mesh_controller.set_view_transform(&view_matrix);
    }
}

#[wasm_bindgen]
pub fn set_layer_order() {
    // TODO - Not even sure if this function was ever necessary. Mesh controller should have all the layer info.
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

// #[wasm_bindgen]
// pub fn apply_selection_mask_to_alpha_channel(
//     layerId: u32,
//     options: Webgl2RendererApplySelectionMaskToAlphaChannelOptions,
// ) {}

#[wasm_bindgen]
pub fn take_snapshot(
    snapshot_width: u32,
    snapshot_height: u32,
    camera_transform: Option<Vec<f32>>,
    layer_ids: Option<Vec<u32>>,
    filters: Option<Vec<JsValue>>,
    apply_selection_mask: Option<bool>,
    disable_scale_to_size: Option<bool>,
) -> js_sys::Promise {
    future_to_promise(async move {
        let bytes_per_pixel = 4;
        let unpadded_bytes_per_row = snapshot_width * bytes_per_pixel;
        let padded_bytes_per_row =
            ((unpadded_bytes_per_row + 255) / 256) * 256;

        let readback_buffer_size = padded_bytes_per_row as u64 * snapshot_height as u64;

        let readback_buffer: Option<wgpu::Buffer> = RENDERER_STATE.with(|s| {
            if let Ok(mut renderer_state) = s.try_borrow_mut() {
                let renderer_state = renderer_state.as_mut().unwrap();

                let render_target_texture = renderer_state.device.create_texture(&wgpu::TextureDescriptor {
                    label: Some("Snapshot Render Target"),
                    size: wgpu::Extent3d {
                        width: snapshot_width,
                        height: snapshot_height,
                        depth_or_array_layers: 1,
                    },
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: wgpu::TextureDimension::D2,
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT
                        | wgpu::TextureUsages::COPY_SRC,
                    view_formats: &[],
                });

                let depth_stencil_texture = renderer_state.device.create_texture(&wgpu::TextureDescriptor {
                    label: Some("Depth Stencil Texture"),
                    size: wgpu::Extent3d {
                        width: snapshot_width,
                        height: snapshot_height,
                        depth_or_array_layers: 1,
                    },
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: wgpu::TextureDimension::D2,
                    format: wgpu::TextureFormat::Depth24PlusStencil8,
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                    view_formats: &[],
                });
                let depth_stencil_view = depth_stencil_texture.create_view(&Default::default());

                let render_target_view = render_target_texture.create_view(&wgpu::TextureViewDescriptor::default());

                apply_view_matrix(
                    renderer_state,
                    glam::Mat4::orthographic_rh(
                        0.0,
                        renderer_state.image_width as f32,
                        renderer_state.image_height as f32,
                        0.0,
                        0.0,
                        1.0,
                    )
                );

                render_main(
                    renderer_state,
                    &render_target_view,
                    Some(&depth_stencil_view),
                );

                apply_view_matrix(
                    renderer_state,
                    renderer_state.view_matrix,
                );

                let device = &renderer_state.device;
                let queue = &renderer_state.queue;

                let readback_buffer = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Readback Buffer"),
                    size: readback_buffer_size,
                    usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
                    mapped_at_creation: false,
                });

                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("Copy Encoder"),
                });

                encoder.copy_texture_to_buffer(
                    wgpu::TexelCopyTextureInfo {
                        texture: &render_target_texture,
                        mip_level: 0,
                        origin: wgpu::Origin3d::ZERO,
                        aspect: wgpu::TextureAspect::All,
                    },
                    wgpu::TexelCopyBufferInfo {
                        buffer: &readback_buffer,
                        layout: wgpu::TexelCopyBufferLayout {
                            offset: 0,
                            bytes_per_row: Some(padded_bytes_per_row),
                            rows_per_image: Some(snapshot_height),
                        },
                    },
                    wgpu::Extent3d {
                        width: snapshot_width,
                        height: snapshot_height,
                        depth_or_array_layers: 1,
                    },
                );

                queue.submit(Some(encoder.finish()));

                return Some(readback_buffer);
            }
            None
        });

        if let Some(readback_buffer) = readback_buffer {
            let slice = readback_buffer.slice(..);

            wgpu_util::map_buffer_slice_async(&slice, wgpu::MapMode::Read).await.map_err(|e| {
                wasm_bindgen::JsValue::from_str(&format!("Failed to map buffer: {:?}", e))
            })?;

            let data = slice.get_mapped_range()
                .map_err(|e| format!("failed to get mapped buffer range: {e:?}"))?;;

            let mut pixels = Vec::with_capacity((snapshot_width * snapshot_height * 4) as usize);
            for y in 0..snapshot_height as usize {
                let row_start = y * padded_bytes_per_row as usize;
                let row_end = row_start + unpadded_bytes_per_row as usize;
                pixels.extend_from_slice(&data[row_start..row_end]);
            }
            drop(data);
            readback_buffer.unmap();

            let screenshot_format: u8 = 0;
            return Ok(
                ImageData::new(
                    snapshot_width,
                    snapshot_height,
                    screenshot_format,
                    pixels,
                ).into()
            );
        }
        Err("A readback_buffer was not returned, likely could not borrow RENDER_STATE".into())
    })
}

// #[wasm_bindgen]
// pub fn start_brush_stroke(
//     layer_id: u32,
//     color: Vec<f32>,
//     size: f32,
//     hardness: f32,
//     color_blending_persistence: f32,
//     blending_mode: String,
// ) {}

// #[wasm_bindgen]
// pub fn move_brush_stroke(
//     layer_id: u32,
//     x: f32,
//     y: f32,
//     size: f32,
//     density: f32,
//     color_blending_strength: f32,
//     concentration: f32,
// ) {}

// #[wasm_bindgen]
// pub fn stopBrushStroke(layer_id: u32) -> js_sys::Promise {}

#[wasm_bindgen]
pub fn create_brush_preview(
    color: Vec<f32>,
    size: f32,
    hardness: f32,
    color_blending_persistence: f32,
    color_blending_strength: f32,
    pressure_min_color_blending_strength: f32,
    density: f32,
    pressure_min_density: f32,
    concentration: f32,
    pressure_min_concentration: f32,
    pressure_min_size: f32,
    jitter: f32,
    spacing: f32,
    pressure_taper: f32,
) -> js_sys::Promise {
    let resources = RENDERER_STATE.with(|state| {
        let state = state.try_borrow().map_err(|_| {
            JsValue::from_str("Could not borrow RENDERER_STATE")
        })?;

        let renderer = state.as_ref().ok_or_else(|| {
            JsValue::from_str("Renderer has not been initialized")
        })?;

        Ok::<_, JsValue>((
            renderer.adapter.clone(),
            renderer.device.clone(),
            renderer.queue.clone(),
            renderer.compositor.clone(),
            renderer.quad_vertex_buffer.clone(),
        ))
    });

    let (
        adapter,
        device,
        queue,
        compositor,
        quad_vertex_buffer,
    ) = match resources {
        Ok(resources) => resources,

        Err(error) => {
            return future_to_promise(async move {
                Err(error)
            });
        }
    };

    future_to_promise(async move {
        let settings = RendererBrushStrokePreviewSettings {
            color,
            size,
            hardness,
            color_blending_persistence,
            color_blending_strength,
            pressure_min_color_blending_strength,
            density,
            pressure_min_density,
            concentration,
            pressure_min_concentration,
            pressure_min_size,
            jitter,
            spacing,
            pressure_taper,
        };

        let encoder = device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor {
                label: Some("Brush Preview Encoder"),
            },
        );

        // This does not wait. If another preview is using the compositor,
        // this returns an error immediately.
        let mut compositor = compositor.try_borrow_mut().map_err(|_| {
            JsValue::from_str(
                "A brush preview is already being generated",
            )
        })?;

        let image_data = compositor
            .brush_preview
            .generate_pixel_buffer(
                &adapter,
                &device,
                &queue,
                encoder,
                &quad_vertex_buffer,
                &settings,
            )
            .await
            .map_err(|error| {
                JsValue::from_str(&format!(
                    "brush_preview.generate_pixel_buffer failed: {error:?}"
                ))
            })?;

        Ok(image_data.into())
    })
}

#[wasm_bindgen]
pub fn render() {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let device = &renderer_state.device;
            let surface = &renderer_state.surface;
            let config = &renderer_state.config;

            let frame = match surface.get_current_texture() {
                wgpu::CurrentSurfaceTexture::Success(texture) => texture,

                wgpu::CurrentSurfaceTexture::Suboptimal(texture) => {
                    surface.configure(device, config);
                    texture
                }

                wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded => {
                    // Try again on the next frame.
                    return;
                }

                wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                    surface.configure(device, config);
                    return;
                }

                wgpu::CurrentSurfaceTexture::Validation => {
                    panic!("Surface texture acquisition failed validation");
                }
            };

            let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

            render_main(renderer_state, &view, None);

            renderer_state.queue.present(frame);
        } else {
            console::warn_1(&"renderer_wgpu_wasm.render() aborted due to busy render state.".into());
        }
    });
}

fn render_main(
    renderer_state: &mut RendererState,
    color_view: &wgpu::TextureView,
    override_depth_stencil_view: Option<&wgpu::TextureView>,
) {
    let device = &renderer_state.device;
    let queue = &renderer_state.queue;
    
    let depth_stencil_view = if let Some(view) = override_depth_stencil_view {
        view
    } else {
        &renderer_state.depth_stencil_view
    };
    let quad_vertex_buffer = &renderer_state.quad_vertex_buffer;
    let image_boundary_mask_enabled = renderer_state.image_boundary_mask_enabled;
    let image_background = &renderer_state.image_background;

    let mesh_controllers = &mut renderer_state.mesh_controllers;
    let layer_passes = &renderer_state.layer_passes;

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("Clear Encoder"),
    });

    {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Clear RenderPass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &color_view,
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
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: &depth_stencil_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: Some(wgpu::Operations {
                    load: if image_boundary_mask_enabled {
                        wgpu::LoadOp::Clear(0)
                    } else {
                        wgpu::LoadOp::Clear(1)
                    },
                    store: wgpu::StoreOp::Store,
                }),
            }),
            occlusion_query_set: None,
            timestamp_writes: None,
            multiview_mask: None,
        });

        pass.set_vertex_buffer(0, quad_vertex_buffer.slice(..));

        image_background.draw_to_stencil(&mut pass);
        image_background.draw(&mut pass);

        for layer_pass in layer_passes {
            let mesh_controller = mesh_controllers.get_mut(&layer_pass.mesh_controller_id).expect("Mesh controller missing");
            // TODO - instead of a draw function, store pipeline and other state in LayerPassStep?
            mesh_controller.draw(queue, &mut pass);
        }

    } // pass drops here and ends the pass

    // Submit the commands
    queue.submit(Some(encoder.finish()));
}

#[wasm_bindgen]
pub fn add_mesh_controller(id: u32, controller_type: u8) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let device = &renderer_state.device;
            let mesh_controllers = &mut renderer_state.mesh_controllers;

            let mesh_controller_option = match MeshControllerType::try_from(controller_type).expect("Invalid controller type") {
                MeshControllerType::Raster => Some(RasterMeshController::new(device)),
                _ => None,
            };

            if let Some(mut mesh_controller) = mesh_controller_option {
                mesh_controller.set_view_transform(&renderer_state.view_matrix);
                mesh_controllers.insert(id, Box::new(mesh_controller));
            }

            queue_create_layer_passes();
        } else {
            console::warn_1(&"renderer_wgpu_wasm.add_mesh_controller() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_name(id: u32, name: &str) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_name(name);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.update_mesh_controller_name() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_size(id: u32, width: u32, height: u32) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_size(width, height);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.update_mesh_controller_size() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_transform(id: u32, transform: &[f32]) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_model_transform(transform);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.update_mesh_controller_transform() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_visible(id: u32, visible: bool) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_visible(visible);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.update_mesh_controller_visible() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn update_mesh_controller_source_image_data(
    id: u32,
    width: u32,
    height: u32,
    format: u8,
    buffer: &[u8],
) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let device = &renderer_state.device;
            let queue = &renderer_state.queue;
            let mipmap_generator = &renderer_state.mipmap_generator;
            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_source_image_data(device, queue, mipmap_generator, width, height, format, buffer);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.update_mesh_controller_source_image_data() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn reorder_mesh_controller(id: u32, order: u32) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            if let Some(mesh_controller) = mesh_controllers.get_mut(&id) {
                mesh_controller.set_order(order);
            }
        } else {
            console::warn_1(&"renderer_wgpu_wasm.reorder_mesh_controller() aborted due to busy render state.".into());
        }
    });
}

#[wasm_bindgen]
pub fn remove_mesh_controller(id: u32) {
    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;

            mesh_controllers.remove(&id);

            queue_create_layer_passes();
        } else {
            console::warn_1(&"renderer_wgpu_wasm.remove_mesh_controller() aborted due to busy render state.".into());
        }
    });
}

pub fn create_layer_passes() {
    SCHEDULED_CREATE_LAYER_PASSES.with(|f| f.set(false));

    RENDERER_STATE.with(|s| {
        if let Ok(mut renderer_state) = s.try_borrow_mut() {
            let renderer_state = renderer_state.as_mut().unwrap();

            let mesh_controllers = &mut renderer_state.mesh_controllers;
            let mut layer_passes = Vec::<LayerPassStep>::with_capacity(mesh_controllers.len());

            for (id, mesh_controller) in mesh_controllers.iter() {
                layer_passes.push(LayerPassStep {
                    mesh_controller_id: id.clone(),
                    order: mesh_controller.get_order(),
                });
            }
            layer_passes.sort_by_key(|k| k.order);

            // TODO - determine when to render buffer swap

            renderer_state.layer_passes = layer_passes;
        } else {
            console::warn_1(&"renderer_wgpu_wasm.create_layer_passes() aborted due to busy render state.".into());
        }
    });
}
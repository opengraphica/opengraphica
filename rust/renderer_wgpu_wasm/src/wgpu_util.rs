use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use wgpu::web_sys::js_sys::Promise;
use wgpu::{ BufferSlice, MapMode };

pub fn map_buffer_slice_async(slice: &BufferSlice, map_mode: MapMode) -> JsFuture {
    // Create a JS promise that resolves when the buffer is mapped
    let promise = Promise::new(&mut |resolve, reject| {
        let resolve = resolve.clone();
        let reject = reject.clone();

        slice.map_async(map_mode, move |result| {
            match result {
                Ok(()) => {
                    let _ = resolve.call0(&JsValue::NULL);
                }
                Err(e) => {
                    let _ = reject.call1(&JsValue::NULL, &JsValue::from_str(&format!("{:?}", e)));
                }
            }
        });
    });

    JsFuture::from(promise)
}

pub struct RenderTarget {
    pub texture: wgpu::Texture,
    pub view: wgpu::TextureView,
    pub width: u32,
    pub height: u32,
    pub format: wgpu::TextureFormat,
}

impl RenderTarget {
    pub fn new(
        device: &wgpu::Device,
        width: u32,
        height: u32,
        format: wgpu::TextureFormat,
        label: &str,
    ) -> Self {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some(label),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::RENDER_ATTACHMENT
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        Self {
            texture,
            view,
            width,
            height,
            format,
        }
    }

    pub fn is_texture_format_supported(
        adapter: &wgpu::Adapter,
        format: wgpu::TextureFormat,
    ) -> bool {
        let required_usage = wgpu::TextureUsages::TEXTURE_BINDING
            | wgpu::TextureUsages::RENDER_ATTACHMENT
            | wgpu::TextureUsages::COPY_SRC
            | wgpu::TextureUsages::COPY_DST;
        
        let supported = adapter
            .get_texture_format_features(format)
            .allowed_usages
            .contains(required_usage);

        supported
    }

    pub fn clear(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        color: wgpu::Color,
    ) {
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Target Clear Encoder"),
        });

        {
            let _ = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Clear Render Target"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(color),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
        }

        queue.submit(std::iter::once(encoder.finish()));
    }
}

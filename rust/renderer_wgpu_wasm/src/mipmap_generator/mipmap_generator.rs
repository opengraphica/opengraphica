use std::borrow::Cow;
use wgpu::util::DeviceExt;

pub struct MipmapGenerator {
    pipeline: wgpu::RenderPipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
}

impl MipmapGenerator {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Mipmap Generation Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(r#"
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) tex_coords: vec2<f32>,
                };

                @vertex
                fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
                    var out: VertexOutput;
                    let x = f32(i32(in_vertex_index << 1u) & 2) * 2.0 - 1.0;
                    let y = f32(i32(in_vertex_index & 2u)) * 2.0 - 1.0;
                    out.position = vec4<f32>(x, y, 0.0, 1.0);
                    // Flip Y for WebGL/wgpu coordinate mapping if necessary
                    out.tex_coords = vec2<f32>(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));
                    return out;
                }

                @group(0) @binding(0) var img_sampler: sampler;
                @group(0) @binding(1) var img_texture: texture_2d<f32>;

                @fragment
                fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
                    return textureSample(img_texture, img_sampler, in.tex_coords);
                }
            "#)),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Mipmap Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Mipmap Pipeline Layout"),
            bind_group_layouts: &[Some(&bind_group_layout)],
            immediate_size: 0,
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Mipmap Render Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Mipmap Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Self {
            pipeline,
            bind_group_layout,
            sampler,
        }
    }

    pub fn generate(&self, device: &wgpu::Device, queue: &wgpu::Queue, texture: &wgpu::Texture) {
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Mipmap Generator Encoder"),
        });

        let mip_count = texture.mip_level_count();
        let format = texture.format();

        for target_mip in 1..mip_count {
            let src_mip = target_mip - 1;

            let src_view = texture.create_view(&wgpu::TextureViewDescriptor {
                label: Some("Mipmap Src View"),
                format: Some(format),
                dimension: Some(wgpu::TextureViewDimension::D2),
                aspect: wgpu::TextureAspect::All,
                base_mip_level: src_mip,
                mip_level_count: Some(1),
                base_array_layer: 0,
                array_layer_count: None,
                ..wgpu::TextureViewDescriptor::default()
            });

            let dst_view = texture.create_view(&wgpu::TextureViewDescriptor {
                label: Some("Mipmap Dst View"),
                format: Some(format),
                dimension: Some(wgpu::TextureViewDimension::D2),
                aspect: wgpu::TextureAspect::All,
                base_mip_level: target_mip,
                mip_level_count: Some(1),
                base_array_layer: 0,
                array_layer_count: None,
                ..wgpu::TextureViewDescriptor::default()
            });

            let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("Mipmap Bind Group"),
                layout: &self.bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                ],
            });

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Mipmap Render Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &dst_view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                            store: wgpu::StoreOp::Store,
                        },
                        depth_slice: None,
                    })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                    multiview_mask: None,
                });

                render_pass.set_pipeline(&self.pipeline);
                render_pass.set_bind_group(0, &bind_group, &[]);
                render_pass.draw(0..3, 0..1);
            }
        }

        queue.submit(std::iter::once(encoder.finish()));
    }
}
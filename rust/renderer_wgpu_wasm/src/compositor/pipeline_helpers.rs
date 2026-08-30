use bytemuck::{ Pod };
use wgpu::util::DeviceExt;

use crate::geometry::{ Vertex };
use crate::uniform::{ BrushCompositorUniform, BrushStrokeUniform, CopyTileUniform, SampleBrushColorUniform };

pub fn create_uniform_buffer<T: Pod>(
    device: &wgpu::Device,
    label: &str,
) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some(label),
        size: std::mem::size_of::<T>() as u64,
        usage: wgpu::BufferUsages::UNIFORM
            | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

pub fn create_pipeline(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    target_format: wgpu::TextureFormat,
    shader_source: wgpu::ShaderModuleDescriptor,
    label: &str,
) -> wgpu::RenderPipeline {
    let shader_module = device.create_shader_module(shader_source);

    let pipeline_layout = device.create_pipeline_layout(
        &wgpu::PipelineLayoutDescriptor {
            label: Some(&format!("{label} Layout")),
            bind_group_layouts: &[Some(layout)],
            immediate_size: 0,
        },
    );

    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some(label),
        layout: Some(&pipeline_layout),

        vertex: wgpu::VertexState {
            module: &shader_module,
            entry_point: Some("vs_main"),
            compilation_options: Default::default(),
            buffers: &[Some(Vertex::layout())],
        },

        fragment: Some(wgpu::FragmentState {
            module: &shader_module,
            entry_point: Some("fs_main"),
            compilation_options: Default::default(),
            targets: &[Some(wgpu::ColorTargetState {
                format: target_format,
                blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),
                write_mask: wgpu::ColorWrites::ALL,
            })],
        }),

        primitive: wgpu::PrimitiveState {
            topology: wgpu::PrimitiveTopology::TriangleList,
            ..Default::default()
        },

        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview_mask: None,
        cache: None,
    })
}

fn bind_group_texture_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Texture {
            sample_type: wgpu::TextureSampleType::Float {
                filterable: true,
            },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}

fn bind_group_sampler_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Sampler(
            wgpu::SamplerBindingType::Filtering,
        ),
        count: None,
    }
}

fn bind_group_uniform_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::VERTEX
            | wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

pub fn make_brush_stroke_bind_group_layout(
    device: &wgpu::Device,
) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("Brush Stroke Bind Group Layout"),
        entries: &[
            bind_group_texture_entry(0),
            bind_group_texture_entry(1),
            bind_group_sampler_entry(2),
            wgpu::BindGroupLayoutEntry {
                binding: 3,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: true,
                    min_binding_size: std::num::NonZeroU64::new(
                        std::mem::size_of::<BrushStrokeUniform>() as u64
                    ),
                },
                count: None,
            },
        ],
    })
}

pub fn make_copy_tile_bind_group_layout(
    device: &wgpu::Device,
) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("Copy Tile Bind Group Layout"),
        entries: &[
            bind_group_texture_entry(0),
            bind_group_sampler_entry(1),
            bind_group_uniform_entry(2),
        ],
    })
}

pub fn make_sample_color_bind_group_layout(
    device: &wgpu::Device,
) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("Brush Sample Color Bind Group Layout"),
        entries: &[
            bind_group_texture_entry(0),
            bind_group_texture_entry(1),
            bind_group_sampler_entry(2),
            wgpu::BindGroupLayoutEntry {
                binding: 3,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: true,
                    min_binding_size: std::num::NonZeroU64::new(
                        std::mem::size_of::<SampleBrushColorUniform>() as u64
                    ),
                },
                count: None,
            },
        ],
    })
}

pub fn make_brush_compositor_bind_group_layout(
    device: &wgpu::Device,
) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("Brush Compositor Bind Group Layout"),
        entries: &[
            bind_group_texture_entry(0),
            bind_group_texture_entry(1),
            bind_group_sampler_entry(2),
            bind_group_uniform_entry(3),
        ],
    })
}

pub fn create_brush_compositor_bind_group(
    device: &wgpu::Device,
    brush_compositor_bind_group_layout: &wgpu::BindGroupLayout,
    dst_texture: &wgpu::TextureView,
    src_texture: &wgpu::TextureView,
    uniforms: &BrushCompositorUniform,
    sampler: &wgpu::Sampler,
) -> wgpu::BindGroup {
    let uniform_buffer = device.create_buffer_init(
        &wgpu::util::BufferInitDescriptor {
            label: Some("Brush Composite Uniform Buffer"),
            contents: bytemuck::bytes_of(uniforms),
            usage: wgpu::BufferUsages::UNIFORM
                | wgpu::BufferUsages::COPY_DST,
        },
    );

    device.create_bind_group(
        &wgpu::BindGroupDescriptor {
            label: Some("Brush Composite Bind Group"),
            layout: brush_compositor_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        dst_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        src_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        },
    )
}

pub fn create_brush_stroke_transform_uniform_buffer(
    device: &wgpu::Device,
    buffer_size: u64,
) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Brush Stroke Uniform Buffer"),
        size: buffer_size,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

pub fn create_brush_stroke_bind_group(
    device: &wgpu::Device,
    transform_uniform_buffer: &wgpu::Buffer,
    brush_stroke_bind_group_layout: &wgpu::BindGroupLayout,
    stroke_texture: &wgpu::TextureView,
    color_texture: &wgpu::TextureView,
    sampler: &wgpu::Sampler,
) -> wgpu::BindGroup {
    device.create_bind_group(
        &wgpu::BindGroupDescriptor {
            label: Some("Brush Stroke Bind Group"),
            layout: brush_stroke_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        stroke_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        color_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::Buffer(
                        wgpu::BufferBinding {
                            buffer: &transform_uniform_buffer,
                            offset: 0,
                            size: std::num::NonZeroU64::new(
                                std::mem::size_of::<BrushStrokeUniform>() as u64
                            ),
                        },
                    ),
                },
            ],
        },
    )
}

pub fn create_copy_tile_bind_group(
    device: &wgpu::Device,
    copy_tile_bind_group_layout: &wgpu::BindGroupLayout,
    source_texture: &wgpu::TextureView,
    uniforms: &CopyTileUniform,
    sampler: &wgpu::Sampler,
) -> wgpu::BindGroup {
    let uniform_buffer = device.create_buffer_init(
        &wgpu::util::BufferInitDescriptor {
            label: Some("Copy Tile Uniform Buffer"),
            contents: bytemuck::bytes_of(uniforms),
            usage: wgpu::BufferUsages::UNIFORM
                | wgpu::BufferUsages::COPY_DST,
        },
    );

    device.create_bind_group(
        &wgpu::BindGroupDescriptor {
            label: Some("Copy Tile Bind Group"),
            layout: copy_tile_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        source_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        },
    )
}

pub fn create_sample_color_uniform_buffer(
    device: &wgpu::Device,
    buffer_size: u64,
) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Sample Color Uniform Buffer"),
        size: buffer_size,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

pub fn create_sample_color_bind_group(
    device: &wgpu::Device,
    uniform_buffer: &wgpu::Buffer,
    sample_color_bind_group_layout: &wgpu::BindGroupLayout,
    previous_color_texture: &wgpu::TextureView,
    sample_texture: &wgpu::TextureView,
    sampler: &wgpu::Sampler,
) -> wgpu::BindGroup {
    device.create_bind_group(
        &wgpu::BindGroupDescriptor {
            label: Some("Sample Color Bind Group"),
            layout: sample_color_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        previous_color_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        sample_texture,
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::Buffer(
                        wgpu::BufferBinding {
                            buffer: &uniform_buffer,
                            offset: 0,
                            size: std::num::NonZeroU64::new(
                                std::mem::size_of::<SampleBrushColorUniform>() as u64
                            ),
                        },
                    ),
                },
            ],
        },
    )
}
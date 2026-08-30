use glam::{ Mat4 };
use wgpu::util::DeviceExt;

use crate::geometry::{ Vertex };
use crate::uniform::{ BackgroundImageUniform, TransformUniform };

pub struct ImageBackground {
    pub transform_buffer: wgpu::Buffer,
    pub transform_bind_group: wgpu::BindGroup,
    pub properties_uniform: BackgroundImageUniform,
    pub properties_buffer: wgpu::Buffer,
    pub properties_bind_group: wgpu::BindGroup,
    pub pipeline: wgpu::RenderPipeline,
    pub stencil_pipeline: wgpu::RenderPipeline,
}

impl ImageBackground {
    pub fn new(device: &wgpu::Device, image_width: u32, image_height: u32) -> Self {
        let shader = device.create_shader_module(wgpu::include_wgsl!("image_background.wgsl"));

        let transform_uniform = TransformUniform {
            matrix: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ]
        };

        let transform_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Image Background Transform Uniform"),
                contents: bytemuck::bytes_of(&transform_uniform),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            }
        );

        let transform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Image Background Transform Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let transform_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &transform_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: transform_buffer.as_entire_binding(),
            }],
            label: None,
        });

        let properties_uniform = BackgroundImageUniform {
            size: [image_width as f32, image_height as f32],
            _padding: [0.0, 0.0],
            color: [1.0, 0.0, 0.0, 1.0],
        };

        let properties_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Image Background Properties Uniform"),
            contents: bytemuck::bytes_of(&properties_uniform),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let properties_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Image Background Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let properties_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Image Background Bind Group"),
            layout: &properties_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: properties_buffer.as_entire_binding(),
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Image Background Pipeline Layout"),
            bind_group_layouts: &[Some(&transform_bind_group_layout), Some(&properties_bind_group_layout)],
            immediate_size: 0,
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Image Background Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Some(Vertex::layout())],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: Some(false),
                depth_compare: Some(wgpu::CompareFunction::Always),
                stencil: wgpu::StencilState {
                    front: wgpu::StencilFaceState {
                        compare: wgpu::CompareFunction::Equal,
                        fail_op: wgpu::StencilOperation::Keep,
                        depth_fail_op: wgpu::StencilOperation::Keep,
                        pass_op: wgpu::StencilOperation::Keep,
                    },
                    back: wgpu::StencilFaceState::IGNORE,
                    read_mask: 0xFF,
                    write_mask: 0x00,
                },
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let stencil_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Image Background Stencil Write Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Some(Vertex::layout())],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    blend: None,
                    write_mask: wgpu::ColorWrites::empty(),
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: Some(false),
                depth_compare: Some(wgpu::CompareFunction::Always),
                stencil: wgpu::StencilState {
                    front: wgpu::StencilFaceState {
                        compare: wgpu::CompareFunction::Always,
                        fail_op: wgpu::StencilOperation::Keep,
                        depth_fail_op: wgpu::StencilOperation::Keep,
                        pass_op: wgpu::StencilOperation::Replace,
                    },
                    back: wgpu::StencilFaceState::IGNORE,
                    read_mask: 0xFF,
                    write_mask: 0xFF,
                },
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        Self {
            transform_buffer,
            transform_bind_group,
            properties_uniform,
            properties_buffer,
            properties_bind_group,
            pipeline,
            stencil_pipeline,
        }
    }

    pub fn resize(&mut self, queue: &wgpu::Queue, image_width: u32, image_height: u32) {
        let properties_uniform = &mut self.properties_uniform;
        properties_uniform.size[0] = image_width as f32;
        properties_uniform.size[1] = image_height as f32;

        queue.write_buffer(
            &self.properties_buffer,
            0,
            bytemuck::bytes_of(&self.properties_uniform)
        )
    }

    pub fn set_transform(&self, queue: &wgpu::Queue, transform: &Mat4) {
        let transform_uniform: TransformUniform = transform.into();

        queue.write_buffer(
            &self.transform_buffer,
            0,
            bytemuck::bytes_of(&transform_uniform),
        );
    }

    pub fn set_color(&mut self, queue: &wgpu::Queue, r: f32, g: f32, b: f32, alpha: f32) {
        let properties_uniform = &mut self.properties_uniform;
        properties_uniform.color[0] = r;
        properties_uniform.color[1] = g;
        properties_uniform.color[2] = b;
        properties_uniform.color[3] = alpha;

        queue.write_buffer(
            &self.properties_buffer,
            0,
            bytemuck::bytes_of(&self.properties_uniform)
        );
    }

    pub fn draw(&self, pass: &mut wgpu::RenderPass) {
        pass.set_pipeline(&self.pipeline);
        pass.set_stencil_reference(1);
        pass.set_bind_group(0, &self.transform_bind_group, &[]);
        pass.set_bind_group(1, &self.properties_bind_group, &[]);
        pass.draw(0..6, 0..1);
    }

    pub fn draw_to_stencil(&self, pass: &mut wgpu::RenderPass) {
        pass.set_pipeline(&self.stencil_pipeline);
        pass.set_stencil_reference(1);
        pass.set_bind_group(0, &self.transform_bind_group, &[]);
        pass.set_bind_group(1, &self.properties_bind_group, &[]);
        pass.draw(0..6, 0..1);
    }
}

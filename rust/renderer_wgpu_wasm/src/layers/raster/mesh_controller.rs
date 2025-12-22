use bitflags::bitflags;
use wgpu::util::DeviceExt;

use crate::geometry::{ Vertex };
use crate::layers::base::mesh_controller::{ MeshController };
use crate::uniform::{ RasterLayerUniform, TransformUniform };

bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct RasterDrawFlag: u8 {
        const SIZE_CHANGED = 1 << 0;
        const TRANSFORM_CHANGED = 1 << 1;
    }
}

pub struct RasterMeshController {
    pub transform_uniform: TransformUniform,
    pub transform_buffer: wgpu::Buffer,
    pub transform_bind_group: wgpu::BindGroup,
    pub properties_uniform: RasterLayerUniform,
    pub properties_buffer: wgpu::Buffer,
    pub properties_bind_group_layout: wgpu::BindGroupLayout,
    pub properties_bind_group: wgpu::BindGroup,
    pub source_texture: wgpu::Texture,
    pub source_texture_view: wgpu::TextureView,
    pub source_texture_sampler: wgpu::Sampler,
    pub pipeline: wgpu::RenderPipeline,

    draw_flags: RasterDrawFlag,

    name: String,
    width: u32,
    height: u32,
    model_transform: glam::Mat4,
    view_transform: glam::Mat4,
    visible: bool,
    order: u32,
}

impl MeshController for RasterMeshController {
    fn set_name(&mut self, name: &str) {
        self.name = name.to_string();
    }
    fn get_name(&self) -> &str {
        self.name.as_str()
    }

    fn set_size(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
        let properties_uniform = &mut self.properties_uniform;
        properties_uniform.size[0] = width as f32;
        properties_uniform.size[1] = height as f32;
        self.draw_flags |= RasterDrawFlag::SIZE_CHANGED;
    }
    fn get_width(&self) -> u32 {
        self.width
    }
    fn get_height(&self) -> u32 {
        self.height
    }

    fn set_model_transform(&mut self, model_transform: &[f32]) {
        self.model_transform = glam::Mat4::from_cols_array(model_transform.try_into().expect("Transform must be of length 16"));
        // wgpu::web_sys::console::log_1(&format!("{:?}", self.transform).into());
        self.transform_uniform = (self.view_transform * self.model_transform).into();
        self.draw_flags |= RasterDrawFlag::TRANSFORM_CHANGED;
    }

    fn set_view_transform(&mut self, view_transform: &glam::Mat4) {
        self.view_transform = view_transform.clone();
        self.transform_uniform = (self.view_transform * self.model_transform).into();
        self.draw_flags |= RasterDrawFlag::TRANSFORM_CHANGED;
    }

    fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }
    fn get_visible(&self) -> bool {
        self.visible
    }

    fn set_order(&mut self, order: u32) {
        self.order = order;
    }
    fn get_order(&self) -> u32 {
        self.order
    }

    fn set_source_image_data(
        &mut self,
        device: &wgpu::Device, queue: &wgpu::Queue,
        width: u32, height: u32, format: u8, buffer: &[u8]
    ) {
        wgpu::web_sys::console::log_1(&format!("Set image data {:?} {:?}", width, height).into());
        let source_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Raster Layer Source Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb, // TODO - read from format param
            usage: wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let source_texture_view = source_texture.create_view(&wgpu::TextureViewDescriptor::default());

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &source_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            buffer,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(4 * width),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        let properties_bind_group = Self::create_properties_bind_group(
            device,
            &self.properties_buffer,
            &self.properties_bind_group_layout,
            &source_texture_view,
            &self.source_texture_sampler
        );

        self.source_texture = source_texture;
        self.source_texture_view = source_texture_view;
        self.properties_bind_group = properties_bind_group;
    }

    fn draw(
        &mut self,
        queue: &wgpu::Queue,
        pass: &mut wgpu::RenderPass,
    ) {

        if self.draw_flags.contains(RasterDrawFlag::SIZE_CHANGED) {
            queue.write_buffer(
                &self.properties_buffer,
                0,
                bytemuck::bytes_of(&self.properties_uniform)
            );
        }
        if self.draw_flags.contains(RasterDrawFlag::TRANSFORM_CHANGED) {
            queue.write_buffer(
                &self.transform_buffer,
                0,
                bytemuck::bytes_of(&self.transform_uniform),
            );
        }
        self.draw_flags = RasterDrawFlag::empty();

        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &self.transform_bind_group, &[]);
        pass.set_bind_group(1, &self.properties_bind_group, &[]);
        pass.draw(0..6, 0..1);
    }
}

impl RasterMeshController {
    pub fn new(device: &wgpu::Device) -> RasterMeshController {
        let shader = device.create_shader_module(wgpu::include_wgsl!("raster_layer_shader.wgsl"));

        let source_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Raster Layer Source Texture"),
            size: wgpu::Extent3d {
                width: 2,
                height: 2,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let source_texture_view = source_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let source_texture_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Raster Layer Source Texture Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

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
                label: Some("Raster Layer Transform Uniform"),
                contents: bytemuck::bytes_of(&transform_uniform),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            }
        );

        let transform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Raster Layer Transform Bind Group Layout"),
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

        let properties_uniform = RasterLayerUniform {
            size: [1.0, 1.0],
            _padding: [0.0, 0.0],
        };

        let properties_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Raster Layer Properties Uniform"),
            contents: bytemuck::bytes_of(&properties_uniform),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let properties_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Raster Layer Properties Bind Group Layout"),
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
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let properties_bind_group = Self::create_properties_bind_group(
            device,
            &properties_buffer,
            &properties_bind_group_layout,
            &source_texture_view,
            &source_texture_sampler
        );

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Raster Layer Pipeline Layout"),
            bind_group_layouts: &[&transform_bind_group_layout, &properties_bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Raster Layer Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::layout()],
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
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None, // TODO
        });

        RasterMeshController {
            transform_uniform,
            transform_buffer,
            transform_bind_group,
            properties_uniform,
            properties_buffer,
            properties_bind_group_layout,
            properties_bind_group,
            source_texture,
            source_texture_view,
            source_texture_sampler,
            pipeline,

            draw_flags: RasterDrawFlag::empty(),

            name: "".to_string(),
            width: 1,
            height: 1,
            model_transform: glam::Mat4::IDENTITY,
            view_transform: glam::Mat4::IDENTITY,
            visible: true,
            order: 0,
        }
    }

    fn create_properties_bind_group(
        device: &wgpu::Device,
        properties_buffer: &wgpu::Buffer,
        properties_bind_group_layout: &wgpu::BindGroupLayout,
        source_texture_view: &wgpu::TextureView,
        source_texture_sampler: &wgpu::Sampler,
    ) -> wgpu::BindGroup {
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Raster Layer Properties Bind Group"),
            layout: properties_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: properties_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&source_texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&source_texture_sampler),
                },
            ],
        })
    }
}
use std::fmt;
use crate::compositor::pipeline_helpers::{
    create_uniform_buffer,
    create_pipeline,
    make_brush_stroke_bind_group_layout,
    make_copy_tile_bind_group_layout,
    make_sample_color_bind_group_layout,
    make_brush_compositor_bind_group_layout,
    create_brush_compositor_bind_group,
    create_brush_stroke_bind_group,
    create_copy_tile_bind_group,
    create_sample_color_uniform_buffer,
    create_sample_color_bind_group,
};
use crate::state::WorkingFileLayerBlendingMode;
use crate::wgpu_util::RenderTarget;
use crate::uniform::{ BrushCompositorUniform, BrushStrokeUniform, CopyTileUniform, SampleBrushColorUniform };

#[derive(Debug)]
pub enum BrushStrokeError {
    InvalidTextureSize,
}
impl fmt::Display for BrushStrokeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BrushStrokeError::InvalidTextureSize => write!(f, "texture dimensions must be non-zero"),
        }
    }
}
impl std::error::Error for BrushStrokeError {}

pub struct RendererBrushStrokeSettings {
    pub max_move_count: u32, // Need a hard limit to determine how big buffer passed to GPU will be
    pub color: Vec<f32>,
    pub size: f32,
    pub hardness: f32,
    pub color_blending_persistence: f32,
    pub layer_id: i32,
    pub blending_mode: WorkingFileLayerBlendingMode,
}

pub struct BrushStroke<'a> {
    texture: &'a wgpu::TextureView,
    texture_width: u32,
    texture_height: u32,
    texture_sampler: wgpu::Sampler,

    settings: RendererBrushStrokeSettings,
    brush_min_concentration: f32,

    layer_transform: glam::Mat4,
    layer_transform_inverse: glam::Mat4,

    brush_stroke_uniform_buffer: wgpu::Buffer,
    brush_stroke_bind_group_layout: wgpu::BindGroupLayout,
    brush_stroke_pipeline: wgpu::RenderPipeline,
    copy_tile_uniform_buffer: wgpu::Buffer,
    copy_tile_bind_group_layout: wgpu::BindGroupLayout,
    copy_tile_pipeline: wgpu::RenderPipeline,
    destination_pipeline: wgpu::RenderPipeline,
    sample_color_uniform_index: usize, // +1 for each time a new uniform is created in the command encoder queue
    sample_color_uniform_buffer: wgpu::Buffer,
    sample_color_uniform_stride: usize,
    sample_color_bind_group_layout: wgpu::BindGroupLayout,
    sample_color_bind_group_1: wgpu::BindGroup,
    sample_color_bind_group_2: wgpu::BindGroup,
    sample_color_pipeline: wgpu::RenderPipeline,
    compositor_uniform_buffer: wgpu::Buffer,
    compositor_bind_group_layout: wgpu::BindGroupLayout,
    compositor_pipeline: wgpu::RenderPipeline,

    tile_size: u32,
    x_tile_count: u32,
    y_tile_count: u32,

    x: f32,
    y: f32,

    all_dirty_tiles: Vec<u8>,
    composite_dirty_tiles: Vec<u8>,

    active_brush_color_render_target: u8,
    brush_color_render_target_1: RenderTarget,
    brush_color_render_target_2: RenderTarget,

    destination_texture_render_targets: Vec<Option<RenderTarget>>,
    brush_stroke_render_targets: Vec<Option<RenderTarget>>,
    brush_blend_render_target_stack: Vec<RenderTarget>,
    output_render_target_stack: Vec<RenderTarget>,
}

fn performance_now() -> f64 {
    wgpu::web_sys::window()
        .unwrap()
        .performance()
        .unwrap()
        .now()
}

impl<'a> BrushStroke<'a> {
    pub fn new(
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        selection_mask: Option<f32>, // TODO - placeholder
        texture: &'a wgpu::TextureView,
        texture_width: u32,
        texture_height: u32,
        layer_transform: glam::Mat4,
        settings: RendererBrushStrokeSettings,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        if texture_width == 0 || texture_height == 0 {
            return Err(Box::new(BrushStrokeError::InvalidTextureSize));
        }

        let alignment = device.limits().min_uniform_buffer_offset_alignment as usize;

        let layer_transform_inverse = layer_transform.inverse();

        let min_tile_size = 256_u32.max(texture_width.max(texture_height) / 8);
        let approximate_tile_count =
            ((settings.size * settings.size).sqrt() / 1024.0).ceil().max(1.0);
        let estimated_tile_size =
            ((settings.size * settings.size) / approximate_tile_count)
                .sqrt()
                .floor()
                .max(min_tile_size as f32)
                .min(8192.0);
        
        let tile_size = (estimated_tile_size as u32).max(1).next_power_of_two();

        let x_tile_count = texture_width.div_ceil(tile_size);
        let y_tile_count = texture_height.div_ceil(tile_size);
        let tile_count = (x_tile_count * y_tile_count) as usize;

        let render_format = if RenderTarget::is_texture_format_supported(adapter, wgpu::TextureFormat::Rgba16Float) {
            wgpu::TextureFormat::Rgba16Float
        } else {
            wgpu::TextureFormat::Rgba8Unorm
        };

        let texture_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Brush Stroke Texture Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            mipmap_filter: wgpu::MipmapFilterMode::Nearest,
            ..Default::default()
        });

        let brush_color_render_target_1 = RenderTarget::new(
            &device,
            8,
            8,
            render_format,
            "Brush Color 1",
        );

        let brush_color_render_target_2 = RenderTarget::new(
            &device,
            8,
            8,
            render_format,
            "Brush Color 2",
        );

        let brush_stroke_uniform_buffer = create_uniform_buffer::<BrushStrokeUniform>(
            &device,
            "Brush Stroke Uniform Buffer",
        );
        let brush_stroke_bind_group_layout =
            make_brush_stroke_bind_group_layout(&device);
        let brush_stroke_pipeline = create_pipeline(
            &device,
            &brush_stroke_bind_group_layout,
            render_format,
            wgpu::include_wgsl!("shader/brush_stroke.wgsl"),
            "Brush Stroke Pipeline",
        );

        let copy_tile_uniform_buffer = create_uniform_buffer::<CopyTileUniform>(
            &device,
            "Brush Copy Tile Uniform Buffer"
        );
        let copy_tile_bind_group_layout =
            make_copy_tile_bind_group_layout(&device);
        let copy_tile_pipeline = create_pipeline(
            &device,
            &copy_tile_bind_group_layout,
            render_format,
            wgpu::include_wgsl!("shader/copy_tile.wgsl"),
            "Brush Copy Tile Pipeline",
        );
        let destination_pipeline = create_pipeline(
            &device,
            &copy_tile_bind_group_layout,
            wgpu::TextureFormat::Rgba8UnormSrgb,
            wgpu::include_wgsl!("shader/copy_tile.wgsl"),
            "Brush Copy Tile Pipeline",
        );

        let sample_color_bind_group_layout =
            make_sample_color_bind_group_layout(&device);
        let sample_color_uniform_stride = (std::mem::size_of::<SampleBrushColorUniform>() + alignment - 1) & !(alignment - 1);
        let sample_color_uniform_buffer_size = sample_color_uniform_stride * settings.max_move_count as usize;
        let sample_color_uniform_buffer =
            create_sample_color_uniform_buffer(&device, sample_color_uniform_buffer_size as u64);
        let sample_color_bind_group_1 = create_sample_color_bind_group(
            device,
            &sample_color_uniform_buffer,
            &sample_color_bind_group_layout,
            &brush_color_render_target_1.view,
            &texture,
            &texture_sampler,
        );
        let sample_color_bind_group_2 = create_sample_color_bind_group(
            device,
            &sample_color_uniform_buffer,
            &sample_color_bind_group_layout,
            &brush_color_render_target_2.view,
            &texture,
            &texture_sampler,
        );
        let sample_color_pipeline = create_pipeline(
            &device,
            &sample_color_bind_group_layout,
            render_format,
            wgpu::include_wgsl!("shader/brush_sample_color.wgsl"),
            "Sample Brush Color Pipeline",
        );

        /*
         * TODO - read selection mask 
         * and send it as a texture to the compositor shader
         */

        let compositor_uniform_buffer = create_uniform_buffer::<BrushCompositorUniform>(
            &device,
            "Brush Composite Uniform Buffer",
        );
        let compositor_bind_group_layout = 
            make_brush_compositor_bind_group_layout(&device);
        let compositor_pipeline = create_pipeline(
            &device,
            &compositor_bind_group_layout,
            texture.texture().format(),
            wgpu::include_wgsl!("shader/brush_compositor.wgsl"),
            "Brush Compositor Pipeline",
        );

        Ok(
            Self {
                texture,
                texture_width,
                texture_height,
                texture_sampler,

                settings,
                brush_min_concentration: 1.0,

                layer_transform,
                layer_transform_inverse,

                brush_stroke_uniform_buffer,
                brush_stroke_bind_group_layout,
                brush_stroke_pipeline,
                copy_tile_uniform_buffer,
                copy_tile_bind_group_layout,
                copy_tile_pipeline,
                destination_pipeline,
                sample_color_uniform_index: 0,
                sample_color_uniform_buffer,
                sample_color_uniform_stride,
                sample_color_bind_group_layout,
                sample_color_bind_group_1,
                sample_color_bind_group_2,
                sample_color_pipeline,
                compositor_uniform_buffer,
                compositor_bind_group_layout,
                compositor_pipeline,

                tile_size,
                x_tile_count,
                y_tile_count,

                x: 0.0,
                y: 0.0,

                all_dirty_tiles: vec![0; tile_count],
                composite_dirty_tiles: vec![0; tile_count],

                active_brush_color_render_target: 1,
                brush_color_render_target_1,
                brush_color_render_target_2,

                destination_texture_render_targets:
                    (0..tile_count).map(|_| None).collect(),
                brush_stroke_render_targets:
                    (0..tile_count).map(|_| None).collect(),
                brush_blend_render_target_stack: vec![],
                output_render_target_stack: vec![],
                
            }
        )
    }

    pub fn move_pointer(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        quad_vertex_buffer: &wgpu::Buffer,
        x: f32,
        y: f32,
        size: f32,
        density: f32,
        color_blending_strength: f32,
        concentration: f32,
    ) {
        let mut bearing = (self.y - y).atan2(x - self.x);
        if bearing < 0.0 {
            bearing += std::f32::consts::TAU;
        }

        self.x = x;
        self.y = y;

        self.brush_min_concentration =
            self.brush_min_concentration.min(concentration);

        let brush_size = size;
        let brush_left = x - brush_size * 0.5;
        let brush_top = y - brush_size * 0.5;

        let corners = [
            self.layer_transform_inverse.transform_point3(
                glam::Vec3::new(brush_left, brush_top, 0.0),
            ),
            self.layer_transform_inverse.transform_point3(
                glam::Vec3::new(brush_left + brush_size, brush_top, 0.0),
            ),
            self.layer_transform_inverse.transform_point3(
                glam::Vec3::new(brush_left, brush_top + brush_size, 0.0),
            ),
            self.layer_transform_inverse.transform_point3(
                glam::Vec3::new(
                    brush_left + brush_size,
                    brush_top + brush_size,
                    0.0,
                ),
            ),
        ];

        let mut aabb_min = glam::Vec2::new(
            f32::INFINITY,
            f32::INFINITY,
        );

        let mut aabb_max = glam::Vec2::new(
            f32::NEG_INFINITY,
            f32::NEG_INFINITY,
        );

        for corner in corners {
            aabb_min.x = aabb_min.x.min(corner.x);
            aabb_min.y = aabb_min.y.min(corner.y);
            aabb_max.x = aabb_max.x.max(corner.x);
            aabb_max.y = aabb_max.y.max(corner.y);
        }

        let texture_width = self.texture_width as f32;
        let texture_height = self.texture_height as f32;

        let aabb_offset_and_size = [
            aabb_min.x / texture_width,
            aabb_min.y / texture_height,
            (aabb_max.x - aabb_min.x) / texture_width,
            (aabb_max.y - aabb_min.y) / texture_height,
        ];

        let active_brush_color_render_target_number = self.active_brush_color_render_target;

        /*
         * Step 1: Sample the average color underneath the brush stamp
         */
        {
            let (active_brush_color_render_target, inactive_brush_color_render_target) =
                if active_brush_color_render_target_number == 1 {
                    (
                        &self.brush_color_render_target_1,
                        &self.brush_color_render_target_2,
                    )
                } else {
                    (
                        &self.brush_color_render_target_2,
                        &self.brush_color_render_target_1,
                    )
                };
            
            let sample_color_uniforms = SampleBrushColorUniform {
                tile_offset_and_size: aabb_offset_and_size,

                brush_color: [
                    self.settings.color[0],
                    self.settings.color[1],
                    self.settings.color[2],
                    density,
                ],

                blending_persistence_bearing_concentration: [
                    color_blending_strength,
                    (0.001_f32).max((1.0 - self.settings.color_blending_persistence) * 0.01),
                    bearing,
                    concentration,
                ],
            };

            let sample_color_uniform_offset = self.sample_color_uniform_index * self.sample_color_uniform_stride;
            self.sample_color_uniform_index += 1;
            queue.write_buffer(
                &self.sample_color_uniform_buffer,
                sample_color_uniform_offset as u64,
                bytemuck::bytes_of(&sample_color_uniforms),
            );

            let sample_color_bind_group = if active_brush_color_render_target_number == 1 {
                &self.sample_color_bind_group_2
            } else {
                &self.sample_color_bind_group_1
            };

            {
                let color_attachment =
                    wgpu::RenderPassColorAttachment {
                        view: &active_brush_color_render_target.view,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(
                                wgpu::Color::TRANSPARENT,
                            ),
                            store: wgpu::StoreOp::Store,
                        },
                    };

                let mut pass = encoder.begin_render_pass(
                    &wgpu::RenderPassDescriptor {
                        label: Some("Sample Brush Color"),
                        color_attachments: &[Some(color_attachment)],
                        depth_stencil_attachment: None,
                        occlusion_query_set: None,
                        timestamp_writes: None,
                        multiview_mask: None,
                    },
                );

                pass.set_pipeline(&self.sample_color_pipeline);
                pass.set_bind_group(0, sample_color_bind_group, &[sample_color_uniform_offset as u32]);
                pass.set_vertex_buffer(
                    0,
                    quad_vertex_buffer.slice(..),
                );

                pass.set_viewport(
                    0.0,
                    0.0,
                    8.0,
                    8.0,
                    0.0,
                    1.0,
                );

                pass.draw(0..6, 0..1);
            }

            self.active_brush_color_render_target = if self.active_brush_color_render_target == 1 { 2 } else { 1 };
        }

        /*
         * Step 2: Loop through each tile and render only tiles affected by the brush stamp
         */
        let brush_hardness = self.settings.hardness;
        let layer_transform = self.layer_transform;
        for xi in 0..self.x_tile_count {
            let tile_x = xi * self.tile_size;
            let tile_width = self
                .tile_size
                .min(self.texture_width - tile_x);
            let tile_right = tile_x + tile_width;

            if (tile_right as f32) < aabb_min.x
                || (tile_x as f32) > aabb_max.x {
                continue;
            }

            for yi in 0..self.y_tile_count {
                let tile_y = yi * self.tile_size;
                let tile_height = self
                    .tile_size
                    .min(self.texture_height - tile_y);
                let tile_bottom = tile_y + tile_height;

                if (tile_bottom as f32) < aabb_min.y
                    || (tile_y as f32) > aabb_max.y {
                    continue;
                }

                let brush_stroke_render_target_index = self.create_brush_stroke_render_target(
                    adapter,
                    device,
                    xi,
                    yi,
                    tile_width,
                    tile_height,
                );
                let brush_stroke_render_target_option = &self.brush_stroke_render_targets[brush_stroke_render_target_index];

                /*
                 * Render one of the tiles for self brush stroke.
                 */
                if let Some(brush_stroke_render_target) = brush_stroke_render_target_option {

                    let brush_tile_offset_x =
                        (tile_x as f32 - brush_left) / brush_size;

                    let brush_tile_offset_y =
                        (tile_y as f32 - brush_top) / brush_size;

                    let brush_tile_scale_x =
                        tile_width as f32 / brush_size;

                    let brush_tile_scale_y =
                        tile_height as f32 / brush_size;
                    
                    let tile_transform_reset =
                        glam::Mat4::from_translation(glam::Vec3::new(
                            -brush_left / brush_size,
                            1.0 + brush_top / brush_size,
                            0.0,
                        ))
                        * glam::Mat4::from_scale(glam::Vec3::new(
                            1.0 / brush_size,
                            -1.0 / brush_size,
                            1.0,
                        ));
                    
                    let tile_transform_reset_inverse =
                        tile_transform_reset.inverse();
                    
                    let brush_transform = tile_transform_reset
                        * layer_transform
                        * tile_transform_reset_inverse
                        * glam::Mat4::from_translation(glam::Vec3::new(
                            brush_tile_offset_x,
                            1.0
                                - brush_tile_offset_y
                                - brush_tile_scale_y,
                            0.0,
                        ))
                        * glam::Mat4::from_scale(glam::Vec3::new(
                            brush_tile_scale_x,
                            brush_tile_scale_y,
                            1.0,
                        ));
                    
                    let brush_stroke_uniforms = BrushStrokeUniform {
                        tile_offset_and_size: [0.0, 0.0, 1.0, 1.0],
                        brush_transform: brush_transform.to_cols_array_2d(),
                        brush_hardness_and_padding: [brush_hardness, 0.0, 0.0, 0.0],
                    };

                    queue.write_buffer(
                        &self.brush_stroke_uniform_buffer,
                        0,
                        bytemuck::bytes_of(&brush_stroke_uniforms),
                    );

                    let active_brush_color_render_target =
                        if active_brush_color_render_target_number == 1 {
                            &self.brush_color_render_target_1
                        } else {
                            &self.brush_color_render_target_2
                        };

                    // let brush_stroke_bind_group = create_brush_stroke_bind_group(
                    //     device,
                    //     &self.brush_stroke_bind_group_layout,
                    //     &brush_stroke_render_target.view,
                    //     &active_brush_color_render_target.view,
                    //     &brush_stroke_uniforms,
                    //     &self.texture_sampler,
                    // );

                //     let brush_blend_render_target_index =
                //         self.create_brush_blend_render_target(
                //             adapter,
                //             device,
                //             tile_width,
                //             tile_height,
                //         );
                //     let brush_blend_render_target = &self.brush_blend_render_target_stack[brush_blend_render_target_index];

                //     {
                //         let color_attachment =
                //             wgpu::RenderPassColorAttachment {
                //                 view: &brush_blend_render_target.view,
                //                 depth_slice: None,
                //                 resolve_target: None,
                //                 ops: wgpu::Operations {
                //                     load: wgpu::LoadOp::Clear(
                //                         wgpu::Color::TRANSPARENT,
                //                     ),
                //                     store: wgpu::StoreOp::Store,
                //                 },
                //             };

                //         let mut pass = encoder.begin_render_pass(
                //             &wgpu::RenderPassDescriptor {
                //                 label: Some("Render Brush Blend Tile"),
                //                 color_attachments: &[Some(
                //                     color_attachment,
                //                 )],
                //                 depth_stencil_attachment: None,
                //                 occlusion_query_set: None,
                //                 timestamp_writes: None,
                //                 multiview_mask: None,
                //             },
                //         );

                //         pass.set_pipeline(&self.brush_stroke_pipeline);
                //         pass.set_bind_group(0, &brush_stroke_bind_group, &[]);
                //         pass.set_vertex_buffer(
                //             0,
                //             quad_vertex_buffer.slice(..),
                //         );

                //         pass.set_viewport(
                //             0.0,
                //             0.0,
                //             tile_width as f32,
                //             tile_height as f32,
                //             0.0,
                //             1.0,
                //         );

                //         pass.draw(0..6, 0..1);
                //     }

                //     /*
                //      * Copy the temporary brush stroke result into the persistent
                //      * brush render target for self tile.
                //      */
                //     let copy_uniforms = CopyTileUniform {
                //         tile_offset_and_size: [0.0, 0.0, 1.0, 1.0],
                //     };

                //     queue.write_buffer(
                //         &self.copy_tile_uniform_buffer,
                //         0,
                //         bytemuck::bytes_of(&copy_uniforms),
                //     );

                //     let copy_bind_group = create_copy_tile_bind_group(
                //         device,
                //         &self.copy_tile_bind_group_layout,
                //         &brush_blend_render_target.view,
                //         &copy_uniforms,
                //         &self.texture_sampler,
                //     );

                //     let mut brush_stroke_render_target_option = &self.brush_stroke_render_targets[brush_stroke_render_target_index];
                    
                //     if let Some(brush_stroke_render_target) = brush_stroke_render_target_option {
                //         let color_attachment =
                //             wgpu::RenderPassColorAttachment {
                //                 view: &brush_stroke_render_target.view,
                //                 depth_slice: None,
                //                 resolve_target: None,
                //                 ops: wgpu::Operations {
                //                     load: wgpu::LoadOp::Clear(
                //                         wgpu::Color::TRANSPARENT,
                //                     ),
                //                     store: wgpu::StoreOp::Store,
                //                 },
                //             };

                //         let mut pass = encoder.begin_render_pass(
                //             &wgpu::RenderPassDescriptor {
                //                 label: Some("Copy Brush Tile"),
                //                 color_attachments: &[Some(
                //                     color_attachment,
                //                 )],
                //                 depth_stencil_attachment: None,
                //                 occlusion_query_set: None,
                //                 timestamp_writes: None,
                //                 multiview_mask: None,
                //             },
                //         );

                //         pass.set_pipeline(&self.copy_tile_pipeline);
                //         pass.set_bind_group(0, &copy_bind_group, &[]);
                //         pass.set_vertex_buffer(
                //             0,
                //             quad_vertex_buffer.slice(..),
                //         );

                //         pass.set_viewport(
                //             0.0,
                //             0.0,
                //             tile_width as f32,
                //             tile_height as f32,
                //             0.0,
                //             1.0,
                //         );

                //         pass.draw(0..6, 0..1);
                //     }

                }

                let tile_index =
                    (yi * self.x_tile_count + xi) as usize;
                self.all_dirty_tiles[tile_index] = 1;
                self.composite_dirty_tiles[tile_index] = 1;
            }
        }

    }

    pub fn composite(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        quad_vertex_buffer: &wgpu::Buffer,
    ) {
        for i in 0..self.composite_dirty_tiles.len() {
            if (self.composite_dirty_tiles[i] == 0) {
                continue;
            }
            self.composite_dirty_tiles[i] = 0;

            let yi = i as u32 / self.x_tile_count;
            let xi = i as u32 - yi * self.x_tile_count;
            let tile_x = xi * self.tile_size;
            let tile_y = yi * self.tile_size;
            let tile_width = self.tile_size.min(self.texture_width - tile_x);
            let tile_height = self.tile_size.min(self.texture_height - tile_y);

            let destination_render_target_index = self.create_destination_texture_render_target(
                adapter,
                device,
                queue,
                encoder,
                quad_vertex_buffer,
                xi,
                yi,
                tile_width,
                tile_height,
            );

            let brush_stroke_render_target_index = self.create_brush_stroke_render_target(
                adapter,
                device,
                xi,
                yi,
                tile_width,
                tile_height,
            );

            let output_render_target_index = self.create_output_tile_render_target(
                adapter,
                device,
                tile_width,
                tile_height,
            );

            let destination_render_target_option = &self.destination_texture_render_targets[destination_render_target_index];
            let brush_stroke_render_target_option = &self.brush_stroke_render_targets[brush_stroke_render_target_index];
            let output_render_target = &self.output_render_target_stack[output_render_target_index];

            if let Some(destination_render_target) = destination_render_target_option
                && let Some(brush_stroke_render_target) = brush_stroke_render_target_option {

                let brush_compositor_uniforms = BrushCompositorUniform {
                    dst_offset_and_size: [0.0, 0.0, 1.0, 1.0],
                    brush_alpha_concentration: [
                        self.settings.color[3],
                        self.brush_min_concentration,
                    ],
                    selection_mask_enabled: 0, // TODO - implement selection mask
                    blending_mode: 0, // TODO - blending mode
                    selection_mask_transform: glam::Mat4::IDENTITY.to_cols_array_2d(), // TODO - selection mask
                };

                queue.write_buffer(
                    &self.compositor_uniform_buffer,
                    0,
                    bytemuck::bytes_of(&brush_compositor_uniforms),
                );

                let brush_compositor_bind_group = create_brush_compositor_bind_group(
                    device,
                    &self.compositor_bind_group_layout,
                    &destination_render_target.view,
                    &brush_stroke_render_target.view,
                    &brush_compositor_uniforms,
                    &self.texture_sampler,
                );

                {
                    let color_attachment =
                        wgpu::RenderPassColorAttachment {
                            view: &output_render_target.view,
                            depth_slice: None,
                            resolve_target: None,
                            ops: wgpu::Operations {
                                load: wgpu::LoadOp::Clear(
                                    wgpu::Color::TRANSPARENT,
                                ),
                                store: wgpu::StoreOp::Store,
                            },
                        };

                    let mut pass = encoder.begin_render_pass(
                        &wgpu::RenderPassDescriptor {
                            label: Some("Render Composite Tile"),
                            color_attachments: &[Some(
                                color_attachment,
                            )],
                            depth_stencil_attachment: None,
                            occlusion_query_set: None,
                            timestamp_writes: None,
                            multiview_mask: None,
                        },
                    );

                    pass.set_pipeline(&self.compositor_pipeline);
                    pass.set_bind_group(0, &brush_compositor_bind_group, &[]);
                    pass.set_vertex_buffer(
                        0,
                        quad_vertex_buffer.slice(..),
                    );

                    pass.set_viewport(
                        0.0,
                        0.0,
                        tile_width as f32,
                        tile_height as f32,
                        0.0,
                        1.0,
                    );

                    pass.draw(0..6, 0..1);
                }

                let copy_size = wgpu::Extent3d {
                    width: tile_width,
                    height: tile_height,
                    depth_or_array_layers: 1,
                };
                let source_origin = wgpu::Origin3d {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                let destination_origin = wgpu::Origin3d {
                    x: tile_x,
                    y: self.texture_height - tile_height - tile_y,
                    z: 0,
                };
                encoder.copy_texture_to_texture(
                    wgpu::TexelCopyTextureInfo {
                        texture: &output_render_target.texture,
                        mip_level: 0,
                        origin: source_origin,
                        aspect: wgpu::TextureAspect::All,
                    },
                    wgpu::TexelCopyTextureInfo {
                        texture: &self.texture.texture(),
                        mip_level: 0,
                        origin: destination_origin,
                        aspect: wgpu::TextureAspect::All,
                    },
                    copy_size,
                );

            }
        }
    }

    // fn collect_tiles()

    fn create_brush_stroke_render_target(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        xi: u32,
        yi: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> usize {
        let tile_index = (yi * self.x_tile_count + xi) as usize;
        if (self.brush_stroke_render_targets[tile_index].is_none()) {
            let texture_format = if RenderTarget::is_texture_format_supported(adapter, wgpu::TextureFormat::Rgba16Float) {
                wgpu::TextureFormat::Rgba16Float
            } else {
                wgpu::TextureFormat::Rgba8Unorm
            };
            self.brush_stroke_render_targets[tile_index] = Some(
                RenderTarget::new(
                    device,
                    tile_width,
                    tile_height,
                    texture_format,
                    "Brush Stroke Render Target"
                )
            );
        }
        return tile_index;
    }

    fn create_brush_blend_render_target(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        tile_width: u32,
        tile_height: u32,
    ) -> usize {
        for (index, render_target) in self.brush_blend_render_target_stack.iter().enumerate() {
            if render_target.width == tile_width && render_target.height == tile_height {
                return index;
            }
        }
        let texture_format = if RenderTarget::is_texture_format_supported(adapter, wgpu::TextureFormat::Rgba16Float) {
            wgpu::TextureFormat::Rgba16Float
        } else {
            wgpu::TextureFormat::Rgba8Unorm
        };
        let render_target = RenderTarget::new(
            device,
            tile_width,
            tile_height,
            texture_format,
            "Brush Blend Render Target"
        );
        self.brush_blend_render_target_stack.push(render_target);
        self.brush_blend_render_target_stack.len() - 1
    }

    fn create_destination_texture_render_target(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        quad_vertex_buffer: &wgpu::Buffer,
        xi: u32,
        yi: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> usize {
        let tile_index = (yi * self.x_tile_count + xi) as usize;
        if self.destination_texture_render_targets[tile_index].is_none() {
            let render_target = RenderTarget::new(
                device,
                tile_width,
                tile_height,
                wgpu::TextureFormat::Rgba8UnormSrgb,
                "Brush Destination Texture Render Target"
            );

            let copy_uniforms = CopyTileUniform {
                tile_offset_and_size: [
                    ((xi * self.tile_size) / self.texture_width) as f32,
                    ((yi * self.tile_size) / self.texture_height) as f32,
                    (tile_width / self.texture_width) as f32,
                    (tile_height / self.texture_height) as f32,
                ],
            };

            queue.write_buffer(
                &self.copy_tile_uniform_buffer,
                0,
                bytemuck::bytes_of(&copy_uniforms),
            );

            let copy_bind_group = create_copy_tile_bind_group(
                device,
                &self.copy_tile_bind_group_layout,
                &self.texture,
                &copy_uniforms,
                &self.texture_sampler,
            );

            {
                let color_attachment =
                    wgpu::RenderPassColorAttachment {
                        view: &render_target.view,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(
                                wgpu::Color::TRANSPARENT,
                            ),
                            store: wgpu::StoreOp::Store,
                        },
                    };

                let mut pass = encoder.begin_render_pass(
                    &wgpu::RenderPassDescriptor {
                        label: Some("Copy Destination Texture Tile"),
                        color_attachments: &[Some(
                            color_attachment,
                        )],
                        depth_stencil_attachment: None,
                        occlusion_query_set: None,
                        timestamp_writes: None,
                        multiview_mask: None,
                    },
                );

                pass.set_pipeline(&self.destination_pipeline);
                pass.set_bind_group(0, &copy_bind_group, &[]);
                pass.set_vertex_buffer(
                    0,
                    quad_vertex_buffer.slice(..),
                );

                pass.set_viewport(
                    0.0,
                    0.0,
                    tile_width as f32,
                    tile_height as f32,
                    0.0,
                    1.0,
                );

                pass.draw(0..6, 0..1);
            }

            self.destination_texture_render_targets[tile_index] = Some(render_target);
        }
        return tile_index;
    }

    fn create_output_tile_render_target(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        tile_width: u32,
        tile_height: u32,
    ) -> usize {
        for (index, render_target) in self.output_render_target_stack.iter().enumerate() {
            if render_target.width == tile_width && render_target.height == tile_height {
                return index;
            }
        }
        let render_target = RenderTarget::new(
            device,
            tile_width,
            tile_height,
            self.texture.texture().format(),
            "Brush Output Tile Render Target",
        );
        self.output_render_target_stack.push(render_target);
        self.output_render_target_stack.len() - 1
    }
}

use crate::compositor::brush_stroke::{
    BrushStroke,
    BrushStrokeError,
    RendererBrushStrokeSettings
};
use crate::state::{ ImageData, WorkingFileLayerBlendingMode };
use crate::wgpu_util::{ self, RenderTarget };
use crate::rng::FastRng;

pub struct RendererBrushStrokePreviewSettings {
    pub color: Vec<f32>,
    pub size: f32,
    pub hardness: f32,
    pub color_blending_persistence: f32,
    pub color_blending_strength: f32,
    pub pressure_min_color_blending_strength: f32,
    pub density: f32,
    pub pressure_min_density: f32,
    pub concentration: f32,
    pub pressure_min_concentration: f32,
    pub pressure_min_size: f32,
    pub jitter: f32,
    pub spacing: f32,
    pub pressure_taper: f32,
}

pub struct BrushPreview {
    pub rng: FastRng,
    pub render_target: RenderTarget,
    pub p0x: f32,
    pub p0y: f32,
    pub p1x: f32,
    pub p1y: f32,
    pub p2x: f32,
    pub p2y: f32,
    pub p3x: f32,
    pub p3y: f32,
    pub t0: f32,
    pub t1: f32,
    pub t2: f32,
    pub t3: f32,
    pub lut: Vec<f32>,
    pub length: f32,
}

fn distance(ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let dx = ax - bx;
    let dy = ay - by;
    dx.hypot(dy)
}

fn get_t(t_prev: f32, x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
    t_prev + distance(x0, y0, x1, y1).sqrt()
}

fn cubic_bezier_at(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
    let q0 = f32::powf(1.0 - t, 3.0) * p0;
    let q1 = 3.0 * f32::powf(1.0 - t, 2.0) * t * p1;
    let q2 = 3.0 * (1.0 - t) * f32::powf(t, 2.0) * p2;
    let q3 = f32::powf(t, 3.0) * p3;
    q0 + q1 + q2 + q3
}

fn performance_now() -> f64 {
    wgpu::web_sys::window()
        .unwrap()
        .performance()
        .unwrap()
        .now()
}

impl BrushPreview {
    pub fn new(
        device: &wgpu::Device,
    ) -> Self {
        let rng = FastRng::new(350824);

        // Generate a LUT
        let p0x: f32 = 10.0;
        let p0y: f32 = 32.0;
        let p1x: f32 = 64.0;
        let p1y: f32 = 32.0 + 48.0;
        let p2x: f32 = 256.0 - 64.0;
        let p2y: f32 = 32.0 - 48.0;
        let p3x: f32 = 256.0 - 12.0;
        let p3y: f32 = 32.0;
        let t0: f32 = 0.0;
        let t1: f32 = get_t(t0, p0x, p0y, p1x, p1y);
        let t2: f32 = get_t(t1, p1x, p1y, p2x, p2y);
        let t3: f32 = get_t(t2, p2x, p2y, p3x, p3y);
        let mut lut: Vec<f32> = vec!(0.0; 64 * 2);
        let mut length: f32 = 0.0;

        let steps: f32 = 64.0;
        let mut t = 0.0;

        let mut prev_x = cubic_bezier_at(p0x, p1x, p2x, p3x, t);
        let mut prev_y = cubic_bezier_at(p0y, p1y, p2y, p3y, t);
        lut[0] = 0.0;
        lut[1] = 0.0;

        let mut x: f32;
        let mut y: f32;
        let steps_count = (steps).round() as usize;
        for i in 1..steps_count {
            t = (i as f32) / steps;
            x = cubic_bezier_at(p0x, p1x, p2x, p3x, t);
            y = cubic_bezier_at(p0y, p1y, p2y, p3y, t);
            length += distance(prev_x, prev_y, x, y);
            lut[i * 2] = t;
            lut[i * 2 + 1] = length;
            prev_x = x;
            prev_y = y;
        }

        let render_target = RenderTarget::new(
            &device,
            256,
            64,
            wgpu::TextureFormat::Rgba8UnormSrgb,
            "Brush Preview",
        );

        Self {
            rng,
            render_target,
            p0x,
            p0y,
            p1x,
            p1y,
            p2x,
            p2y,
            p3x,
            p3y,
            t0,
            t1,
            t2,
            t3,
            lut,
            length,
        }
    }

    pub fn get_t_at_length(&self, target_length: f32) -> f32 {
        if target_length <= 0.0 {
            return 0.0;
        }
        if target_length >= self.length {
            return 1.0;
        }

        let mut low: usize = 0;
        let mut high: usize = (self.lut.len() / 2) - 2;
        while low <= high {
            let mid = (low + high) / 2;
            let mid_length = self.lut[mid * 2 + 1];

            if mid_length < target_length {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        let a_t = self.lut[high * 2];
        let a_length = self.lut[high * 2 + 1];
        let b_t = self.lut[low * 2];
        let b_length = self.lut[low * 2 + 1];
        let ratio = (target_length - a_length) / (b_length - a_length);
        a_t + (b_t - a_t) * ratio
    }

    pub async fn generate_pixel_buffer(
        &mut self,
        adapter: &wgpu::Adapter,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        mut encoder: wgpu::CommandEncoder,
        quad_vertex_buffer: &wgpu::Buffer,
        settings: &RendererBrushStrokePreviewSettings,
    ) -> Result<ImageData, Box<dyn std::error::Error>> {
        self.render_target.clear(
            device,
            queue,
            wgpu::Color {
                r: 0.0,
                g: 0.0,
                b: 0.0,
                a: 0.0,
            },
        );

        let brush_stroke_result = BrushStroke::new(
            adapter,
            device,
            None, // Selection mask
            &self.render_target.view,
            self.render_target.width,
            self.render_target.height,
            glam::Mat4::IDENTITY,
            RendererBrushStrokeSettings {
                max_move_count: 256,
                layer_id: -1,
                color: settings.color.clone(),
                size: settings.size,
                hardness: settings.hardness,
                color_blending_persistence: settings.color_blending_persistence,
                blending_mode: WorkingFileLayerBlendingMode::Normal,
            },
        );
        if let Err(error) = brush_stroke_result {
            return Err(error);
        }
        let mut brush_stroke = brush_stroke_result.unwrap();

        let mut distance: f32 = 0.0;
        let mut t: f32;
        let mut pressure: f32;
        let mut size: f32;
        let mut step: f32;
        let mut x: f32;
        let mut y: f32;
        let mut density: f32;
        let mut color_blending_strength: f32;
        let mut concentration: f32;

        let start = performance_now();
        while distance < self.length {

            t = self.get_t_at_length(distance);
            
            pressure = 1.0;
            if t < 0.4 {
                pressure = t / 0.4;
            } else if t > 0.6 {
                pressure = (1.0 - t) / 0.4;
            }
            
            size = settings.size * (settings.pressure_min_size + (1.0 - settings.pressure_min_size) * pressure);
            density = settings.pressure_min_density + (settings.density - settings.pressure_min_density) * pressure;
            color_blending_strength = settings.pressure_min_color_blending_strength + (settings.color_blending_strength - settings.pressure_min_color_blending_strength) * (1.0 - pressure);
            concentration = settings.pressure_min_concentration + (settings.concentration - settings.pressure_min_concentration) * pressure;

            step = (1.0_f32).max(size * settings.spacing);

            x = cubic_bezier_at(self.p0x, self.p1x, self.p2x, self.p3x, t);
            y = cubic_bezier_at(self.p0y, self.p1y, self.p2y, self.p3y, t);
            x += ((self.rng.next_f32() * 2.0) - 1.0) * settings.jitter * size;
            y += ((self.rng.next_f32() * 2.0) - 1.0) * settings.jitter * size;

            brush_stroke.move_pointer(
                adapter,
                device,
                queue,
                &mut encoder,
                quad_vertex_buffer,
                x,
                y,
                size,
                density,
                color_blending_strength,
                concentration
            );

            distance += step;
        }

        let end = performance_now();
        wgpu::web_sys::console::log_1(&format!(
            "stamp: {} ms",
            end - start,
        ).into());

        brush_stroke.composite(
            adapter,
            device,
            queue,
            &mut encoder,
            quad_vertex_buffer,
        );

        let width = self.render_target.width;
        let height = self.render_target.height;

        let bytes_per_pixel = match self.render_target.format {
            wgpu::TextureFormat::Rgba8UnormSrgb => 4,
            wgpu::TextureFormat::Rgba16Float => 8,
            format => panic!("Unsupported readback format: {format:?}"),
        };

        // wgpu::web_sys::console::log_1(
        //     &wasm_bindgen::JsValue::from_str(&format!(
        //         "bytes per pixel {:?}",
        //         bytes_per_pixel
        //     )),
        // );

        let unpadded_bytes_per_row = width * bytes_per_pixel;

        let padded_bytes_per_row = wgpu::util::align_to(
            unpadded_bytes_per_row,
            wgpu::COPY_BYTES_PER_ROW_ALIGNMENT,
        );

        let buffer_size = padded_bytes_per_row as u64 * height as u64;

        let readback_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Render Target Readback Buffer"),
            size: buffer_size,
            usage: wgpu::BufferUsages::COPY_DST
                | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &self.render_target.texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &readback_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bytes_per_row),
                    rows_per_image: Some(height),
                },
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        queue.submit(Some(encoder.finish()));

        let slice = readback_buffer.slice(..);

        crate::wgpu_util::map_buffer_slice_async(&slice, wgpu::MapMode::Read).await.map_err(|e| {
            Box::new(std::io::Error::other(format!(
                "Failed to map buffer: {e:?}"
            ))) as Box<dyn std::error::Error>
        });

        let pixels = {
            let data = slice.get_mapped_range()
                .map_err(|e| format!("failed to get mapped buffer range: {e:?}"))?;;

            let mut pixels = Vec::with_capacity((width * height * bytes_per_pixel) as usize);
            for y in 0..height as usize {
                let row_start = y * padded_bytes_per_row as usize;
                let row_end = row_start + unpadded_bytes_per_row as usize;
                pixels.extend_from_slice(&data[row_start..row_end]);
            }

            pixels
        };

        readback_buffer.unmap();

        let screenshot_format: u8 = 0;
        Ok(
            ImageData::new(
                width,
                height,
                screenshot_format,
                pixels,
            )
        )
    }

    // pub generate(
    //     device: &wgpu::Device,
    //     original_viewport: [f32; 4],
    //     settings: &RendererBrushStrokeSettings,
    // ): Promise<ImageBitmap> {

        // Unfortunately iOS breaks in strange ways depending on the frame buffer type used.
        // If there's an invisible output, switches up the renderer a bit.
        // if (!this.isSanityCheckRan) {
        //     this.isSanityCheckRan = true;
        //     const sanityBuffer = await this.generatePixelBuffer(originalViewport, {
        //         color: new Float16Array([1, 0, 0, 1]),
        //         size: 1000,
        //         hardness: 1,
        //         colorBlendingPersistence: 1,
        //         colorBlendingStrength: 0,
        //         pressureMinColorBlendingStrength: 0,
        //         density: 1,
        //         pressureMinDensity: 1,
        //         concentration: 1,
        //         pressureMinConcentration: 1,
        //         pressureMinSize: 1000,
        //         jitter: 0,
        //         spacing: 0.01,
        //         pressureTaper: 0,
        //     });
        //     if (sanityBuffer[4] === 0) {
        //         tryHalfFloatColorBuffers();
        //     }
        // }

        // const buffer = await self.generatePixelBuffer(device, original_viewport, settings);

        // return await createImageBitmap(
        //     new ImageData(new Uint8ClampedArray(buffer), this.renderTarget.width, this.renderTarget.height),
        //     { imageOrientation: 'flipY' },
        // );
    // }

}
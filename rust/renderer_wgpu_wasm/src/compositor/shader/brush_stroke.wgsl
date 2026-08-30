struct BrushStroke {
    tile_offset_and_size: vec4<f32>,
    brush_transform: mat4x4<f32>,
    brush_hardness_and_padding: vec4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct FragmentInput {
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0)
var brush_stroke_map: texture_2d<f32>;

@group(0) @binding(1)
var brush_color_map: texture_2d<f32>;

@group(0) @binding(2)
var texture_sampler: sampler;

@group(0) @binding(3)
var<uniform> uniforms: BrushStroke;

fn circle_falloff(radius: f32, hardness: f32) -> f32 {
    let edge = hardness;
    let t = clamp(
        (radius - edge) / max(1.0 - hardness, 0.00001),
        0.0,
        1.0
    );

    let s = t * t * (3.0 - 2.0 * t);

    return mix(1.0, 0.0, s);
}

fn circle(
    uv: vec2<f32>,
    center: vec2<f32>,
    radius: f32,
    hardness: f32
) -> f32 {
    let dist = distance(uv, center);
    let edge = fwidth(dist);

    return circle_falloff(
        clamp(dist / radius, 0.0, 1.0),
        hardness
    ) * smoothstep(
        radius + edge,
        radius - edge,
        dist
    );
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.uv = input.uv;
    output.position = vec4<f32>((input.position.xy * vec2<f32>(2.0, 2.0)) - vec2<f32>(1.0, 1.0), 0.0, 1.0);

    return output;
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
    let tile = uniforms.tile_offset_and_size;

    let base_uv =
        vec2<f32>(
            tile.x,
            1.0 - tile.y - tile.w
        ) + input.uv * tile.zw;

    var brush_stroke_color =
        textureSample(
            brush_stroke_map,
            texture_sampler,
            base_uv
        );

    let brush_uv =
        (uniforms.brush_transform * vec4<f32>(
            input.uv,
            0.0,
            1.0
        )).xy;

    let brush_color =
        textureSample(
            brush_color_map,
            texture_sampler,
            vec2<f32>(0.5, 0.5)
        );

    let brush_stamp_alpha =
        brush_color.a * circle(
            brush_uv,
            vec2<f32>(0.5, 0.5),
            0.5,
            uniforms.brush_hardness_and_padding[0]
        );

    let brush_stamp_color =
        vec4<f32>(
            brush_color.rgb,
            brush_stamp_alpha
        );

    let stroke_is_empty =
        select(
            0.0,
            1.0,
            brush_stroke_color.a <= 0.001
        );

    let stroke_is_nonempty =
        select(
            0.0,
            1.0,
            brush_stroke_color.a >= 0.001
        );

    brush_stroke_color = vec4<f32>(
        stroke_is_empty * brush_stamp_color.rgb +
        stroke_is_nonempty * brush_stroke_color.rgb,
        brush_stroke_color.a
    );

    let output_rgb =
        brush_stamp_color.rgb * brush_stamp_color.a +
        brush_stroke_color.rgb * (1.0 - brush_stamp_color.a);

    let output_a =
        brush_stamp_color.a +
        brush_stroke_color.a * (1.0 - brush_stamp_color.a);

    return vec4<f32>(output_rgb, output_a);
}
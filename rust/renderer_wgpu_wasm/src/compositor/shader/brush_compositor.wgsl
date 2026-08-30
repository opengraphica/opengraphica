const BLENDING_MODE_ERASE: u32 = 1u;
const EPSILON: f32 = 1.0e-6;

struct BrushCompositor {
    dst_offset_and_size: vec4<f32>,
    brush_alpha_concentration: vec2<f32>,
    selection_mask_enabled: u32,
    blending_mode: u32,
    selection_mask_transform: mat4x4<f32>,
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

struct FragmentOutput {
    @location(0) color: vec4<f32>,
};

@group(0) @binding(0)
var dst_map: texture_2d<f32>;

@group(0) @binding(1)
var src_map: texture_2d<f32>;

@group(0) @binding(2)
var image_sampler: sampler;

@group(0) @binding(3)
var<uniform> uniforms: BrushCompositor;


fn srgb_channel_to_linear_srgb_channel(value: f32) -> f32 {
    var calculated_value = 0.0;

    calculated_value +=
        select(
            0.0,
            value / 12.92,
            value <= 0.04045
        );

    calculated_value +=
        select(
            0.0,
            pow((value + 0.055) / 1.055, 2.4),
            value >= 0.04045
        );

    return calculated_value;
}

fn srgb_to_linear_srgb(rgb: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(
        srgb_channel_to_linear_srgb_channel(rgb.r),
        srgb_channel_to_linear_srgb_channel(rgb.g),
        srgb_channel_to_linear_srgb_channel(rgb.b),
        rgb.a
    );
}

fn rgb_to_oklab(rgb: vec3<f32>) -> vec3<f32> {
    let l = pow(
        0.4122214708 * rgb.r +
        0.5363325363 * rgb.g +
        0.0514459929 * rgb.b,
        1.0 / 3.0
    );

    let m = pow(
        0.2119034982 * rgb.r +
        0.6806995451 * rgb.g +
        0.1073969566 * rgb.b,
        1.0 / 3.0
    );

    let s = pow(
        0.0883024619 * rgb.r +
        0.2817188376 * rgb.g +
        0.6299787005 * rgb.b,
        1.0 / 3.0
    );

    return vec3<f32>(
        0.2104542553 * l +
        0.7936177850 * m -
        0.0040720468 * s,

        1.9779984951 * l -
        2.4285922050 * m +
        0.4505937099 * s,

        0.0259040371 * l +
        0.7827717662 * m -
        0.8086757660 * s
    );
}

fn oklab_to_rgb(lab: vec3<f32>) -> vec3<f32> {
    let l = pow(
        lab.x * 0.9999999985 +
        0.3963377922 * lab.y +
        0.2158037581 * lab.z,
        3.0
    );

    let m = pow(
        lab.x * 1.0000000089 -
        0.1055613423 * lab.y -
        0.0638541748 * lab.z,
        3.0
    );

    let s = pow(
        lab.x * 1.0000000547 -
        0.0894841821 * lab.y -
        1.2914855379 * lab.z,
        3.0
    );

    return vec3<f32>(
        4.0767416613 * l -
        3.3077115904 * m +
        0.2309699287 * s,

        -1.2684380041 * l +
        2.6097574007 * m -
        0.3413193963 * s,

        -0.0041960865 * l -
        0.7034186145 * m +
        1.7076147009 * s
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
fn fs_main(input: FragmentInput) -> FragmentOutput {
    let offset_and_size = uniforms.dst_offset_and_size;

    let dst_uv = vec2<f32>(
        offset_and_size.x,
        1.0 - offset_and_size.y - offset_and_size.w
    ) + input.uv * offset_and_size.zw;

    // TODO - selection masks
    let selection_mask_multiplier = 1.0;

    let src_color = srgb_to_linear_srgb(
        textureSample(src_map, image_sampler, input.uv)
    );

    let src_alpha =
        src_color.a *
        uniforms.brush_alpha_concentration.x *
        selection_mask_multiplier;
    
    let dst_color = textureSample(dst_map, image_sampler, dst_uv);

    // Normal source-over compositing
    let normal_alpha =
        src_alpha +
        dst_color.a * (1.0 - src_alpha);
    
    let normal_numerator =
        src_color.rgb * src_alpha +
        dst_color.rgb * dst_color.a * (1.0 - src_alpha);
    
    let normal_rgb =
        normal_numerator / max(normal_alpha, EPSILON);

    // Erase compositing
    let erase_alpha =
        max(dst_color.a - src_alpha, 0.0);

    let erase_rgb =
        (dst_color.rgb * dst_color.a) / max(erase_alpha, EPSILON);
    
    let erase_visible = step(EPSILON, erase_alpha);

    let erase_result = vec4<f32>(
        erase_rgb * erase_visible,
        erase_alpha
    );

    let normal_result = vec4<f32>(
        normal_rgb,
        normal_alpha
    );

    let is_erase =
        uniforms.blending_mode == BLENDING_MODE_ERASE;

    let result = select(
        normal_result, // false
        erase_result, // true
        is_erase
    );

    return FragmentOutput(result);
}

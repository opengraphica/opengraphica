
struct SampleBrushColor {
    tile_offset_and_size: vec4<f32>,
    brush_color: vec4<f32>,
    blending_persistence_bearing_concentration: vec4<f32>,
};


struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0)
var previous_color_map: texture_2d<f32>;

@group(0) @binding(1)
var sample_map: texture_2d<f32>;

@group(0) @binding(2)
var tex_sampler: sampler;

@group(0) @binding(3)
var<uniform> uniforms: SampleBrushColor;

fn linear_srgb_channel_to_srgb_channel(value: f32) -> f32 {
    var calculated_value = 0.0;

    calculated_value +=
        select(
            0.0,
            value * 12.92,
            value <= 0.0031308
        );

    calculated_value +=
        select(
            0.0,
            pow(value, 1.0 / 2.4) * 1.055 - 0.055,
            value >= 0.0031308
        );

    return clamp(calculated_value, 0.0, 1.0);
}

fn linear_srgb_to_srgb(rgb: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(
        linear_srgb_channel_to_srgb_channel(rgb.r),
        linear_srgb_channel_to_srgb_channel(rgb.g),
        linear_srgb_channel_to_srgb_channel(rgb.b),
        rgb.a
    );
}

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

fn srgb_to_linear_srgb_vec3(rgb: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        srgb_channel_to_linear_srgb_channel(rgb.r),
        srgb_channel_to_linear_srgb_channel(rgb.g),
        srgb_channel_to_linear_srgb_channel(rgb.b)
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

fn sample_circle_alpha(
    center: vec2<f32>,
    radius: f32,
    step_size: f32
) -> f32 {
    var sum = 0.0;
    var total_weight = 0.0;
    var y = -radius;

    loop {
        if (y > radius) {
            break;
        }
        var x = -radius;
        loop {
            if (x > radius) {
                break;
            }

            let offset = vec2<f32>(x, y);
            let dist = length(offset);

            // Circle mask (1 inside radius, 0 outside)
            let inside = select(0.0, 1.0, dist <= radius);
            let texel = textureSample(sample_map, tex_sampler, center + offset);

            let weight = (1.0 - dist / radius) * texel.a * inside;

            sum += texel.a * weight;
            total_weight += weight;

            x += step_size;
        }

        y += step_size;
    }

    return sum / max(total_weight, 1e-5);
}

fn sample_arc(
    center: vec2<f32>,
    radius: f32,
    bearing: f32
) -> vec4<f32> {
    var sum = vec4<f32>(0.0);
    var total_weight = 0.0;
    var a = 0.0;

    loop {
        if (a >= 6.28318) {
            break;
        }
        var r = radius;
        loop {
            if (r >= radius * 1.05) {
                break;
            }

            let offset = vec2<f32>(
                -cos(a),
                sin(a)
            ) * r;

            let sample_uv = center + offset;
            let texel = textureSample(sample_map, tex_sampler, sample_uv);

            let direction = vec2<f32>(
                cos(bearing),
                sin(bearing)
            );

            let dir_dot = dot(normalize(offset), direction);
            var weight = max(dir_dot, 0.0) * texel.a;

            weight = pow(weight, 2.0);

            sum += texel * weight;
            total_weight += weight;

            r += radius * 0.01;
        }

        a += 0.2;
    }

    return sum / max(total_weight, 1e-5);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.uv = input.uv;
    output.position = vec4<f32>((input.position.xy * vec2<f32>(2.0, 2.0)) - vec2<f32>(1.0, 1.0), 0.0, 1.0);

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let tile = uniforms.tile_offset_and_size;
    let brush = uniforms.brush_color;
    let blending_data =
        uniforms.blending_persistence_bearing_concentration;

    let sample_center = vec2<f32>(
        tile.x + tile.z * 0.5,
        1.0 - tile.y - tile.w * 0.5
    );

    let radius = tile.w * 0.5;
    let bearing = blending_data.z;

    let sampled_color = sample_arc(
        sample_center,
        radius,
        bearing
    );

    let previous_sample = textureSample(
        previous_color_map,
        tex_sampler,
        vec2<f32>(0.5, 0.5)
    );

    let previous_color = srgb_to_linear_srgb(previous_sample);

    let blending = min(
        blending_data.x,
        sampled_color.a
    );

    let persistence = min(
        1.0,
        select(0.0, 1.0, previous_color.a <= 0.001) +
        blending_data.y
    );

    // let concentration = blending_data.w;

    let brush_linear =
        srgb_to_linear_srgb_vec3(brush.rgb);

    let sampled_linear =
        srgb_to_linear_srgb_vec3(sampled_color.rgb);

    let blended_oklab =
        rgb_to_oklab(brush_linear) * (1.0 - blending) +
        rgb_to_oklab(sampled_linear) * blending;

    var blended_color = oklab_to_rgb(blended_oklab);
    let snap_target_color = blended_color;

    let snap = step(
        vec3<f32>(persistence),
        abs(blended_color - previous_color.rgb)
    );

    let diff =
        sign(blended_color - previous_color.rgb) * snap;

    blended_color =
        previous_color.rgb +
        diff * persistence;

    blended_color =
        snap * blended_color +
        (vec3<f32>(1.0) - snap) * snap_target_color;

    return linear_srgb_to_srgb(
        vec4<f32>(
            blended_color,
            brush.a
        )
    );
}
struct Transform {
    matrix: mat4x4<f32>,
};

@group(0) @binding(0)
var<uniform> u_transform: Transform;

struct Properties {
    size: vec2<f32>,
    _padding: vec2<f32>,
};

@group(1) @binding(0)
var<uniform> u_properties: Properties;

@group(1) @binding(1)
var source_texture: texture_2d<f32>;

@group(1) @binding(2)
var source_texture_sampler: sampler;

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let pos = vec4<f32>(input.position, 0.0, 1.0);

    let scale = mat4x4<f32>(
        vec4<f32>(u_properties.size.x, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, u_properties.size.y, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, 1.0, 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0),
    );

    out.position = u_transform.matrix * scale * pos;
    out.uv = input.uv;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(source_texture, source_texture_sampler, in.uv);
}

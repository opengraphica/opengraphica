struct CopyTile {
    tile_offset_and_size: vec4<f32>,
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
var source_texture: texture_2d<f32>;

@group(0) @binding(1)
var source_sampler: sampler;

@group(0) @binding(2)
var<uniform> uniforms: CopyTile;

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

    return textureSample(source_texture, source_sampler, base_uv);
}

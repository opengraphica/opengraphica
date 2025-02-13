vec4 materialMain(vec2 uv) {
    // Calculate the mip level based on the texture coordinates
    // vec2 textureSize = vec2(float(cMapWidth), float(cMapHeight));
    // float lod = log2(max(textureSize.x, textureSize.y)); // Max dimension of the texture
    // vec2 texelSize = 1.0 / textureSize;
    // vec2 dx = dFdx(vUv) * textureSize;
    // vec2 dy = dFdy(vUv) * textureSize;
    // float d = max(dot(dx, dx), dot(dy, dy));
    // lod += 0.5 * log2(d);

    // // Sample texels from neighboring mip levels and perform linear interpolation
    // vec4 texColor = texture2D(map, vUv, lod); // Sample current mip level
    // vec4 texColorNext = texture2D(map, vUv, lod + 1.0); // Sample next mip level
    // float t = fract(lod); // Interpolation factor between mip levels
    // gl_FragColor = mix(texColor, texColorNext, t); // Linear interpolation

    // Get texture size
    // vec2 texSize = vec2(float(cMapWidth), float(cMapHeight));
    
    // // Calculate the number of mip levels
    // float mipLevels = 1.0 + log2(max(texSize.x, texSize.y));
    
    // // Calculate the mip level
    // float mipLevel = mipLevels - 1.0 + log2(max(dFdx(vUv.s), dFdy(vUv.t)));
    
    // // Extract the fractional part of the mip level
    // float level = fract(mipLevel);
    
    // // Get the integer part of the mip level
    // int level1 = int(floor(mipLevel));
    // int level2 = min(level1 + 1, int(mipLevels) - 1);
    
    // // Get the texel colors from adjacent mip levels
    // vec4 color1 = texture2D(map, vUv, float(level1));
    // vec4 color2 = texture2D(map, vUv, float(level2));
    
    // // Interpolate between the two mip levels based on the fractional part
    // // gl_FragColor = mix(color1, color2, level);
    // gl_FragColor = textureLod(map, vUv, 4.0);

    // if (gl_FragColor.a < 0.1) {
    //     discard;
    // }

    return texture2D(map, vUv);
}

void main() {
    gl_FragColor = materialMain(vUv);
    //[INJECT_FILTERS_HERE]
}

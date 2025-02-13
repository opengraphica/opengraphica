
vec4 materialMain(vec2 uv) {
    vec4 color = texture2D(srcTexture, uv);
#if cColorSpaceConversion == RASTER_COLOR_SPACE_CONVERSION_SRGB_TO_LINEAR_SRGB
    color = vec4(srgbToLinearSrgb(color.rgb).rgb, color.a);
#endif
    return color;
}

void main() {
    gl_FragColor = materialMain(vUv);
    
    //[INJECT_FILTERS_HERE]
}

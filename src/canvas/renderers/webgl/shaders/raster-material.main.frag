
void main() {
    gl_FragColor = texture2D(srcTexture, vUv);
#if cColorSpaceConversion == RASTER_COLOR_SPACE_CONVERSION_SRGB_TO_LINEAR_SRGB
    gl_FragColor = vec4(srgbToLinearSrgb(gl_FragColor.rgb).rgb, gl_FragColor.a);
#endif
    //[INJECT_FILTERS_HERE]
}

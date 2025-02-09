uniform float pMix;

vec4 processInstagramAden(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    vec4 fill = vec4(0.25882, 0.03921, 0.05490, 0.2);

    // Darken blending mode
    newRgb.r = rgb.r * (1.0 - fill.a) + min(rgb.r, fill.r) * fill.a;
    newRgb.g = rgb.g * (1.0 - fill.a) + min(rgb.g, fill.g) * fill.a;
    newRgb.b = rgb.b * (1.0 - fill.a) + min(rgb.b, fill.b) * fill.a;

    // Hue-roate(-20deg)
    vec3 lch = labToLch(rgbToOklab(newRgb.rgb));
    lch.z += -20.0;
    newRgb = oklabToRgb(lchToLab(lch));
    
    // Contrast(0.9)
    float contrast = -1.0 + tan((min(0.9999, -0.1) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Saturate(0.85)
    float chroma = tan((min(0.9999, -0.15) + 1.0) * PI / 4.0);
    lch = labToLch(rgbToOklab(newRgb.rgb));
    float c = lch.y * chroma;
    c = clamp(c, 0.0, 1.0);
    lch.y = c;
    newRgb.rgb = oklabToRgb(lchToLab(lch));

    // Brightness(1.2)
    float brightness = 1.2;
    newRgb.r = clamp(newRgb.r * brightness, 0.0, 1.0);
    newRgb.g = clamp(newRgb.g * brightness, 0.0, 1.0);
    newRgb.b = clamp(newRgb.b * brightness, 0.0, 1.0);

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
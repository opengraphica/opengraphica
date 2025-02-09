uniform float pMix;

vec4 processInstagram1997(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    vec4 fill = vec4(0.95294, 0.41568, 0.73725, 0.3);

    // Screen blending mode
    newRgb.r = (rgb.r * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(rgb.r)) * (1.0 - linearSrgbChannelToSrgbChannel(fill.r)))) * fill.a;
    newRgb.g = (rgb.g * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(rgb.g)) * (1.0 - linearSrgbChannelToSrgbChannel(fill.g)))) * fill.a;
    newRgb.b = (rgb.b * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(rgb.b)) * (1.0 - linearSrgbChannelToSrgbChannel(fill.b)))) * fill.a;
    
    // Contrast(1.1)
    float contrast = -1.0 + tan((min(0.9999, 0.1) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Brightness(1.1)
    float brightness = 1.1;
    newRgb.r = clamp(newRgb.r * brightness, 0.0, 1.0);
    newRgb.g = clamp(newRgb.g * brightness, 0.0, 1.0);
    newRgb.b = clamp(newRgb.b * brightness, 0.0, 1.0);

    // Saturate(1.3)
    float chroma = tan((min(0.9999, 0.3) + 1.0) * PI / 4.0);
    vec3 lab = rgbToOklab(newRgb.rgb);
    vec3 lch = labToLch(lab);
    float c = lch.y * chroma;
    c = clamp(c, 0.0, 1.0);
    lch.y = c;
    newRgb.rgb = oklabToRgb(lchToLab(lch));

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
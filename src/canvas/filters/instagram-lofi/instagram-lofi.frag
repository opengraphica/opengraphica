uniform float pMix;

vec4 processInstagramLofi(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    // Vignette
    vec2 position = vec2(-0.5, -0.5);
    float radius = 0.75;
    vec4 stop1 = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 stop2 = vec4(0.13333, 0.13333, 0.13333, 0.25);
    float interpolation = clamp(length(position + vUv) - (1.0 - radius), 0.0, 1.0);
    vec4 gradientColor = (interpolation * stop2) + (1.0 - interpolation) * stop1;
    newRgb.rgb = (gradientColor.rgb * gradientColor.a) + (rgb.rgb * (1.0 - gradientColor.a));

    // Saturate(1.1)
    float chroma = tan((min(0.9999, 0.1) + 1.0) * PI / 4.0);
    vec3 lch = labToLch(rgbToOklab(srgbToLinearSrgb(newRgb.rgb)));
    float c = lch.y * chroma;
    c = clamp(c, 0.0, 1.0);
    lch.y = c;
    newRgb.rgb = linearSrgbToSrgb(oklabToRgb(lchToLab(lch)));

    // Contrast(1.2)
    float contrast = -1.0 + tan((min(0.9999, 0.2) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
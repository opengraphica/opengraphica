uniform float pMix;

vec4 processInstagramToaster(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    // Vignette
    vec2 position = vec2(-0.5, -0.5);
    float radius = 1.25;
    vec3 stop1 = vec3(0.50196, 0.30588, 0.05882);
    vec3 stop2 = vec3(0.23137, 0.0, 0.23137);
    float interpolation = clamp(length(position + vUv) - (1.0 - radius), 0.0, 1.0);
    vec3 gradientColor = (interpolation * stop2) + (1.0 - interpolation) * stop1;

    // Screen blending mode
    newRgb.r = (1.0 - ((1.0 - (rgb.r)) * (1.0 - (gradientColor.r))));
    newRgb.g = (1.0 - ((1.0 - (rgb.g)) * (1.0 - (gradientColor.g))));
    newRgb.b = (1.0 - ((1.0 - (rgb.b)) * (1.0 - (gradientColor.b))));

    // Contrast(1.3)
    float contrast = -1.0 + tan((min(0.9999, 0.3) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Brightness(0.9)
    float brightness = 0.9;
    newRgb.r = clamp(newRgb.r * brightness, 0.0, 1.0);
    newRgb.g = clamp(newRgb.g * brightness, 0.0, 1.0);
    newRgb.b = clamp(newRgb.b * brightness, 0.0, 1.0);

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
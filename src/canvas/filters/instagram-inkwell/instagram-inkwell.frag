uniform float pMix;

vec4 processInstagramInkwell(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    // Sepia(0.3)
    newRgb.r = rgb.r * 0.7 + (0.393 * rgb.r + 0.769 * rgb.g + 0.189 * rgb.b) * 0.3;
    newRgb.g = rgb.g * 0.7 + (0.349 * rgb.r + 0.686 * rgb.g + 0.168 * rgb.b) * 0.3;
    newRgb.b = rgb.b * 0.7 + (0.272 * rgb.r + 0.534 * rgb.g + 0.131 * rgb.b) * 0.3;

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

    // Grayscale(1)
    float intensity = (
        newRgb.r * 0.22 +
        newRgb.g * 0.72 +
        newRgb.b * 0.06
    );

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + vec3(intensity, intensity, intensity) * pMix), color.a);
}
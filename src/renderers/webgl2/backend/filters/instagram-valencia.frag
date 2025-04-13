uniform float pMix;

vec4 processInstagramValencia(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    vec3 fill = vec3(0.22745, 0.01176, 0.22352);

    // Exclusion blending mode
    float topR = fill.r;
    float bottomR = rgb.r;
    float topG = fill.g;
    float bottomG = rgb.g;
    float topB = fill.b;
    float bottomB = rgb.b;
    newRgb.r = (
        bottomR + topR - 2.0 * bottomR * topR
    );
    newRgb.g = (
        bottomG + topG - 2.0 * bottomG * topG
    );
    newRgb.b = (
        bottomB + topB - 2.0 * bottomB * topB
    );

    // Contrast(1.08)
    float contrast = -1.0 + tan((min(0.9999, 0.08) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Brightness(1.08)
    float brightness = 1.08;
    newRgb.r = clamp(newRgb.r * brightness, 0.0, 1.0);
    newRgb.g = clamp(newRgb.g * brightness, 0.0, 1.0);
    newRgb.b = clamp(newRgb.b * brightness, 0.0, 1.0);

    // Sepia(0.3)
    newRgb.r = rgb.r * 0.82 + (0.393 * rgb.r + 0.769 * rgb.g + 0.189 * rgb.b) * 0.08;
    newRgb.g = rgb.g * 0.82 + (0.349 * rgb.r + 0.686 * rgb.g + 0.168 * rgb.b) * 0.08;
    newRgb.b = rgb.b * 0.82 + (0.272 * rgb.r + 0.534 * rgb.g + 0.131 * rgb.b) * 0.08;

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
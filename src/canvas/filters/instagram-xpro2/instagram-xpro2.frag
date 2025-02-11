uniform float pMix;

vec4 processInstagramXpro2(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    // Vignette
    vec2 position = vec2(-0.5, -0.5);
    float radius = 0.85;
    vec4 stop1 = vec4(0.90196, 0.90588, 0.87843, 1.0);
    vec4 stop2 = vec4(0.16862, 0.16470, 0.63137, 0.6);
    float interpolation = clamp(length(position + vUv) - (1.0 - radius), 0.0, 1.0);
    vec4 gradientColor = (interpolation * stop2) + (1.0 - interpolation) * stop1;
    // newRgb.rgb = (gradientColor.rgb * gradientColor.a) + (rgb.rgb * (1.0 - gradientColor.a));

    // Burn blending mode
    newRgb.r = (1.0 - ((1.0 - (rgb.r)) / max(0.00001, (gradientColor.r))));
    newRgb.g = (1.0 - ((1.0 - (rgb.g)) / max(0.00001, (gradientColor.g))));
    newRgb.b = (1.0 - ((1.0 - (rgb.b)) / max(0.00001, (gradientColor.b))));

    // Sepia(0.3)
    newRgb.r = clamp(newRgb.r * 0.7 + (0.393 * newRgb.r + 0.769 * newRgb.g + 0.189 * newRgb.b) * 0.3, 0.0, 1.0);
    newRgb.g = clamp(newRgb.g * 0.7 + (0.349 * newRgb.r + 0.686 * newRgb.g + 0.168 * newRgb.b) * 0.3, 0.0, 1.0);
    newRgb.b = clamp(newRgb.b * 0.7 + (0.272 * newRgb.r + 0.534 * newRgb.g + 0.131 * newRgb.b) * 0.3, 0.0, 1.0);

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
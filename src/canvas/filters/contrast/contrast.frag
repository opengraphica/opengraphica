
uniform float pContrast;
uniform float pMiddleGray;

vec4 processContrast(vec4 color) {
    float contrast = -1.0 + tan((min(0.9999, pContrast) + 1.0) * PI / 4.0);
    color.rgb = linearSrgbToSrgb(color.rgb);
    color.r = clamp(color.r + (color.r - pMiddleGray) * contrast, 0.0, 1.0);
    color.g = clamp(color.g + (color.g - pMiddleGray) * contrast, 0.0, 1.0);
    color.b = clamp(color.b + (color.b - pMiddleGray) * contrast, 0.0, 1.0);
    return vec4(srgbToLinearSrgb(color.rgb), color.a);
}

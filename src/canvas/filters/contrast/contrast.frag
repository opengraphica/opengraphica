
uniform float pContrast;
uniform float pMiddleGray;

vec4 processContrast(vec4 color) {
    float contrast = -1.0 + tan((min(0.9999, pContrast) + 1.0) * PI / 4.0);
    color.rgb = linearSrgbToSrgb(color.rgb);
    color.r += (color.r - pMiddleGray) * contrast;
    color.g += (color.g - pMiddleGray) * contrast;
    color.b += (color.b - pMiddleGray) * contrast;
    return vec4(srgbToLinearSrgb(color.rgb), color.a);
}

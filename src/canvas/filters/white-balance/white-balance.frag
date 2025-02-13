uniform vec4 pWhite;

vec4 processWhiteBalance(vec4 color) {
    vec4 white = pWhite;
    vec3 whiteLab = rgbToOklab(srgbToLinearSrgb(white.rgb));
    float neutral = whiteLab.x;

    color.r = clamp(color.r * neutral / white.r, 0.0, 1.0);
    color.g = clamp(color.g * neutral / white.g, 0.0, 1.0);
    color.b = clamp(color.b * neutral / white.b, 0.0, 1.0);

    return color;
}

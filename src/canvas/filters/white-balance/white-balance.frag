uniform vec4 pWhite;

vec4 processWhiteBalance(vec4 color) {
    vec3 white = srgbToLinearSrgb(pWhite.rgb);

    float neutral = (0.22 * white.r) + (0.72 * white.g) + (0.06 * white.b);

    vec3 scale = vec3(neutral) / white;

    color.rgb = clamp(color.rgb * scale, 0.0, 1.0);

    return color;
}
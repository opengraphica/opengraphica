uniform vec4 pWhite;

vec4 processWhiteBalance(vec4 color) {

    // TODO - this seems to be the most common method online but it's not giving great results.

    vec4 white = pWhite;
    float neutral = (white.r + white.b + white.g) / 3.0;

    color.rgb = linearSrgbToSrgb(color.rgb);
    color.r *= neutral / white.r;
    color.g *= neutral / white.g;
    color.b *= neutral / white.b;
    color.rgb = srgbToLinearSrgb(color.rgb);

    return color;
}

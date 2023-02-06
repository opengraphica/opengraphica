const int NegativeInvertColorSpacePerceptualRgb = 0;
const int NegativeInvertColorSpaceLinearRgb = 0;

vec4 processNegative(vec4 color) {
    vec3 rgb = color.rgb;
    if (cColorSpace == NegativeInvertColorSpacePerceptualRgb) {
        rgb = linearSrgbToSrgb(rgb);
    }

    if (cInvertRed == 1) {
        rgb.r = 1.0 - rgb.r;
    }
    if (cInvertGreen == 1) {
        rgb.g = 1.0 - rgb.g;
    }
    if (cInvertBlue == 1) {
        rgb.b = 1.0 - rgb.b;
    }
    if (cInvertValue == 1) {
        vec3 hsv = rgbToHsv(rgb);
        hsv.z = 1.0 - hsv.z;
        rgb = hsvToRgb(hsv);
    }

    if (cColorSpace == NegativeInvertColorSpacePerceptualRgb) {
        rgb = srgbToLinearSrgb(rgb);
    }
    return vec4(rgb, color.a);
}

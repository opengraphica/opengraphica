const int NegativeInvertColorSpacePerceptualRgb = 0;
const int NegativeInvertColorSpaceLinearRgb = 0;

vec4 processNegative(vec4 color) {
    vec3 rgb = color.rgb;
    if (cColorSpace == NegativeInvertColorSpacePerceptualRgb) {
        rgb = linearSrgbToSrgb(rgb);
    }

    #ifdef cInvertRed
        rgb.r = 1.0 - rgb.r;
    #endif
    #ifdef cInvertGreen
        rgb.g = 1.0 - rgb.g;
    #endif
    #ifdef cInvertBlue
        rgb.b = 1.0 - rgb.b;
    #endif
    #ifdef cInvertValue
        vec3 hsv = rgbToHsv(rgb);
        hsv.z = 1.0 - hsv.z;
        rgb = hsvToRgb(hsv);
    #endif

    if (cColorSpace == NegativeInvertColorSpacePerceptualRgb) {
        rgb = srgbToLinearSrgb(rgb);
    }
    return vec4(rgb, color.a);
}

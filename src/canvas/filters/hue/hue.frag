const int HueColorSpaceOklab = 0;
const int HueColorSpacePerceptualRgb = 1;
const int HueColorSpaceLinearRgb = 2;

uniform float pRotate;

vec4 processHue(vec4 color) {
    vec3 rgb = color.rgb;

    if (cColorSpace == HueColorSpaceOklab) {
        vec3 lch = labToLch(rgbToOklab(color.rgb));
        lch.z += pRotate * 360.0;
        rgb = oklabToRgb(lchToLab(lch));
    } else {
        if (cColorSpace == HueColorSpacePerceptualRgb) {
            rgb = linearSrgbToSrgb(rgb);
        }
        vec3 hsl = rgbToHsl(rgb);
        hsl.x += pRotate;
        rgb = hslToRgb(hsl);
        if (cColorSpace == HueColorSpacePerceptualRgb) {
            rgb = srgbToLinearSrgb(rgb);
        }
    }

    return vec4(rgb.rgb, color.a);
}

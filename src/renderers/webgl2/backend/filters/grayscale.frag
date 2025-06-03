const int GrayscaleModeLuminance = 0;
const int GrayscaleModeLuma = 1;
const int GrayscaleModeLightness = 2;
const int GrayscaleModeAverage = 3;
const int GrayscaleModeValue = 4;

uniform float pMix;

vec4 processGrayscale(vec4 color) {
    float intensity = 0.0;
    vec3 rgb = linearSrgbToSrgb(color.rgb);

    if (cMode == GrayscaleModeLuminance) {
        intensity = linearSrgbChannelToSrgbChannel(
            color.r * 0.22 +
            color.g * 0.72 +
            color.b * 0.06
        );
    } else if (cMode == GrayscaleModeLuma) {
        intensity = rgb.r * 0.22 + rgb.g * 0.72 + rgb.b * 0.06;
    } else if (cMode == GrayscaleModeLightness) {
        intensity = 0.5 * (max(max(rgb.r, rgb.g), rgb.b) + min(min(rgb.r, rgb.g), rgb.b));
    } else if (cMode == GrayscaleModeAverage) {
        intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
    } else if (cMode == GrayscaleModeValue) {
        intensity = max(max(rgb.r, rgb.g), rgb.b);
    }

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + vec3(intensity) * pMix), color.a);
}

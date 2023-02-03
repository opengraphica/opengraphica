const int GrayscaleModeLuminance = 0;
const int GrayscaleModeLuma = 1;
const int GrayscaleModeLightness = 2;
const int GrayscaleModeAverage = 3;
const int GrayscaleModeValue = 4;

uniform float pMix;

float processGrayscaleSRgbToLinearRgb(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.04045) * value / 12.92;
    calculatedValue += step(0.04045, value) * pow((value + 0.055) / 1.055, 2.4);
    return calculatedValue;
}

float processGrayscaleLinearRgbToSRgb(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.0031308) * value * 12.92;
    calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
    return clamp(calculatedValue, 0.0, 1.0);
}

vec4 processGrayscale(vec4 color) {
    float intensity = 0.0;

    if (cMode == GrayscaleModeLuminance) {
        intensity = processGrayscaleLinearRgbToSRgb(
            processGrayscaleSRgbToLinearRgb(color.r) * 0.22 +
            processGrayscaleSRgbToLinearRgb(color.g) * 0.72 +
            processGrayscaleSRgbToLinearRgb(color.b) * 0.06
        );
    } else if (cMode == GrayscaleModeLuma) {
        intensity = color.r * 0.22 + color.g * 0.72 + color.b * 0.06;
    } else if (cMode == GrayscaleModeLightness) {
        intensity = 0.5 * (max(max(color.r, color.g), color.b) + min(min(color.r, color.g), color.b));
    } else if (cMode == GrayscaleModeAverage) {
        intensity = (color.r + color.g + color.b) / 3.0;
    } else if (cMode == GrayscaleModeValue) {
        intensity = max(max(color.r, color.g), color.b);
    }

    return vec4(color.rgb * (1.0 - pMix) + vec3(intensity) * pMix, color.a);
}

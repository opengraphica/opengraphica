const int BrightnessModeLuminance = 0;
const int BrightnessModeGamma = 1;
const int BrightnessModeShift = 2;

uniform float pBrightness;
uniform vec2 pEffectiveRange;
uniform vec2 pEffectiveRangeFeather;

vec4 processBrightness(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    if (cMode == BrightnessModeGamma) {
        // Adjust gamma
        float brightness = tan((min(0.9999, pBrightness) + 1.0) * PI / 4.0);
        newRgb.r = pow(rgb.r, 1.0 / brightness);
        newRgb.g = pow(rgb.g, 1.0 / brightness);
        newRgb.b = pow(rgb.b, 1.0 / brightness);
    } else if (cMode == BrightnessModeShift) {
        // Mix towards white or black
        float darknessMultiplier = abs(pBrightness);
        newRgb -= step(pBrightness, 0.0) * vec3(
            rgb.r * darknessMultiplier,
            rgb.g * darknessMultiplier,
            rgb.b * darknessMultiplier
        );
        newRgb += step(0.0, pBrightness) * vec3(
            ((1.0 - rgb.r) * pBrightness),
            ((1.0 - rgb.g) * pBrightness),
            ((1.0 - rgb.b) * pBrightness)
        );
    } else if (cMode == BrightnessModeLuminance) {
        vec3 lch = labToLch(rgbToOklab(color.rgb));
        lch.x = max(0.0, lch.x + pBrightness);
        newRgb = linearSrgbToSrgb(oklabToRgb(lchToLab(lch)));
    }

    // Apply effective range
    float intensity = rgb.r * 0.22 + rgb.g * 0.72 + rgb.b * 0.06;
    float mixValue = 1.0;
    float effectiveRangeSize = pEffectiveRange.y - pEffectiveRange.x;
    mixValue *= smoothstep(
        pEffectiveRange.x - 0.000000001,
        pEffectiveRange.x + (effectiveRangeSize * pEffectiveRangeFeather.x),
        intensity
    );
    mixValue *= 1.0 - smoothstep(
        pEffectiveRange.y - (effectiveRangeSize * (1.0 - pEffectiveRangeFeather.y)),
        pEffectiveRange.y,
        intensity
    );
    rgb = (rgb * (1.0 - mixValue)) + (newRgb * mixValue);

    return vec4(srgbToLinearSrgb(rgb.rgb), color.a);
}
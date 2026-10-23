const int HueColorSpaceOklab = 0;
const int HueColorSpacePerceptualRgb = 1;
const int HueColorSpaceLinearRgb = 2;

uniform float pRotate;
uniform vec4 pTargetColor;
uniform vec2 pTargetRange;

vec4 processHue(vec4 color, vec2 uv) {
    vec3 rgb = color.rgb;
    float sourceHue;
    float targetHue;

    if (cColorSpace == HueColorSpaceOklab) {
        vec3 lch = labToLch(rgbToOklab(color.rgb));
        vec3 targetLch = labToLch(rgbToOklab(srgbToLinearSrgb(pTargetColor.rgb)));

        sourceHue = mod(lch.z / 360.0, 1.0);
        targetHue = mod(targetLch.z / 360.0, 1.0);

        lch.z += pRotate * 360.0;
        rgb = oklabToRgb(lchToLab(lch));
    } else {
        if (cColorSpace == HueColorSpacePerceptualRgb) {
            rgb = linearSrgbToSrgb(rgb);
        }
        vec3 hsl = rgbToHsl(rgb);
        vec3 targetHsl = rgbToHsl(pTargetColor.rgb);

        sourceHue = mod(hsl.x, 1.0);
        targetHue = mod(targetHsl.x, 1.0);

        hsl.x += pRotate;
        rgb = hslToRgb(hsl);
        if (cColorSpace == HueColorSpacePerceptualRgb) {
            rgb = srgbToLinearSrgb(rgb);
        }
    }

    float hueDistance = abs(sourceHue - targetHue);
    hueDistance = min(hueDistance, 1.0 - hueDistance);

    float featherWidth = max(pTargetRange.y, 1e-6);
    float feathered = 1.0 - smoothstep(
        pTargetRange.x,
        pTargetRange.x + featherWidth,
        hueDistance
    );
    float mixAmount = mix(
        feathered,
        step(hueDistance, pTargetRange.x),
        step(pTargetRange.y, 0.0)
    );

    return vec4(
        oklabToRgb(mix(rgbToOklab(color.rgb), rgbToOklab(rgb), mixAmount)),
        color.a
    );
}

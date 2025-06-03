
// https://ssp.impulsetrain.com/porterduff.html

// vec3 outRgb = src.rgb * src.a + dst.rgb * (1.0 - src.a);
// float outAlpha = src.a + dst.a * (1.0 - src.a);

varying vec2 vUv;

uniform sampler2D srcMap;
uniform sampler2D dstMap;
uniform sampler2D selectionMaskMap;
uniform vec4 dstOffsetAndSize;
uniform vec2 brushAlphaConcentration;
uniform mat4 selectionMaskTransform;

float srgbChannelToLinearSrgbChannel(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.04045) * value / 12.92;
    calculatedValue += step(0.04045, value) * pow((value + 0.055) / 1.055, 2.4);
    return calculatedValue;
}

vec4 srgbToLinearSrgb(vec4 srgb) {
    return vec4(
        srgbChannelToLinearSrgbChannel(srgb.r),
        srgbChannelToLinearSrgbChannel(srgb.g),
        srgbChannelToLinearSrgbChannel(srgb.b),
        srgb.a
    );
}

vec3 rgbToOklab(in vec3 rgb) {
    float L = pow(
        0.41222147079999993 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b,
        1.0 / 3.0
    );
    float M = pow(
        0.2119034981999999 * rgb.r + 0.6806995450999999 * rgb.g + 0.1073969566 * rgb.b,
        1.0 / 3.0
    );
    float S = pow(
        0.08830246189999998 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005000002 * rgb.b,
        1.0 / 3.0
    );
    return vec3(
        0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
        1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S,
        0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S
    );
}

vec3 oklabToRgb(in vec3 lab) {
    float L = pow(
        (lab.x * 0.9999999984505198) + (0.39633779217376786 * lab.y) + (0.2158037580607588 * lab.z),
        3.0
    );
    float M = pow(
        (lab.x * 1.0000000088817608) - (0.10556134232365635 * lab.y) - (0.0638541747717059 * lab.z),
        3.0
    );
    float S = pow(
        (lab.x * 1.0000000546724109) - (0.08948418209496576 * lab.y) - (1.2914855378640917 * lab.z),
        3.0
    );
    return vec3(
        (4.076741661347994 * L) - (3.307711590408193 * M) + (0.230969928729428 * S),
        (-1.2684380040921763 * L) + (2.6097574006633715 * M) - (0.3413193963102197 * S),
        (-0.004196086541837188 * L) - (0.7034186144594493 * M) + (1.7076147009309444 * S)
    );
}

void main() {
    vec2 dstUv = vec2(dstOffsetAndSize.x, 1.0 - dstOffsetAndSize.y - dstOffsetAndSize.w) + vUv * dstOffsetAndSize.zw;
    
#if cSelectionMaskEnabled == 1
    vec2 selectionMaskUv = (selectionMaskTransform * vec4(vUv, 0.0, 1.0)).xy;
    float selectionMaskVisible = step(0.0, selectionMaskUv.x) * step(0.0, selectionMaskUv.y) *
        step(selectionMaskUv.x, 1.0) * step(selectionMaskUv.y, 1.0);
    float selectionMaskMultiplier = texture2D(selectionMaskMap, selectionMaskUv).a * selectionMaskVisible;
#else
    float selectionMaskMultiplier = 1.0;
#endif

    vec4 srcColor = srgbToLinearSrgb(texture2D(srcMap, vUv));
    float srcAlpha = srcColor.a * brushAlphaConcentration.x * selectionMaskMultiplier;
    vec4 dstColor = texture2D(dstMap, dstUv);

#if cLayerBlendingMode == BLENDING_MODE_ERASE
    float alpha = max(dstColor.a - srcAlpha, 0.0);
    gl_FragColor = vec4(
        (dstColor.rgb * dstColor.a) / alpha, alpha
    );
#else
    float alpha = srcAlpha + dstColor.a * (1.0 - srcAlpha);

    // OKLab Variant
    // gl_FragColor = vec4(
    //     oklabToRgb((rgbToOklab(srcColor.rgb) * srcAlpha + (rgbToOklab(dstColor.rgb) * dstColor.a) * (1.0 - srcAlpha)) / alpha), alpha
    // );

    gl_FragColor = vec4(
        ((srcColor.rgb) * srcAlpha + ((dstColor.rgb) * dstColor.a) * (1.0 - srcAlpha)) / alpha, alpha
    );
#endif
}


// https://ssp.impulsetrain.com/porterduff.html

// vec3 outRgb = src.rgb * src.a + dst.rgb * (1.0 - src.a);
// float outAlpha = src.a + dst.a * (1.0 - src.a);

varying vec2 vUv;

uniform sampler2D srcMap;
uniform sampler2D dstMap;
uniform vec4 dstOffsetAndSize;
uniform float brushAlpha;

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

void main() {
    vec4 srcColor = srgbToLinearSrgb(texture2D(srcMap, vUv));
    vec2 dstUv = vec2(dstOffsetAndSize.x, 1.0 - dstOffsetAndSize.y - dstOffsetAndSize.w) + vUv * dstOffsetAndSize.zw;
    vec4 dstColor = texture2D(dstMap, dstUv);

    float srcAlpha = srcColor.a * brushAlpha;
    float alpha = srcAlpha + dstColor.a * (1.0 - srcAlpha);
    gl_FragColor = vec4(
        (srcColor.rgb * srcAlpha + (dstColor.rgb) * (1.0 - srcAlpha)) / alpha, alpha
    );


    // float alpha = max(srcAlpha, srcAlpha / (srcAlpha + dstColor.a));
    // gl_FragColor = vec4(
    //     spectral_mix(srcColor.rgb, dstColor.rgb, (1.0 - alpha)),
    //     srcColor.a + dstColor.a * (1.0 - srcColor.a)
    // );
}

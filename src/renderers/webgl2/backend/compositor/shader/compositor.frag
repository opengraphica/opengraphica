
// https://ssp.impulsetrain.com/porterduff.html

// vec3 outRgb = src.rgb * src.a + dst.rgb * (1.0 - src.a);
// float outAlpha = src.a + dst.a * (1.0 - src.a);

varying vec2 vUv;

uniform sampler2D srcMap;
uniform sampler2D dstMap;
uniform vec4 dstOffsetAndSize;

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

float linearSrgbChannelToSrgbChannel(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.0031308) * value * 12.92;
    calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
    return clamp(calculatedValue, 0.0, 1.0);
}

vec4 linearSrgbToSrgb(vec4 rgb) {
    return vec4(
        linearSrgbChannelToSrgbChannel(rgb.r),
        linearSrgbChannelToSrgbChannel(rgb.g),
        linearSrgbChannelToSrgbChannel(rgb.b),
        rgb.a
    );
}

void main() {
    vec4 srcColor = texture2D(srcMap, vUv);
    vec2 dstUv = vec2(dstOffsetAndSize.x, 1.0 - dstOffsetAndSize.y - dstOffsetAndSize.w) + vUv * dstOffsetAndSize.zw;
    vec4 dstColor = linearSrgbToSrgb(texture2D(dstMap, dstUv));

    gl_FragColor = srgbToLinearSrgb(vec4(
        srcColor.rgb * srcColor.a + dstColor.rgb * (1.0 - srcColor.a),
        srcColor.a + dstColor.a * (1.0 - srcColor.a)
    ));
}
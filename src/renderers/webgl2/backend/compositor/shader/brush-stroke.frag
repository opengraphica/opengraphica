varying vec2 vUv;

uniform sampler2D brushStrokeMap;
uniform vec4 tileOffsetAndSize;
uniform mat4 brushTransform;
uniform vec4 brushColor;

// float linearSrgbChannelToSrgbChannel(float value) {
//     float calculatedValue = 0.0;
//     calculatedValue += step(value, 0.0031308) * value * 12.92;
//     calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
//     return clamp(calculatedValue, 0.0, 1.0);
// }

// vec3 linearSrgbToSrgb(vec3 rgb) {
//     return vec3(
//         linearSrgbChannelToSrgbChannel(rgb.r),
//         linearSrgbChannelToSrgbChannel(rgb.g),
//         linearSrgbChannelToSrgbChannel(rgb.b)
//     );
// }

// float srgbChannelToLinearSrgbChannel(float value) {
//     float calculatedValue = 0.0;
//     calculatedValue += step(value, 0.04045) * value / 12.92;
//     calculatedValue += step(0.04045, value) * pow((value + 0.055) / 1.055, 2.4);
//     return calculatedValue;
// }

// vec3 srgbToLinearSrgb(vec3 srgb) {
//     return vec3(
//         srgbChannelToLinearSrgbChannel(srgb.r),
//         srgbChannelToLinearSrgbChannel(srgb.g),
//         srgbChannelToLinearSrgbChannel(srgb.b)
//     );
// }

float circle(vec2 uv, vec2 center, float radius) {
    float dist = distance(uv, center);
    float edge = fwidth(dist) * 1.0;
    return smoothstep(radius + edge, radius - edge, dist);
}

void main() {
    vec2 baseUv = vUv; // vec2(tileOffsetAndSize.x, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w) + vUv * tileOffsetAndSize.zw;
    vec4 brushStrokeColor = texture2D(brushStrokeMap, baseUv);

    vec2 brushUv = (brushTransform * vec4(vUv, 0.0, 1.0)).xy;
    vec4 brushStampColor = vec4(brushColor.rgb, brushColor.a * circle(brushUv, vec2(0.5, 0.5), 0.5));

    brushStrokeColor.rgb = (
        (step(brushStampColor.a, 0.001) * brushStrokeColor.rgb)
        + (step(0.001, brushStampColor.a) * brushStampColor.rgb)
    );

    gl_FragColor = vec4(
        brushStampColor.rgb * brushStampColor.a + brushStrokeColor.rgb * (1.0 - brushStampColor.a),
        brushStampColor.a + brushStrokeColor.a * (1.0 - brushStampColor.a)
    );
}
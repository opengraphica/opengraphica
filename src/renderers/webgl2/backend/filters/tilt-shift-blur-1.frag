/**
 * This file is adapted from:
 * https://github.com/evanw/glfx.js/blob/master/src/filters/blur/tiltshift.js
 * @copyright Evan Wallace
 * @license MIT https://github.com/evanw/glfx.js/blob/master/LICENSE
 */

uniform float pBlurRadius;
uniform float pGradientRadius;
uniform float pAngle;
uniform float pOffset;

vec4 processTiltShiftBlur(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    float angle = pAngle * PI;
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    mat2 handleRotation = mat2(cosAngle, sinAngle, -sinAngle, cosAngle);
    vec2 center = vec2(0.5);
    vec2 translationOffset = handleRotation * vec2(0.0, pOffset);

    vec2 start = center + handleRotation * vec2(-0.5, 0.0) + translationOffset;
    vec2 end = center + handleRotation * vec2( 0.5, 0.0) + translationOffset;
    vec2 dxy = end - start;
    float d = sqrt(dxy.x * dxy.x + dxy.y * dxy.y);

    vec2 delta = vec2(-dxy.y / d, dxy.x / d);
    vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));

    float blurRadius = 1.0 - cbrt(1.0 - pBlurRadius);

    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    float radius = smoothstep(
        0.0, 1.0,
        abs(dot(uv - start, normal)) / pGradientRadius
    ) * blurRadius;

    vec4 newColor = vec4(0.0);
    float total = 0.0;

    for (float t = -30.0; t <= 30.0; t++) {
        float percent = (t + offset - 0.5) / 30.0;
        float weight = 1.0 - abs(percent);
        vec2 sampleUv = uv + delta * percent * radius;
        vec4 colorSample = sampleBackbuffer(sampleUv);
        colorSample.rgb *= colorSample.a;
        newColor += colorSample * weight;
        total += weight;
    }

    newColor /= total;
    newColor.rgb /= max(newColor.a, 0.00001);

    return newColor;
}

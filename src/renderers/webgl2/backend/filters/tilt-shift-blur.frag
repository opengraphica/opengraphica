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
    float angle = pAngle * PI;
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    mat2 handleRotation = mat2(cosAngle, sinAngle, -sinAngle, cosAngle);

    vec2 center = vec2(0.5);
    vec2 translationOffset = handleRotation * vec2(0.0, pOffset);
    vec2 start = center + handleRotation * vec2(-0.5, 0.0) + translationOffset;
    vec2 end = center + handleRotation * vec2( 0.5, 0.0) + translationOffset;

    vec2 dxy = end - start;
    float d = length(dxy);
    vec2 delta = dxy / d;
    vec2 perpendicular = vec2(-delta.y, delta.x);
    vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));

    float blurRadius = 1.0 - cbrt(1.0 - pBlurRadius);
    float radius = smoothstep(
        0.0, 1.0,
        abs(dot(uv - start, normal)) / pGradientRadius
    ) * blurRadius;

    float randomOffsetX = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    float randomOffsetY = random(vec3(78.233, 151.7182, 212.9898), 0.0);

    vec4 newColor = vec4(0.0);
    float total = 0.0;

    for (float y = 0.0; y < 9.0; y++) {
        float yOffset = ((y + 0.5 + randomOffsetY) / 4.5) - 1.0;
        float yWeight = 1.0 - abs(yOffset);

        for (float x = 0.0; x < 9.0; x++) {
            float xOffset = ((x + 0.5 + randomOffsetX) / 4.5) - 1.0;
            float xWeight = 1.0 - abs(xOffset);
            float weight = xWeight * yWeight;


            vec2 sampleUv = uv + radius * (
                delta * xOffset + perpendicular * yOffset
            );

            vec4 colorSample = sampleBackbuffer(sampleUv);
            colorSample.rgb *= colorSample.a;

            newColor += colorSample * weight;
            total += weight;
        }
    }

    newColor /= total;
    newColor.rgb /= max(newColor.a, 0.00001);
    return newColor;
}

vec4 bakeTiltShiftBlur(vec4 color, vec2 uv) {
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

    vec2 delta = vec2(dxy.x / d, dxy.y / d);
    vec2 secondDelta = vec2(-dxy.y / d, dxy.x / d);
    vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));

    float blurRadius = 1.0 - cbrt(1.0 - pBlurRadius);

    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    float radius = smoothstep(
        0.0, 1.0,
        abs(dot(uv - start, normal)) / pGradientRadius
    ) * blurRadius;

    vec4 newColor = vec4(0.0);
    float total = 0.0;

    // Second blur, perpendicular to the first.
    for (float t = -30.0; t <= 30.0; t++) {
        float percent = (t + offset - 0.5) / 30.0;
        float weight = 1.0 - abs(percent);
        vec2 sampleUv = uv + secondDelta * percent * radius;

        // First blur at this second-pass sample position.
        float sampleRadius = smoothstep(
            0.0, 1.0,
            abs(dot(sampleUv - start, normal)) / pGradientRadius
        ) * blurRadius;

        vec4 firstBlurColor = vec4(0.0);
        float firstBlurTotal = 0.0;

        for (float firstT = -30.0; firstT <= 30.0; firstT++) {
            float firstPercent = (firstT + offset - 0.5) / 30.0;
            float firstWeight = 1.0 - abs(firstPercent);

            vec4 colorSample = sampleBackbuffer(
                sampleUv + delta * firstPercent * sampleRadius
            );
            colorSample.rgb *= colorSample.a;

            firstBlurColor += colorSample * firstWeight;
            firstBlurTotal += firstWeight;
        }

        firstBlurColor /= firstBlurTotal;
        firstBlurColor.rgb /= max(firstBlurColor.a, 0.00001);

        firstBlurColor.rgb *= firstBlurColor.a;
        newColor += firstBlurColor * weight;
        total += weight;
    }

    newColor /= total;
    newColor.rgb /= max(newColor.a, 0.00001);

    return newColor;
}

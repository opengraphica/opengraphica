varying vec2 vUv;

uniform sampler2D sampleMap;
uniform sampler2D previousColorMap;
uniform vec4 tileOffsetAndSize;
uniform vec4 brushColor;
uniform vec4 brushBlendingPersistenceBearingConcentration;

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

vec3 srgbToLinearSrgb(vec3 srgb) {
    return vec3(
        srgbChannelToLinearSrgbChannel(srgb.r),
        srgbChannelToLinearSrgbChannel(srgb.g),
        srgbChannelToLinearSrgbChannel(srgb.b)
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

float sampleCircleAlpha(vec2 center, float radius, float stepSize) {
    float sum = 0.0;
    float totalWeight = 0.0;

    for (float y = -radius; y <= radius; y += stepSize) {
        for (float x = -radius; x <= radius; x += stepSize) {
            vec2 offset = vec2(x, y);
            float dist = length(offset);

            // Circle mask (1 inside radius, 0 outside)
            float inside = step(dist, radius);

            vec4 texel = texture(sampleMap, center + offset);
            float weight = (1.0 - dist / radius) * texel.a * inside;

            sum += texel.a * weight;
            totalWeight += weight;
        }
    }

    return sum / max(totalWeight, 1e-5); // avoid div by 0
}

vec4 sampleArc(vec2 center, float radius, float bearing) {
    vec4 sum = vec4(0.0);
    float totalWeight = 0.0;

    for (float a = 0.0; a < 6.28318; a += 0.2) {
        for (float r = radius; r < radius * 1.05; r += radius * 0.01) {
            vec2 offset = vec2(-cos(a), sin(a)) * r;
            vec2 sampleUv = center + offset;

            vec4 texel = texture(sampleMap, sampleUv);

            float dirDot = dot(normalize(offset), vec2(cos(bearing), sin(bearing)));
            float weight = max(dirDot, 0.0) * texel.a;

            weight = pow(weight, 2.0);

            sum += texel * weight;
            totalWeight += weight;
        }
    }

    return sum / max(totalWeight, 1e-5);
}

void main() {
    vec4 sampledColor = sampleArc(
        vec2(tileOffsetAndSize.x + tileOffsetAndSize.z * 0.5, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w * 0.5),
        tileOffsetAndSize.w * 0.5,
        brushBlendingPersistenceBearingConcentration.z
    );
    vec4 previousColor = srgbToLinearSrgb(texture(previousColorMap, vec2(0.5, 0.5)));

    float blending = min(brushBlendingPersistenceBearingConcentration.x, sampledColor.a);
    float persistence = min(1.0, step(previousColor.a, 0.001) + brushBlendingPersistenceBearingConcentration.y);
    float concentration = brushBlendingPersistenceBearingConcentration.a;

    vec3 blendedColor = oklabToRgb(rgbToOklab(srgbToLinearSrgb(brushColor.rgb)) * (1.0 - blending) + rgbToOklab(sampledColor.rgb) * blending);
    vec3 snapTargetColor = blendedColor;

    vec3 snap = step(vec3(persistence), abs(blendedColor - previousColor.rgb));
    vec3 diff = sign(blendedColor - previousColor.rgb) * snap;
    blendedColor = previousColor.rgb + diff * persistence;
    blendedColor = snap * blendedColor + (vec3(1.0) - snap) * snapTargetColor;

    // float alphaDiff = sign(sampledColor.a - previousColor.a);
    // float sampledAlpha = previousColor.a + alphaDiff * 0.01;
    // float alpha = sampledAlpha * brushColor.a; // mix(min(brushColor.a, sampledAlpha), brushColor.a, concentration);

    gl_FragColor = linearSrgbToSrgb(vec4(blendedColor, brushColor.a));
}
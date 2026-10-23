uniform float pWhirl;
uniform float pPinch;
uniform float pRadius;
uniform float pCenterX;
uniform float pCenterY;

vec4 processWhirlPinch(vec4 color, vec2 uv) {
    float aspectRatio = 1.0 / 1.0;
    vec2 aspectScale = vec2(aspectRatio, 1.0);
    vec2 center = (uv - 0.5 + vec2(-pCenterX, -pCenterY)) * aspectScale;

    float maxRadius = 0.5 * length(aspectScale);
    float radius = pRadius * maxRadius;
    float distanceFromCenter = length(center);
    float falloff = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter / radius);

    float angle = pWhirl * 6.28318530718 * falloff;
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec2 source = vec2(
        cosAngle * center.x - sinAngle * center.y,
        sinAngle * center.x + cosAngle * center.y
    ) * 1.0 + pPinch * falloff;

    vec2 sourceUv = uv + ((source - center) / aspectScale);
    sourceUv = clamp(sourceUv, 0.0, 1.0);
    return sampleBackbuffer(sourceUv);
}
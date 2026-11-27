uniform vec2 pThreshold;
uniform float pRadius;
uniform float pStrength;

vec4 processHighlightBloom(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    float maxDimension = max(layerResolution.x, layerResolution.y);
    float sigma = pRadius * maxDimension / 6.0;
    vec2 halfTexel = 0.5 / layerResolution;

    float hardThresholdCutoff = 1.0 - pThreshold.y;
    float softThresholdEnd = 1.0 - pThreshold.x;

    float jitterOffset = random(vec3(12.9898, 78.233, 151.7182), 0.0);

    vec3 sum = vec3(0.0);
    float weightSum = 0.0;

    for (int i = -64; i <= 64; ++i) {
        float t = (float(i) + jitterOffset) / 64.0;
        float weight = exp(-4.5 * t * t);
        float distancePixels = 3.0 * sigma * t;
        vec2 offset = vec2(distancePixels / layerResolution.x, 0.0);
        vec2 sampleUV = clamp(uv + offset, halfTexel, vec2(1.0) - halfTexel);

        vec4 source = sampleBackbuffer(sampleUV);
        float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));

        float mask = (pThreshold.x < pThreshold.y)
            ? smoothstep(hardThresholdCutoff, softThresholdEnd, luminance)
            : step(hardThresholdCutoff, luminance);
        mask *= pStrength * 3.0;

        sum += source.rgb * mask * weight;
        weightSum += weight;
    }

    return vec4(sum / max(weightSum, 1e-5), 1.0);
}
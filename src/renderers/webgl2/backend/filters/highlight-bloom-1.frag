uniform vec2 pThreshold;
uniform float pRadius;
uniform float pStrength;

vec4 processHighlightBloom(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    float maxDimension = max(layerResolution.x, layerResolution.y);
    float sigma = pRadius * maxDimension / 6.0;
    vec2 halfTexel = 0.5 / layerResolution;

    vec3 sum = sampleBackbuffer(uv).rgb;
    float weightSum = 1.0;

    for (int i = 1; i <= 64; ++i) {
        float t = float(i) / 64.0;
        float weight = exp(-4.5 * t * t);
        float distancePixels = 3.0 * sigma * t;
        vec2 offset = vec2(0.0, distancePixels / layerResolution.y);

        vec2 uvPositive = clamp(uv + offset, halfTexel, vec2(1.0) - halfTexel);
        vec2 uvNegative = clamp(uv - offset, halfTexel, vec2(1.0) - halfTexel);

        sum += (sampleBackbuffer(uvPositive).rgb + sampleBackbuffer(uvNegative).rgb) * weight;
        weightSum += 2.0 * weight;
    }

    vec4 original = texture2D(srcTexture, uv);
    vec3 bloom = sum / weightSum;

    return vec4(original.rgb + bloom, original.a);
}
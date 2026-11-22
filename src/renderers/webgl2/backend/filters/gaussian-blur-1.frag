uniform float pXRadius;
uniform float pYRadius;

vec4 processGaussianBlur(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    float maxDimension = max(layerResolution.x, layerResolution.y);
    float sigma = (1.0 - cbrt(1.0 - pYRadius)) * maxDimension / 6.0;
    vec2 halfTexel = 0.5 / layerResolution;

    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);

    vec4 sum = sampleBackbuffer(uv);
    float weightSum = 1.0;

    for (int i = 1; i <= 64; ++i) {
        float t = (float(i) + offset - 0.5) / 64.0;
        float weight = exp(-4.5 * t * t);
        float distancePixels = 3.0 * sigma * t;
        vec2 offset = vec2(0.0, distancePixels / layerResolution.y);

        vec2 uvPositive = clamp(uv + offset, halfTexel, vec2(1.0) - halfTexel);
        vec2 uvNegative = clamp(uv - offset, halfTexel, vec2(1.0) - halfTexel);

        sum += (sampleBackbuffer(uvPositive) + sampleBackbuffer(uvNegative)) * weight;
        weightSum += 2.0 * weight;
    }

    sum /= weightSum;
    sum.rgb /= max(sum.a, 0.00001);

    return sum;
}
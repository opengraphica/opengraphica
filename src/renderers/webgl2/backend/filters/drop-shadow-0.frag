uniform float pXOffset;
uniform float pYOffset;
uniform float pBlurRadius;
uniform float pGrowRadius;
uniform vec4 pColor;

vec4 processDropShadow(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 offsetUv = uv + vec2(-pXOffset / layerResolution.x, pYOffset / layerResolution.y);
    vec2 halfTexel = 0.5 / layerResolution;

    float jitterOffset = random(vec3(12.9898, 78.233, 151.7182), 0.0);

    float shadowAlpha = 0.0;
    float weightSum = 0.0;

    for (int i = 0; i <= 32; ++i) {
        float t = (float(i) - jitterOffset - 16.0) / 16.0;
        float distancePixels = pBlurRadius * t;
        float weight = exp(-4.5 * t * t);
        vec2 blurOffset = vec2(distancePixels / layerResolution.x, 0.0);

        vec2 positiveCenter = offsetUv + blurOffset;
        vec2 negativeCenter = offsetUv - blurOffset;

        vec2 positiveMinus = positiveCenter - vec2(pGrowRadius / layerResolution.x, 0.0);
        vec2 positivePlus = positiveCenter + vec2(pGrowRadius / layerResolution.x, 0.0);
        vec2 negativeMinus = negativeCenter - vec2(pGrowRadius / layerResolution.x, 0.0);
        vec2 negativePlus = negativeCenter + vec2(pGrowRadius / layerResolution.x, 0.0);

        float positiveAlpha = max(
            sampleBackbuffer(clamp(positiveCenter, halfTexel, vec2(1.0) - halfTexel)).a *
                step(0.0, positiveCenter.x) * step(positiveCenter.x, 1.0) *
                step(0.0, positiveCenter.y) * step(positiveCenter.y, 1.0),
            max(
                sampleBackbuffer(clamp(positiveMinus, halfTexel, vec2(1.0) - halfTexel)).a *
                    step(0.0, positiveMinus.x) * step(positiveMinus.x, 1.0) *
                    step(0.0, positiveMinus.y) * step(positiveMinus.y, 1.0),
                sampleBackbuffer(clamp(positivePlus, halfTexel, vec2(1.0) - halfTexel)).a *
                    step(0.0, positivePlus.x) * step(positivePlus.x, 1.0) *
                    step(0.0, positivePlus.y) * step(positivePlus.y, 1.0)
            )
        );

        float negativeAlpha = max(
            sampleBackbuffer(clamp(negativeCenter, halfTexel, vec2(1.0) - halfTexel)).a *
                step(0.0, negativeCenter.x) * step(negativeCenter.x, 1.0) *
                step(0.0, negativeCenter.y) * step(negativeCenter.y, 1.0),
            max(
                sampleBackbuffer(clamp(negativeMinus, halfTexel, vec2(1.0) - halfTexel)).a *
                    step(0.0, negativeMinus.x) * step(negativeMinus.x, 1.0) *
                    step(0.0, negativeMinus.y) * step(negativeMinus.y, 1.0),
                sampleBackbuffer(clamp(negativePlus, halfTexel, vec2(1.0) - halfTexel)).a *
                    step(0.0, negativePlus.x) * step(negativePlus.x, 1.0) *
                    step(0.0, negativePlus.y) * step(negativePlus.y, 1.0)
            )
        );

        shadowAlpha += (positiveAlpha + negativeAlpha) * weight;
        weightSum += 2.0 * weight;
    }

    shadowAlpha /= max(weightSum, 0.00001);

    return vec4(srgbToLinearSrgb(pColor.rgb), pColor.a * shadowAlpha);
}

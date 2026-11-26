uniform float pXOffset;
uniform float pYOffset;
uniform float pBlurRadius;
uniform float pGrowRadius;
uniform vec4 pColor;

vec4 processDropShadow(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 halfTexel = 0.5 / layerResolution;
    vec2 growOffset = vec2(0.0, max(pGrowRadius, 0.0) / layerResolution.y);

    vec4 extendedBounds = vec4(
        abs(min(-pBlurRadius - pGrowRadius + pXOffset, 0.0)),
        abs(min(-pBlurRadius - pGrowRadius + pYOffset, 0.0)),
        max(pBlurRadius + pGrowRadius + pXOffset, 0.0),
        max(pBlurRadius + pGrowRadius + pYOffset, 0.0)
    );

    float uMin = -extendedBounds.x / layerResolution.x;
    float uMax = 1.0 + extendedBounds.z / layerResolution.x;
    float vMin = -extendedBounds.w / layerResolution.y;
    float vMax = 1.0 + extendedBounds.y / layerResolution.y;
    vec2 extendedBoundsUv = (uv - vec2(uMin, vMin)) / vec2(uMax - uMin, vMax - vMin);

    float jitterOffset = random(vec3(12.9898, 78.233, 151.7182), 0.0);

    vec4 center = sampleBackbuffer(clamp(extendedBoundsUv, halfTexel, vec2(1.0) - halfTexel));
    vec4 centerMinus = sampleBackbuffer(clamp(extendedBoundsUv - growOffset, halfTexel, vec2(1.0) - halfTexel));
    vec4 centerPlus = sampleBackbuffer(clamp(extendedBoundsUv + growOffset, halfTexel, vec2(1.0) - halfTexel));

    vec4 grownCenter = mix(center, centerMinus, step(center.a, centerMinus.a));
    grownCenter = mix(grownCenter, centerPlus, step(grownCenter.a, centerPlus.a));

    vec4 shadow = grownCenter;
    float weightSum = 1.0;

    for (int i = 1; i <= 32; ++i) {
        float t = (float(i) + jitterOffset - 0.5) / 32.0;
        float distancePixels = pBlurRadius * t;
        float weight = exp(-4.5 * t * t);
        vec2 blurOffset = vec2(0.0, distancePixels / layerResolution.y);

        vec2 positiveUv = extendedBoundsUv + blurOffset;
        vec2 negativeUv = extendedBoundsUv - blurOffset;

        vec2 positiveCenterUv = clamp(positiveUv, halfTexel, vec2(1.0) - halfTexel);
        vec2 positiveMinusUv = clamp(positiveUv - growOffset, halfTexel, vec2(1.0) - halfTexel);
        vec2 positivePlusUv = clamp(positiveUv + growOffset, halfTexel, vec2(1.0) - halfTexel);

        vec4 positiveCenter = sampleBackbuffer(positiveCenterUv);
        vec4 positiveMinus = sampleBackbuffer(positiveMinusUv);
        vec4 positivePlus = sampleBackbuffer(positivePlusUv);

        vec4 positiveGrown = mix(positiveCenter, positiveMinus, step(positiveCenter.a, positiveMinus.a));
        positiveGrown = mix(positiveGrown, positivePlus, step(positiveGrown.a, positivePlus.a));

        vec2 negativeCenterUv = clamp(negativeUv, halfTexel, vec2(1.0) - halfTexel);
        vec2 negativeMinusUv = clamp(negativeUv - growOffset, halfTexel, vec2(1.0) - halfTexel);
        vec2 negativePlusUv = clamp(negativeUv + growOffset, halfTexel, vec2(1.0) - halfTexel);

        vec4 negativeCenter = sampleBackbuffer(negativeCenterUv);
        vec4 negativeMinus = sampleBackbuffer(negativeMinusUv);
        vec4 negativePlus = sampleBackbuffer(negativePlusUv);

        vec4 negativeGrown = mix(negativeCenter, negativeMinus, step(negativeCenter.a, negativeMinus.a));
        negativeGrown = mix(negativeGrown, negativePlus, step(negativeGrown.a, negativePlus.a));

        shadow += (positiveGrown + negativeGrown) * weight;
        weightSum += 2.0 * weight;
    }

    shadow /= weightSum;
    shadow.rgb /= max(shadow.a, 0.00001);
    shadow.a = linearSrgbChannelToSrgbChannel(shadow.a);

    vec4 original = texture2D(srcTexture, uv);
    float insideOriginal = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    original.a *= insideOriginal;

    float alpha = original.a + shadow.a * (1.0 - original.a);

    return vec4(
        (original.rgb * original.a + shadow.rgb * shadow.a * (1.0 - original.a)) / max(alpha, 0.00001),
        alpha
    );
}

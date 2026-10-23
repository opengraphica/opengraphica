uniform float pSize;

vec4 processMonteCarloBlur(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));

    float pixelSeed = sin(dot(uv, vec2(1233.224,1743.335)));

    float randomScale = (1.0 - cbrt(1.0 - pSize)) * 0.25;
    vec4 newColor = vec4(0.0);
    vec2 randomValue = vec2(0.0);

    for (int i=0; i<cIterations; i++) {
        pixelSeed = fract(3712.65 * pixelSeed + 0.61432);
        pixelSeed = (pixelSeed - 0.5) * 2.0;
        randomValue.x = pixelSeed;
        pixelSeed = fract(3712.65 * pixelSeed + 0.61432);
        pixelSeed = (pixelSeed - 0.5) * 2.0;
        randomValue.y = pixelSeed;
        newColor += sampleBackbuffer(uv + randomValue * randomScale) / float(cIterations);
    }

    return newColor;
}

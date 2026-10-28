uniform float pSize;
uniform float pOffsetX;
uniform float pOffsetY;

vec4 processPixelize(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));

    float amount = clamp(pSize, 0.0, 1.0);
    float rawBlockPixels = max(1.0, 256.0 * (1.0 - cbrt(1.0 - amount)));
    float blockPixels = max(1.0, floor(rawBlockPixels + 0.5));

    vec2 pixel = floor(vec2(uv.x, 1.0 - uv.y) * layerResolution);
    pixel = clamp(pixel, vec2(0.0), layerResolution - 1.0);

    vec2 offsetPixels = floor(vec2(pOffsetX, pOffsetY) * blockPixels);

    vec2 blockMin = offsetPixels + (floor((pixel - offsetPixels) / blockPixels)) * blockPixels;
    vec2 blockMax = blockMin + blockPixels;

    vec2 validMin = max(blockMin, vec2(0.0));
    vec2 validMax = min(blockMax, layerResolution);

    vec4 newColor = vec4(0.0);

    for (int y = 0; y < 2; ++y) {
        for (int x = 0; x < 2; ++x) {
            vec2 fraction = (vec2(float(x), float(y)) + 0.5) / 2.0;
            vec2 samplePixel = mix(validMin, validMax, fraction);
            vec2 sampleUV = vec2(
                samplePixel.x / layerResolution.x,
                1.0 - samplePixel.y / layerResolution.y
            );
            sampleUV = clamp(
                sampleUV,
                0.5 / layerResolution,
                1.0 - 0.5 / layerResolution
            );
            newColor += sampleBackbuffer(sampleUV);
        }
    }

    return newColor * 0.25;
}
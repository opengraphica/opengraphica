uniform float pHorizontal;
uniform float pVertical;
uniform float pSeed;

vec4 processSpread(vec4 color) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 pixel = min(floor(vUv * layerResolution), layerResolution - vec2(1.0));

    float horizontal = floor(max((1.0 - cbrt(1.0 - pHorizontal)) * 512.0, 0.0));
    float vertical = floor(max((1.0 - cbrt(1.0 - pVertical)) * 512.0, 0.0));

    uint pixelSeed = uint(max(pSeed * 256.0, 0.0));
    pixelSeed ^= uint(pixel.x) * 0x9E3779B9u;
    pixelSeed ^= uint(pixel.y) * 0x85EBCA6Bu;

    float offsetX = floor(float(pcgWhiteNoise(pixelSeed)) * (horizontal * 2.0 + 1.0)) - horizontal;
    float offsetY = floor(float(pcgWhiteNoise(pixelSeed ^ 0xC2B2AE35u)) * (vertical * 2.0 + 1.0)) - vertical;

    ivec2 sourcePixel = ivec2(pixel) + ivec2(offsetX, offsetY);
    sourcePixel = clamp(sourcePixel, ivec2(0), ivec2(layerResolution) - ivec2(1));
    vec2 sourceUv = (vec2(sourcePixel) + vec2(0.5)) / layerResolution;
    return sampleBackbuffer(sourceUv);
}
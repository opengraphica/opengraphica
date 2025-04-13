uniform vec4 pEraseColor;
uniform float pThreshold;
uniform float pSoftness;
uniform float pSpillSuppression;
uniform float pHueWeight;
uniform float pChromaWeight;
uniform float pLightnessWeight;

vec4 processChromaKey(vec4 color) {
    float threshold = pThreshold * 0.15;
    float softness = pSoftness * 0.15;

    float keyCb = (0.5 + -0.168736 * pEraseColor.r - 0.331264 * pEraseColor.g + 0.5 * pEraseColor.b);
    float keyCr = (0.5 + 0.5 * pEraseColor.r - 0.418688 * pEraseColor.g - 0.081312 * pEraseColor.b);
    float pixCb = (0.5 + -0.168736 * color.r - 0.331264 * color.g + 0.5 * color.b);
    float pixCr = (0.5 + 0.5 * color.r - 0.418688 * color.g - 0.081312 * color.b);

    float closeness = (keyCb - pixCb) * (keyCb - pixCb) + (keyCr - pixCr) * (keyCr - pixCr);
    float mask = smoothstep(threshold - 0.000001, threshold + softness, closeness);
    color = clamp(color * mask, 0.0, 1.0);

    float r = (2.0 * color.r + color.g + color.b) / 4.0;
    float g = (2.0 * color.g + color.r + color.b) / 4.0;
    float b = (2.0 * color.b + color.r + color.g) / 4.0;
    color.r = mix(color.r, r, step(r, color.r) * pSpillSuppression);
    color.g = mix(color.g, g, step(g, color.g) * pSpillSuppression);
    color.b = mix(color.b, b, step(b, color.b) * pSpillSuppression);
    vec4 dif = color - vec4(r, g, b, 0.0);
    float desaturatedDif = (0.299 * dif.r + 0.587 * dif.g + 0.114 * dif.b);
    color += mix(0.0, desaturatedDif, pSpillSuppression);

    return color;
}

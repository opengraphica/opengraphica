const int ChromaModifyModeMultiply = 0;
const int ChromaModifyModeShift = 1;

uniform float pChroma;

vec4 processChroma(vec4 color) {
    float chroma = 0.0;
    vec3 lab = rgbToOklab(color.rgb);
    vec3 lch = labToLch(lab);
    float c = 0.0;
    if (cMode == ChromaModifyModeMultiply) {
        chroma = tan((min(0.9999, pChroma) + 1.0) * PI / 4.0);
        c = lch.y * chroma;
    } else if (cMode == ChromaModifyModeShift) {
        chroma = -1.0 + tan((min(0.9999, pChroma) + 1.0) * PI / 4.0);
        c += step(0.0, chroma) * (lch.y + (1.0 - lch.y) * chroma / 4.0);
        c += step(chroma, -0.00000000001) * (lch.y * (1.0 - abs(chroma)));
    }
    c = clamp(c, 0.0, 1.0);
    lch.y = c;
    color.rgb = oklabToRgb(lchToLab(lch));
    return color;
}

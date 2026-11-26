uniform sampler2D passTexture;

vec4 materialMain(vec2 uv, float lod) {
    return sampleLayerTexture(passTexture, uv, lod);
}

void main() {
    //[INJECT_FILTERS_HERE]
}
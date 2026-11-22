vec4 materialMain(vec2 uv) {
    return sampleLayerTexture(srcTexture, uv);
}

void main() {
    //[INJECT_FILTERS_HERE]
}
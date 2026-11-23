uniform sampler2D passTexture;

vec4 materialMain(vec2 uv) {
    return sampleLayerTexture(passTexture, uv);
}

void main() {
    //[INJECT_FILTERS_HERE]
}
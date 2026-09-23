
vec4 materialMain(vec2 uv) {
    return color;
}

void main() {
    gl_FragColor = materialMain(vUv);
    //[INJECT_FILTERS_HERE]
}

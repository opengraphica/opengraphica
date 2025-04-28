uniform vec4 fill;

vec4 materialMain(vec2 uv) {
    return fill;
}

void main() {
    gl_FragColor = materialMain(vUv);
    
    //[INJECT_FILTERS_HERE]
}

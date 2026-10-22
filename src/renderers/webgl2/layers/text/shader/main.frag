uniform vec4 fill;

vec4 materialMain(vec2 uv) {
    return fill * vec4(1.0, 1.0, 1.0, opacity);
}

void main() {
    //[INJECT_FILTERS_HERE]
}

uniform float contrast;

void main() {
    gl_FragColor = vec4((color.rgb - 0.5) * (contrast + 1.0) + 0.5, color.a);
}

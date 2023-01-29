uniform float brightness;

void main() {
    gl_FragColor = vec4(color.rgb * brightness, color.a);
}

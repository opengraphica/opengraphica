
void main() {
    gl_FragColor = texture2D(map, vUv);
    //[INJECT_FILTERS_HERE]
    // gl_FragColor = vec4(linearSrgbToSrgb(gl_FragColor.rgb), gl_FragColor.a);
}

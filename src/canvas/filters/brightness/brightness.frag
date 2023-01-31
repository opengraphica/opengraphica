uniform float pBrightness;

vec4 processBrightness(vec4 color) {
    return vec4(color.rgb + pBrightness, color.a);
}

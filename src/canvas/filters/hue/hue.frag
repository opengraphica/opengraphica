uniform float pRotate;

vec4 processHue(vec4 color) {
    vec3 hsl = rgbToHsl(color.rgb);
    hsl.x += pRotate;
    vec3 rgb = hslToRgb(hsl);
    return vec4(rgb.rgb, color.a);
}

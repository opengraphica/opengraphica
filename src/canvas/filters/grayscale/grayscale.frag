uniform float pPercentage;

vec4 processGrayscale(vec4 color) {
    float intensity = pPercentage * (color.r * 0.298995 + color.g * 0.587 + color.b * 0.113998);
    return vec4(vec3(intensity), color.a);
}

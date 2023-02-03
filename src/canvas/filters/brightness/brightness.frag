uniform float pBrightness;

vec4 processBrightness(vec4 color) {
    vec3 rgb = color.rgb;
    float darknessMultiplier = abs(pBrightness);
    rgb -= step(pBrightness, 0.0) * vec3(
        rgb.r * darknessMultiplier,
        rgb.g * darknessMultiplier,
        rgb.b * darknessMultiplier
    );
    rgb += step(0.0, pBrightness) * vec3(
        ((1.0 - rgb.r) * pBrightness),
        ((1.0 - rgb.g) * pBrightness),
        ((1.0 - rgb.b) * pBrightness)
    );
    return vec4(rgb.rgb, color.a);
}

uniform float pRotate;

vec3 processHueHueToRgb(float hue) {
    hue = fract(hue);
    return clamp(
        vec3(
            abs(hue * 6.0 - 3.0) - 1.0,
            2.0 - abs(hue * 6.0 - 2.0),
            2.0 - abs(hue * 6.0 - 4.0)
        ),
        0.0,
        1.0
    );
}

vec3 processHueHslToRgb(vec3 hsl) {
    if (hsl.y == 0.0) {
        return vec3(hsl.z);
    } else {
        float b;
        if (hsl.z < 0.5) {
            b = hsl.z * (1.0 + hsl.y);
        } else {
            b = hsl.z + hsl.y - hsl.y * hsl.z;
        }
        float a = 2.0 * hsl.z - b;
        return a + processHueHueToRgb(hsl.x) * (b - a);
    }
}

vec3 processHueRgbToHsl(in vec3 c){
    float cMin = min(min(c.r,c.g),c.b),
          cMax = max(max(c.r,c.g),c.b),
          delta = cMax-cMin;
    vec3 hsl = vec3(0.0, 0.0, (cMax + cMin) / 2.0);
    if (delta != 0.0) {
        if (hsl.z < .5) {
            hsl.y = delta / (cMax + cMin);
        } else {
            hsl.y = delta / (2.0 - cMax - cMin);
        }
        float deltaR = (((cMax - c.r) / 6.0) + (delta / 2.0)) / delta,
              deltaG = (((cMax - c.g) / 6.0) + (delta / 2.0)) / delta,
              deltaB = (((cMax - c.b) / 6.0) + (delta / 2.0)) / delta;
        if (c.r == cMax) {
            hsl.x = deltaB - deltaG;
        } else if (c.g == cMax) {
            hsl.x = (1.0 / 3.0) + deltaR - deltaB;
        } else {
            hsl.x = (2.0 / 3.0) + deltaG - deltaR;
        }
        hsl.x = fract(hsl.x);
    }
    return hsl;
}

vec4 processHue(vec4 color) {
    vec3 hsl = processHueRgbToHsl(color.rgb);
    hsl.x += pRotate;
    vec3 rgb = processHueHslToRgb(hsl);
    return vec4(rgb.rgb, color.a);
}
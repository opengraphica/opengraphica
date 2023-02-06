uniform sampler2D map;

varying vec2 vUv;

float srgbChannelToLinearSrgbChannel(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.04045) * value / 12.92;
    calculatedValue += step(0.04045, value) * pow((value + 0.055) / 1.055, 2.4);
    return calculatedValue;
}

vec3 srgbToLinearSrgb(vec3 srgb) {
    return vec3(
        srgbChannelToLinearSrgbChannel(srgb.r),
        srgbChannelToLinearSrgbChannel(srgb.g),
        srgbChannelToLinearSrgbChannel(srgb.b)
    );
}

float linearSrgbChannelToSrgbChannel(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.0031308) * value * 12.92;
    calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
    return clamp(calculatedValue, 0.0, 1.0);
}

vec3 linearSrgbToSrgb(vec3 rgb) {
    return vec3(
        linearSrgbChannelToSrgbChannel(rgb.r),
        linearSrgbChannelToSrgbChannel(rgb.g),
        linearSrgbChannelToSrgbChannel(rgb.b)
    );
}

vec3 rgbToHsv(vec3 rgb) {
    float max = max(max(rgb.r, rgb.g), rgb.b);
    float min = min(min(rgb.r, rgb.g), rgb.b);
    vec3 hsv = vec3(0.0, 0.0, max);
    float d = max - min;
    if (max == 0.0) {
        hsv.y = 0.0;
    } else {
        hsv.y = d / max;
    }
    if (max == min) {
        hsv.x = 0.0;
    } else {
        if (rgb.r == max) {
            hsv.x = (rgb.g - rgb.b) / d;
            if (rgb.g < rgb.b) {
                hsv.x += 6.0;
            }
        } else if (rgb.b == max) {
            hsv.x = (rgb.b - rgb.r) / d + 2.0;
        } else {
            hsv.x = (rgb.r - rgb.g) / d + 4.0;
        }
        hsv.x /= 6.0;
    }
    return hsv;
}

vec3 hsvToRgb(vec3 hsv) {
    vec3 rgb = vec3(0.0);
    float i = floor(hsv.x * 6.0);
    float f = hsv.x * 6.0 - i;
    float p = hsv.z * (1.0 - hsv.y);
    float q = hsv.z * (1.0 - f * hsv.y);
    float t = hsv.z * (1.0 - (1.0 - f) * hsv.y);

    int iMod = int(floor((i - floor((i + 0.5) / 6.0) * 6.0) + 0.5));
    if (iMod == 0) {
        rgb = vec3(hsv.z, t, p);
    } else if (iMod == 1) {
        rgb = vec3(q, hsv.z, p);
    } else if (iMod == 2) {
        rgb = vec3(p, hsv.z, t);
    } else if (iMod == 3) {
        rgb = vec3(p, q, hsv.z);
    } else if (iMod == 4) {
        rgb = vec3(t, p, hsv.z);
    } else {
        rgb = vec3(hsv.z, p, q);
    }
    return rgb;    
}

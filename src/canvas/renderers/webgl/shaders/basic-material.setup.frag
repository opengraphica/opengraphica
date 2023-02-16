#define PI 3.1415926535
#define CBRT_NEWTON_ITER 2
#define CBRT_HALLEY_ITER 0

uniform sampler2D map;

varying vec2 vUv;

float cbrt(float x) {
    float y = sign(x) * uintBitsToFloat(floatBitsToUint(abs(x)) / 3u + 0x2a514067u);
    for(int i = 0; i < CBRT_NEWTON_ITER; ++i) {
        y = (2. * y + x / ( y * y )) * .333333333;
    }
    for(int i = 0; i < CBRT_HALLEY_ITER; ++i) {
        float y3 = y * y * y;
        y *= (y3 + 2. * x) / (2. * y3 + x);
    }
    return y;
}

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

vec3 hueToRgb(float hue) {
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

vec3 hslToRgb(vec3 hsl) {
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
        return a + hueToRgb(hsl.x) * (b - a);
    }
}

vec3 rgbToHsl(in vec3 c){
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

vec3 rgbToOklab(in vec3 rgb) {
    float L = pow(
        0.41222147079999993 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b,
        1.0 / 3.0
    );
    float M = pow(
        0.2119034981999999 * rgb.r + 0.6806995450999999 * rgb.g + 0.1073969566 * rgb.b,
        1.0 / 3.0
    );
    float S = pow(
        0.08830246189999998 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005000002 * rgb.b,
        1.0 / 3.0
    );
    return vec3(
        0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
        1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S,
        0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S
    );
}

vec3 oklabToRgb(in vec3 lab) {
    float L = pow(
        (lab.x * 0.9999999984505198) + (0.39633779217376786 * lab.y) + (0.2158037580607588 * lab.z),
        3.0
    );
    float M = pow(
        (lab.x * 1.0000000088817608) - (0.10556134232365635 * lab.y) - (0.0638541747717059 * lab.z),
        3.0
    );
    float S = pow(
        (lab.x * 1.0000000546724109) - (0.08948418209496576 * lab.y) - (1.2914855378640917 * lab.z),
        3.0
    );
    return vec3(
        (4.076741661347994 * L) - (3.307711590408193 * M) + (0.230969928729428 * S),
        (-1.2684380040921763 * L) + (2.6097574006633715 * M) - (0.3413193963102197 * S),
        (-0.004196086541837188 * L) - (0.7034186144594493 * M) + (1.7076147009309444 * S)
    );
}

float normalizeHue(float hue) {
    float normalized = 0.0;
    normalized += step(0.0, hue) * hue;
    normalized += step(hue, -0.0000001) * hue + 360.0;
    return normalized;
}

vec3 lchToLab(in vec3 lch) {
    return vec3(
        lch.x,
        lch.y * cos((lch.z / 180.0) * PI),
        lch.y * sin((lch.z / 180.0) * PI)
    );
}

vec3 labToLch(in vec3 lab) {
    float c = sqrt(lab.y * lab.y + lab.z * lab.z);
    return vec3(
        lab.x,
        c,
        normalizeHue((atan(lab.z, lab.y) * 180.0) / PI)
    );
}

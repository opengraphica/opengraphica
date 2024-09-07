#define PI 3.1415926535
#define CBRT_NEWTON_ITER 2
#define CBRT_HALLEY_ITER 0

#define GRADIENT_COLOR_SPACE_OKLAB 0
#define GRADIENT_COLOR_SPACE_SRGB 1
#define GRADIENT_COLOR_SPACE_LINEAR_SRGB 2

#define GRADIENT_FILL_TYPE_LINEAR 0
#define GRADIENT_FILL_TYPE_RADIAL 1

#define GRADIENT_SPREAD_METHOD_PAD 0
#define GRADIENT_SPREAD_METHOD_REPEAT 1
#define GRADIENT_SPREAD_METHOD_REFLECT 2

uniform sampler2D gradientMap;
uniform vec2 start;
uniform vec2 end;
uniform vec2 focus;

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

const int ColorBlindnessSimulationMethodBrettel = 0;
const int ColorBlindnessSimulationMethodVienot = 1;
const int ColorBlindnessTypeProtan = 0;
const int ColorBlindnessTypeDeuteran = 1;
const int ColorBlindnessTypeTritan = 2;
const int ColorBlindnessTypeAchroma = 3;

const mat3 ColorBlindnessBrettelProtanRgbCvd1 = mat3(
    0.14980, 1.19548, -0.34528,
    0.10764, 0.84864, 0.04372,
    0.00384, -0.00540, 1.00156
);
const mat3 ColorBlindnessBrettelProtanRgbCvd2 = mat3(
    0.14570, 1.16172, -0.30742,
    0.10816, 0.85291, 0.03892,
    0.00386, -0.00524, 1.00139
);
const vec3 ColorBlindnessBrettelProtanSeparation = vec3(
    0.00048, 0.00393, -0.00441
);

const mat3 ColorBlindnessBrettelDeuteranRgbCvd1 = mat3(
    0.36477, 0.86381, -0.22858,
    0.26294, 0.64245, 0.09462,
    -0.02006, 0.02728, 0.99278
);
const mat3 ColorBlindnessBrettelDeuteranRgbCvd2 = mat3(
    0.37298, 0.88166, -0.25464,
    0.25954, 0.63506, 0.10540,
    -0.01980, 0.02784, 0.99196
);
const vec3 ColorBlindnessBrettelDeuteranSeparation = vec3(
    -0.00281, -0.00611, 0.00892
);

const mat3 ColorBlindnessBrettelTritanRgbCvd1 = mat3(
    1.01277, 0.13548, -0.14826,
    -0.01243, 0.86812, 0.14431,
    0.07589, 0.80500, 0.11911
);
const mat3 ColorBlindnessBrettelTritanRgbCvd2 = mat3(
    0.93678, 0.18979, -0.12657,
    0.06154, 0.81526, 0.12320,
    -0.37562, 1.12767, 0.24796
);
const vec3 ColorBlindnessBrettelTritanSeparation = vec3(
    0.03901, -0.02788, -0.01113
);

const mat3 ColorBlindnessVienotProtanRgbCvd = mat3(
    0.11238, 0.88762, 0.00000,
    0.11238, 0.88762, -0.00000,
    0.00401, -0.00401, 1.00000
);
const mat3 ColorBlindnessVienotDeuteranRgbCvd = mat3(
    0.29275, 0.70725, 0.00000,
    0.29275, 0.70725, -0.00000,
    -0.02234, 0.02234, 1.00000
);
const mat3 ColorBlindnessVienotTritanRgbCvd = mat3(
    1.00000, 0.14461, -0.14461,
    0.00000, 0.85924, 0.14076,
    -0.00000, 0.85924, 0.14076
);

uniform float pSeverity;

float processColorBlindnessSRgbToLinearRgb(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.04045) * value / 12.92;
    calculatedValue += step(0.04045, value) * pow((value + 0.055) / 1.055, 2.4);
    return calculatedValue;
}

float processColorBlindnessLinearRgbToSRgb(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.0031308) * value * 12.92;
    calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
    return clamp(calculatedValue, 0.0, 1.0);
}

vec4 processColorBlindness(vec4 color) {
    vec3 rgb = vec3(
        processColorBlindnessSRgbToLinearRgb(color.r),
        processColorBlindnessSRgbToLinearRgb(color.g),
        processColorBlindnessSRgbToLinearRgb(color.b)
    );
    vec3 rgbCvd = vec3(0.0);

    if (cType == ColorBlindnessTypeAchroma) {
        rgb = color.rgb;
        float intensity = rgb.r * 0.212656 + rgb.g * 0.715158 + rgb.b * 0.072186;
        rgbCvd.r = ( (rgb.r * (1.0 - pSeverity)) + (intensity * pSeverity) );
        rgbCvd.g = ( (rgb.g * (1.0 - pSeverity)) + (intensity * pSeverity) );
        rgbCvd.b = ( (rgb.b * (1.0 - pSeverity)) + (intensity * pSeverity) );
        return vec4(rgbCvd, color.a);
    } else {
        if (cMethod == ColorBlindnessSimulationMethodBrettel) {
            mat3 rgbCvd1;
            mat3 rgbCvd2;
            vec3 n;
            if (cType == ColorBlindnessTypeProtan) {
                rgbCvd1 = ColorBlindnessBrettelProtanRgbCvd1;
                rgbCvd2 = ColorBlindnessBrettelProtanRgbCvd2;
                n = ColorBlindnessBrettelProtanSeparation;
            } else if (cType == ColorBlindnessTypeDeuteran) {
                rgbCvd1 = ColorBlindnessBrettelDeuteranRgbCvd1;
                rgbCvd2 = ColorBlindnessBrettelDeuteranRgbCvd2;
                n = ColorBlindnessBrettelDeuteranSeparation;
            } else if (cType == ColorBlindnessTypeTritan) {
                rgbCvd1 = ColorBlindnessBrettelTritanRgbCvd1;
                rgbCvd2 = ColorBlindnessBrettelTritanRgbCvd2;
                n = ColorBlindnessBrettelTritanSeparation;
            }
            float dotWithSepPlane = rgb[0] * n[0] + rgb[1] * n[1] + rgb[2] * n[2];
            mat3 rgbCvdFromRgb = mat3(0.0);
            rgbCvdFromRgb += step(0.0, dotWithSepPlane) * rgbCvd1;
            rgbCvdFromRgb += step(dotWithSepPlane, 0.0) * rgbCvd2;
            rgbCvd = vec3(
                rgbCvdFromRgb[0][0] * rgb.r + rgbCvdFromRgb[0][1] * rgb.g + rgbCvdFromRgb[0][2] * rgb.b,
                rgbCvdFromRgb[1][0] * rgb.r + rgbCvdFromRgb[1][1] * rgb.g + rgbCvdFromRgb[1][2] * rgb.b,
                rgbCvdFromRgb[2][0] * rgb.r + rgbCvdFromRgb[2][1] * rgb.g + rgbCvdFromRgb[2][2] * rgb.b
            );
            rgbCvd.r = rgbCvd.r * pSeverity + rgb.r * (1.0 - pSeverity);
            rgbCvd.g = rgbCvd.g * pSeverity + rgb.g * (1.0 - pSeverity);
            rgbCvd.b = rgbCvd.b * pSeverity + rgb.b * (1.0 - pSeverity);
        }
        else if (cMethod == ColorBlindnessSimulationMethodVienot) {
            mat3 rgbCvdFromRgb = mat3(0.0);
            if (cType == ColorBlindnessTypeProtan) {
                rgbCvdFromRgb = ColorBlindnessVienotProtanRgbCvd;
            } else if (cType == ColorBlindnessTypeDeuteran) {
                rgbCvdFromRgb = ColorBlindnessVienotDeuteranRgbCvd;
            } else if (cType == ColorBlindnessTypeTritan) {
                rgbCvdFromRgb = ColorBlindnessVienotTritanRgbCvd;
            }
            rgbCvd = vec3(
                rgbCvdFromRgb[0][0] * rgb.r + rgbCvdFromRgb[0][1] * rgb.g + rgbCvdFromRgb[0][2] * rgb.b,
                rgbCvdFromRgb[1][0] * rgb.r + rgbCvdFromRgb[1][1] * rgb.g + rgbCvdFromRgb[1][2] * rgb.b,
                rgbCvdFromRgb[2][0] * rgb.r + rgbCvdFromRgb[2][1] * rgb.g + rgbCvdFromRgb[2][2] * rgb.b
            );

            if (pSeverity < 0.999) {
                rgbCvd.r = pSeverity * rgbCvd.r + (1.0 - pSeverity) * rgb.r;
                rgbCvd.g = pSeverity * rgbCvd.g + (1.0 - pSeverity) * rgb.g;
                rgbCvd.b = pSeverity * rgbCvd.b + (1.0 - pSeverity) * rgb.b;
            }
        }
    }
    return vec4(
        vec3(
            processColorBlindnessLinearRgbToSRgb(rgbCvd.r),
            processColorBlindnessLinearRgbToSRgb(rgbCvd.g),
            processColorBlindnessLinearRgbToSRgb(rgbCvd.b)
        ),
        color.a
    );
    
    return color;
}

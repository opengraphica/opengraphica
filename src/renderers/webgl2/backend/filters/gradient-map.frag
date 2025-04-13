const int GradientMapColorSpaceOklab = 0;
const int GradientMapColorSpacePerceptualRgb = 1;
const int GradientMapColorSpaceLinearRgb = 2;

uniform float pMix;
uniform sampler2D pGradient;

vec4 processGradientMap(vec4 color) {

    vec3 lch = labToLch(rgbToOklab(color.rgb));

    vec4 newRgb = texture2D(pGradient, vec2(lch.x, 0.0));
    newRgb = color * (1.0 - pMix) + newRgb * pMix;

    return vec4(newRgb.rgb, newRgb.a * color.a);
}

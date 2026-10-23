/**
 * This file is adapted from:
 * https://github.com/evanw/glfx.js/blob/master/src/filters/blur/zoomblur.js
 * @copyright Evan Wallace
 * @license MIT https://github.com/evanw/glfx.js/blob/master/LICENSE
 */

uniform float pStrength;
uniform float pCenterX;
uniform float pCenterY;

vec4 processZoomBlur(vec4 color, vec2 uv) {
    vec2 focus = uv - vec2(0.5 + pCenterX, 0.5 + pCenterY);

    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);

    vec4 newColor = vec4(0.0, 0.0, 0.0, 0.0);
    float total = 0.0;
    vec2 toCenter = vec2(0.5 + pCenterX, 0.5 + pCenterY) - uv;

    for (int i = 0; i < 40; i++) {
        float percent = (float(i) + offset) / 40.0;
        float weight = 4.0 * (percent - percent * percent);

        float power = pStrength * 0.1 * float(i);

        vec4 colorSample = sampleBackbuffer(uv + toCenter * percent * pStrength);
        colorSample.rgb *= colorSample.a;

        newColor += colorSample * weight;
        total += weight;
    }
    newColor /= total;
    newColor.rgb /= max(newColor.a, 0.00001);

    return newColor;
}
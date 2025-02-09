uniform float pMix;

vec4 processInstagramGingham(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    vec3 fill = vec3(0.90196, 0.90196, 0.98039);

    // Soft light blending mode
    float topR = linearSrgbChannelToSrgbChannel(fill.r);
    float bottomR = linearSrgbChannelToSrgbChannel(color.r);
    float topG = linearSrgbChannelToSrgbChannel(fill.g);
    float bottomG = linearSrgbChannelToSrgbChannel(color.g);
    float topB = linearSrgbChannelToSrgbChannel(fill.b);
    float bottomB = linearSrgbChannelToSrgbChannel(color.b);
    newRgb.r = (
        ((topR * bottomR) * (1.0 - bottomR)) +
        ((1.0 - ((1.0 - topR) * (1.0 - bottomR))) * bottomR)
    );
    newRgb.g = (
        ((topG * bottomG) * (1.0 - bottomG)) +
        ((1.0 - ((1.0 - topG) * (1.0 - bottomG))) * bottomG)
    );
    newRgb.b = (
        ((topB * bottomB) * (1.0 - bottomB)) +
        ((1.0 - ((1.0 - topB) * (1.0 - bottomB))) * bottomB)
    );

    // Contrast(0.9)
    float contrast = -1.0 + tan((min(0.9999, -0.1) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Hue-roate(-10deg)
    vec3 lch = labToLch(rgbToOklab(newRgb.rgb));
    lch.z += -10.0;
    newRgb = oklabToRgb(lchToLab(lch));

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
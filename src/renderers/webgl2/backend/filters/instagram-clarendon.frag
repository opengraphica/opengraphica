uniform float pMix;

vec4 processInstagramClarendon(vec4 color) {
    vec3 rgb = linearSrgbToSrgb(color.rgb);
    vec3 newRgb = vec3(rgb.rgb);

    vec4 fill = vec4(0.49803, 0.73333, 0.89019, 0.2);

    // Overlay blending mode
    float topR = linearSrgbChannelToSrgbChannel(color.r);
    float bottomR = linearSrgbChannelToSrgbChannel(fill.r);
    float topG = linearSrgbChannelToSrgbChannel(color.g);
    float bottomG = linearSrgbChannelToSrgbChannel(fill.g);
    float topB = linearSrgbChannelToSrgbChannel(color.b);
    float bottomB = linearSrgbChannelToSrgbChannel(fill.b);
    newRgb.r = (rgb.r * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomR, 0.5) * (topR * bottomR * 2.0)) + 
            (step(0.5, bottomR) * (1.0 - ((1.0 - topR) * (1.0 - bottomR) * 2.0)))
        ) * fill.a;
    newRgb.g =  (rgb.g * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomG, 0.5) * (topG * bottomG * 2.0)) + 
            (step(0.5, bottomG) * (1.0 - ((1.0 - topG) * (1.0 - bottomG) * 2.0)))
        ) * fill.a;
    newRgb.b =  (rgb.b * (1.0 - fill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomB, 0.5) * (topB * bottomB * 2.0)) + 
            (step(0.5, bottomB) * (1.0 - ((1.0 - topB) * (1.0 - bottomB) * 2.0)))
        ) * fill.a;

    // Contrast(1.1)
    float contrast = -1.0 + tan((min(0.9999, 0.1) + 1.0) * PI / 4.0);
    newRgb.r += (newRgb.r - 0.5) * contrast;
    newRgb.g += (newRgb.g - 0.5) * contrast;
    newRgb.b += (newRgb.b - 0.5) * contrast;

    // Saturate(1.2)
    float chroma = tan((min(0.9999, 0.2) + 1.0) * PI / 4.0);
    vec3 lch = labToLch(rgbToOklab(newRgb.rgb));
    float c = lch.y * chroma;
    c = clamp(c, 0.0, 1.0);
    lch.y = c;
    newRgb.rgb = oklabToRgb(lchToLab(lch));

    return vec4(srgbToLinearSrgb(rgb.rgb * (1.0 - pMix) + newRgb * pMix), color.a);
}
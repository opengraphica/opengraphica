

#if cLayerBlendingMode == BLENDING_MODE_MULTIPLY
    vec4 blendTexture = texture2D(destinationMap, vScreenUv);
    gl_FragColor.r = gl_FragColor.r * blendTexture.r;
    gl_FragColor.g = gl_FragColor.g * blendTexture.g;
    gl_FragColor.b = gl_FragColor.b * blendTexture.b;
#elif cLayerBlendingMode == BLENDING_MODE_DIFFERENCE
    vec4 blendTexture = texture2D(destinationMap, vScreenUv);
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.r) - linearSrgbChannelToSrgbChannel(gl_FragColor.r)));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.g) - linearSrgbChannelToSrgbChannel(gl_FragColor.g)));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.b) - linearSrgbChannelToSrgbChannel(gl_FragColor.b)));
#elif cLayerBlendingMode == BLENDING_MODE_SUBTRACT
    vec4 blendTexture = texture2D(destinationMap, vScreenUv);
    gl_FragColor.r = clamp(blendTexture.r - gl_FragColor.r, 0.0, 1.0);
    gl_FragColor.g = clamp(blendTexture.g - gl_FragColor.g, 0.0, 1.0);
    gl_FragColor.b = clamp(blendTexture.b - gl_FragColor.b, 0.0, 1.0);
#endif
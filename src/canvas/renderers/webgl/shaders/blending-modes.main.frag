
#ifdef cLayerBlendingMode
    vec4 blendTexture = texture2D(destinationMap, vScreenUv);
#endif
#if cLayerBlendingMode == BLENDING_MODE_COLOR_ERASE
    // TODO - not sure about this implementation.
    vec3 topLch = labToLch(rgbToOklab(gl_FragColor.rgb));
    vec3 bottomLch = labToLch(rgbToOklab(blendTexture.rgb));
    float hueDelta = (180.0 - min(abs(bottomLch.z - topLch.z), 360.0 - abs(bottomLch.z - topLch.z))) / 180.0;
    float lightnessDelta = abs(bottomLch.x - topLch.x);
    float chromaDelta = abs(bottomLch.y - topLch.y);
    float eraseFactor = hueDelta * (1.0 - lightnessDelta) * (1.0 - chromaDelta);
    gl_FragColor.rgb = blendTexture.rgb;
    gl_FragColor.a = clamp(blendTexture.a - (eraseFactor * gl_FragColor.a), 0.0, 1.0);
#elif cLayerBlendingMode == BLENDING_MODE_LIGHTEN_ONLY
    gl_FragColor.r = max(gl_FragColor.r, blendTexture.r);
    gl_FragColor.g = max(gl_FragColor.g, blendTexture.g);
    gl_FragColor.b = max(gl_FragColor.b, blendTexture.b);
#elif cLayerBlendingMode == BLENDING_MODE_LUMA_LIGHTEN_ONLY
    vec3 topLch = labToLch(rgbToOklab(gl_FragColor.rgb));
    vec3 bottomLch = labToLch(rgbToOklab(blendTexture.rgb));
    float topContribution = step(bottomLch.x, topLch.x);
    gl_FragColor.rgb = (gl_FragColor.rgb * topContribution) + (blendTexture.rgb * (1.0 - topContribution));
#elif cLayerBlendingMode == BLENDING_MODE_SCREEN
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.r)) * (1.0 - linearSrgbChannelToSrgbChannel(blendTexture.r))));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.g)) * (1.0 - linearSrgbChannelToSrgbChannel(blendTexture.g))));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.b)) * (1.0 - linearSrgbChannelToSrgbChannel(blendTexture.b))));
#elif cLayerBlendingMode == BLENDING_MODE_DODGE
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.r) / (1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.r)));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.g) / (1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.g)));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.b) / (1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.b)));
#elif cLayerBlendingMode == BLENDING_MODE_ADDITION
    gl_FragColor.r = gl_FragColor.r + blendTexture.r;
    gl_FragColor.g = gl_FragColor.g + blendTexture.g;
    gl_FragColor.b = gl_FragColor.b + blendTexture.b;
#elif cLayerBlendingMode == BLENDING_MODE_MULTIPLY
    gl_FragColor.r = gl_FragColor.r * blendTexture.r;
    gl_FragColor.g = gl_FragColor.g * blendTexture.g;
    gl_FragColor.b = gl_FragColor.b * blendTexture.b;
#elif cLayerBlendingMode == BLENDING_MODE_DIFFERENCE
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.r) - linearSrgbChannelToSrgbChannel(gl_FragColor.r)));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.g) - linearSrgbChannelToSrgbChannel(gl_FragColor.g)));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.b) - linearSrgbChannelToSrgbChannel(gl_FragColor.b)));
#elif cLayerBlendingMode == BLENDING_MODE_SUBTRACT
    gl_FragColor.r = clamp(blendTexture.r - gl_FragColor.r, 0.0, 1.0);
    gl_FragColor.g = clamp(blendTexture.g - gl_FragColor.g, 0.0, 1.0);
    gl_FragColor.b = clamp(blendTexture.b - gl_FragColor.b, 0.0, 1.0);
#endif

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
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.r) / max(0.00001, 1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.r)));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.g) / max(0.00001, 1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.g)));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(blendTexture.b) / max(0.00001, 1.0 - linearSrgbChannelToSrgbChannel(gl_FragColor.b)));
#elif cLayerBlendingMode == BLENDING_MODE_LINEAR_DODGE
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.r) + linearSrgbChannelToSrgbChannel(blendTexture.r));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.g) + linearSrgbChannelToSrgbChannel(blendTexture.g));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.b) + linearSrgbChannelToSrgbChannel(blendTexture.b));
#elif cLayerBlendingMode == BLENDING_MODE_ADDITION
    gl_FragColor.r = gl_FragColor.r + blendTexture.r;
    gl_FragColor.g = gl_FragColor.g + blendTexture.g;
    gl_FragColor.b = gl_FragColor.b + blendTexture.b;
#elif cLayerBlendingMode == BLENDING_MODE_DARKEN_ONLY
    gl_FragColor.r = min(gl_FragColor.r, blendTexture.r);
    gl_FragColor.g = min(gl_FragColor.g, blendTexture.g);
    gl_FragColor.b = min(gl_FragColor.b, blendTexture.b);
#elif cLayerBlendingMode == BLENDING_MODE_LUMA_DARKEN_ONLY
    vec3 topLch = labToLch(rgbToOklab(gl_FragColor.rgb));
    vec3 bottomLch = labToLch(rgbToOklab(blendTexture.rgb));
    float topContribution = step(topLch.x, bottomLch.x);
    gl_FragColor.rgb = (gl_FragColor.rgb * topContribution) + (blendTexture.rgb * (1.0 - topContribution));
#elif cLayerBlendingMode == BLENDING_MODE_MULTIPLY
    gl_FragColor.r = gl_FragColor.r * blendTexture.r;
    gl_FragColor.g = gl_FragColor.g * blendTexture.g;
    gl_FragColor.b = gl_FragColor.b * blendTexture.b;
#elif cLayerBlendingMode == BLENDING_MODE_BURN
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(blendTexture.r)) / max(0.00001, linearSrgbChannelToSrgbChannel(gl_FragColor.r))));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(blendTexture.g)) / max(0.00001, linearSrgbChannelToSrgbChannel(gl_FragColor.g))));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(1.0 - ((1.0 - linearSrgbChannelToSrgbChannel(blendTexture.b)) / max(0.00001, linearSrgbChannelToSrgbChannel(gl_FragColor.b))));
#elif cLayerBlendingMode == BLENDING_MODE_LINEAR_BURN
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.r) + linearSrgbChannelToSrgbChannel(blendTexture.r) - 1.0);
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.g) + linearSrgbChannelToSrgbChannel(blendTexture.g) - 1.0);
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.b) + linearSrgbChannelToSrgbChannel(blendTexture.b) - 1.0);
#elif cLayerBlendingMode == BLENDING_MODE_OVERLAY
    float topR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float bottomR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float topG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float bottomG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float topB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    float bottomB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(
        (step(bottomR, 0.5) * (topR * bottomR * 2.0)) + 
        (step(0.5, bottomR) * (1.0 - ((1.0 - topR) * (1.0 - bottomR) * 2.0)))
    );
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(
        (step(bottomG, 0.5) * (topG * bottomG * 2.0)) + 
        (step(0.5, bottomG) * (1.0 - ((1.0 - topG) * (1.0 - bottomG) * 2.0)))
    );
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(
        (step(bottomB, 0.5) * (topB * bottomB * 2.0)) + 
        (step(0.5, bottomB) * (1.0 - ((1.0 - topB) * (1.0 - bottomB) * 2.0)))
    );
#elif cLayerBlendingMode == BLENDING_MODE_SOFT_LIGHT
    float topR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float bottomR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float topG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float bottomG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float topB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    float bottomB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(
        ((topR * bottomR) * (1.0 - bottomR)) +
        ((1.0 - ((1.0 - topR) * (1.0 - bottomR))) * bottomR)
    );
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(
        ((topG * bottomG) * (1.0 - bottomG)) +
        ((1.0 - ((1.0 - topG) * (1.0 - bottomG))) * bottomG)
    );
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(
        ((topB * bottomB) * (1.0 - bottomB)) +
        ((1.0 - ((1.0 - topB) * (1.0 - bottomB))) * bottomB)
    );
#elif cLayerBlendingMode == BLENDING_MODE_HARD_LIGHT
    float topR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float bottomR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float topG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float bottomG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float topB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    float bottomB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(
        (step(bottomR, 0.5) * (topR * bottomR * 2.0)) + 
        (step(0.5, bottomR) * (1.0 - ((1.0 - topR) * (1.0 - bottomR) * 2.0)))
    );
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(
        (step(bottomG, 0.5) * (topG * bottomG * 2.0)) + 
        (step(0.5, bottomG) * (1.0 - ((1.0 - topG) * (1.0 - bottomG) * 2.0)))
    );
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(
        (step(bottomB, 0.5) * (topB * bottomB * 2.0)) + 
        (step(0.5, bottomB) * (1.0 - ((1.0 - topB) * (1.0 - bottomB) * 2.0)))
    );
#elif cLayerBlendingMode == BLENDING_MODE_VIVID_LIGHT
    float topR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float bottomR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float topG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float bottomG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float topB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    float bottomB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    gl_FragColor.r = clamp(srgbChannelToLinearSrgbChannel(
        (step(topR, 0.5) * (1.0 - (1.0 - bottomR) / max(0.00001, 2.0 * topR))) +
        (step(0.5, topR) * (bottomR / max(0.00001, 2.0 * (1.0 - topR))))
    ), 0.0, 1.0);
    gl_FragColor.g = clamp(srgbChannelToLinearSrgbChannel(
        (step(topG, 0.5) * (1.0 - (1.0 - bottomG) / max(0.00001, 2.0 * topG))) +
        (step(0.5, topG) * (bottomG / max(0.00001, 2.0 * (1.0 - topG))))
    ), 0.0, 1.0);
    gl_FragColor.b = clamp(srgbChannelToLinearSrgbChannel(
        (step(topB, 0.5) * (1.0 - (1.0 - bottomB) / max(0.00001, 2.0 * topB))) +
        (step(0.5, topB) * (bottomB / max(0.00001, 2.0 * (1.0 - topB))))
    ), 0.0, 1.0);
#elif cLayerBlendingMode == BLENDING_MODE_PIN_LIGHT
    float topR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float bottomR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float topG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float bottomG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float topB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    float bottomB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(
        (step(0.5, topR) * max((topR - 0.5) * 2.0, bottomR)) +
        (step(topR, 0.5) * min(topR * 2.0, bottomR))
    );
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(
        (step(0.5, topG) * max((topG - 0.5) * 2.0, bottomG)) +
        (step(topG, 0.5) * min(topG * 2.0, bottomG))
    );
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(
        (step(0.5, topB) * max((topB - 0.5) * 2.0, bottomB)) +
        (step(topB, 0.5) * min(topB * 2.0, bottomB))
    );
#elif cLayerBlendingMode == BLENDING_MODE_LINEAR_LIGHT
    float topR = linearSrgbChannelToSrgbChannel(gl_FragColor.r);
    float bottomR = linearSrgbChannelToSrgbChannel(blendTexture.r);
    float topG = linearSrgbChannelToSrgbChannel(gl_FragColor.g);
    float bottomG = linearSrgbChannelToSrgbChannel(blendTexture.g);
    float topB = linearSrgbChannelToSrgbChannel(gl_FragColor.b);
    float bottomB = linearSrgbChannelToSrgbChannel(blendTexture.b);
    gl_FragColor.r = clamp(srgbChannelToLinearSrgbChannel(bottomR + 2.0 * (topR - 0.5)), 0.0, 1.0);
    gl_FragColor.g = clamp(srgbChannelToLinearSrgbChannel(bottomG + 2.0 * (topG - 0.5)), 0.0, 1.0);
    gl_FragColor.b = clamp(srgbChannelToLinearSrgbChannel(bottomB + 2.0 * (topB - 0.5)), 0.0, 1.0);
#elif cLayerBlendingMode == BLENDING_MODE_HARD_MIX
    gl_FragColor.r = floor(srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.r) + linearSrgbChannelToSrgbChannel(blendTexture.r)));
    gl_FragColor.g = floor(srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.g) + linearSrgbChannelToSrgbChannel(blendTexture.g)));
    gl_FragColor.b = floor(srgbChannelToLinearSrgbChannel(linearSrgbChannelToSrgbChannel(gl_FragColor.b) + linearSrgbChannelToSrgbChannel(blendTexture.b)));
#elif cLayerBlendingMode == BLENDING_MODE_DIFFERENCE
    gl_FragColor.r = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.r) - linearSrgbChannelToSrgbChannel(gl_FragColor.r)));
    gl_FragColor.g = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.g) - linearSrgbChannelToSrgbChannel(gl_FragColor.g)));
    gl_FragColor.b = srgbChannelToLinearSrgbChannel(abs(linearSrgbChannelToSrgbChannel(blendTexture.b) - linearSrgbChannelToSrgbChannel(gl_FragColor.b)));
#elif cLayerBlendingMode == BLENDING_MODE_SUBTRACT
    gl_FragColor.r = clamp(blendTexture.r - gl_FragColor.r, 0.0, 1.0);
    gl_FragColor.g = clamp(blendTexture.g - gl_FragColor.g, 0.0, 1.0);
    gl_FragColor.b = clamp(blendTexture.b - gl_FragColor.b, 0.0, 1.0);
#endif
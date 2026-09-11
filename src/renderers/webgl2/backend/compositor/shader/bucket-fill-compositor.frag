varying vec2 vUv;

uniform sampler2D dstMap;
uniform sampler2D fillMap;
uniform sampler2D selectionMaskMap;
uniform vec4 fillColor;
uniform vec4 strengthFeatherAntialias;
uniform mat4 selectionMaskTransform;

const float FEATHER_EPSILON = 1e-6;

void main() {

#if cSelectionMaskEnabled == 1
    vec2 selectionMaskUv = (selectionMaskTransform * vec4(vUv, 0.0, 1.0)).xy;
    float selectionMaskVisible = step(0.0, selectionMaskUv.x) * step(0.0, selectionMaskUv.y) *
        step(selectionMaskUv.x, 1.0) * step(selectionMaskUv.y, 1.0);
    float selectionMaskMultiplier = texture2D(selectionMaskMap, selectionMaskUv).a * selectionMaskVisible;
#else
    float selectionMaskMultiplier = 1.0;
#endif

    vec4 fillMapColor = texture2D(fillMap, vec2(vUv.x, 1.0 - vUv.y));

    float strength = strengthFeatherAntialias.x;

    float feather = strengthFeatherAntialias.y;
    float antialias = strengthFeatherAntialias.z;
    float featherWithAntialias = feather + fwidth(fillMapColor.r) * antialias;
    float fillEdge = 1.0 - strength - feather;

    float hasFeather = step(FEATHER_EPSILON, featherWithAntialias);
    float hardAlpha = step(
        fillEdge,
        fillMapColor.r - feather
    );
    float safeFeather = max(featherWithAntialias, FEATHER_EPSILON);
    float softAlpha = smoothstep(
        fillEdge,
        fillEdge + safeFeather,
        fillMapColor.r - feather
    );

    float fillAlpha = fillColor.a * mix(
        hardAlpha,
        softAlpha,
        hasFeather
    ) * selectionMaskMultiplier;

    vec4 dstColor = texture2D(dstMap, vUv);

#if cLayerBlendingMode == BLENDING_MODE_ERASE
    float alpha = max(dstColor.a - fillAlpha, 0.0);
    gl_FragColor = vec4(
        dstColor.rgb, alpha
    );
#else
    float alpha = fillAlpha + dstColor.a * (1.0 - fillAlpha);
    gl_FragColor = vec4(
        ((fillColor.rgb) * fillAlpha + ((dstColor.rgb) * dstColor.a) * (1.0 - fillAlpha)) / alpha, alpha
    );
#endif
}


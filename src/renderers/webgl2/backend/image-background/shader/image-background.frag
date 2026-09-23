uniform vec4 color;
uniform sampler2D transparencyGridMap;
uniform float transparencyTileSize;
uniform float opacity;

varying vec2 vUv;

const float EPSILON = 1.0 / 255.0;

void main() {

#if cTransparencyEnabled == 1
    vec2 uvPerScreenX = dFdx(vUv);
    vec2 uvPerScreenY = dFdy(vUv);

    mat2 uvFromScreen = mat2(
        uvPerScreenX,
        uvPerScreenY
    );

    mat2 screenFromUv = inverse(uvFromScreen);

    // Screen-space directions corresponding to increasing U and V.
    vec2 screenAxisU = normalize(screenFromUv[0]);
    vec2 screenAxisV = normalize(screenFromUv[1]);

    vec2 screenOrigin =
        gl_FragCoord.xy -
        screenFromUv * vUv;

    vec2 offsetFromOrigin =
        gl_FragCoord.xy - screenOrigin;

    vec2 gridPixelPosition = vec2(
        dot(offsetFromOrigin, screenAxisU),
        dot(offsetFromOrigin, screenAxisV)
    );

    vec2 gridUv = gridPixelPosition / transparencyTileSize;

    gl_FragColor = vec4(
        (
            (texture2D(transparencyGridMap, gridUv).rgb * (1.0 - color.a))
            + (color.rgb * color.a)
        ) * step(EPSILON, opacity),
        opacity
    );
#else
    gl_FragColor = vec4(color.rgb * color.a * step(EPSILON, opacity), color.a * opacity);
#endif
}
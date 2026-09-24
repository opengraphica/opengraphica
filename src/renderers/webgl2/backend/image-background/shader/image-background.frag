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

    vec2 screenAxisU = normalize(screenFromUv[0]);
    vec2 screenAxisV = normalize(screenFromUv[1]);
    vec2 screenOffset = screenFromUv * vUv;

    vec2 gridPixelPosition = vec2(
        dot(screenOffset, screenAxisU),
        dot(screenOffset, screenAxisV)
    );

    vec2 gridUv = gridPixelPosition / transparencyTileSize;
    vec2 wrappedGridUv = fract(gridUv);
    vec2 gridUvDx = dFdx(wrappedGridUv);
    vec2 gridUvDy = dFdy(wrappedGridUv);

    vec3 transparencyGridColor = textureGrad(
        transparencyGridMap,
        wrappedGridUv,
        gridUvDx,
        gridUvDy
    ).rgb;

    gl_FragColor = vec4(
        (
            (transparencyGridColor * (1.0 - color.a))
            + (color.rgb * color.a)
        ) * step(EPSILON, opacity),
        opacity
    );
#else
    gl_FragColor = vec4(color.rgb * color.a * step(EPSILON, opacity), color.a * opacity);
#endif
}
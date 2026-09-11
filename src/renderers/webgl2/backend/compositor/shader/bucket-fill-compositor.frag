varying vec2 vUv;

uniform sampler2D dstMap;
uniform sampler2D fillMap;
uniform vec4 fillColor;
uniform vec4 strengthFeatherAntialias;

const float FEATHER_EPSILON = 1e-6;

void main() {

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
    );

    vec4 dstColor = texture2D(dstMap, vUv);

    float alpha = fillAlpha + dstColor.a * (1.0 - fillAlpha);
    gl_FragColor = vec4(
        ((fillColor.rgb) * fillAlpha + ((dstColor.rgb) * dstColor.a) * (1.0 - fillAlpha)) / alpha, alpha
    );
}


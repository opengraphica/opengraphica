varying vec2 vUv;

uniform sampler2D brushStrokeMap;
uniform vec4 tileOffsetAndSize;
uniform mat4 brushTransform;
uniform vec4 brushColor;

float circle(vec2 uv, vec2 center, float radius) {
    float dist = distance(uv, center);
    float edge = fwidth(dist) * 1.0;
    return smoothstep(radius + edge, radius - edge, dist);
}

void main() {
    vec2 baseUv = vec2(tileOffsetAndSize.x, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w) + vUv * tileOffsetAndSize.zw;
    vec4 brushStrokeColor = texture2D(brushStrokeMap, baseUv);

    vec2 brushUv = (brushTransform * vec4(vUv, 0.0, 1.0)).xy;
    vec4 brushStampColor = vec4(brushColor.rgb, brushColor.a * circle(brushUv, vec2(0.5, 0.5), 0.5));

    brushStrokeColor.rgb = (
        (step(brushStampColor.a, 0.001) * brushStrokeColor.rgb)
        + (step(0.001, brushStampColor.a) * brushStampColor.rgb)
    );

    gl_FragColor = vec4(
        brushStampColor.rgb * brushStampColor.a + brushStrokeColor.rgb * (1.0 - brushStampColor.a),
        brushStampColor.a + brushStrokeColor.a * (1.0 - brushStampColor.a)
    );
}
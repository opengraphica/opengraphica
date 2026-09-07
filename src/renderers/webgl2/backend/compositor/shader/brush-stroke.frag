#define BRUSH_SHAPE_CIRCLE 0
#define BRUSH_SHAPE_SQUARE 1

varying vec2 vUv;

uniform sampler2D brushStrokeMap;
uniform sampler2D brushColorMap;
uniform vec4 tileOffsetAndSize;
uniform mat4 brushTransform;
uniform float brushHardness;

float circleFalloff(float radius, float hardness) {
    float edge = hardness;
    float t = clamp((radius - edge) / max(1.0 - hardness, 1e-5), 0.0, 1.0);
    float s = t * t * (3.0 - 2.0 * t);
    return mix(1.0, 0.0, s);
}

float square(vec2 uv, vec2 center, float radius) {
    vec2 delta = abs(uv - center);
    float dist = max(delta.x, delta.y);
    float squareDist = max(delta.x, delta.y) / max(radius, 1e-5);
    return (
        circleFalloff(
            clamp(squareDist, 0.0, 1.0),
            brushHardness
        )
        * step(dist, radius)
    );
}

float circle(vec2 uv, vec2 center, float radius) {
    float dist = distance(uv, center);
    float edge = fwidth(dist) * 1.0;
    return (
        circleFalloff(clamp(dist / radius, 0.0, 1.0), brushHardness)
        * smoothstep(radius + edge, radius - edge, dist)
    );
}

void main() {
    vec2 baseUv = vec2(tileOffsetAndSize.x, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w) + vUv * tileOffsetAndSize.zw;
    vec4 brushStrokeColor = texture2D(brushStrokeMap, baseUv);

    vec2 brushUv = (brushTransform * vec4(vUv, 0.0, 1.0)).xy;
    vec4 brushColor = texture2D(brushColorMap, vec2(0.5, 0.5));
#if cBrushShape == BRUSH_SHAPE_CIRCLE
    vec4 brushStampColor = vec4(brushColor.rgb, brushColor.a * circle(brushUv, vec2(0.5, 0.5), 0.5));
#elif cBrushShape == BRUSH_SHAPE_SQUARE
    vec4 brushStampColor = vec4(brushColor.rgb, brushColor.a * square(brushUv, vec2(0.5, 0.5), 0.5));
#endif

    brushStrokeColor.rgb = (
        (step(brushStrokeColor.a, 0.001) * brushStampColor.rgb)
        + (step(0.001, brushStrokeColor.a) * brushStrokeColor.rgb)
    );

    gl_FragColor = vec4(
        brushStampColor.rgb * brushStampColor.a + brushStrokeColor.rgb * (1.0 - brushStampColor.a),
        brushStampColor.a + brushStrokeColor.a * (1.0 - brushStampColor.a)
    );
}
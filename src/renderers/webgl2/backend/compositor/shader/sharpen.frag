varying vec2 vUv;

uniform sampler2D map;
uniform vec2 mapSize;
uniform vec4 tileOffsetAndSize;
uniform float sharpness;

void main() {
    vec2 baseUv = vec2(
        tileOffsetAndSize.x,
        1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w
    ) + vUv * tileOffsetAndSize.zw;

    vec2 step = 1.0 / mapSize;
    vec3 texA = texture2D(map, vUv + vec2(-step.x, -step.y) * 1.5).rgb;
    vec3 texB = texture2D(map, vUv + vec2( step.x, -step.y) * 1.5).rgb;
    vec3 texC = texture2D(map, vUv + vec2(-step.x,  step.y) * 1.5).rgb;
    vec3 texD = texture2D(map, vUv + vec2( step.x,  step.y) * 1.5).rgb;

    vec3 around = 0.25 * (texA + texB + texC + texD);
    vec4 center  = texture2D(map, vUv);

    vec3 col = center.rgb + (center.rgb - around) * sharpness;

    gl_FragColor = vec4(col, center.a);
}

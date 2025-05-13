varying vec2 vUv;

uniform sampler2D map;
uniform vec4 tileOffsetAndSize;

void main() {
    vec2 baseUv = vec2(tileOffsetAndSize.x, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w) + vUv * tileOffsetAndSize.zw;
    vec4 color = texture2D(map, baseUv);

    gl_FragColor = color;
}
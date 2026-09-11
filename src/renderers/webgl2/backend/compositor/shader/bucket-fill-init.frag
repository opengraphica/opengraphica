uniform vec2 seed;
uniform vec2 resolution;

varying vec2 vUv;

void main() {
    vec2 point = vUv;

    vec2 seedRange = (0.5 / resolution) + vec2(0.00001);

    float withinX = step(abs(point.x - seed.x), seedRange.x);
    float withinY = step(abs(point.y - seed.y), seedRange.y);

    float isSeed = withinX * withinY;

    gl_FragColor = vec4(isSeed);
}
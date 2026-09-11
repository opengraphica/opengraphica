uniform sampler2D reference;
uniform sampler2D previousHeight;
uniform vec2 seed;
uniform vec2 resolution;
uniform float tolerance;

varying vec2 vUv;

bool inBounds(vec2 p) {
    return p.x >= 0.0 && p.y >= 0.0 && p.x < 1.0 && p.y < 1.0;
}

vec4 getHeight(vec2 point) {
    if (!inBounds(point)) {
        return vec4(0.0);
    }
    return texture2D(previousHeight, point);
}

void main() {
    vec2 texelSize = 1.0 / resolution;
    vec2 point = vUv;

    vec4 seedPixel = texture2D(reference, vec2(seed.x, 1.0 - seed.y));
    vec4 referencePixel = texture2D(reference, vec2(vUv.x, 1.0 - vUv.y));

    vec4 referencePremultiplied = vec4(referencePixel.rgb * referencePixel.a, referencePixel.a);
    vec4 seedPremultiplied = vec4(seedPixel.rgb * seedPixel.a, seedPixel.a);
    float rgbDistance = distance(referencePremultiplied, seedPremultiplied);

    float similarity = max(0.0001, 1.0 - smoothstep(
        0.0,
        tolerance,
        rgbDistance
    ));

    vec4 currentHeight = getHeight(vUv);
    vec4 neighborHeight = max(
        max(
            getHeight(vUv + vec2(texelSize.x, 0.0)),
            getHeight(vUv + vec2(-texelSize.x, 0.0))
        ),
        max(
            getHeight(vUv + vec2(0.0, texelSize.y)),
            getHeight(vUv + vec2(0.0, -texelSize.y))
        )
    );

    float propagatedHeight = neighborHeight.r * similarity;

    bool isSeed = distance(vUv, seed) <= 0.5 * max(texelSize.x, texelSize.y);
    
    float seedMask = mix(0.0, 1.0, isSeed);

    float neighborMask = 1.0 - step(0.0, -neighborHeight.a);
    float similarityMask = 1.0 - step(0.0, -similarity);

    float processed = max(
        currentHeight.a,
        max(
            seedMask,
            neighborMask * similarityMask
        )
    );

    float height = max(currentHeight.r, propagatedHeight);

    height = mix(height, 1.0, seedMask);

    gl_FragColor = vec4(
        height * processed,
        height * processed,
        height * processed,
        processed
    );
}

varying vec2 vUv;

uniform sampler2D map;
uniform vec2 mapSize;
uniform vec4 tileOffsetAndSize;
uniform float blurMipLevel;

const int KERNEL_SIZE = 9;

float gaussian(vec2 offset, float sigma) {
    offset /= sigma;
    return exp(-0.5 * dot(offset, offset)) /
        (6.28318530718 * sigma * sigma);
}

vec4 blur(sampler2D source, vec2 uv, vec2 scale) {
    float mipLevel = max(blurMipLevel, 0.0);

    float mipScale = exp2(mipLevel);

    vec3 blurredPremultipliedRgb = vec3(0.0);
    float blurredAlpha = 0.0;
    float totalWeight = 0.0;

    vec2 center = vec2(float(KERNEL_SIZE - 1)) * 0.5;

    float sigma = 2.0;

    for (int y = 0; y < KERNEL_SIZE; ++y) {
        for (int x = 0; x < KERNEL_SIZE; ++x) {
            vec2 cell = vec2(float(x), float(y));

            vec2 offset = (cell - center) * mipScale;

            vec4 sampleColor = textureLod(
                source,
                uv + offset * scale,
                mipLevel
            );

            sampleColor.rgb *= sampleColor.a;

            float weight = gaussian(cell - center, sigma);

            blurredPremultipliedRgb += sampleColor.rgb * weight;
            blurredAlpha += sampleColor.a * weight;
            totalWeight += weight;
        }
    }

    blurredPremultipliedRgb /= totalWeight;
    blurredAlpha /= totalWeight;

    vec3 rgb = blurredPremultipliedRgb / max(blurredAlpha, 0.00001);

    return vec4(rgb, blurredAlpha);
}

void main() {
    vec2 baseUv = vec2(
        tileOffsetAndSize.x,
        1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w
    ) + vUv * tileOffsetAndSize.zw;

    gl_FragColor = blur(map, baseUv, 1.0 / mapSize);
}

uniform sampler2D map;

varying vec2 vUv;

float processGaussianBlurNormpdf(in float x, in float sigma) {
	return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}

vec4 processGaussianBlur(vec4 color) {
    const int pixelSize = 11; // cPixelSize
    const int kernelSize = (pixelSize - 1) / 2;
    float kernel[pixelSize];
    vec4 finalColor = vec4(0.0);

    float sigma = 7.0;
    float z = 0.0;
    for (int j = 0; j <= kernelSize; ++j) {
        kernel[kernelSize + j] = kernel[kernelSize - j] = processGaussianBlurNormpdf(float(j), sigma);
    }

    for (int i = -kernelSize; i <= kernelSize; ++i) {
        for (int j = -kernelSize; j <= kernelSize; ++j) {
            vec4 testColor = texture2D(map, vUv.xy + vec2(float(i), float(j)) / vec2(660.0, 338.0) / 1.0);
            if (testColor.a > 0.000001) {
                finalColor += kernel[kernelSize + j] * kernel[kernelSize + i] * testColor;
                z += 1.0;
            }
        }
    }

    return vec4(vec3(finalColor.rgb) / z, min(finalColor.a, 0.004));
}

void main() {
    vec2 pxOffset = vec2(float(cMapWidth) * vUv.x, float(cMapHeight) * vUv.y);

    vec4 color = texture2D(map, vUv);
    vec4 testColor;

    if (color.a < 0.000001) {
        color = processGaussianBlur(color);
    }

    gl_FragColor = color;

    #include <encodings_fragment>
}

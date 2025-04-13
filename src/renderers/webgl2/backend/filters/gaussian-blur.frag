uniform float pXIntensity;
uniform float pYIntensity;

float processGaussianBlurNormpdf(in float x, in float sigma) {
	return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}

vec4 processGaussianBlur(vec4 color) {
    const int pixelSize = 11; // cPixelSize
    const int kernelSize = (pixelSize - 1) / 2;
    float kernel[pixelSize];
    vec3 finalColor = vec3(0.0);

    float sigma = 7.0;
    float z = 0.0;
    for (int j = 0; j <= kernelSize; ++j) {
        kernel[kernelSize + j] = kernel[kernelSize - j] = processGaussianBlurNormpdf(float(j), sigma);
    }

    for (int j = 0; j < pixelSize; ++j) {
        z += kernel[j];
    }

    for (int i = -kernelSize; i <= kernelSize; ++i) {
        for (int j = -kernelSize; j <= kernelSize; ++j) {
            finalColor += kernel[kernelSize + j] * kernel[kernelSize + i] *
                texture2D(map, vUv.xy + vec2(float(i), float(j)) / vec2(660.0, 338.0) / 1.0).rgb;
        }
    }

    return vec4(vec3(finalColor.rgb) / (z * z), color.a);
}

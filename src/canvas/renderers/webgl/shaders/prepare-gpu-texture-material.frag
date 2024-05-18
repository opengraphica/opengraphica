uniform sampler2D map;

varying vec2 vUv;

// float processGaussianBlurNormpdf(in float x, in float sigma) {
// 	return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
// }

// vec4 processGaussianBlur(vec4 color) {
//     const int pixelSize = 11; // cPixelSize
//     const int kernelSize = (pixelSize - 1) / 2;
//     float kernel[pixelSize];
//     vec4 finalColor = vec4(0.0);

//     float sigma = 7.0;
//     float z = 0.0;
//     for (int j = 0; j <= kernelSize; ++j) {
//         kernel[kernelSize + j] = kernel[kernelSize - j] = processGaussianBlurNormpdf(float(j), sigma);
//     }

//     for (int i = -kernelSize; i <= kernelSize; ++i) {
//         for (int j = -kernelSize; j <= kernelSize; ++j) {
//             vec4 testColor = texture2D(map, vUv.xy + vec2(float(i), float(j)) / vec2(660.0, 338.0) / 1.0);
//             if (testColor.a > 0.001) {
//                 finalColor += kernel[kernelSize + j] * kernel[kernelSize + i] * testColor;
//                 z += 1.0;
//             }
//         }
//     }

//     return vec4(vec3(finalColor.rgb) / z, min(finalColor.a, 1.0));
// }

void main() {
    vec2 textureSize = vec2(float(cMapWidth), float(cMapHeight));

    vec2 texelSize = 1.0 / textureSize;
    vec4 centerPixel = texture2D(map, vUv);
    
    if (centerPixel.a > 0.0) {
        gl_FragColor = centerPixel;
    } else {
        vec4 colorSum = vec4(0.0);
        float count = 0.0;

        // Check the 8 neighboring pixels
        for (int dy = -3; dy <= 3; dy++) {
            for (int dx = -3; dx <= 3; dx++) {
                if (dx == 0 && dy == 0) continue;

                vec2 offset = vec2(float(dx), float(dy)) * texelSize;
                vec4 neighborPixel = texture2D(map, vUv + offset);

                if (neighborPixel.a > 0.0) {
                    colorSum += neighborPixel;
                    count += 1.0;
                }
            }
        }

        if (count > 0.0) {
            gl_FragColor = colorSum / count;
            gl_FragColor.a = 0.0;
        } else {
            gl_FragColor = centerPixel;
        }
    }

    // vec2 pxOffset = vec2(float(cMapWidth) * vUv.x, float(cMapHeight) * vUv.y);

    // vec4 color = texture2D(map, vUv);
    // vec4 testColor;

    // if (color.a < 0.001) {
    //     color = processGaussianBlur(color);
    // }

    // gl_FragColor = color;

    gl_FragColor = LinearTosRGB(gl_FragColor);
    // #include <encodings_fragment>
}

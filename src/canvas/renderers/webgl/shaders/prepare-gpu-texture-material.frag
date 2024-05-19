uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec2 textureSize = vec2(float(cMapWidth), float(cMapHeight));

    vec2 texelSize = 1.0 / textureSize;
    vec4 centerPixel = texture2D(map, vUv);
    
    if (centerPixel.a > 0.00001) {
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

    gl_FragColor = LinearTosRGB(gl_FragColor);
}

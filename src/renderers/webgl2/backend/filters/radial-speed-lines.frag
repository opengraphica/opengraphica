/**
 * This is a somewhat inefficient but effective way to generate manga speed lines.
 * The general idea is to create a float mask that detects if the pixel is inside of a line.
 * Loop for a reasonable amount of max lines, get the distance to each line drawn to the center,
 * then multiply it by a tapering width. That gives the inside/outside check.
 */

uniform vec2 pCenterRadius;
uniform vec2 pLineSpacing;
uniform vec2 pLineClumping;
uniform vec2 pLineThickness;
uniform float pSeed;

vec4 processRadialSpeedLines(vec4 color, vec2 uv) {
    vec2 resolution = vec2(float(cLayerWidth), float(cLayerHeight));
    float pixelScale = max(resolution.y, 1.0);
    float pixelAA = 0.5 / pixelScale;

    vec2 center = (uv - 0.5) * resolution / pixelScale;
    float radius = length(center);
    float maxRadius = max(0.5 * length(resolution / pixelScale), 0.0001);

    float maxThickness = (1.0 - cbrt(1.0 - pLineThickness.y)) * (PI / 64.0);

    float minGap = min(pLineSpacing.x, pLineSpacing.y) * (PI / 4.0);
    float maxGap = max(pLineSpacing.x, pLineSpacing.y) * (PI / 4.0);
    float targetGap = 0.5 * (minGap + maxGap);
    float phaseKey = pLineSpacing.x * 17.0 + pLineSpacing.y * 131.0;
    float startAngle = TAU * pcgWhiteNoise(
        uint(abs(floor(phaseKey * 4099.0 + pSeed * 65537.0 + (503.0))))
    );

    float minClumpCount = max(1.0, ceil(TAU / max(maxGap, 0.0001)));
    float maxClumpCount = (minGap > 0.0001) ? min(256.0, floor(TAU / minGap)) : 256.0;

    float desiredCount = floor(TAU / max(targetGap, 0.0001) + 0.5);

    float clumpCount;
    if (minClumpCount <= maxClumpCount) {
        clumpCount = clamp(desiredCount, minClumpCount, maxClumpCount);
    } else {
        clumpCount = clamp(desiredCount, 1.0, 256.0);
    }

    float baseGap = TAU / clumpCount;

    float jitterLimit = max(min(baseGap - minGap, maxGap - baseGap), 0.0);

    float lineSeparation = max(maxThickness * 2.0, 0.002);
    float lineMask = 0.0;

    for (int k = 0; k < 96; ++k) {
        if (float(k) < clumpCount) {
            float clumpCenterAngle = startAngle + float(k) * baseGap;

            if ((k & 1) != 0) {
                float pairId = float((k - 1) / 2);
                float jitterMix = pcgWhiteNoise(
                    uint(abs(floor(pairId * 4099.0 + pSeed * 65537.0 + (101.0))))
                );
                float jitter = (2.0 * jitterMix - 1.0) * jitterLimit;
                clumpCenterAngle += jitter;
            }

            float clumping = mix(
                pLineClumping.x,
                pLineClumping.y,
                pcgWhiteNoise(
                    uint(abs(floor(float(k) * 4099.0 + pSeed * 65537.0 + (211.0))))
                )
            );
            float lineCount = 1.0 + floor(clumping * 9.0 + 0.5);

            for (int i = 0; i < 10; ++i) {
                if (float(i) < lineCount) {
                    float lineId = float(k * 10 + i);

                    float thickness = mix(
                        pLineThickness.x,
                        pLineThickness.y,
                        pcgWhiteNoise(
                            uint(abs(floor(lineId * 4099.0 + pSeed * 65537.0 + (307.0))))
                        )
                    );
                    float maxWidth = (1.0 - cbrt(1.0 - thickness)) * (PI / 64.0);

                    float startValue = mix(
                        pCenterRadius.x,
                        pCenterRadius.y,
                        pcgWhiteNoise(
                            uint(abs(floor(lineId * 4099.0 + pSeed * 65537.0 + (401.0))))
                        )
                    );
                    float startRadius = startValue * maxRadius;

                    float offset = (float(i) + 0.5 - lineCount * 0.5) * lineSeparation;

                    float lineAngle = clumpCenterAngle + offset / max(maxRadius, 0.0001);
                    vec2 lineDirection = vec2(cos(lineAngle), sin(lineAngle));

                    float distanceToLine = abs(center.x * lineDirection.y - center.y * lineDirection.x);

                    float taper = clamp((radius - startRadius) / max(maxRadius - startRadius, 0.0001), 0.0, 1.0);
                    float width = maxWidth * taper;

                    float line = clamp(
                        (width + pixelAA - distanceToLine) / (2.0 * pixelAA),
                        0.0, 1.0
                    ) * step(startRadius, radius) * step(0.0, width);

                    lineMask = max(lineMask, line);
                }
            }
        }
    }

    return vec4(
        vec3(mix(color.rgb, vec3(0.0), lineMask * color.a)),
        max(lineMask, color.a)
    );
}

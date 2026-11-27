/**
 * Simulates the original image as if it were printed on a newspaper.
 *
 * This conceptually divides the image into a grid of cells based on the dot density, samples the texture
 * in the center of the cell, and creates a circle with the sample color and size, by using the distance from
 * the cell center as an inside/outside check for the current pixel. For CMYK, do this 4 times at different rotations.
 * Neighbor cells are also sampled so when the circle is larger than the cell size, it doesn't get cut off.
 *
 * References:
 * @website https://www.shadertoy.com/view/Ds2fRD
 * @website http://the-print-guide.blogspot.com/2009/05/halftone-screen-angles.html
 */

const int NewsprintColorModelCmyk = 0;
const int NewsprintColorModelBlackOnWhite = 1;

uniform float pDensity;

vec4 processNewsprint(vec4 color, vec2 uv) {
    vec2 resolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 aspect = resolution / resolution.y;

    float density = (1.0 - cbrt(1.0 - clamp(pDensity, 0.01, 1.0))) * max(resolution.x, resolution.y);

    vec4 angles = vec4(0.261, 1.309, 0.0, 0.785);

    vec3 rgb;
    float alpha = sampleBackbuffer(uv).a;

    if (cColorModel == NewsprintColorModelCmyk) {

        vec4 inks = vec4(0.0);

        for (int channel = 0; channel < 4; ++channel) {
            float angle = angles[channel];
            float cosAngle = cos(angle);
            float sinAngle = sin(angle);

            vec2 position = vec2(
                uv.x * aspect.x * cosAngle - uv.y * sinAngle,
                uv.x * aspect.x * sinAngle + uv.y * cosAngle
            ) * density;

            vec2 baseCell = floor(position);
            float antialias = max(max(fwidth(position.x), fwidth(position.y)), 0.0001);

            for (int y = -1; y <= 1; ++y) {
                for (int x = -1; x <= 1; ++x) {
                    vec2 cell = baseCell + vec2(float(x), float(y));
                    vec2 centerRot = (cell + vec2(0.5)) / density;

                    vec2 centerUv = vec2(
                        centerRot.x * cosAngle + centerRot.y * sinAngle,
                        -centerRot.x * sinAngle + centerRot.y * cosAngle
                    );
                    centerUv.x /= aspect.x;

                    vec4 source = sampleBackbuffer(centerUv);
                    float k = 1.0 - max(source.r, max(source.g, source.b));
                    float denominator = max(1.0 - k, 0.000001);

                    vec4 cmyk = clamp(vec4(
                        (1.0 - source.r - k) / denominator,
                        (1.0 - source.g - k) / denominator,
                        (1.0 - source.b - k) / denominator,
                        k
                    ), 0.0, 1.0);

                    float coverage = cmyk[channel];
                    float radius = sqrt(coverage / 3.14159265);
                    float distanceToCenter = length(position - (cell + vec2(0.5)));

                    float dotInk = 1.0 - smoothstep(
                        radius - antialias,
                        radius + antialias,
                        distanceToCenter
                    );
                    dotInk *= source.a;

                    inks[channel] = max(inks[channel], dotInk);
                }
            }
        }

        rgb = vec3(
            (1.0 - inks.x) * (1.0 - inks.w),
            (1.0 - inks.y) * (1.0 - inks.w),
            (1.0 - inks.z) * (1.0 - inks.w)
        );

    }
    else if (cColorModel == NewsprintColorModelBlackOnWhite) {

        float ink = 0.0;
        float angle = angles[3];
        float cosAngle = cos(angle);
        float sinAngle = sin(angle);

        vec2 position = vec2(
            uv.x * aspect.x * cosAngle - uv.y * sinAngle,
            uv.x * aspect.x * sinAngle + uv.y * cosAngle
        ) * density;

        vec2 baseCell = floor(position);
        float antialias = max(max(fwidth(position.x), fwidth(position.y)), 0.0001);

        for (int y = -1; y <= 1; ++y) {
            for (int x = -1; x <= 1; ++x) {
                vec2 cell = baseCell + vec2(float(x), float(y));
                vec2 centerRot = (cell + vec2(0.5)) / density;

                vec2 centerUv = vec2(
                    centerRot.x * cosAngle + centerRot.y * sinAngle,
                    -centerRot.x * sinAngle + centerRot.y * cosAngle
                );
                centerUv.x /= aspect.x;

                vec4 source = sampleBackbuffer(centerUv);
                float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));

                float coverage = 1.0 - clamp(luminance, 0.0, 1.0);
                float radius = sqrt(coverage / 3.14159265);
                float distanceToCenter = length(position - (cell + vec2(0.5)));

                float dotInk = 1.0 - smoothstep(
                    radius - antialias,
                    radius + antialias,
                    distanceToCenter
                );
                dotInk *= source.a;

                ink = max(ink, dotInk);
            }
        }

        rgb = vec3(1.0 - ink);

    }

    return vec4(clamp(rgb, 0.0, 1.0), alpha);
}

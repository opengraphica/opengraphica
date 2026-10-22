const int EmbossTypeBlend = 0;
const int EmbossTypeHeightmap = 1;

uniform float pAngle;
uniform float pElevation;

vec4 processEmboss(vec4 color) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 pixel = min(floor(vUv * layerResolution), layerResolution - vec2(1.0));

    vec2 sourceUv = (pixel + vec2(0.5)) / layerResolution;
    vec2 texel = 1.0 * vec2(1.0) / layerResolution;

    float tl = dot(sampleBackbuffer(clamp(sourceUv + vec2(-texel.x, texel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float tc = dot(sampleBackbuffer(clamp(sourceUv + vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(sampleBackbuffer(clamp(sourceUv + texel, vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float ml = dot(sampleBackbuffer(clamp(sourceUv + vec2(-texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float mr = dot(sampleBackbuffer(clamp(sourceUv + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(sampleBackbuffer(clamp(sourceUv - texel, vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float bc = dot(sampleBackbuffer(clamp(sourceUv + vec2(0.0, -texel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(sampleBackbuffer(clamp(sourceUv + vec2(texel.x, -texel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.299, 0.587, 0.114));

    float gradientSample = 2.0;
    float gradientX = (tr + gradientSample * mr + br) - (tl + gradientSample * ml + bl);
    float gradientY = (bl + gradientSample * bc + br) - (tl + gradientSample * tc + tr);

    float angle = pAngle * 6.28318530718;
    float elevation = 0.0;
    vec2 lightDirection = cos(elevation) * vec2(cos(angle), sin(angle));
    float emboss = clamp(0.5 + (1.0 - cbrt(1.0 - pElevation)) * 5.0 * dot(vec2(gradientX, gradientY), lightDirection), 0.0, 1.0);

    vec4 sourceColor = sampleBackbuffer(sourceUv);

    if (cType == EmbossTypeBlend) {
        vec3 blended = mix(
            2.0 * sourceColor.rgb * emboss,
            1.0 - 2.0 * (1.0 - sourceColor.rgb) * (1.0 - emboss),
            step(0.5, emboss)
        );
        return vec4(blended, sourceColor.a);
    } else {
        return vec4(srgbToLinearSrgb(vec3(emboss)), sourceColor.a);
    }
}

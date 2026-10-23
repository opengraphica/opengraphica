const int FilmGrainBlendModeNormal = 0;
const int FilmGrainBlendModeSubtract = 1;
const int FilmGrainBlendModeAdd = 2;

uniform float pIntensity;
uniform float pGrainScale;
uniform float pSeed;

vec4 processFilmGrain(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));
    vec2 pixel = min(floor(uv * layerResolution), layerResolution - vec2(1.0));
    
    float scale = max(pGrainScale, 0.001);
    uint baseSeed = uint(max(pSeed * 256.0, 0.0)) * 0xcb1ab31fu;

    vec2 warpCoord = pixel / (scale * 2.0);
    vec2 warpCell = floor(warpCoord);
    vec2 warpF = fract(warpCoord);
    vec2 warpU = warpF * warpF * (3.0 - 2.0 * warpF);
    
    uvec2 wc00 = uvec2(warpCell);
    uvec2 wc10 = uvec2(warpCell + vec2(1.0, 0.0));
    uvec2 wc01 = uvec2(warpCell + vec2(0.0, 1.0));
    uvec2 wc11 = uvec2(warpCell + vec2(1.0, 1.0));

    float wx00 = pcgWhiteNoise(wc00.x * 1973u + wc00.y * 9277u + baseSeed);
    float wx10 = pcgWhiteNoise(wc10.x * 1973u + wc10.y * 9277u + baseSeed);
    float wx01 = pcgWhiteNoise(wc01.x * 1973u + wc01.y * 9277u + baseSeed);
    float wx11 = pcgWhiteNoise(wc11.x * 1973u + wc11.y * 9277u + baseSeed);
    float wx = mix(mix(wx00, wx10, warpU.x), mix(wx01, wx11, warpU.x), warpU.y);

    float wy00 = pcgWhiteNoise(wc00.x * 2669u + wc00.y * 5279u + baseSeed);
    float wy10 = pcgWhiteNoise(wc10.x * 2669u + wc10.y * 5279u + baseSeed);
    float wy01 = pcgWhiteNoise(wc01.x * 2669u + wc01.y * 5279u + baseSeed);
    float wy11 = pcgWhiteNoise(wc11.x * 2669u + wc11.y * 5279u + baseSeed);
    float wy = mix(mix(wy00, wy10, warpU.x), mix(wy01, wy11, warpU.x), warpU.y);

    vec2 warp = (vec2(wx, wy) - 0.5) * scale * 0.8;

    vec2 scaledCoord = (pixel + warp) / scale;
    vec2 cell = floor(scaledCoord);
    vec2 f = fract(scaledCoord);
    vec2 u = f * f * (3.0 - 2.0 * f);

    uvec2 c00 = uvec2(cell);
    uvec2 c10 = uvec2(cell + vec2(1.0, 0.0));
    uvec2 c01 = uvec2(cell + vec2(0.0, 1.0));
    uvec2 c11 = uvec2(cell + vec2(1.0, 1.0));

    uint s00 = c00.x * 0x8da6b343u ^ c00.y * 0xd8163841u ^ baseSeed;
    uint s10 = c10.x * 0x8da6b343u ^ c10.y * 0xd8163841u ^ baseSeed;
    uint s01 = c01.x * 0x8da6b343u ^ c01.y * 0xd8163841u ^ baseSeed;
    uint s11 = c11.x * 0x8da6b343u ^ c11.y * 0xd8163841u ^ baseSeed;

    vec3 noise;
    if (cGrayscale == 1) {
        uint channelSeed = 0x68bc21ebu;
        float sum = 0.0;
        for (int i = 0; i < 6; ++i) {
            uint tapSalt = uint(i) * 0x9e3779b9u ^ channelSeed;
            float r00 = pcgWhiteNoise(s00 ^ tapSalt);
            float r10 = pcgWhiteNoise(s10 ^ tapSalt);
            float r01 = pcgWhiteNoise(s01 ^ tapSalt);
            float r11 = pcgWhiteNoise(s11 ^ tapSalt);
            sum += mix(mix(r00, r10, u.x), mix(r01, r11, u.x), u.y);
        }
        noise = vec3((sum - 3.0) * 1.41421356);
    } else {
        uint seedR = 0x68bc21ebu;
        uint seedG = 0x02e5be93u;
        uint seedB = 0x967a889bu;
        
        vec3 sum = vec3(0.0);
        for (int i = 0; i < 6; ++i) {
            uint tapSalt = uint(i) * 0x9e3779b9u;
            
            uint saltR = tapSalt ^ seedR;
            float rR00 = pcgWhiteNoise(s00 ^ saltR);
            float rR10 = pcgWhiteNoise(s10 ^ saltR);
            float rR01 = pcgWhiteNoise(s01 ^ saltR);
            float rR11 = pcgWhiteNoise(s11 ^ saltR);
            sum.r += mix(mix(rR00, rR10, u.x), mix(rR01, rR11, u.x), u.y);

            uint saltG = tapSalt ^ seedG;
            float rG00 = pcgWhiteNoise(s00 ^ saltG);
            float rG10 = pcgWhiteNoise(s10 ^ saltG);
            float rG01 = pcgWhiteNoise(s01 ^ saltG);
            float rG11 = pcgWhiteNoise(s11 ^ saltG);
            sum.g += mix(mix(rG00, rG10, u.x), mix(rG01, rG11, u.x), u.y);

            uint saltB = tapSalt ^ seedB;
            float rB00 = pcgWhiteNoise(s00 ^ saltB);
            float rB10 = pcgWhiteNoise(s10 ^ saltB);
            float rB01 = pcgWhiteNoise(s01 ^ saltB);
            float rB11 = pcgWhiteNoise(s11 ^ saltB);
            sum.b += mix(mix(rB00, rB10, u.x), mix(rB01, rB11, u.x), u.y);
        }
        noise = (sum - 3.0) * 1.41421356;
    }

    float y = dot(max(color.rgb, 0.0), vec3(0.2126, 0.7152, 0.0722));
    float level = 1.0 - smoothstep(0.02, 0.5, y);

    vec4 newColor;
    if (cBlendMode == FilmGrainBlendModeNormal) {
        newColor = vec4(vec3(color) * exp2(noise * (pIntensity * 2.0) * level), color.a);
    } else if (cBlendMode == FilmGrainBlendModeSubtract) {
        float grain = dot(abs(noise), vec3(1.0 / 3.0));
        newColor = vec4(color.rgb - vec3(grain * pIntensity), color.a);
    } else if (cBlendMode == FilmGrainBlendModeAdd) {
        float grain = dot(abs(noise), vec3(1.0 / 3.0));
        newColor = vec4(color.rgb + vec3(grain * pIntensity), color.a);
    }

    return newColor;
}
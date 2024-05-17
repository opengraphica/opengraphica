uniform sampler2D baseMap;
uniform sampler2D overlayMap;
uniform float baseTextureScaleX;
uniform float baseTextureScaleY;
uniform float baseTextureOffsetX;
uniform float baseTextureOffsetY;

varying vec2 vUv;

void main() {
    vec2 uv = vec2(
        (vUv.x * baseTextureScaleX) + baseTextureOffsetX,
        1.0 - (((1.0 - vUv.y) * baseTextureScaleY) + baseTextureOffsetY)
    );
    vec4 a = texture2D(baseMap, uv);
    vec4 b = texture2D(overlayMap, vUv);
    vec3 ac = (step(a.a, 0.00001) * b.rgb) + step(0.00001, a.a) * a.rgb;
    vec3 bc = (step(b.a, 0.00001) * a.rgb) + step(0.00001, b.a) * b.rgb;
    gl_FragColor = vec4(
        ac.r * (1.0 - b.a) + bc.r * b.a,
        ac.g * (1.0 - b.a) + bc.g * b.a,
        ac.b * (1.0 - b.a) + bc.b * b.a,
        a.a + b.a
    );

    #include <encodings_fragment>
}

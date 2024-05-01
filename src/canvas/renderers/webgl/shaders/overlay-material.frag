uniform sampler2D destinationMap;
uniform sampler2D sourceMap;
uniform float destinationTextureScaleX;
uniform float destinationTextureScaleY;
uniform float destinationTextureOffsetX;
uniform float destinationTextureOffsetY;

varying vec2 vUv;

void main() {
    vec2 uv = vec2(
        (vUv.x * destinationTextureScaleX) + destinationTextureOffsetX,
        1.0 - (((1.0 - vUv.y) * destinationTextureScaleY) + destinationTextureOffsetY)
    );
    vec4 a = texture2D(destinationMap, uv);
    vec4 b = texture2D(sourceMap, vUv);
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

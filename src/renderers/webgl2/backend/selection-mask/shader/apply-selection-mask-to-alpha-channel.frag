varying vec2 vUv;

uniform sampler2D baseMap;
uniform sampler2D selectionMaskMap;
uniform vec4 tileOffsetAndSize;
uniform mat4 selectionMaskTransform;
uniform float selectionMaskAlpha;

void main() {
    vec2 baseUv = vec2(tileOffsetAndSize.x, 1.0 - tileOffsetAndSize.y - tileOffsetAndSize.w) + vUv * tileOffsetAndSize.zw;
    vec4 baseColor = texture2D(baseMap, baseUv);

    vec2 selectionMaskUv = (selectionMaskTransform * vec4(vUv, 0.0, 1.0)).xy;
    float selectionMaskVisible = step(0.0, selectionMaskUv.x) * step(0.0, selectionMaskUv.y) *
        step(selectionMaskUv.x, 1.0) * step(selectionMaskUv.y, 1.0);
    vec4 selectionMaskColor = texture2D(selectionMaskMap, selectionMaskUv);

#if cInvert == 1
    gl_FragColor = vec4(
        baseColor.rgb,
        baseColor.a * (1.0 - selectionMaskVisible * selectionMaskAlpha * selectionMaskColor.a)
    );
#else
    gl_FragColor = vec4(
        baseColor.rgb,
        baseColor.a * (selectionMaskVisible * selectionMaskAlpha * selectionMaskColor.a)
    );
#endif

}
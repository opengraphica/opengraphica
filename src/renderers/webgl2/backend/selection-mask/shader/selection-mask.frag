uniform sampler2D unselectedMaskMap;
uniform sampler2D selectedMaskMap;
uniform vec2 selectedMaskSize;
uniform vec2 selectedMaskOffset;

uniform float viewportWidth;
uniform float viewportHeight;
uniform mat4 inverseProjectionMatrix;

varying vec2 vUv;
varying mat4 vInverseModelViewMatrix;

void main() {
    vec2 unselectedUv = vec2(vUv.x * viewportWidth / 4.0, vUv.y * viewportHeight / 4.0);
    vec4 unselectedColor = texture2D(unselectedMaskMap, unselectedUv);

    vec4 clipSpacePos = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);

    vec4 viewSpacePos = inverseProjectionMatrix * clipSpacePos;
    viewSpacePos /= viewSpacePos.w;

    vec4 localPos = vInverseModelViewMatrix * viewSpacePos;
    vec2 localUV = (localPos.xy - selectedMaskOffset.xy) / selectedMaskSize.xy;
    localUV.y = 1.0 - localUV.y;
    
    vec4 selectedColor = texture2D(selectedMaskMap, localUV);
    selectedColor.a *= step(localUV.x, 1.0);
    selectedColor.a *= step(0.0, localUV.x);
    selectedColor.a *= step(localUV.y, 1.0);
    selectedColor.a *= step(0.0, localUV.y);

    unselectedColor.a = clamp(unselectedColor.a - selectedColor.a, 0.0, 1.0);

    gl_FragColor = unselectedColor;

}

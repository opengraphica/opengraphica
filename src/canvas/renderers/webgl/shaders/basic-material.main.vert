void main() {
    vUv = uv;

    vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreenUv = (clipPosition.xyz / clipPosition.w).xy * 0.5 + 0.5;
    gl_Position = clipPosition;

    //[INJECT_FILTERS_HERE]
}

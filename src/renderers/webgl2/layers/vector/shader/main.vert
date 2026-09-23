void main() {
    vUv = uv;

    vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec3 ndcPosition = clipPosition.xyz / clipPosition.w;
    vScreenUv = ndcPosition.xy * 0.5 + 0.5;
    gl_Position = clipPosition;

    //[INJECT_FILTERS_HERE]
}

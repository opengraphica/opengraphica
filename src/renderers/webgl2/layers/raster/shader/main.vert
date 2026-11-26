void main() {
    vUv = uv;

    gl_Position = vec4(position, 1.0);

    //[INJECT_FILTERS_HERE]

    vec4 clipPosition = projectionMatrix * modelViewMatrix * gl_Position;
    vec3 ndcPosition = clipPosition.xyz / clipPosition.w;
    vScreenUv = ndcPosition.xy * 0.5 + 0.5;
    gl_Position = clipPosition;

}

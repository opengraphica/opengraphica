varying vec2 vUv;
varying mat4 vInverseModelViewMatrix;

void main() {
    vUv = uv;
    vInverseModelViewMatrix = inverse(modelViewMatrix);
    gl_Position = vec4(position, 1.0);
}
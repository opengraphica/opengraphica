const int NaturalVignetteModeSimulate = 0;
const int NaturalVignetteModeRemove = 1;

uniform float pSensorWidth;
uniform float pSensorHeight;
uniform float pFocalLength;

vec4 processNaturalVignette(vec4 color, vec2 uv) {
    vec2 sensorPosition = (uv - vec2(0.5)) * vec2(pSensorWidth, pSensorHeight);
    float squaredDistanceFromCenter = dot(sensorPosition, sensorPosition);
    float transmission = 1.0 / pow(
        1.0 + squaredDistanceFromCenter / (pFocalLength * pFocalLength),
        2.0
    );
    if (cMode == NaturalVignetteModeSimulate) {
        color.rgb *= transmission;
    }
    else if (cMode == NaturalVignetteModeRemove) {
        color.rgb /= transmission;
    }
    return color;
}
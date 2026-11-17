const int MechanicalVignetteModeSimulate = 0;
const int MechanicalVignetteModeRemove = 1;

uniform float pSensorWidth;
uniform float pSensorHeight;
uniform float pExitPupilDistance;
uniform float pExitPupilRadius;
uniform float pBarrelOpeningDistance;
uniform float pBarrelOpeningRadius;

vec4 processMechanicalVignette(vec4 color, vec2 uv) {
    vec2 sensorPosition = (uv - vec2(0.5)) * vec2(pSensorWidth, pSensorHeight);

    float pupilArea = PI * pExitPupilRadius * pExitPupilRadius;

    float t = clamp(
        pBarrelOpeningDistance / max(pExitPupilDistance, 1e-6),
        0.0, 1.0
    );

    float safeT = max(t, 1e-6);
    float openingRadius = max(pBarrelOpeningRadius, 0.0) / safeT;
    vec2 openingCenter = -((1.0 - t) / safeT) * sensorPosition;
    float centerDistance = length(openingCenter);

    float disjointMask = step(pExitPupilRadius + openingRadius, centerDistance);
    float containedMask = step(centerDistance, abs(pExitPupilRadius - openingRadius));

    float safeDistance = max(centerDistance, 1e-6);
    float safePupilRadius = max(pExitPupilRadius, 1e-6);
    float safeOpeningRadius = max(openingRadius, 1e-6);

    float pupilAngle = acos(clamp(
        (centerDistance * centerDistance
        + pExitPupilRadius * pExitPupilRadius
        - openingRadius * openingRadius)
        / (2.0 * safeDistance * safePupilRadius),
        -1.0, 1.0
    ));
    float openingAngle = acos(clamp(
        (centerDistance * centerDistance
        + openingRadius * openingRadius
        - pExitPupilRadius * pExitPupilRadius)
        / (2.0 * safeDistance * safeOpeningRadius),
        -1.0, 1.0
    ));

    float triangleArea = 0.5 * sqrt(max(
        0.0,
        (-centerDistance + pExitPupilRadius + openingRadius)
        * (centerDistance + pExitPupilRadius - openingRadius)
        * (centerDistance - pExitPupilRadius + openingRadius)
        * (centerDistance + pExitPupilRadius + openingRadius)
    ));
    float partialOverlapArea =
        pExitPupilRadius * pExitPupilRadius * pupilAngle
        + openingRadius * openingRadius * openingAngle - triangleArea;
    float smallerRadius = min(pExitPupilRadius, openingRadius);
    float containedOverlapArea = PI * smallerRadius * smallerRadius;
    float overlapArea = mix(
        partialOverlapArea,
        containedOverlapArea,
        containedMask
    );
    overlapArea *= 1.0 - disjointMask;

    float generalTransmission = overlapArea / max(pupilArea, 1e-6);

    float sensorPlaneTransmission = 1.0 - step(
        pBarrelOpeningRadius * pBarrelOpeningRadius,
        dot(sensorPosition, sensorPosition)
    );

    float sensorPlaneMask = 1.0 - step(1e-6, t);
    float transmission = mix(generalTransmission, sensorPlaneTransmission, sensorPlaneMask);

    transmission *= step(1e-6, pupilArea);

    if (cMode == MechanicalVignetteModeSimulate) {
        color.rgb *= transmission;
    }
    else if (cMode == MechanicalVignetteModeRemove) {
        color.rgb /= transmission;
    }
    return color;
}
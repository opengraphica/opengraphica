uniform float pRotation;
uniform float pViewPosition;
uniform float pPerspective;

vec4 processCylinderBend(vec4 color, vec2 uv) {
    float aspect = float(cLayerWidth) / float(cLayerHeight);
    float radius = 0.5 * aspect;
    float halfHeight = 0.5;

    float perspectiveValue = pPerspective;
    float perspectiveAmount = perspectiveValue * 0.5;
    float perspectiveMask = step(0.0001, perspectiveAmount);

    float viewY = -pViewPosition * 10.0 * halfHeight * perspectiveValue;

    float perspectiveDistance = radius + radius * (1.0 - perspectiveAmount) / max(perspectiveAmount, 0.001);
    float orthographicDistance = 10.0 * radius;

    float cameraDistance = max(
        mix(orthographicDistance, perspectiveDistance, perspectiveMask),
        sqrt(radius * radius + halfHeight * halfHeight) + 0.01
    );

    float perspectiveRotationLimit = 1.0 - 0.34 * perspectiveValue;

    float viewElevation = atan(abs(viewY), cameraDistance);
    float verticalRotationLimit = max(0.0, 1.0 - (viewElevation + 0.01) / (0.5 * PI));

    float positiveViewMask = step(0.00001, viewY);
    float negativeViewMask = step(0.00001, -viewY);

    float positiveRotationLimit = min(perspectiveRotationLimit, mix(1.0, verticalRotationLimit, positiveViewMask));
    float negativeRotationLimit = min(perspectiveRotationLimit, mix(1.0, verticalRotationLimit, negativeViewMask));
    float rotationInput = clamp(-pRotation, -negativeRotationLimit, positiveRotationLimit);

    float rotationAngle = rotationInput * 0.5 * PI;
    float rotationCos = cos(rotationAngle);
    float rotationSin = sin(rotationAngle);

    mat3 rotation = mat3(
        1.0, 0.0, 0.0,
        0.0, rotationCos, rotationSin,
        0.0, -rotationSin, rotationCos
    );
    mat3 inverseRotation = transpose(rotation);

    vec3 eye = vec3(0.0, viewY, cameraDistance);
    vec3 forward = vec3(0.0, 0.0, -1.0);
    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float focalLength = cameraDistance;

    vec2 boundsMin = vec2(1e20);
    vec2 boundsMax = vec2(-1e20);

    for (int i = 0; i <= 8; ++i) {
        float theta = -0.5 * PI + PI * float(i) / float(8);
        float x = radius * sin(theta);
        float z = radius * cos(theta);

        for (int j = 0; j < 2; ++j) {
            float y = mix(-halfHeight, halfHeight, float(j));
            vec3 point = rotation * vec3(x, y, z);
            vec3 delta = point - eye;

            vec2 cameraXY = vec2(dot(delta, right), dot(delta, up));

            float depth = max(dot(delta, forward), 0.0001);
            vec2 perspectiveProjected = focalLength * cameraXY / depth;
            vec2 projected = mix(cameraXY, perspectiveProjected, perspectiveMask);

            boundsMin = min(boundsMin, projected);
            boundsMax = max(boundsMax, projected);
        }
    }

    vec2 boundsSize = max(boundsMax - boundsMin, vec2(0.0001));
    vec2 boundsCenter = 0.5 * (boundsMin + boundsMax);

    float activity = max(abs(rotationInput), max(perspectiveValue, abs(pViewPosition * 10.0)));
    float fitScale = min(aspect / boundsSize.x, 1.0 / boundsSize.y) * (1.0 - 0.005 * activity);

    vec2 screenPoint = vec2((uv.x - 0.5) * aspect, 0.5 - uv.y);
    vec2 projectedPoint = screenPoint / fitScale + boundsCenter;

    vec3 perspectiveRayDirection = normalize(forward * focalLength + right * projectedPoint.x + up * projectedPoint.y);
    vec3 orthographicRayOrigin = eye + right * projectedPoint.x + up * projectedPoint.y;
    vec3 rayOriginWorld = mix(orthographicRayOrigin, eye, perspectiveMask);
    vec3 rayDirectionWorld = mix(forward, perspectiveRayDirection, perspectiveMask);

    vec3 rayOrigin = inverseRotation * rayOriginWorld;
    vec3 rayDirection = inverseRotation * rayDirectionWorld;

    float a = rayDirection.x * rayDirection.x + rayDirection.z * rayDirection.z;
    float b = 2.0 * (rayOrigin.x * rayDirection.x + rayOrigin.z * rayDirection.z);
    float c = rayOrigin.x * rayOrigin.x + rayOrigin.z * rayOrigin.z - radius * radius;

    float discriminant = b * b - 4.0 * a * c;
    float root = sqrt(max(discriminant, 0.0));
    float denominator = 2.0 * max(a, 0.000001);

    float t0 = (-b - root) / denominator;
    float t1 = (-b + root) / denominator;
    float t = mix(t1, t0, 1.0 - step(0.0, -t0));

    vec3 hit = rayOrigin + t * rayDirection;
    float theta = atan(hit.x, hit.z);

    vec3 surfaceNormal = normalize(vec3(hit.x, 0.0, hit.z));
    float frontFacing = step(0.0001, dot(surfaceNormal, -rayDirection));

    float hitMask =
        step(0.0, discriminant)
        * step(0.000001, a)
        * (1.0 - step(0.0, -t))
        * step(abs(theta), 0.5 * PI)
        * step(abs(hit.y), halfHeight)
        * frontFacing;

    vec2 sourceUV = vec2(0.5 + hit.x / (2.0 * radius), 0.5 - hit.y);

    return sampleBackbuffer(clamp(sourceUV, vec2(0.0), vec2(1.0))) * hitMask;
}

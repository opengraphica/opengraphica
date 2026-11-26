const int ShapeMaskTypeCircle = 0;
const int ShapeMaskTypeEquilateralTriangle = 1;
const int ShapeMaskTypeRightAngleTriangle = 2;
const int ShapeMaskTypeParallelogram = 3;
const int ShapeMaskTypeDiamond = 4;
const int ShapeMaskTypePentagon = 5;
const int ShapeMaskTypeHexagon = 6;
const int ShapeMaskTypeHeptagon = 7;
const int ShapeMaskTypeOctagon = 8;
const int ShapeMaskTypeDecagon = 10;
const int ShapeMaskTypeDodecagon = 12;
const int ShapeMaskTypeTrapezoid = 13;
const int ShapeMaskTypeCross = 14;
const int ShapeMaskTypeHeart = 15;
const int ShapeMaskTypeMoon = 16;

uniform float pRotation;
uniform float pAdjustment;

vec4 processShapeMask(vec4 color, vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));

    float angle = pRotation * PI;
    mat2 rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));

    if (cSquareAspect == 1) {
        float minDimension = min(layerResolution.x, layerResolution.y);
        uv = (uv - 0.5) * (layerResolution / minDimension) + 0.5;
    }

    if (cType == ShapeMaskTypeCircle) {

        vec2 center = (uv - 0.5) * 2.0;
        float aa = fwidth(length(center));
        float mask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, dot(center, center));
        color.a *= mask;

    } else if (cType == ShapeMaskTypeEquilateralTriangle) {

        angle = pRotation * (2.0 / 3.0) * PI;
        rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));

        vec2 v0 = rotation * vec2(0.0, 1.0);
        vec2 v1 = rotation * vec2(-0.8660254, -0.5);
        vec2 v2 = rotation * vec2(0.8660254, -0.5);

        vec2 lo = min(v0, min(v1, v2));
        vec2 hi = max(v0, max(v1, v2));
        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);

        vec2 center = uv - 0.5;
        v0 = (v0 - boxCenter) * scale;
        v1 = (v1 - boxCenter) * scale;
        v2 = (v2 - boxCenter) * scale;

        float d0 = ((v1.x - v0.x) * (center.y - v0.y)
            - (v1.y - v0.y) * (center.x - v0.x)) / length(v1 - v0);
        float d1 = ((v2.x - v1.x) * (center.y - v1.y)
            - (v2.y - v1.y) * (center.x - v1.x)) / length(v2 - v1);
        float d2 = ((v0.x - v2.x) * (center.y - v2.y)
            - (v0.y - v2.y) * (center.x - v2.x)) / length(v0 - v2);

        float d = min(d0, min(d1, d2));
        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (cType == ShapeMaskTypeRightAngleTriangle) {

        float rightLeg = max(1.0 - max(pAdjustment, 0.0), 0.001);
        float topLeg = max(1.0 + min(pAdjustment, 0.0), 0.001);

        vec2 v0 = rotation * vec2(0.0, 0.0);
        vec2 v1 = rotation * vec2(rightLeg, 0.0);
        vec2 v2 = rotation * vec2(0.0, topLeg);

        vec2 lo = min(v0, min(v1, v2));
        vec2 hi = max(v0, max(v1, v2));
        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);

        vec2 center = uv - 0.5;
        v0 = (v0 - boxCenter) * scale;
        v1 = (v1 - boxCenter) * scale;
        v2 = (v2 - boxCenter) * scale;

        float d0 = ((v1.x - v0.x) * (center.y - v0.y)
            - (v1.y - v0.y) * (center.x - v0.x)) / length(v1 - v0);
        float d1 = ((v2.x - v1.x) * (center.y - v1.y)
            - (v2.y - v1.y) * (center.x - v1.x)) / length(v2 - v1);
        float d2 = ((v0.x - v2.x) * (center.y - v2.y)
            - (v0.y - v2.y) * (center.x - v2.x)) / length(v0 - v2);

        float d = min(d0, min(d1, d2));
        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (cType == ShapeMaskTypeParallelogram) {

        vec2 v0 = rotation * vec2(0.0, 0.0);
        vec2 v1 = rotation * vec2(1.0, 0.0);
        vec2 v2 = rotation * vec2(1.0 + pAdjustment * 4.0, 1.0);
        vec2 v3 = rotation * vec2(pAdjustment * 4.0, 1.0);

        vec2 lo = min(min(v0, v1), min(v2, v3));
        vec2 hi = max(max(v0, v1), max(v2, v3));
        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);

        vec2 center = uv - 0.5;
        v0 = (v0 - boxCenter) * scale;
        v1 = (v1 - boxCenter) * scale;
        v2 = (v2 - boxCenter) * scale;
        v3 = (v3 - boxCenter) * scale;

        float d0 = ((v1.x - v0.x) * (center.y - v0.y)
            - (v1.y - v0.y) * (center.x - v0.x)) / length(v1 - v0);
        float d1 = ((v2.x - v1.x) * (center.y - v1.y)
            - (v2.y - v1.y) * (center.x - v1.x)) / length(v2 - v1);
        float d2 = ((v3.x - v2.x) * (center.y - v2.y)
            - (v3.y - v2.y) * (center.x - v2.x)) / length(v3 - v2);
        float d3 = ((v0.x - v3.x) * (center.y - v3.y)
            - (v0.y - v3.y) * (center.x - v3.x)) / length(v0 - v3);

        float d = min(min(d0, d1), min(d2, d3));
        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (cType == ShapeMaskTypeDiamond) {

        float radiusX = max(1.0 + min(pAdjustment, 0.0), 0.001);
        float radiusY = max(1.0 - max(pAdjustment, 0.0), 0.001);

        vec2 v0 = rotation * vec2(0.0, -radiusY);
        vec2 v1 = rotation * vec2(radiusX, 0.0);
        vec2 v2 = rotation * vec2(0.0, radiusY);
        vec2 v3 = rotation * vec2(-radiusX, 0.0);

        vec2 lo = min(min(v0, v1), min(v2, v3));
        vec2 hi = max(max(v0, v1), max(v2, v3));
        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);

        vec2 center = uv - 0.5;
        v0 = (v0 - boxCenter) * scale;
        v1 = (v1 - boxCenter) * scale;
        v2 = (v2 - boxCenter) * scale;
        v3 = (v3 - boxCenter) * scale;

        float d0 = ((v1.x - v0.x) * (center.y - v0.y)
            - (v1.y - v0.y) * (center.x - v0.x)) / length(v1 - v0);
        float d1 = ((v2.x - v1.x) * (center.y - v1.y)
            - (v2.y - v1.y) * (center.x - v1.x)) / length(v2 - v1);
        float d2 = ((v3.x - v2.x) * (center.y - v2.y)
            - (v3.y - v2.y) * (center.x - v2.x)) / length(v3 - v2);
        float d3 = ((v0.x - v3.x) * (center.y - v3.y)
            - (v0.y - v3.y) * (center.x - v3.x)) / length(v0 - v3);

        float d = min(min(d0, d1), min(d2, d3));
        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (cType == ShapeMaskTypeTrapezoid) {

        float topWidth = max(1.0 + min(pAdjustment, 0.0), 0.001);
        float bottomWidth = max(1.0 - max(pAdjustment, 0.0), 0.001);

        vec2 v0 = rotation * vec2(-bottomWidth * 0.5, -0.5);
        vec2 v1 = rotation * vec2(bottomWidth * 0.5, -0.5);
        vec2 v2 = rotation * vec2(topWidth * 0.5, 0.5);
        vec2 v3 = rotation * vec2(-topWidth * 0.5, 0.5);

        vec2 lo = min(min(v0, v1), min(v2, v3));
        vec2 hi = max(max(v0, v1), max(v2, v3));
        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);

        vec2 p = uv - 0.5;
        v0 = (v0 - boxCenter) * scale;
        v1 = (v1 - boxCenter) * scale;
        v2 = (v2 - boxCenter) * scale;
        v3 = (v3 - boxCenter) * scale;

        float d0 = ((v1.x - v0.x) * (p.y - v0.y)
            - (v1.y - v0.y) * (p.x - v0.x)) / length(v1 - v0);
        float d1 = ((v2.x - v1.x) * (p.y - v1.y)
            - (v2.y - v1.y) * (p.x - v1.x)) / length(v2 - v1);
        float d2 = ((v3.x - v2.x) * (p.y - v2.y)
            - (v3.y - v2.y) * (p.x - v2.x)) / length(v3 - v2);
        float d3 = ((v0.x - v3.x) * (p.y - v3.y)
            - (v0.y - v3.y) * (p.x - v3.x)) / length(v0 - v3);

        float d = min(min(d0, d1), min(d2, d3));
        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (
        cType == ShapeMaskTypePentagon || cType == ShapeMaskTypeHexagon || cType == ShapeMaskTypeHeptagon
        || cType == ShapeMaskTypeOctagon || cType == ShapeMaskTypeDecagon || cType == ShapeMaskTypeDodecagon
    ) {

        float n = float(cType);
        float angle = pRotation * PI / n + PI / 2.0;

        vec2 lo = vec2(1e20);
        vec2 hi = vec2(-1e20);

        for (int i = 0; i < cType; ++i) {
            float theta = angle + TAU * float(i) / n;
            vec2 v = vec2(cos(theta), sin(theta));
            lo = min(lo, v);
            hi = max(hi, v);
        }

        vec2 boxCenter = (lo + hi) * 0.5;
        float scale = 1.0 / max(hi.x - lo.x, hi.y - lo.y);
        vec2 p = uv - 0.5;

        float d = 1e20;
        for (int i = 0; i < cType; ++i) {
            int prevIndex = (i + cType - 1) % cType;

            float thetaA = angle + TAU * float(prevIndex) / n;
            float thetaB = angle + TAU * float(i) / n;

            vec2 a = (vec2(cos(thetaA), sin(thetaA)) - boxCenter) * scale;
            vec2 b = (vec2(cos(thetaB), sin(thetaB)) - boxCenter) * scale;

            vec2 edge = b - a;
            float edgeDistance = (edge.x * (p.y - a.y) - edge.y * (p.x - a.x)) / length(edge);
            d = min(d, edgeDistance);
        }

        float aa = fwidth(d);
        color.a *= smoothstep(-aa, aa, d);

    } else if (cType == ShapeMaskTypeCross) {

        float angle = pRotation * PI / 4.0;
        float cosAngle = cos(angle);
        float sinAngle = sin(angle);

        float t = clamp(0.5 + 0.5 * pAdjustment, 0.001, 0.999);

        float extent = max(abs(cosAngle) + abs(sinAngle) * t, abs(sinAngle) + abs(cosAngle) * t);
        float scale = 0.5 / extent;

        vec2 center = mat2(cosAngle, -sinAngle, sinAngle, cosAngle) * (uv - 0.5) / scale;

        vec2 qH = abs(center) - vec2(1.0, t);
        float dH = length(max(qH, 0.0)) + min(max(qH.x, qH.y), 0.0);

        vec2 qV = abs(center) - vec2(t, 1.0);
        float dV = length(max(qV, 0.0)) + min(max(qV.x, qV.y), 0.0);

        float d = min(dH, dV) * scale;
        float aa = fwidth(d);
        color.a *= (1.0 - smoothstep(-aa, aa, d));

    } else if (cType == ShapeMaskTypeMoon) {

        float cosAngle = cos(angle);
        float sinAngle = sin(angle);

        vec2 center = (uv - 0.5) * 2.0;
        vec2 local = vec2(cosAngle * center.x + sinAngle * center.y, -sinAngle * center.x + cosAngle * center.y);

        float coverage = 0.5 * (-pAdjustment + 1.0);
        float occluderOffset = 2.0 * (1.0 - coverage);

        float moonDistance = length(local) - 1.0;
        float occluderDistance = length(local - vec2(occluderOffset, 0.0)) - 1.0;

        float d = max(moonDistance, -occluderDistance);
        float aa = fwidth(d);

        color.a *= 1.0 - smoothstep(-aa, aa, d);

    }

    return color;
}
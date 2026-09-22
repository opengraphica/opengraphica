import { CubicBezierCurve } from 'three/src/extras/curves/CubicBezierCurve';
import { Vector2 } from 'three/src/math/Vector2';

import type { EllipseCurve } from 'three';

export function ellipseToCubicBeziers(
    ellipse: EllipseCurve,
    maxSegmentAngle = Math.PI / 2,
): CubicBezierCurve[] {
    const {
        aX: centerX,
        aY: centerY,
        xRadius: radiusX,
        yRadius: radiusY,
        aStartAngle: startAngle,
        aEndAngle: endAngle,
        aClockwise: clockwise,
        aRotation: rotation,
    } = ellipse;

    if (radiusX === 0 || radiusY === 0) {
        return [];
    }

    const deltaAngle = getEllipseDelta(startAngle, endAngle, clockwise);

    if (Math.abs(deltaAngle) < Number.EPSILON) {
        return [];
    }

    const segmentCount = Math.max(1, Math.ceil(Math.abs(deltaAngle) / maxSegmentAngle));
    const segmentAngle = deltaAngle / segmentCount;
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);

    const curves: CubicBezierCurve[] = [];

    for (let i = 0; i < segmentCount; i++) {
        const angle1 = startAngle + i * segmentAngle;
        const angle2 = angle1 + segmentAngle;

        const p0 = ellipsePoint(
            angle1,
            centerX,
            centerY,
            radiusX,
            radiusY,
            cosRotation,
            sinRotation,
        );

        const p3 = ellipsePoint(
            angle2,
            centerX,
            centerY,
            radiusX,
            radiusY,
            cosRotation,
            sinRotation,
        );

        const k = (4 / 3) * Math.tan(segmentAngle / 4);

        const d1 = ellipseDerivative(
            angle1,
            radiusX,
            radiusY,
            cosRotation,
            sinRotation,
        );

        const d2 = ellipseDerivative(
            angle2,
            radiusX,
            radiusY,
            cosRotation,
            sinRotation,
        );

        const p1 = p0.clone().addScaledVector(d1, k);
        const p2 = p3.clone().addScaledVector(d2, -k);

        curves.push(
            new CubicBezierCurve(
                p0,
                p1,
                p2,
                p3,
            ),
        );
    }

    return curves;
}

function getEllipseDelta(
    startAngle: number,
    endAngle: number,
    clockwise: boolean,
): number {
    const twoPi = Math.PI * 2;
    let delta = endAngle - startAngle;

    if (clockwise) {
        while (delta > 0) {
            delta -= twoPi;
        }
    } else {
        while (delta < 0) {
            delta += twoPi;
        }
    }

    return delta;
}

function ellipsePoint(
    angle: number,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    cosRotation: number,
    sinRotation: number,
): Vector2 {
    const x = radiusX * Math.cos(angle);
    const y = radiusY * Math.sin(angle);

    return new Vector2(
        centerX + cosRotation * x - sinRotation * y,
        centerY + sinRotation * x + cosRotation * y,
    );
}

function ellipseDerivative(
    angle: number,
    radiusX: number,
    radiusY: number,
    cosRotation: number,
    sinRotation: number,
): Vector2 {
    const x = -radiusX * Math.sin(angle);
    const y = radiusY * Math.cos(angle);

    return new Vector2(
        cosRotation * x - sinRotation * y,
        sinRotation * x + cosRotation * y,
    );
}
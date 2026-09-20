import { CubicBezierCurve } from 'three/src/extras/curves/CubicBezierCurve';
import { Vector2 } from 'three/src/math/Vector2';

import type { Curve } from 'three';

export function arcToCubicBezier(
    currentPoint: Vector2,
    position: Vector2,
    radius: Vector2,
    xAxisRotation: number = 0,
    largeArcFlag: number = 0,
    sweepFlag: number = 0
): Curve<Vector2>[] {
    const curves: Array<[Vector2, Vector2, Vector2]> = [];
    
    if (radius.x == 0.0 || radius.y == 0.0) {
        return [];
    }
    
    const sinphi = Math.sin(xAxisRotation * (2 * Math.PI) / 360.0);
    const cosphi = Math.cos(xAxisRotation * (2 * Math.PI) / 360.0);
    
    const pp = new Vector2(
        cosphi * (currentPoint.x - position.x) / 2.0 + sinphi * (currentPoint.y - position.y) / 2.0,
        -sinphi * (currentPoint.x - position.x) / 2.0 + cosphi * (currentPoint.y - position.y) / 2.0
    );
    
    if (pp.x == 0.0 && pp.y == 0.0) {
        return [];
    }
    
    radius = new Vector2(Math.abs(radius.x), Math.abs(radius.y));
    
    const lambda = Math.pow(pp.x, 2) / Math.pow(radius.x, 2) + Math.pow(pp.y, 2) / Math.pow(radius.y, 2);
    
    if (lambda > 1.0) {
        radius.multiplyScalar(Math.sqrt(lambda));
    }
    
    let [center, ang1, ang2] = getArcCenter(currentPoint, position, radius, largeArcFlag, sweepFlag, sinphi, cosphi, pp);
    
    let ratio = Math.abs(ang2) / ((2 * Math.PI) / 4.0);
    if (Math.abs(1.0 - ratio) < 0.0000001) {
        ratio = 1.0;
    }
    
    const segments = Math.max(Math.ceil(ratio), 1.0);
    
    ang2 /= segments;
    
    for (let i = 0; i < segments; i++) {
        curves.push(approxUnitArc(ang1, ang2));
        ang1 += ang2;
    }
    
    const commands: Curve<Vector2>[] = [];
    currentPoint = currentPoint.clone();
    for (const curve of curves) {
        const start = currentPoint;
        const control1 = mapToEllipse(curve[0], radius, cosphi, sinphi, center);
        const control2 = mapToEllipse(curve[1], radius, cosphi, sinphi, center);
        const end = mapToEllipse(curve[2], radius, cosphi, sinphi, center);
        currentPoint = end.clone();
        const command = new CubicBezierCurve(
            start,
            control1,
            control2,
            end,
        );
        commands.push(command);
    }
    return commands;
}

function getArcCenter(
    currentPoint: Vector2, position: Vector2, radius: Vector2, largeArcFlag: number, sweepFlag: number,
    sinphi: number, cosphi: number, pp: Vector2,
): [Vector2, number, number] {
    const rxsq = Math.pow(radius.x, 2);
    const rysq = Math.pow(radius.y, 2);
    const pxpsq = Math.pow(pp.x, 2);
    const pypsq = Math.pow(pp.y, 2);
    
    let radicant = Math.max(0.0, (rxsq * rysq) - (rxsq * pypsq) - (rysq * pxpsq));
    
    radicant /= (rxsq * pypsq) + (rysq * pxpsq);
    radicant = Math.sqrt(radicant) * (largeArcFlag == sweepFlag ? -1 : 1);
    
    const centerxp = radicant * radius.x / radius.y * pp.y;
    const centeryp = radicant * -radius.y / radius.x * pp.x;
    
    const centerx = cosphi * centerxp - sinphi * centeryp + (currentPoint.x + position.x) / 2.0;
    const centery = sinphi * centerxp + cosphi * centeryp + (currentPoint.y + position.y) / 2.0;
    
    const vx1 = (pp.x - centerxp) / radius.x;
    const vy1 = (pp.y - centeryp) / radius.y;
    const vx2 = (-pp.x - centerxp) / radius.x;
    const vy2 = (-pp.y - centeryp) / radius.y;
    
    const ang1 = vectorAngle(new Vector2(1.0, 0.0), new Vector2(vx1, vy1));
    let ang2 = vectorAngle(new Vector2(vx1, vy1), new Vector2(vx2, vy2));
    
    if (sweepFlag == 0 && ang2 > 0) {
        ang2 -= 2 * Math.PI;
    }
    if (sweepFlag == 1 && ang2 < 0) {
        ang2 += 2 * Math.PI;
    }
    
    return [
        new Vector2(centerx, centery),
        ang1,
        ang2,
    ];
}

function vectorAngle(u: Vector2, v: Vector2) {
    const uvSign = (u.x * v.y - u.y * v.x < 0.0) ? -1 : 1;
    const dot = Math.max(-1.0, Math.min(1.0, u.x * v.x + u.y * v.y));
    return uvSign * Math.acos(dot);
}

function approxUnitArc(ang1: number, ang2: number): [Vector2, Vector2, Vector2] {
    const a = ang2 == 1.5707963267948966
        ? 0.551915024494
        : (
            ang2 == -1.5707963267948966
                ? -0.551915024494
                : 4.0 / 3.0 * Math.tan(ang2 / 4.0)
        );
    
    const x1 = Math.cos(ang1);
    const y1 = Math.sin(ang1);
    const x2 = Math.cos(ang1 + ang2);
    const y2 = Math.sin(ang1 + ang2);
    
    return [
        new Vector2(x1 - y1 * a, y1 + x1 * a),
        new Vector2(x2 + y2 * a, y2 - x2 * a),
        new Vector2(x2, y2),
    ];
}

function mapToEllipse(position: Vector2, radius: Vector2, cosphi: number, sinphi: number, center: Vector2) {
    const p = position.clone().multiply(radius);
    const xp = cosphi * p.x - sinphi * p.y
    const yp = sinphi * p.x + cosphi * p.y
    return new Vector2(xp + center.x, yp + center.y);
}












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

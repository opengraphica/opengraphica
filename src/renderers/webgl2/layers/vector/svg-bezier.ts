import { Vector2 } from 'three/src/math/Vector2';

export function angleTo(a: Vector2, b: Vector2) {
    const cross = a.x * b.y - a.y * b.x;
    const dot = a.x * b.x + a.y * b.y;
    return Math.atan2(cross, dot);
}

export function directionTo(a: Vector2, b: Vector2): Vector2 {
    return b.clone().sub(a).normalize();
}

export function isEqualApprox(a: Vector2, b: Vector2, epsilon = 0.00001) {
    return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

/*------------*\
|              |
|   Segments   |
|              |
\*------------*/

export function sliceLineSegment(p0: Vector2, p1: Vector2, startT: number, endT: number): Vector2[] {
    let isReversed = false;
    if (startT > endT) {
        isReversed = true;
        let tmp = endT;
        endT = startT
        startT = tmp;
    }
    if (startT == 0.0 && endT == 1.0) {
        if (isReversed) {
            return [p1.clone(), p0.clone()];
        } else {
            return [p0.clone(), p1.clone()];
        }
    } else {
        const pathDirection = p1.clone().sub(p0);
        const newP0 = p0.clone().add(pathDirection.clone().multiplyScalar(startT));
        const newP1 = p0.clone().add(pathDirection.clone().multiplyScalar(endT));
        return [
            isReversed ? newP1 : newP0,
            isReversed ? newP0 : newP1,
        ];
    }
}

/*--------------*\
|                |
|   Quadratics   |
|                |
\*--------------*/

export function quadraticBezierAt(p0: Vector2 | null, p1: Vector2 | null, p2: Vector2 | null, t: number): Vector2 {
    if (p0 == null || p1 == null || p2 == null) return new Vector2();
    const q0 = p0.lerp(p1, t);
    const q1 = p1.lerp(p2, t);
    return q0.lerp(q1, t);
}

export function splitQuadraticBezier(p0: Vector2, p1: Vector2, p2: Vector2, t: number): Vector2[] {
    const x1 = p0.x;
    const y1 = p0.y;
    const x2 = p1.x;
    const y2 = p1.y;
    const x3 = p2.x;
    const y3 = p2.y;
    
    const x12 = (x2 - x1) * t + x1;
    const y12 = (y2 - y1) * t + y1;
    
    const x23 = (x3 - x2) * t + x2;
    const y23 = (y3 - y2) * t + y2;
    
    const x123 = (x23 - x12) * t + x12;
    const y123 = (y23 - y12) * t + y12;
    
    return [
        new Vector2(x1, y1),
        new Vector2(x12, y12),
        new Vector2(x123, y123),
        new Vector2(x23, y23),
        new Vector2(x3, y3),
    ];
}

export function sliceQuadraticBezier(p0: Vector2, p1: Vector2, p2: Vector2, startT: number, endT: number): Vector2[] {
    let isReversed = false;
    if (startT > endT) {
        isReversed = true;
        let tmp = endT;
        endT = startT
        startT = tmp;
    }
    if (startT == 0.0 && endT == 1.0) {
        if (isReversed) {
            return [p2.clone(), p1.clone(), p0.clone()];
        } else {
            return [p0.clone(), p1.clone(), p2.clone()];
        }
    } else {
        const splitEpsilon = 0.0001;
        const leftSplit = splitQuadraticBezier(p0, p1, p2, startT);
        const rightSplit = splitQuadraticBezier(leftSplit[2], leftSplit[3], leftSplit[4], (endT - startT) / Math.max(splitEpsilon, (1.0 - startT)));
        if (isReversed) {
            return [rightSplit[2], rightSplit[1], rightSplit[2]];
        } else {
            return [rightSplit[0], rightSplit[1], rightSplit[2]];
        }
    }
}

/*----------*\
|            |
|   Cubics   |
|            |
\*----------*/

export function cubicBezierAt(p0: Vector2 | null, p1: Vector2 | null, p2: Vector2 | null, p3: Vector2 | null, t: number): Vector2 {
    if (p0 == null || p1 == null || p2 == null || p3 == null) return new Vector2();
    const s0 = Math.pow(1.0 - t, 3.0);
    const s1 = 3.0 * Math.pow(1.0 - t, 2.0) * t;
    const s2 = 3.0 * (1.0 - t) * Math.pow(t, 2.0);
    const s3 = Math.pow(t, 3.0);
    const q0 = p0.clone().multiplyScalar(s0);
    const q1 = p1.clone().multiplyScalar(s1);
    const q2 = p2.clone().multiplyScalar(s2);
    const q3 = p3.clone().multiplyScalar(s3);
    return q0.add(q1).add(q2).add(q3);
}

export function cubicBezierLength(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, subdiv: number = 5.0) {
    var length = 0;
    if (subdiv > 0) {
        const a = p0.clone().add(p1.clone().sub(p0).multiplyScalar(0.5));
        const b = p1.clone().add(p2.clone().sub(p1).multiplyScalar(0.5));
        const c = p2.clone().add(p3.clone().sub(p2).multiplyScalar(0.5));
        const d = a.clone().add(b.clone().sub(a).multiplyScalar(0.5));
        const e = b.clone().add(c.clone().sub(b).multiplyScalar(0.5));
        const f = d.clone().add(e.clone().sub(d).multiplyScalar(0.5));
        length += cubicBezierLength(p0, a, d, f, subdiv - 1);
        length += cubicBezierLength(f, e, c, p3, subdiv - 1);
    } else {
        const controlNetLength = (p1.clone().sub(p0)).length() + (p2.clone().sub(p1)).length() + (p3.clone().sub(p2)).length();
        const chordLength = (p3.clone().sub(p0)).length();
        length += (chordLength + controlNetLength) / 2.0;
    }
    return length;
}

export function findCubicBezierDirectionAt(
    p0: Vector2,
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    t: number,
): Vector2 {
    const epsilon = 0.00001;
    if (t == 0.0) {
        const controlPoint = p1 != p0 ? p1 : p2;
        return directionTo(p0, controlPoint);
    }
    if (t == 1.0) {
        const controlPoint = p2 != p3 ? p2 : p1;
        return directionTo(controlPoint, p3);
    }
    const startT = Math.min(1, Math.max(0, t - epsilon));
    const endT = Math.min(1, Math.max(0, t + epsilon));
    return directionTo(
        cubicBezierAt(p0, p1, p2, p3, startT),
        cubicBezierAt(p0, p1, p2, p3, endT),
    );
}

export function splitCubicBezier(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number) {
    const x1 = p0.x
    const y1 = p0.y
    const x2 = p1.x
    const y2 = p1.y
    const x3 = p2.x
    const y3 = p2.y
    const x4 = p3.x
    const y4 = p3.y

    const x12 = (x2 - x1) * t + x1
    const y12 = (y2 - y1) * t + y1

    const x23 = (x3 - x2) * t + x2
    const y23 = (y3 - y2) * t + y2

    const x34 = (x4 - x3) * t + x3
    const y34 = (y4 - y3) * t + y3

    const x123 = (x23 - x12) * t + x12
    const y123 = (y23 - y12) * t + y12

    const x234 = (x34 - x23) * t + x23
    const y234 = (y34 - y23) * t + y23

    const x1234 = (x234 - x123) * t + x123
    const y1234 = (y234 - y123) * t + y123

    return [
        new Vector2(x1, y1),
        new Vector2(x12, y12),
        new Vector2(x123, y123),
        new Vector2(x1234, y1234),
        new Vector2(x234, y234),
        new Vector2(x34, y34),
        new Vector2(x4, y4),
    ];
}

export function sliceCubicBezier(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, startT: number, endT: number): Vector2[] {
    let isReversed = false;
    if (startT > endT) {
        isReversed = true;
        let tmp = endT;
        endT = startT;
        startT = tmp;
    }
    if (startT == 0.0 && endT == 1.0) {
        if (isReversed) {
            return [p3.clone(), p2.clone(), p1.clone(), p0.clone()];
        } else {
            return [p0.clone(), p1.clone(), p2.clone(), p3.clone()];
        }
    } else {
        var leftSplit = splitCubicBezier(p0, p1, p2, p3, startT);
        var rightSplit = (
            startT < 1.0
                ? splitCubicBezier(leftSplit[3], leftSplit[4], leftSplit[5], leftSplit[6], (endT - startT) / (1.0 - startT))
                : [p3.clone(), p3.clone(), p3.clone(), p3.clone(), p3.clone(), p3.clone(), p3.clone()]
        );
        if (isReversed) {
            return [rightSplit[3], rightSplit[2], rightSplit[1], rightSplit[0]];
        } else {
            return [rightSplit[0], rightSplit[1], rightSplit[2], rightSplit[3]];
        }
    }
}

/*---------------*\
|                 |
|   Polynomials   |
|                 |
\*---------------*/

export function slicePolynomial(p: Vector2[], startT: number, endT: number): Vector2[] {
    if (p.length === 2) {
        return sliceLineSegment(p[0], p[1], startT, endT);
    } else if (p.length === 3) {
        return sliceQuadraticBezier(p[0], p[1], p[2], startT, endT);
    } else if (p.length === 4) {
        return sliceCubicBezier(p[0], p[1], p[2], p[3], startT, endT);
    }
    return p;
}
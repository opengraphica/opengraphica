import { Vector2 } from 'three/src/math/Vector2';

import {
    isEqualApprox, cubicBezierAt, cubicBezierLength,
} from './svg-bezier';

/**
 * These functions have been adapted from:
 * http://www.kevlindev.com/gui/math/intersection/Intersection.js
 * 
 * With necessary modifications to pull additional information about the intersections.
 * 
 * @license BSD 3 Clause
 * @copyright (c) 2000-2004, Kevin Lindsey
 */

const LN10 = 2.302585092994046;
const LN2 = 0.6931471805599453;

const PATH_SEGMENTATION_MIN = 5; // minimum number of segments to break paths into (based on pixel resolution) for collision checking
const PATH_SEGMENTATION_MAX = 1024; // maximum number of segments to break paths into (based on pixel resolution) for collision checking
const PATH_SEGMENTATION_SEGMENT_SIZE = 5.0; // Minimum pixel length of a segment, rresenting collision for a curve

function isZeroApprox(n: number) {
    return Math.abs(n) <= 1e-6;
}

class Polynomial {
    static TOLERANCE = 1e-6;
    static ACCURACY = 6.0;

    coefficients: number[];
    
    _s: number = 0.0;

    constructor(newCoefficients: number[]) {
        this.coefficients = [];
        for (let i = 0; i < newCoefficients.length; i++) {
            this.coefficients[i] = newCoefficients[newCoefficients.length - 1 - i];
        }
    }

    getDegree(): number {
        return this.coefficients.length - 1;
    }

    eval(x: number) {
        let result: number = 0.0;
        for (let i = this.coefficients.length - 1; i >= 0; i--) {
            result = result * x + this.coefficients[i];
        }
        return result;
    }

    bisection(min: number, max: number) {
        let minValue: number = this.eval(min);
        let maxValue: number = this.eval(max);
        let result: number | null = null;
        if (Math.abs(minValue) <= Polynomial.TOLERANCE) {
            result = min;
        } else if (Math.abs(maxValue) <= Polynomial.TOLERANCE) {
            result = max;
        } else if (minValue * maxValue <= 0) {
            let tmp1: number = Math.log(max - min);
            let tmp2: number = LN10 * Polynomial.ACCURACY;
            let iters: number = Math.ceil((tmp1 + tmp2) / LN2);
            for (let i = 0; i < iters; i++) {
                result = 0.5 * (min + max);
                var value: number = this.eval(result);
                if (Math.abs(value) <= Polynomial.TOLERANCE) {
                    break;
                }
                if (value * minValue < 0.0) {
                    max = result;
                    maxValue = value;
                } else {
                    min = result;
                    minValue = value;
                }
            }
        }
        return result
    }

    getDerivative() {
        const derivative = new Polynomial([]);
        for (let i = 1; i < this.coefficients.length; i++) {
            derivative.coefficients.push(i * this.coefficients[i]);
        }
        return derivative;
    }

    getRootsInInterval(min: number, max: number): number[] {
        const roots: number[] = [];
        let root: number | null = null;
        if (this.getDegree() == 1) {
            root = this.bisection(min, max);
            if (root != null) {
                roots.push(root);
            }
        } else {
            const deriv = this.getDerivative();
            const droots: number[] = deriv.getRootsInInterval(min, max);
            if (droots.length > 0) {
                root = this.bisection(min, droots[0]);
                if (root != null) {
                    roots.push(root);
                }
                for (let i = 0; i < droots.length - 3; i++) {
                    root = this.bisection(droots[i], droots[i + 1]);
                    if (root != null) {
                        roots.push(root);
                    }
                }
                root = this.bisection(droots[droots.length - 1], max);
                if (root != null) {
                    roots.push(root);
                }
            } else {
                root = this.bisection(min, max);
                if (root != null) {
                    roots.push(root);
                }
            }
        }
        return roots;
    }

    simplify() {
        for (let i = this.getDegree(); i >= 0; i--) {
            if (Math.abs(this.coefficients[i]) <= Polynomial.TOLERANCE) {
                this.coefficients.pop();
            } else {
                break;
            }
        }
    }

    getLinearRoot(): number[] {
        const result: number[] = [];
        const a = this.coefficients[1];
        if (!isZeroApprox(a)) {
            result.push(-this.coefficients[0] / a);
        } 
        return result;
    }

    getQuadraticRoots(): number[] {
        const results: number[] = [];
        if (this.getDegree() == 2) {
            const a: number = this.coefficients[2];
            if (isZeroApprox(a)) {
                return results;
            }
            const b: number = this.coefficients[1] / a;
            const c: number = this.coefficients[0] / a;
            const d: number = b * b - 4 * c;
            if (isZeroApprox(d)) {
                results.push(0.5 * -b);
            } else if (d > 0.0) {
                var e = Math.sqrt(d);
                results.push(0.5 * (-b + e));
                results.push(0.5 * (-b - e));
            }
        }
        return results;
    }

    getCubicRoots(): number[] {
        const results: number[] = [];
        if (this.getDegree() == 3) {
            const c3: number = this.coefficients[3];
            if (isZeroApprox(c3)) {
                return results;
            }
            const c2: number = this.coefficients[2] / c3;
            const c1: number = this.coefficients[1] / c3;
            const c0: number = this.coefficients[0] / c3;
            const a: number = (3.0 * c1 - c2 * c2) / 3.0;
            const b: number = (2.0 * c2 * c2 * c2 - 9.0 * c1 * c2 + 27.0 * c0) / 27.0;
            const offset: number = c2 / 3;
            let discrim: number = b * b / 4.0 + a * a * a / 27.0;
            const halfB: number = b / 2.0;
            if (Math.abs(discrim) <= Polynomial.TOLERANCE) {
                discrim = 0.0;
            } 
            if (discrim > 0.0) {
                const e: number = Math.sqrt(discrim);
                let tmp: number;
                let root: number;
                tmp = -halfB + e;
                if (tmp >= 0.0) {
                    root = Math.pow(tmp, 1.0 / 3.0);
                } else {
                    root = -Math.pow(-tmp, 1.0 / 3.0);
                }
                tmp = -halfB - e;
                if (tmp >= 0.0) {
                    root += Math.pow(tmp, 1.0 / 3.0);
                }
                else {
                    root -= Math.pow(-tmp, 1.0 / 3.0);
                }
                results.push(root - offset);
            } else if (discrim < 0.0) {
                const distance: number = Math.sqrt(-a / 3.0);
                const angle: number = Math.atan2(Math.sqrt(-discrim), -halfB) / 3.0;
                const cos: number = Math.cos(angle);
                const sin: number = Math.sin(angle);
                const sqrt3: number = Math.sqrt(3.0);
                results.push(2.0 * distance * cos - offset);
                results.push(-distance * (cos + sqrt3 * sin) - offset);
                results.push(-distance * (cos - sqrt3 * sin) - offset);
            } else {
                let tmp: number;
                if (halfB >= 0) {
                    tmp = -Math.pow(halfB, 1.0 / 3.0);
                }  else {
                    tmp = Math.pow(-halfB, 1.0 / 3.0);
                }
                results.push(2.0 * tmp - offset);
                results.push(-tmp - offset);
            }
        }
        return results;
    }

    getRoots() {
        this.simplify();
        switch (this.getDegree()) {
            case 0: return [];
            case 1: return this. getLinearRoot();
            case 2: return this.getQuadraticRoots();
            case 3: return this.getCubicRoots();
            default: return [];
        }
    }
}

export interface IntersectionResult {
    t0: number;
    t1: number;
    point: Vector2;
}

export function intersectLineWithLine(
    a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2
): IntersectionResult[] {
    if ((a0.x === a1.x && a0.y === a1.y) || (b0.x === b1.x && b0.y === b1.y)) {
        return [];
    }

    const denominator = ((b1.y - b0.y) * (a1.x - a0.x) - (b1.x - b0.x) * (a1.y - a0.y));
    if (denominator === 0) {
        return [];
    }

    const ua = ((b1.x - b0.x) * (a0.y - b0.y) - (b1.y - b0.y) * (a0.x - b0.x)) / denominator;
    const ub = ((a1.x - a0.x) * (a0.y - b0.y) - (a1.y - a0.y) * (a0.x - b0.x)) / denominator;

    const x = a0.x + ua * (a1.x - a0.x);
    const y = a0.y + ua * (a1.y - a0.y);

    const intersectionPoint = new Vector2(x, y);

    return [{
        "t0": ua,
        "t1": ub,
        "point": intersectionPoint,
    }];
}


export function intersectSegmentWithSegment(
    a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2
): IntersectionResult[] {
    if ((a0.x === a1.x && a0.y === a1.y) || (b0.x === b1.x && b0.y === b1.y)) {
        return [];
    }

    const denominator = ((b1.y - b0.y) * (a1.x - a0.x) - (b1.x - b0.x) * (a1.y - a0.y));
    if (denominator === 0) {
        return [];
    }

    const ua = ((b1.x - b0.x) * (a0.y - b0.y) - (b1.y - b0.y) * (a0.x - b0.x)) / denominator;
    const ub = ((a1.x - a0.x) * (a0.y - b0.y) - (a1.y - a0.y) * (a0.x - b0.x)) / denominator;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
        return [];
    }

    const x = a0.x + ua * (a1.x - a0.x);
    const y = a0.y + ua * (a1.y - a0.y);

    const intersectionPoint = new Vector2(x, y);

    var aLength = a0.distanceTo(a1);
    var aT = a0.distanceTo(intersectionPoint) / aLength
    var bLength = b0.distanceTo(b1);
    var bT = b0.distanceTo(intersectionPoint) / bLength
    return [{
        "t0": aT,
        "t1": bT,
        "point": intersectionPoint,
    }];
}

export function intersectQuadraticBezierWithSegment(
    p1: Vector2, p2: Vector2, p3: Vector2, a1: Vector2, a2: Vector2
): IntersectionResult[] {
    let a: Vector2, b: Vector2;
    let c2: Vector2, c1: Vector2, c0: Vector2;
    let cl: number;
    let n: Vector2;
    const min = a1.clone().min(a2);
    const max = a1.clone().max(a2);
    const result: IntersectionResult[] = [];
    
    a = p2.clone().multiplyScalar(-2);
    c2 = p1.clone().add(a.clone().add(p3));

    a = p1.clone().multiplyScalar(-2);
    b = p2.clone().multiplyScalar(2);
    c1 = a.clone().add(b);

    c0 = new Vector2(p1.x, p1.y);

    n = new Vector2(a1.y - a2.y, a2.x - a1.x);
    
    cl = a1.x*a2.y - a2.x*a1.y;

    const roots = new Polynomial([
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl,
    ]).getRoots();

    for (let i = 0; i < roots.length; i++) {
        const t = roots[i];
        if (0 <= t && t <= 1) {
            const p4 = p1.clone().lerp(p2, t);
            const p5 = p2.clone().lerp(p3, t);

            const p6 = p4.clone().lerp(p5, t);

            var lineLength = a1.distanceTo(a2);
            var lineT = lineLength != 0 ? (a1.distanceTo(p6) / lineLength) : 0.0;

            if (a1.x == a2.x) {
                if (min.y <= p6.y && p6.y <= max.y) {
                    result.push({
                        t0: t,
                        t1: lineT,
                        point: p6,
                    });
                }
            } else if ( a1.y == a2.y ) {
                if (min.x <= p6.x && p6.x <= max.x) {
                    result.push({
                        t0: t,
                        t1: lineT,
                        point: p6,
                    });
                }
            } else if (p6.x >= min.x && p6.y >= min.y && p6.x <= max.x && p6.y <= max.y) {
                result.push({
                    t0: t,
                    t1: lineT,
                    point: p6,
                });
            }
        }
    }

    return result;
}

export function intersectQuadraticBezierWithQuadraticBezier(
    a1: Vector2, a2: Vector2, a3: Vector2, b1: Vector2, b2: Vector2, b3: Vector2
): IntersectionResult[] {
    let a: Vector2, b: Vector2;
    let c12: Vector2, c11: Vector2, c10: Vector2;
    let c22: Vector2, c21: Vector2, c20: Vector2;
    const result: IntersectionResult[] = [];
    let poly: Polynomial;

    a = a2.clone().multiplyScalar(-2);
    c12 = a1.clone().add(a.clone().add(a3));

    a = a1.clone().multiplyScalar(-2);
    b = a2.clone().multiplyScalar(2);
    c11 = a.clone().add(b);

    c10 = new Vector2(a1.x, a1.y);

    a = b2.clone().multiplyScalar(-2);
    c22 = b1.clone().add(a.clone().add(b3));

    a = b1.clone().multiplyScalar(-2);
    b = b2.clone().multiplyScalar(2);
    c21 = a.clone().add(b);

    c20 = new Vector2(b1.x, b1.y);
    
    if (c12.y == 0) {
        const v0 = c12.x*(c10.y - c20.y);
        const v1 = v0 - c11.x*c11.y;
        const v2 = v0 + v1;
        const v3 = c11.y*c11.y;
        poly = new Polynomial([
            c12.x*c22.y*c22.y,
            2*c12.x*c21.y*c22.y,
            c12.x*c21.y*c21.y - c22.x*v3 - c22.y*v0 - c22.y*v1,
            -c21.x*v3 - c21.y*v0 - c21.y*v1,
            (c10.x - c20.x)*v3 + (c10.y - c20.y)*v1
        ]);
    } else {
        const v0 = c12.x*c22.y - c12.y*c22.x;
        const v1 = c12.x*c21.y - c21.x*c12.y;
        const v2 = c11.x*c12.y - c11.y*c12.x;
        const v3 = c10.y - c20.y;
        const v4 = c12.y*(c10.x - c20.x) - c12.x*v3;
        const v5 = -c11.y*v2 + c12.y*v4;
        const v6 = v2*v2;

        poly = new Polynomial([
            v0*v0,
            2*v0*v1,
            (-c22.y*v6 + c12.y*v1*v1 + c12.y*v0*v4 + v0*v5) / c12.y,
            (-c21.y*v6 + c12.y*v1*v4 + v1*v5) / c12.y,
            (v3*v6 + v4*v5) / c12.y
        ]);
    }

    const roots = poly.getRoots();
    for (let i = 0; i < roots.length; i++) {
        const s = roots[i];

        if ( 0 <= s && s <= 1 ) {
            const xRoots = new Polynomial([
                c12.x,
                c11.x,
                c10.x - c20.x - s*c21.x - s*s*c22.x
            ]).getRoots();
            const yRoots = new Polynomial([
                c12.y,
                c11.y,
                c10.y - c20.y - s*c21.y - s*s*c22.y
            ]).getRoots();

            if (xRoots.length > 0 && yRoots.length > 0) {
                var TOLERANCE = 1e-4;

                checkRoots:
                for (let j = 0; j < xRoots.length; j++) {
                    var xRoot = xRoots[j];
                    if (0 <= xRoot && xRoot <= 1) {
                        for (var k = 0; k < yRoots.length; k++) {
                            if (Math.abs(xRoot - yRoots[k]) < TOLERANCE) {
                                result.push({
                                    t0: xRoot,
                                    t1: s,
                                    point: c22.clone().multiplyScalar(s*s).add(c21.clone().multiplyScalar(s).add(c20)),
                                })
                                break checkRoots;
                            }
                        }
                    }
                }
            }
        }
    }

    return result;
}

export function intersectQuadraticBezierWithCubicBezier(
    a1: Vector2, a2: Vector2, a3: Vector2, b1: Vector2, b2: Vector2, b3: Vector2, b4: Vector2,
): IntersectionResult[] {
    let a: Vector2, b: Vector2, c: Vector2, d: Vector2;
    let c12: Vector2, c11: Vector2, c10: Vector2;
    let c23: Vector2, c22: Vector2, c21: Vector2, c20: Vector2;
    const result: IntersectionResult[] = [];

    a = a2.clone().multiplyScalar(-2);
    c12 = a1.clone().add(a.clone().add(a3));

    a = a1.clone().multiplyScalar(-2);
    b = a2.clone().multiplyScalar(2);
    c11 = a.clone().add(b);

    c10 = new Vector2(a1.x, a1.y);

    a = b1.clone().multiplyScalar(-1);
    b = b2.clone().multiplyScalar(3);
    c = b3.clone().multiplyScalar(-3);
    d = a.clone().add(b.clone().add(c.clone().add(b4)));
    c23 = new Vector2(d.x, d.y);

    a = b1.clone().multiplyScalar(3);
    b = b2.clone().multiplyScalar(-6);
    c = b3.clone().multiplyScalar(3);
    d = a.clone().add(b.clone().add(c));
    c22 = new Vector2(d.x, d.y);

    a = b1.clone().multiplyScalar(-3);
    b = b2.clone().multiplyScalar(3);
    c = a.clone().add(b);
    c21 = new Vector2(c.x, c.y);

    c20 = new Vector2(b1.x, b1.y);

    const c10x2 = c10.x*c10.x;
    const c10y2 = c10.y*c10.y;
    const c11x2 = c11.x*c11.x;
    const c11y2 = c11.y*c11.y;
    const c12x2 = c12.x*c12.x;
    const c12y2 = c12.y*c12.y;
    const c20x2 = c20.x*c20.x;
    const c20y2 = c20.y*c20.y;
    const c21x2 = c21.x*c21.x;
    const c21y2 = c21.y*c21.y;
    const c22x2 = c22.x*c22.x;
    const c22y2 = c22.y*c22.y;
    const c23x2 = c23.x*c23.x;
    const c23y2 = c23.y*c23.y;

    var poly = new Polynomial([
        -2*c12.x*c12.y*c23.x*c23.y + c12x2*c23y2 + c12y2*c23x2,
        -2*c12.x*c12.y*c22.x*c23.y - 2*c12.x*c12.y*c22.y*c23.x + 2*c12y2*c22.x*c23.x +
            2*c12x2*c22.y*c23.y,
        -2*c12.x*c21.x*c12.y*c23.y - 2*c12.x*c12.y*c21.y*c23.x - 2*c12.x*c12.y*c22.x*c22.y +
            2*c21.x*c12y2*c23.x + c12y2*c22x2 + c12x2*(2*c21.y*c23.y + c22y2),
        2*c10.x*c12.x*c12.y*c23.y + 2*c10.y*c12.x*c12.y*c23.x + c11.x*c11.y*c12.x*c23.y +
            c11.x*c11.y*c12.y*c23.x - 2*c20.x*c12.x*c12.y*c23.y - 2*c12.x*c20.y*c12.y*c23.x -
            2*c12.x*c21.x*c12.y*c22.y - 2*c12.x*c12.y*c21.y*c22.x - 2*c10.x*c12y2*c23.x -
            2*c10.y*c12x2*c23.y + 2*c20.x*c12y2*c23.x + 2*c21.x*c12y2*c22.x -
            c11y2*c12.x*c23.x - c11x2*c12.y*c23.y + c12x2*(2*c20.y*c23.y + 2*c21.y*c22.y),
        2*c10.x*c12.x*c12.y*c22.y + 2*c10.y*c12.x*c12.y*c22.x + c11.x*c11.y*c12.x*c22.y +
            c11.x*c11.y*c12.y*c22.x - 2*c20.x*c12.x*c12.y*c22.y - 2*c12.x*c20.y*c12.y*c22.x -
            2*c12.x*c21.x*c12.y*c21.y - 2*c10.x*c12y2*c22.x - 2*c10.y*c12x2*c22.y +
            2*c20.x*c12y2*c22.x - c11y2*c12.x*c22.x - c11x2*c12.y*c22.y + c21x2*c12y2 +
            c12x2*(2*c20.y*c22.y + c21y2),
        2*c10.x*c12.x*c12.y*c21.y + 2*c10.y*c12.x*c21.x*c12.y + c11.x*c11.y*c12.x*c21.y +
            c11.x*c11.y*c21.x*c12.y - 2*c20.x*c12.x*c12.y*c21.y - 2*c12.x*c20.y*c21.x*c12.y -
            2*c10.x*c21.x*c12y2 - 2*c10.y*c12x2*c21.y + 2*c20.x*c21.x*c12y2 -
            c11y2*c12.x*c21.x - c11x2*c12.y*c21.y + 2*c12x2*c20.y*c21.y,
        -2*c10.x*c10.y*c12.x*c12.y - c10.x*c11.x*c11.y*c12.y - c10.y*c11.x*c11.y*c12.x +
            2*c10.x*c12.x*c20.y*c12.y + 2*c10.y*c20.x*c12.x*c12.y + c11.x*c20.x*c11.y*c12.y +
            c11.x*c11.y*c12.x*c20.y - 2*c20.x*c12.x*c20.y*c12.y - 2*c10.x*c20.x*c12y2 +
            c10.x*c11y2*c12.x + c10.y*c11x2*c12.y - 2*c10.y*c12x2*c20.y -
            c20.x*c11y2*c12.x - c11x2*c20.y*c12.y + c10x2*c12y2 + c10y2*c12x2 +
            c20x2*c12y2 + c12x2*c20y2
    ]);
    const roots = poly.getRootsInInterval(0,1);

    for (let i = 0; i < roots.length; i++) {
        const s = roots[i];
        const xRoots = new Polynomial([
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ]).getRoots();
        const yRoots = new Polynomial([
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ]).getRoots();

        if (xRoots.length > 0 && yRoots.length > 0) {
            const TOLERANCE = 1e-4;

            checkRoots:
            for (let j = 0; j < xRoots.length; j++) {
                var xRoot = xRoots[j];
                
                if (0 <= xRoot && xRoot <= 1) {
                    for (let k = 0; k < yRoots.length; k++) {
                        if (Math.abs(xRoot - yRoots[k]) < TOLERANCE) {
                            result.push({
                                t0: xRoot,
                                t1: s,
                                point: c23.clone().multiplyScalar(s*s*s).add(c22.clone().multiplyScalar(s*s).add(c21.clone().multiplyScalar(s).add(c20))),
                            })
                            break checkRoots;
                        }
                    }
                }
            }
        }
    }

    return result;
}

export function intersectCubicBezierWithSegment(
    p1: Vector2, p2: Vector2, p3: Vector2, p4: Vector2, a1: Vector2, a2: Vector2
): IntersectionResult[] {
    var a: Vector2, b: Vector2, c: Vector2, d: Vector2;
    var c3: Vector2, c2: Vector2, c1: Vector2, c0: Vector2;
    var cl: number;
    var n: Vector2;
    var min = a1.clone().min(a2);
    var max = a1.clone().max(a2);
    var result: IntersectionResult[] = [];
    
    a = p1.clone().multiplyScalar(-1);
    b = p2.clone().multiplyScalar(3);
    c = p3.clone().multiplyScalar(-3);
    d = a.clone().add(b.clone().add(c.clone().add(p4)));
    c3 = new Vector2(d.x, d.y);

    a = p1.clone().multiplyScalar(3);
    b = p2.clone().multiplyScalar(-6);
    c = p3.clone().multiplyScalar(3);
    d = a.clone().add(b.clone().add(c));
    c2 = new Vector2(d.x, d.y);

    a = p1.clone().multiplyScalar(-3);
    b = p2.clone().multiplyScalar(3);
    c = a.clone().add(b);
    c1 = new Vector2(c.x, c.y);

    c0 = new Vector2(p1.x, p1.y);
    
    n = new Vector2(a1.y - a2.y, a2.x - a1.x);
    
    cl = a1.x*a2.y - a2.x*a1.y;

    const roots = new Polynomial([
        n.dot(c3),
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl
    ]).getRoots();

    for (var i = 0; i < roots.length; i++) {
        const t = roots[i];

        if (0 <= t && t <= 1) {
            const p5 = p1.clone().lerp(p2, t);
            const p6 = p2.clone().lerp(p3, t);
            const p7 = p3.clone().lerp(p4, t);

            const p8 = p5.clone().lerp(p6, t);
            const p9 = p6.clone().lerp(p7, t);

            const p10 = p8.clone().lerp(p9, t);

            var lineLength = a1.distanceTo(a2);
            var lineT = lineLength != 0 ? (a1.distanceTo(p10) / lineLength) : 0.0;

            if (a1.x == a2.x) {
                if (min.y <= p10.y && p10.y <= max.y) {
                    result.push({
                        t0: t,
                        t1: lineT,
                        point: p10,
                    });
                }
            } else if (a1.y == a2.y) {
                if (min.x <= p10.x && p10.x <= max.x) {
                    result.push({
                        t0: t,
                        t1: lineT,
                        point: p10,
                    });
                }
            } else if (p10.x >= min.x && p10.y >= min.y && p10.x <= max.x && p10.y <= max.y) {
                result.push({
                    t0: t,
                    t1: lineT,
                    point: p10,
                });
            }
        }
    }

    return result;
}

export function intersectCubicBezierWithCubicBezier(
    a1: Vector2, a2: Vector2, a3: Vector2, a4: Vector2,
    b1: Vector2, b2: Vector2, b3: Vector2, b4: Vector2
): IntersectionResult[] {
    let a: Vector2, b: Vector2, c: Vector2, d: Vector2;
    let c13: Vector2, c12: Vector2, c11: Vector2, c10: Vector2;
    let c23: Vector2, c22: Vector2, c21: Vector2, c20: Vector2;
    var result: IntersectionResult[] = [];

    a = a1.clone().multiplyScalar(-1);
    b = a2.clone().multiplyScalar(3);
    c = a3.clone().multiplyScalar(-3);
    d = a.clone().add(b.clone().add(c.clone().add(a4)));
    c13 = new Vector2(d.x, d.y);

    a = a1.clone().multiplyScalar(3);
    b = a2.clone().multiplyScalar(-6);
    c = a3.clone().multiplyScalar(3);
    d = a.clone().add(b.clone().add(c));
    c12 = new Vector2(d.x, d.y);

    a = a1.clone().multiplyScalar(-3);
    b = a2.clone().multiplyScalar(3);
    c = a.clone().add(b);
    c11 = new Vector2(c.x, c.y);

    c10 = new Vector2(a1.x, a1.y);

    a = b1.clone().multiplyScalar(-1);
    b = b2.clone().multiplyScalar(3);
    c = b3.clone().multiplyScalar(-3);
    d = a.clone().add(b.clone().add(c.clone().add(b4)));
    c23 = new Vector2(d.x, d.y);

    a = b1.clone().multiplyScalar(3);
    b = b2.clone().multiplyScalar(-6);
    c = b3.clone().multiplyScalar(3);
    d = a.clone().add(b.clone().add(c));
    c22 = new Vector2(d.x, d.y);

    a = b1.clone().multiplyScalar(-3);
    b = b2.clone().multiplyScalar(3);
    c = a.clone().add(b);
    c21 = new Vector2(c.x, c.y);

    c20 = new Vector2(b1.x, b1.y);

    const c10x2 = c10.x*c10.x;
    const c10x3 = c10.x*c10.x*c10.x;
    const c10y2 = c10.y*c10.y;
    const c10y3 = c10.y*c10.y*c10.y;
    const c11x2 = c11.x*c11.x;
    const c11x3 = c11.x*c11.x*c11.x;
    const c11y2 = c11.y*c11.y;
    const c11y3 = c11.y*c11.y*c11.y;
    const c12x2 = c12.x*c12.x;
    const c12x3 = c12.x*c12.x*c12.x;
    const c12y2 = c12.y*c12.y;
    const c12y3 = c12.y*c12.y*c12.y;
    const c13x2 = c13.x*c13.x;
    const c13x3 = c13.x*c13.x*c13.x;
    const c13y2 = c13.y*c13.y;
    const c13y3 = c13.y*c13.y*c13.y;
    const c20x2 = c20.x*c20.x;
    const c20x3 = c20.x*c20.x*c20.x;
    const c20y2 = c20.y*c20.y;
    const c20y3 = c20.y*c20.y*c20.y;
    const c21x2 = c21.x*c21.x;
    const c21x3 = c21.x*c21.x*c21.x;
    const c21y2 = c21.y*c21.y;
    const c22x2 = c22.x*c22.x;
    const c22x3 = c22.x*c22.x*c22.x;
    const c22y2 = c22.y*c22.y;
    const c23x2 = c23.x*c23.x;
    const c23x3 = c23.x*c23.x*c23.x;
    const c23y2 = c23.y*c23.y;
    const c23y3 = c23.y*c23.y*c23.y;
    const poly = new Polynomial([
        -c13x3*c23y3 + c13y3*c23x3 - 3*c13.x*c13y2*c23x2*c23.y +
            3*c13x2*c13.y*c23.x*c23y2,
        -6*c13.x*c22.x*c13y2*c23.x*c23.y + 6*c13x2*c13.y*c22.y*c23.x*c23.y + 3*c22.x*c13y3*c23x2 -
            3*c13x3*c22.y*c23y2 - 3*c13.x*c13y2*c22.y*c23x2 + 3*c13x2*c22.x*c13.y*c23y2,
        -6*c21.x*c13.x*c13y2*c23.x*c23.y - 6*c13.x*c22.x*c13y2*c22.y*c23.x + 6*c13x2*c22.x*c13.y*c22.y*c23.y +
            3*c21.x*c13y3*c23x2 + 3*c22x2*c13y3*c23.x + 3*c21.x*c13x2*c13.y*c23y2 - 3*c13.x*c21.y*c13y2*c23x2 -
            3*c13.x*c22x2*c13y2*c23.y + c13x2*c13.y*c23.x*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-c21.y*c23y2 -
            2*c22y2*c23.y - c23.y*(2*c21.y*c23.y + c22y2)),
        c11.x*c12.y*c13.x*c13.y*c23.x*c23.y - c11.y*c12.x*c13.x*c13.y*c23.x*c23.y + 6*c21.x*c22.x*c13y3*c23.x +
            3*c11.x*c12.x*c13.x*c13.y*c23y2 + 6*c10.x*c13.x*c13y2*c23.x*c23.y - 3*c11.x*c12.x*c13y2*c23.x*c23.y -
            3*c11.y*c12.y*c13.x*c13.y*c23x2 - 6*c10.y*c13x2*c13.y*c23.x*c23.y - 6*c20.x*c13.x*c13y2*c23.x*c23.y +
            3*c11.y*c12.y*c13x2*c23.x*c23.y - 2*c12.x*c12y2*c13.x*c23.x*c23.y - 6*c21.x*c13.x*c22.x*c13y2*c23.y -
            6*c21.x*c13.x*c13y2*c22.y*c23.x - 6*c13.x*c21.y*c22.x*c13y2*c23.x + 6*c21.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.y*c23.x*c23.y + c22x3*c13y3 - 3*c10.x*c13y3*c23x2 + 3*c10.y*c13x3*c23y2 +
            3*c20.x*c13y3*c23x2 + c12y3*c13.x*c23x2 - c12x3*c13.y*c23y2 - 3*c10.x*c13x2*c13.y*c23y2 +
            3*c10.y*c13.x*c13y2*c23x2 - 2*c11.x*c12.y*c13x2*c23y2 + c11.x*c12.y*c13y2*c23x2 - c11.y*c12.x*c13x2*c23y2 +
            2*c11.y*c12.x*c13y2*c23x2 + 3*c20.x*c13x2*c13.y*c23y2 - c12.x*c12y2*c13.y*c23x2 -
            3*c20.y*c13.x*c13y2*c23x2 + c12x2*c12.y*c13.x*c23y2 - 3*c13.x*c22x2*c13y2*c22.y +
            c13x2*c13.y*c23.x*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c22.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c21.y*c22.y*c23.y - c20.y*c23y2 - c22.y*(2*c21.y*c23.y + c22y2) - c23.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        6*c11.x*c12.x*c13.x*c13.y*c22.y*c23.y + c11.x*c12.y*c13.x*c22.x*c13.y*c23.y + c11.x*c12.y*c13.x*c13.y*c22.y*c23.x -
            c11.y*c12.x*c13.x*c22.x*c13.y*c23.y - c11.y*c12.x*c13.x*c13.y*c22.y*c23.x - 6*c11.y*c12.y*c13.x*c22.x*c13.y*c23.x -
            6*c10.x*c22.x*c13y3*c23.x + 6*c20.x*c22.x*c13y3*c23.x + 6*c10.y*c13x3*c22.y*c23.y + 2*c12y3*c13.x*c22.x*c23.x -
            2*c12x3*c13.y*c22.y*c23.y + 6*c10.x*c13.x*c22.x*c13y2*c23.y + 6*c10.x*c13.x*c13y2*c22.y*c23.x +
            6*c10.y*c13.x*c22.x*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c23.y - 3*c11.x*c12.x*c13y2*c22.y*c23.x +
            2*c11.x*c12.y*c22.x*c13y2*c23.x + 4*c11.y*c12.x*c22.x*c13y2*c23.x - 6*c10.x*c13x2*c13.y*c22.y*c23.y -
            6*c10.y*c13x2*c22.x*c13.y*c23.y - 6*c10.y*c13x2*c13.y*c22.y*c23.x - 4*c11.x*c12.y*c13x2*c22.y*c23.y -
            6*c20.x*c13.x*c22.x*c13y2*c23.y - 6*c20.x*c13.x*c13y2*c22.y*c23.x - 2*c11.y*c12.x*c13x2*c22.y*c23.y +
            3*c11.y*c12.y*c13x2*c22.x*c23.y + 3*c11.y*c12.y*c13x2*c22.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c23.y -
            2*c12.x*c12y2*c13.x*c22.y*c23.x - 2*c12.x*c12y2*c22.x*c13.y*c23.x - 6*c20.y*c13.x*c22.x*c13y2*c23.x -
            6*c21.x*c13.x*c21.y*c13y2*c23.x - 6*c21.x*c13.x*c22.x*c13y2*c22.y + 6*c20.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.x*c22.y*c23.y + 2*c12x2*c12.y*c22.x*c13.y*c23.y + 2*c12x2*c12.y*c13.y*c22.y*c23.x +
            3*c21.x*c22x2*c13y3 + 3*c21x2*c13y3*c23.x - 3*c13.x*c21.y*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c23.y +
            c13x2*c22.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c13.y*c23.x*(6*c20.y*c22.y + 3*c21y2) +
            c21.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-2*c20.y*c22.y*c23.y - c23.y*(2*c20.y*c22.y + c21y2) -
            c21.y*(2*c21.y*c23.y + c22y2) - c22.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        c11.x*c21.x*c12.y*c13.x*c13.y*c23.y + c11.x*c12.y*c13.x*c21.y*c13.y*c23.x + c11.x*c12.y*c13.x*c22.x*c13.y*c22.y -
            c11.y*c12.x*c21.x*c13.x*c13.y*c23.y - c11.y*c12.x*c13.x*c21.y*c13.y*c23.x - c11.y*c12.x*c13.x*c22.x*c13.y*c22.y -
            6*c11.y*c21.x*c12.y*c13.x*c13.y*c23.x - 6*c10.x*c21.x*c13y3*c23.x + 6*c20.x*c21.x*c13y3*c23.x +
            2*c21.x*c12y3*c13.x*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c23.y + 6*c10.x*c13.x*c21.y*c13y2*c23.x +
            6*c10.x*c13.x*c22.x*c13y2*c22.y + 6*c10.y*c21.x*c13.x*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c23.y -
            3*c11.x*c12.x*c21.y*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c22.y + 2*c11.x*c21.x*c12.y*c13y2*c23.x +
            4*c11.y*c12.x*c21.x*c13y2*c23.x - 6*c10.y*c21.x*c13x2*c13.y*c23.y - 6*c10.y*c13x2*c21.y*c13.y*c23.x -
            6*c10.y*c13x2*c22.x*c13.y*c22.y - 6*c20.x*c21.x*c13.x*c13y2*c23.y - 6*c20.x*c13.x*c21.y*c13y2*c23.x -
            6*c20.x*c13.x*c22.x*c13y2*c22.y + 3*c11.y*c21.x*c12.y*c13x2*c23.y - 3*c11.y*c12.y*c13.x*c22x2*c13.y +
            3*c11.y*c12.y*c13x2*c21.y*c23.x + 3*c11.y*c12.y*c13x2*c22.x*c22.y - 2*c12.x*c21.x*c12y2*c13.x*c23.y -
            2*c12.x*c21.x*c12y2*c13.y*c23.x - 2*c12.x*c12y2*c13.x*c21.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c22.y -
            6*c20.y*c21.x*c13.x*c13y2*c23.x - 6*c21.x*c13.x*c21.y*c22.x*c13y2 + 6*c20.y*c13x2*c21.y*c13.y*c23.x +
            2*c12x2*c21.x*c12.y*c13.y*c23.y + 2*c12x2*c12.y*c21.y*c13.y*c23.x + 2*c12x2*c12.y*c22.x*c13.y*c22.y -
            3*c10.x*c22x2*c13y3 + 3*c20.x*c22x2*c13y3 + 3*c21x2*c22.x*c13y3 + c12y3*c13.x*c22x2 +
            3*c10.y*c13.x*c22x2*c13y2 + c11.x*c12.y*c22x2*c13y2 + 2*c11.y*c12.x*c22x2*c13y2 -
            c12.x*c12y2*c22x2*c13.y - 3*c20.y*c13.x*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c22.y +
            c12x2*c12.y*c13.x*(2*c21.y*c23.y + c22y2) + c11.x*c12.x*c13.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c21.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c21.y*c23.y - c22y2) +
            c10.y*c13x3*(6*c21.y*c23.y + 3*c22y2) + c11.y*c12.x*c13x2*(-2*c21.y*c23.y - c22y2) +
            c11.x*c12.y*c13x2*(-4*c21.y*c23.y - 2*c22y2) + c10.x*c13x2*c13.y*(-6*c21.y*c23.y - 3*c22y2) +
            c13x2*c22.x*c13.y*(6*c20.y*c22.y + 3*c21y2) + c20.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c20.y*c21.y*c23.y - c22.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c21.y*c23.y + c22y2) -
            c21.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c23.y + c10.x*c11.y*c12.x*c13.x*c13.y*c23.y + 6*c10.x*c11.y*c12.y*c13.x*c13.y*c23.x -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c23.y - c10.y*c11.x*c12.y*c13.x*c13.y*c23.x + c10.y*c11.y*c12.x*c13.x*c13.y*c23.x +
            c11.x*c11.y*c12.x*c12.y*c13.x*c23.y - c11.x*c11.y*c12.x*c12.y*c13.y*c23.x + c11.x*c20.x*c12.y*c13.x*c13.y*c23.y +
            c11.x*c20.y*c12.y*c13.x*c13.y*c23.x + c11.x*c21.x*c12.y*c13.x*c13.y*c22.y + c11.x*c12.y*c13.x*c21.y*c22.x*c13.y -
            c20.x*c11.y*c12.x*c13.x*c13.y*c23.y - 6*c20.x*c11.y*c12.y*c13.x*c13.y*c23.x - c11.y*c12.x*c20.y*c13.x*c13.y*c23.x -
            c11.y*c12.x*c21.x*c13.x*c13.y*c22.y - c11.y*c12.x*c13.x*c21.y*c22.x*c13.y - 6*c11.y*c21.x*c12.y*c13.x*c22.x*c13.y -
            6*c10.x*c20.x*c13y3*c23.x - 6*c10.x*c21.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c23.x + 6*c20.x*c21.x*c22.x*c13y3 +
            2*c20.x*c12y3*c13.x*c23.x + 2*c21.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c23.y - 6*c10.x*c10.y*c13.x*c13y2*c23.x +
            3*c10.x*c11.x*c12.x*c13y2*c23.y - 2*c10.x*c11.x*c12.y*c13y2*c23.x - 4*c10.x*c11.y*c12.x*c13y2*c23.x +
            3*c10.y*c11.x*c12.x*c13y2*c23.x + 6*c10.x*c10.y*c13x2*c13.y*c23.y + 6*c10.x*c20.x*c13.x*c13y2*c23.y -
            3*c10.x*c11.y*c12.y*c13x2*c23.y + 2*c10.x*c12.x*c12y2*c13.x*c23.y + 2*c10.x*c12.x*c12y2*c13.y*c23.x +
            6*c10.x*c20.y*c13.x*c13y2*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c22.y + 6*c10.x*c13.x*c21.y*c22.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c23.y + 6*c10.y*c20.x*c13.x*c13y2*c23.x + 2*c10.y*c11.y*c12.x*c13x2*c23.y -
            3*c10.y*c11.y*c12.y*c13x2*c23.x + 2*c10.y*c12.x*c12y2*c13.x*c23.x + 6*c10.y*c21.x*c13.x*c22.x*c13y2 -
            3*c11.x*c20.x*c12.x*c13y2*c23.y + 2*c11.x*c20.x*c12.y*c13y2*c23.x + c11.x*c11.y*c12y2*c13.x*c23.x -
            3*c11.x*c12.x*c20.y*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c22.y - 3*c11.x*c12.x*c21.y*c22.x*c13y2 +
            2*c11.x*c21.x*c12.y*c22.x*c13y2 + 4*c20.x*c11.y*c12.x*c13y2*c23.x + 4*c11.y*c12.x*c21.x*c22.x*c13y2 -
            2*c10.x*c12x2*c12.y*c13.y*c23.y - 6*c10.y*c20.x*c13x2*c13.y*c23.y - 6*c10.y*c20.y*c13x2*c13.y*c23.x -
            6*c10.y*c21.x*c13x2*c13.y*c22.y - 2*c10.y*c12x2*c12.y*c13.x*c23.y - 2*c10.y*c12x2*c12.y*c13.y*c23.x -
            6*c10.y*c13x2*c21.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c23.y - 2*c11.x*c11y2*c13.x*c13.y*c23.x +
            3*c20.x*c11.y*c12.y*c13x2*c23.y - 2*c20.x*c12.x*c12y2*c13.x*c23.y - 2*c20.x*c12.x*c12y2*c13.y*c23.x -
            6*c20.x*c20.y*c13.x*c13y2*c23.x - 6*c20.x*c21.x*c13.x*c13y2*c22.y - 6*c20.x*c13.x*c21.y*c22.x*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c23.x + 3*c11.y*c21.x*c12.y*c13x2*c22.y + 3*c11.y*c12.y*c13x2*c21.y*c22.x -
            2*c12.x*c20.y*c12y2*c13.x*c23.x - 2*c12.x*c21.x*c12y2*c13.x*c22.y - 2*c12.x*c21.x*c12y2*c22.x*c13.y -
            2*c12.x*c12y2*c13.x*c21.y*c22.x - 6*c20.y*c21.x*c13.x*c22.x*c13y2 - c11y2*c12.x*c12.y*c13.x*c23.x +
            2*c20.x*c12x2*c12.y*c13.y*c23.y + 6*c20.y*c13x2*c21.y*c22.x*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c23.y +
            c11x2*c12.x*c12.y*c13.y*c23.y + 2*c12x2*c20.y*c12.y*c13.y*c23.x + 2*c12x2*c21.x*c12.y*c13.y*c22.y +
            2*c12x2*c12.y*c21.y*c22.x*c13.y + c21x3*c13y3 + 3*c10x2*c13y3*c23.x - 3*c10y2*c13x3*c23.y +
            3*c20x2*c13y3*c23.x + c11y3*c13x2*c23.x - c11x3*c13y2*c23.y - c11.x*c11y2*c13x2*c23.y +
            c11x2*c11.y*c13y2*c23.x - 3*c10x2*c13.x*c13y2*c23.y + 3*c10y2*c13x2*c13.y*c23.x - c11x2*c12y2*c13.x*c23.y +
            c11y2*c12x2*c13.y*c23.x - 3*c21x2*c13.x*c21.y*c13y2 - 3*c20x2*c13.x*c13y2*c23.y + 3*c20y2*c13x2*c13.y*c23.x +
            c11.x*c12.x*c13.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c10.y*c13x3*(6*c20.y*c23.y + 6*c21.y*c22.y) + c11.y*c12.x*c13x2*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c12x2*c12.y*c13.x*(2*c20.y*c23.y + 2*c21.y*c22.y) + c11.x*c12.y*c13x2*(-4*c20.y*c23.y - 4*c21.y*c22.y) +
            c10.x*c13x2*c13.y*(-6*c20.y*c23.y - 6*c21.y*c22.y) + c20.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) +
            c21.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) + c13x3*(-2*c20.y*c21.y*c22.y - c20y2*c23.y -
            c21.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c22.y + c10.x*c11.y*c12.x*c13.x*c13.y*c22.y + 6*c10.x*c11.y*c12.y*c13.x*c22.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c22.y - c10.y*c11.x*c12.y*c13.x*c22.x*c13.y + c10.y*c11.y*c12.x*c13.x*c22.x*c13.y +
            c11.x*c11.y*c12.x*c12.y*c13.x*c22.y - c11.x*c11.y*c12.x*c12.y*c22.x*c13.y + c11.x*c20.x*c12.y*c13.x*c13.y*c22.y +
            c11.x*c20.y*c12.y*c13.x*c22.x*c13.y + c11.x*c21.x*c12.y*c13.x*c21.y*c13.y - c20.x*c11.y*c12.x*c13.x*c13.y*c22.y -
            6*c20.x*c11.y*c12.y*c13.x*c22.x*c13.y - c11.y*c12.x*c20.y*c13.x*c22.x*c13.y - c11.y*c12.x*c21.x*c13.x*c21.y*c13.y -
            6*c10.x*c20.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c22.x + 2*c20.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c22.y -
            6*c10.x*c10.y*c13.x*c22.x*c13y2 + 3*c10.x*c11.x*c12.x*c13y2*c22.y - 2*c10.x*c11.x*c12.y*c22.x*c13y2 -
            4*c10.x*c11.y*c12.x*c22.x*c13y2 + 3*c10.y*c11.x*c12.x*c22.x*c13y2 + 6*c10.x*c10.y*c13x2*c13.y*c22.y +
            6*c10.x*c20.x*c13.x*c13y2*c22.y - 3*c10.x*c11.y*c12.y*c13x2*c22.y + 2*c10.x*c12.x*c12y2*c13.x*c22.y +
            2*c10.x*c12.x*c12y2*c22.x*c13.y + 6*c10.x*c20.y*c13.x*c22.x*c13y2 + 6*c10.x*c21.x*c13.x*c21.y*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c22.y + 6*c10.y*c20.x*c13.x*c22.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c22.y -
            3*c10.y*c11.y*c12.y*c13x2*c22.x + 2*c10.y*c12.x*c12y2*c13.x*c22.x - 3*c11.x*c20.x*c12.x*c13y2*c22.y +
            2*c11.x*c20.x*c12.y*c22.x*c13y2 + c11.x*c11.y*c12y2*c13.x*c22.x - 3*c11.x*c12.x*c20.y*c22.x*c13y2 -
            3*c11.x*c12.x*c21.x*c21.y*c13y2 + 4*c20.x*c11.y*c12.x*c22.x*c13y2 - 2*c10.x*c12x2*c12.y*c13.y*c22.y -
            6*c10.y*c20.x*c13x2*c13.y*c22.y - 6*c10.y*c20.y*c13x2*c22.x*c13.y - 6*c10.y*c21.x*c13x2*c21.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c22.y - 2*c10.y*c12x2*c12.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c22.y -
            2*c11.x*c11y2*c13.x*c22.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c22.y - 2*c20.x*c12.x*c12y2*c13.x*c22.y -
            2*c20.x*c12.x*c12y2*c22.x*c13.y - 6*c20.x*c20.y*c13.x*c22.x*c13y2 - 6*c20.x*c21.x*c13.x*c21.y*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c22.x + 3*c11.y*c21.x*c12.y*c13x2*c21.y - 2*c12.x*c20.y*c12y2*c13.x*c22.x -
            2*c12.x*c21.x*c12y2*c13.x*c21.y - c11y2*c12.x*c12.y*c13.x*c22.x + 2*c20.x*c12x2*c12.y*c13.y*c22.y -
            3*c11.y*c21x2*c12.y*c13.x*c13.y + 6*c20.y*c21.x*c13x2*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c22.y +
            c11x2*c12.x*c12.y*c13.y*c22.y + 2*c12x2*c20.y*c12.y*c22.x*c13.y + 2*c12x2*c21.x*c12.y*c21.y*c13.y -
            3*c10.x*c21x2*c13y3 + 3*c20.x*c21x2*c13y3 + 3*c10x2*c22.x*c13y3 - 3*c10y2*c13x3*c22.y + 3*c20x2*c22.x*c13y3 +
            c21x2*c12y3*c13.x + c11y3*c13x2*c22.x - c11x3*c13y2*c22.y + 3*c10.y*c21x2*c13.x*c13y2 -
            c11.x*c11y2*c13x2*c22.y + c11.x*c21x2*c12.y*c13y2 + 2*c11.y*c12.x*c21x2*c13y2 + c11x2*c11.y*c22.x*c13y2 -
            c12.x*c21x2*c12y2*c13.y - 3*c20.y*c21x2*c13.x*c13y2 - 3*c10x2*c13.x*c13y2*c22.y + 3*c10y2*c13x2*c22.x*c13.y -
            c11x2*c12y2*c13.x*c22.y + c11y2*c12x2*c22.x*c13.y - 3*c20x2*c13.x*c13y2*c22.y + 3*c20y2*c13x2*c22.x*c13.y +
            c12x2*c12.y*c13.x*(2*c20.y*c22.y + c21y2) + c11.x*c12.x*c13.x*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c12x3*c13.y*(-2*c20.y*c22.y - c21y2) + c10.y*c13x3*(6*c20.y*c22.y + 3*c21y2) +
            c11.y*c12.x*c13x2*(-2*c20.y*c22.y - c21y2) + c11.x*c12.y*c13x2*(-4*c20.y*c22.y - 2*c21y2) +
            c10.x*c13x2*c13.y*(-6*c20.y*c22.y - 3*c21y2) + c20.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c13x3*(-2*c20.y*c21y2 - c20y2*c22.y - c20.y*(2*c20.y*c22.y + c21y2)),
        -c10.x*c11.x*c12.y*c13.x*c21.y*c13.y + c10.x*c11.y*c12.x*c13.x*c21.y*c13.y + 6*c10.x*c11.y*c21.x*c12.y*c13.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c21.y*c13.y - c10.y*c11.x*c21.x*c12.y*c13.x*c13.y + c10.y*c11.y*c12.x*c21.x*c13.x*c13.y -
            c11.x*c11.y*c12.x*c21.x*c12.y*c13.y + c11.x*c11.y*c12.x*c12.y*c13.x*c21.y + c11.x*c20.x*c12.y*c13.x*c21.y*c13.y +
            6*c11.x*c12.x*c20.y*c13.x*c21.y*c13.y + c11.x*c20.y*c21.x*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c13.x*c21.y*c13.y -
            6*c20.x*c11.y*c21.x*c12.y*c13.x*c13.y - c11.y*c12.x*c20.y*c21.x*c13.x*c13.y - 6*c10.x*c20.x*c21.x*c13y3 -
            2*c10.x*c21.x*c12y3*c13.x + 6*c10.y*c20.y*c13x3*c21.y + 2*c20.x*c21.x*c12y3*c13.x + 2*c10.y*c12x3*c21.y*c13.y -
            2*c12x3*c20.y*c21.y*c13.y - 6*c10.x*c10.y*c21.x*c13.x*c13y2 + 3*c10.x*c11.x*c12.x*c21.y*c13y2 -
            2*c10.x*c11.x*c21.x*c12.y*c13y2 - 4*c10.x*c11.y*c12.x*c21.x*c13y2 + 3*c10.y*c11.x*c12.x*c21.x*c13y2 +
            6*c10.x*c10.y*c13x2*c21.y*c13.y + 6*c10.x*c20.x*c13.x*c21.y*c13y2 - 3*c10.x*c11.y*c12.y*c13x2*c21.y +
            2*c10.x*c12.x*c21.x*c12y2*c13.y + 2*c10.x*c12.x*c12y2*c13.x*c21.y + 6*c10.x*c20.y*c21.x*c13.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c21.y + 6*c10.y*c20.x*c21.x*c13.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c21.y -
            3*c10.y*c11.y*c21.x*c12.y*c13x2 + 2*c10.y*c12.x*c21.x*c12y2*c13.x - 3*c11.x*c20.x*c12.x*c21.y*c13y2 +
            2*c11.x*c20.x*c21.x*c12.y*c13y2 + c11.x*c11.y*c21.x*c12y2*c13.x - 3*c11.x*c12.x*c20.y*c21.x*c13y2 +
            4*c20.x*c11.y*c12.x*c21.x*c13y2 - 6*c10.x*c20.y*c13x2*c21.y*c13.y - 2*c10.x*c12x2*c12.y*c21.y*c13.y -
            6*c10.y*c20.x*c13x2*c21.y*c13.y - 6*c10.y*c20.y*c21.x*c13x2*c13.y - 2*c10.y*c12x2*c21.x*c12.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c21.y - c11.x*c11.y*c12x2*c21.y*c13.y - 4*c11.x*c20.y*c12.y*c13x2*c21.y -
            2*c11.x*c11y2*c21.x*c13.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c21.y - 2*c20.x*c12.x*c21.x*c12y2*c13.y -
            2*c20.x*c12.x*c12y2*c13.x*c21.y - 6*c20.x*c20.y*c21.x*c13.x*c13y2 - 2*c11.y*c12.x*c20.y*c13x2*c21.y +
            3*c11.y*c20.y*c21.x*c12.y*c13x2 - 2*c12.x*c20.y*c21.x*c12y2*c13.x - c11y2*c12.x*c21.x*c12.y*c13.x +
            6*c20.x*c20.y*c13x2*c21.y*c13.y + 2*c20.x*c12x2*c12.y*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c21.y*c13.y +
            c11x2*c12.x*c12.y*c21.y*c13.y + 2*c12x2*c20.y*c21.x*c12.y*c13.y + 2*c12x2*c20.y*c12.y*c13.x*c21.y +
            3*c10x2*c21.x*c13y3 - 3*c10y2*c13x3*c21.y + 3*c20x2*c21.x*c13y3 + c11y3*c21.x*c13x2 - c11x3*c21.y*c13y2 -
            3*c20y2*c13x3*c21.y - c11.x*c11y2*c13x2*c21.y + c11x2*c11.y*c21.x*c13y2 - 3*c10x2*c13.x*c21.y*c13y2 +
            3*c10y2*c21.x*c13x2*c13.y - c11x2*c12y2*c13.x*c21.y + c11y2*c12x2*c21.x*c13.y - 3*c20x2*c13.x*c21.y*c13y2 +
            3*c20y2*c21.x*c13x2*c13.y,
        c10.x*c10.y*c11.x*c12.y*c13.x*c13.y - c10.x*c10.y*c11.y*c12.x*c13.x*c13.y + c10.x*c11.x*c11.y*c12.x*c12.y*c13.y -
            c10.y*c11.x*c11.y*c12.x*c12.y*c13.x - c10.x*c11.x*c20.y*c12.y*c13.x*c13.y + 6*c10.x*c20.x*c11.y*c12.y*c13.x*c13.y +
            c10.x*c11.y*c12.x*c20.y*c13.x*c13.y - c10.y*c11.x*c20.x*c12.y*c13.x*c13.y - 6*c10.y*c11.x*c12.x*c20.y*c13.x*c13.y +
            c10.y*c20.x*c11.y*c12.x*c13.x*c13.y - c11.x*c20.x*c11.y*c12.x*c12.y*c13.y + c11.x*c11.y*c12.x*c20.y*c12.y*c13.x +
            c11.x*c20.x*c20.y*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c20.y*c13.x*c13.y - 2*c10.x*c20.x*c12y3*c13.x +
            2*c10.y*c12x3*c20.y*c13.y - 3*c10.x*c10.y*c11.x*c12.x*c13y2 - 6*c10.x*c10.y*c20.x*c13.x*c13y2 +
            3*c10.x*c10.y*c11.y*c12.y*c13x2 - 2*c10.x*c10.y*c12.x*c12y2*c13.x - 2*c10.x*c11.x*c20.x*c12.y*c13y2 -
            c10.x*c11.x*c11.y*c12y2*c13.x + 3*c10.x*c11.x*c12.x*c20.y*c13y2 - 4*c10.x*c20.x*c11.y*c12.x*c13y2 +
            3*c10.y*c11.x*c20.x*c12.x*c13y2 + 6*c10.x*c10.y*c20.y*c13x2*c13.y + 2*c10.x*c10.y*c12x2*c12.y*c13.y +
            2*c10.x*c11.x*c11y2*c13.x*c13.y + 2*c10.x*c20.x*c12.x*c12y2*c13.y + 6*c10.x*c20.x*c20.y*c13.x*c13y2 -
            3*c10.x*c11.y*c20.y*c12.y*c13x2 + 2*c10.x*c12.x*c20.y*c12y2*c13.x + c10.x*c11y2*c12.x*c12.y*c13.x +
            c10.y*c11.x*c11.y*c12x2*c13.y + 4*c10.y*c11.x*c20.y*c12.y*c13x2 - 3*c10.y*c20.x*c11.y*c12.y*c13x2 +
            2*c10.y*c20.x*c12.x*c12y2*c13.x + 2*c10.y*c11.y*c12.x*c20.y*c13x2 + c11.x*c20.x*c11.y*c12y2*c13.x -
            3*c11.x*c20.x*c12.x*c20.y*c13y2 - 2*c10.x*c12x2*c20.y*c12.y*c13.y - 6*c10.y*c20.x*c20.y*c13x2*c13.y -
            2*c10.y*c20.x*c12x2*c12.y*c13.y - 2*c10.y*c11x2*c11.y*c13.x*c13.y - c10.y*c11x2*c12.x*c12.y*c13.y -
            2*c10.y*c12x2*c20.y*c12.y*c13.x - 2*c11.x*c20.x*c11y2*c13.x*c13.y - c11.x*c11.y*c12x2*c20.y*c13.y +
            3*c20.x*c11.y*c20.y*c12.y*c13x2 - 2*c20.x*c12.x*c20.y*c12y2*c13.x - c20.x*c11y2*c12.x*c12.y*c13.x +
            3*c10y2*c11.x*c12.x*c13.x*c13.y + 3*c11.x*c12.x*c20y2*c13.x*c13.y + 2*c20.x*c12x2*c20.y*c12.y*c13.y -
            3*c10x2*c11.y*c12.y*c13.x*c13.y + 2*c11x2*c11.y*c20.y*c13.x*c13.y + c11x2*c12.x*c20.y*c12.y*c13.y -
            3*c20x2*c11.y*c12.y*c13.x*c13.y - c10x3*c13y3 + c10y3*c13x3 + c20x3*c13y3 - c20y3*c13x3 -
            3*c10.x*c20x2*c13y3 - c10.x*c11y3*c13x2 + 3*c10x2*c20.x*c13y3 + c10.y*c11x3*c13y2 +
            3*c10.y*c20y2*c13x3 + c20.x*c11y3*c13x2 + c10x2*c12y3*c13.x - 3*c10y2*c20.y*c13x3 - c10y2*c12x3*c13.y +
            c20x2*c12y3*c13.x - c11x3*c20.y*c13y2 - c12x3*c20y2*c13.y - c10.x*c11x2*c11.y*c13y2 +
            c10.y*c11.x*c11y2*c13x2 - 3*c10.x*c10y2*c13x2*c13.y - c10.x*c11y2*c12x2*c13.y + c10.y*c11x2*c12y2*c13.x -
            c11.x*c11y2*c20.y*c13x2 + 3*c10x2*c10.y*c13.x*c13y2 + c10x2*c11.x*c12.y*c13y2 +
            2*c10x2*c11.y*c12.x*c13y2 - 2*c10y2*c11.x*c12.y*c13x2 - c10y2*c11.y*c12.x*c13x2 + c11x2*c20.x*c11.y*c13y2 -
            3*c10.x*c20y2*c13x2*c13.y + 3*c10.y*c20x2*c13.x*c13y2 + c11.x*c20x2*c12.y*c13y2 - 2*c11.x*c20y2*c12.y*c13x2 +
            c20.x*c11y2*c12x2*c13.y - c11.y*c12.x*c20y2*c13x2 - c10x2*c12.x*c12y2*c13.y - 3*c10x2*c20.y*c13.x*c13y2 +
            3*c10y2*c20.x*c13x2*c13.y + c10y2*c12x2*c12.y*c13.x - c11x2*c20.y*c12y2*c13.x + 2*c20x2*c11.y*c12.x*c13y2 +
            3*c20.x*c20y2*c13x2*c13.y - c20x2*c12.x*c12y2*c13.y - 3*c20x2*c20.y*c13.x*c13y2 + c12x2*c20y2*c12.y*c13.x
    ]);
    const roots = poly.getRootsInInterval(0, 1);

    for (let i = 0; i < roots.length; i++) {
        const s = roots[i];
        const xRoots = new Polynomial([
            c13.x,
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ]).getRoots();
        const yRoots = new Polynomial([
            c13.y,
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ]).getRoots();

        if (xRoots.length > 0 && yRoots.length > 0) {
            const TOLERANCE = 1e-4;

            checkRoots:
            for (let j = 0; j < xRoots.length; j++) {
                const xRoot = xRoots[j];
                
                if (0 <= xRoot && xRoot <= 1) {
                    for (let k = 0; k < yRoots.length; k++) {
                        if (Math.abs( xRoot - yRoots[k] ) < TOLERANCE) {
                            result.push({
                                t0: xRoot,
                                t1: s,
                                point: c23.clone().multiplyScalar(s*s*s).add(c22.clone().multiplyScalar(s*s).add(c21.clone().multiplyScalar(s).add(c20))),
                            });
                            break checkRoots;
                        }
                    }
                }
            }
        }
    }

    return result;
}

export function findCubicBezierSelfIntersections(
    p0: Vector2,
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
): Vector2[] {
    const segments: Vector2[] = [];
    const length = cubicBezierLength(p0, p1, p2, p3);
    let intersectionCheckLength = 0.0;
    const resolution = Math.min(PATH_SEGMENTATION_MAX, Math.max(PATH_SEGMENTATION_MIN, Math.floor(length / PATH_SEGMENTATION_SEGMENT_SIZE)));
    let previousSegment = p0;
    for (let i = 0; i < resolution + 1; i++) {
        var newSegment = cubicBezierAt(p0, p1, p2, p3, i / resolution);
        intersectionCheckLength += previousSegment.distanceTo(newSegment);
        segments.push(newSegment);
        previousSegment = newSegment;
    }
    
    const selfIntersections: Vector2[] = [];
    const selfSegmentRange = segments.length - 1;
    for (let i = 0; i < selfSegmentRange; i++) {
        var a0 = segments[i];
        var a1 = segments[i + 1];
        for (let j = i + 1; j < selfSegmentRange; j++) {
            var b0 = segments[j];
            var b1 = segments[j + 1];
            const [intersection] = intersectSegmentWithSegment(a0, a1, b0, b1);
            if (intersection && !isEqualApprox(intersection.point, a0) && !isEqualApprox(intersection.point, b0)) {
                selfIntersections.push(intersection.point);
            }
        }
    }
    return selfIntersections
}

function reverseIntersectionT(intersections: IntersectionResult[]): IntersectionResult[] {
    for (const intersection of intersections) {
        const t0 = intersection.t0;
        intersection.t0 = intersection.t1;
        intersection.t1 = t0;
    }
    return intersections;
}

export function findPolynomialIntersections(
    a: Vector2[],
    b: Vector2[],
): IntersectionResult[] {
    if (a.length === 2 && b.length === 2) {
        return intersectSegmentWithSegment(a[0], a[1], b[0], b[1]);
    } else if (a.length === 2 && b.length === 3) {
        return reverseIntersectionT(
            intersectQuadraticBezierWithSegment(b[0], b[1], b[2], a[0], a[1])
        );
    } else if (a.length === 2 && b.length === 4) {
        return reverseIntersectionT(
            intersectCubicBezierWithSegment(b[0], b[1], b[2], b[3], a[0], a[1])
        );
    } else if (a.length === 3 && b.length === 2) {
        return intersectQuadraticBezierWithSegment(a[0], a[1], a[2], b[0], b[1]);
    } else if (a.length === 3 && b.length === 3) {
        return intersectQuadraticBezierWithQuadraticBezier(a[0], a[1], a[2], b[0], b[1], b[2]);
    } else if (a.length === 3 && b.length === 4) {
        return intersectQuadraticBezierWithCubicBezier(a[0], a[1], a[2], b[0], b[1], b[2], b[3]);
    } else if (a.length === 4 && b.length === 2) {
        return intersectCubicBezierWithSegment(a[0], a[1], a[2], a[3], b[0], b[1]);
    } else if (a.length === 4 && b.length === 3) {
        return reverseIntersectionT(
            intersectQuadraticBezierWithCubicBezier(b[0], b[1], b[2], a[0], a[1], a[2], a[3])
        );
    } else if (a.length === 4 && b.length === 4) {
        return intersectCubicBezierWithCubicBezier(a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3]);
    }
    return [];
}
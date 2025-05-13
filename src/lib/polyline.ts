/**
 * Parts of this file were adapted from simplify.js
 * @copyright (c) 2017, Vladimir Agafonkin
 * @license BSD-2-Clause https://github.com/mourner/simplify-js/blob/master/LICENSE
 */


/*

 (c) 2017, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/


export interface BrushStrokePoint {
    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    rendered?: boolean;
}

// square distance between 2 points
function getSquareDistance(p1: BrushStrokePoint, p2: BrushStrokePoint) {

    var dx = p1.x - p2.x,
        dy = p1.y - p2.y;

    return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getPointSegmentSquareDistance(p: BrushStrokePoint, p1: BrushStrokePoint, p2: BrushStrokePoint) {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
        let t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2.x;
            y = p2.y;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
}

// basic distance-based simplification
function simplifyRadialDist(points: BrushStrokePoint[], toleranceSquared: number): BrushStrokePoint[] {

    let prevPoint: BrushStrokePoint = points[0];
    let newPoints: BrushStrokePoint[] = [prevPoint];
    let point: BrushStrokePoint | undefined;

    for (var i = 1, length = points.length; i < length; i++) {
        point = points[i];

        if (getSquareDistance(point, prevPoint) > toleranceSquared) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (prevPoint !== point && point) newPoints.push(point);

    return newPoints;
}

function simplifyDPStep(points: BrushStrokePoint[], first: number, last: number, toleranceSquared: number, simplified: BrushStrokePoint[]) {
    let maxDistanceSquared: number = toleranceSquared;
    let index: number = 0;

    for (let i = first + 1; i < last; i++) {
        let distanceSquared = getPointSegmentSquareDistance(points[i], points[first], points[last]);

        if (distanceSquared > maxDistanceSquared) {
            index = i;
            maxDistanceSquared = distanceSquared;
        }
    }

    if (maxDistanceSquared > toleranceSquared) {
        if (index - first > 1) simplifyDPStep(points, first, index, toleranceSquared, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, toleranceSquared, simplified);
    }
}


// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points: BrushStrokePoint[], toleranceSquared: number) {
    var last: number = points.length - 1;

    const simplified: BrushStrokePoint[] = [points[0]];
    simplifyDPStep(points, 0, last, toleranceSquared, simplified);
    simplified.push(points[last]);

    return simplified;
}

export function simplifyPolyline(points: BrushStrokePoint[], tolerance: number): BrushStrokePoint[] {
    if (points.length <= 2) return points;

    const toleranceSquared = tolerance !== undefined ? tolerance * tolerance : 1;

    points = simplifyRadialDist(points, toleranceSquared);
    points = simplifyDouglasPeucker(points, toleranceSquared);

    return points;
}

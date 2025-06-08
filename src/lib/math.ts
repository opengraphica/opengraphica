
// Linear interpolation
export function lerp(value1: number, value2: number, amount: number) {
    return (1 - amount) * value1 + amount * value2;
}

// Finds the distance between two points
export function pointDistance2d(x1: number, y1: number, x2: number, y2: number) {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
}

// Finds the angle between the line segment defined by two points and the x axis. range is (-PI, PI], where positive values are clockwise.
export function clockwiseAngle2d(cx: number, cy: number, ex: number, ey: number) {
    var dy = ey - cy;
    var dx = ex - cx;
    return Math.atan2(dy, dx);
}

// Rotates a directional vector by the given angle in radians.
export function rotateDirectionVector2d(x: number, y: number, angle: number) {
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);
    return {
        x: x * cosAngle - y * sinAngle,
        y: x * sinAngle + y * cosAngle
    };
}

// For the given two points, returns a directional vector from the first to the 2nd point, normalized to a length of 1.
export function normalizedDirectionVector2d(x1: number, y1: number, x2: number, y2: number) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const normalizedX = deltaX / magnitude;
    const normalizedY = deltaY / magnitude;
    return { x: normalizedX, y: normalizedY };
}

// For the two lines defined by having points on them (x1, y1, x2, y2) and (x3, y3, x4, y4), return the point where the lines intersect.
export function lineIntersectsLine2d(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denominator === 0) {
        return null;
    }
    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    let intersectionX = x1 + ua * (x2 - x1);
    let intersectionY = y1 + ua * (y2 - y1);
    return { x: intersectionX, y: intersectionY };
}

// Finds the nearest power of 2, rounded up, mainly for generating textures. You still need to calculate the exponent, e.g. Math.pow(2, nearestPowerOf2(30))
export function nearestPowerOf2(value: number) {
    return Math.ceil(Math.log(value) / Math.log(2));
}

// Finds the bounding box, given a list of points.
export function findPointListBounds(points: Array<DOMPoint | { x: number, y: number }>) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const point of points) {
        if (point.x < left) left = point.x;
        if (point.x > right) right = point.x;
        if (point.y < top) top = point.y;
        if (point.y > bottom) bottom = point.y;
    }

    return {
        left,
        right,
        top,
        bottom,
    }
}

// True if two values are approximately equal, due to floating point rounding errors
export function isEqualApprox(a, b, epsilon = 0.00001) {
    return Math.abs(a - b) <= epsilon;
}
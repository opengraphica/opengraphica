
export function lerp(value1: number, value2: number, amount: number) {
    return (1 - amount) * value1 + amount * value2;
}

export function pointDistance2d(x1: number, y1: number, x2: number, y2: number) {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
}

export function clockwiseSlope2d(cx: number, cy: number, ex: number, ey: number) {
    var dy = ey - cy;
    var dx = ex - cx;
    return Math.atan2(dy, dx); // range (-PI, PI]
}

export function normalizedDirectionVector2d(x1: number, y1: number, x2: number, y2: number) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const normalizedX = deltaX / magnitude;
    const normalizedY = deltaY / magnitude;
    return { x: normalizedX, y: normalizedY };
}

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

export function nearestPowerOf2(value: number) {
    return Math.ceil(Math.log(value) / Math.log(2));
}

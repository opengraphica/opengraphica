
export function lerp(value1: number, value2: number, amount: number) {
    return (1 - amount) * value1 + amount * value2;
}

export function pointDistance2d(x1: number, y1: number, x2: number, y2: number) {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
}

export function lineIntersectsLine2d(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): DOMPoint | null {
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return null;
    }
    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    if (denominator === 0) {
        return null;
    }
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;
    const x = x1 + ua * (x2 - x1);
    const y = y1 + ua * (y2 - y1);
    return new DOMPoint(x, y);
}

export function nearestPowerOf2(value: number) {
    return Math.ceil(Math.log(value) / Math.log(2));
}

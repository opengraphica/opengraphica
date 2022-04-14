
export function lerp(value1: number, value2: number, amount: number) {
    return (1 - amount) * value1 + amount * value2;
}

export function pointDistance2d(x1: number, y1: number, x2: number, y2: number) {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
}

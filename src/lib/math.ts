
export const pointDistance2d = (x1: number, y1: number, x2: number, y2: number) => {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
};


export interface DecomposedMatrix {
    translateX: number,
    translateY: number,
    rotation: number,
    skewX: number,
    scaleX: number,
    scaleY: number
}

/**
 * Extract individual transform values from the canvas transform matrix.
 */
export const decomposeMatrix = (matrix: DOMMatrix): DecomposedMatrix => {
    let a = matrix.a, b = matrix.b, c = matrix.c, d = matrix.d, e = matrix.e, f = matrix.f;
    let scaleX: number, scaleY: number, skewX: number;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
        translateX: e,
        translateY: f,
        rotation: Math.atan2(b, a),
        skewX: Math.atan(skewX),
        scaleX: scaleX,
        scaleY: scaleY
    };       
}

/**
 * Snaps the given x/y coordinates to the nearest half pixel on the screen. Prevents blurry lines when scaling a non-rotated image.
 */
 export const snapPointAtHalfPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, xOffset: number = 0, yOffset: number = 0): DOMPoint => {
    let point = new DOMPoint(x, y);
    point = point.matrixTransform(ctx.getTransform());
    point.x = Math.round(point.x + 0.5) - 0.5 + xOffset;
    point.y = Math.round(point.y + 0.5) - 0.5 + yOffset;
    point = point.matrixTransform(ctx.getTransform().inverse());
    return point;
}

/**
 * Snaps the given x/y coordinates to the nearest pixel on the screen. Prevents blurry lines when scaling a non-rotated image.
 */
 export const snapPointAtPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, xOffset: number = 0, yOffset: number = 0): DOMPoint => {
    let point = new DOMPoint(x, y);
    point = point.matrixTransform(ctx.getTransform());
    point.x = Math.round(point.x) + xOffset;
    point.y = Math.round(point.y) + yOffset;
    point = point.matrixTransform(ctx.getTransform().inverse());
    return point;
}

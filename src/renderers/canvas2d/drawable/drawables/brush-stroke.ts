import type { Drawable, DrawableOptions, DrawableUpdateOptions } from '@/types';

function pointDistance2d(x1: number, y1: number, x2: number, y2: number) {
    const a = x2 - x1;
    const b = y2 - y1;
    return Math.sqrt(a * a + b * b);
}

export function normalizedDirectionVector2d(x1: number, y1: number, x2: number, y2: number) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const normalizedX = deltaX / magnitude;
    const normalizedY = deltaY / magnitude;
    return { x: normalizedX, y: normalizedY };
}

function intersectLines(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const slope1 = (y2 - y1) / (x2 - x1);
    const slope2 = (y4 - y3) / (x4 - x3);
    const determinant = ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    if (slope1 === slope2 || determinant === 0) {
        return { x: x2, y: y2 };
    }
    var x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / determinant;
    var y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / determinant;
    return { x, y };
}

export interface BrushStrokePoint {
    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    rendered?: boolean;
}

export interface BrushStrokeData {
    color?: string; // Hex code
    minDensity?: number;
    maxDensity?: number;
    points?: BrushStrokePoint[];
    isPointsFinalized?: boolean;
    smoothing?: number; // Number of historical points to check for line smoothing. A value of 1 averages 3 points: previous, current, next.
}

export default class BrushStroke implements Drawable<BrushStrokeData> {
    private color: string = '#000000';
    private minDensity: number = 1;
    private maxDensity: number = 0.5;
    private spacing: number = 0.05;
    private points: BrushStrokePoint[] = [];
    private smoothing: number = 1;
    private isPointsFinalized: boolean = false;

    private startPointIndex: number = 0;
    private drawSteps: number[] = [];
    private lastDrawLineOffset: number = 0;

    constructor(options: DrawableOptions<BrushStrokeData>) {
        if (options.data) this.update(options.data, { refresh: true });
    }

    update(data: BrushStrokeData, { refresh }: DrawableUpdateOptions = {}) {
        this.color = data?.color ?? '#000000';
        this.minDensity = data?.minDensity ?? this.minDensity;
        this.maxDensity = data?.maxDensity ?? this.maxDensity;
        this.points = data?.points ?? [];
        this.smoothing = data?.smoothing ?? 1;
        this.isPointsFinalized = data?.isPointsFinalized ?? false;

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        this.drawSteps = [];
        if (refresh) {
            this.startPointIndex = 0;
        }
        if (this.startPointIndex === 0 && this.points.length > 0) {
            const { x, y, size } = this.points[0];
            this.drawSteps.push(x, y, size);
            this.lastDrawLineOffset = Math.max(1.0, size * this.spacing);
            const drawMargin = (size / 2.0) + 16;
            if (x - drawMargin < left) left = x - drawMargin;
            if (x + drawMargin > right) right = x + drawMargin;
            if (y - drawMargin < top) top = y - drawMargin;
            if (y + drawMargin > bottom) bottom = y + drawMargin;
        }

        for (let i = this.startPointIndex; i < this.points.length - 1; i++) {
            const { x: startX, y: startY, size: startSize } = this.points[i];
            const { x: endX, y: endY, size: endSize } = this.points[i + 1];
            const direction = normalizedDirectionVector2d(startX, startY, endX, endY);

            const lineLength = pointDistance2d(startX, startY, endX, endY);
            let elapsedLength = this.lastDrawLineOffset;

            while (elapsedLength < lineLength) {
                const size = startSize * (elapsedLength / lineLength) + endSize * (1.0 - (elapsedLength / lineLength));
                this.drawSteps.push(startX + direction.x * elapsedLength, startY + direction.y * elapsedLength, size);
                elapsedLength += Math.max(1.0, size * this.spacing);
            }
            this.lastDrawLineOffset = elapsedLength - lineLength;

            const drawMargin = (Math.max(startSize, endSize) / 2.0) + 16;
            if (startX - drawMargin < left) left = startX - drawMargin;
            if (startX + drawMargin > right) right = startX + drawMargin;
            if (startY - drawMargin < top) top = startY - drawMargin;
            if (startY + drawMargin > bottom) bottom = startY + drawMargin;
            if (i === this.points.length - 2) {
                if (endX - drawMargin < left) left = endX - drawMargin;
                if (endX + drawMargin > right) right = endX + drawMargin;
                if (endY - drawMargin < top) top = endY - drawMargin;
                if (endY + drawMargin > bottom) bottom = endY + drawMargin;
            }
        }
        if (this.isPointsFinalized) {
            const lastPoint = this.points[this.points.length - 1];
            this.drawSteps.push(lastPoint.x, lastPoint.y, lastPoint.size);
        }
        this.startPointIndex = this.points.length - 1;

        return {
            left,
            right,
            top,
            bottom,
        };
    }

    draw2d(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = this.color;

        for (let i = 0; i < this.drawSteps.length; i += 3) {
            ctx.globalAlpha = this.maxDensity;
            ctx.beginPath();
            ctx.arc(this.drawSteps[i], this.drawSteps[i + 1], this.drawSteps[i + 2] / 2, 0, 1.999999 * Math.PI);
            ctx.fill();
        }

    }

    drawWebgl() {
        // Pass
    }

    dispose() {
        // Pass
    }
}

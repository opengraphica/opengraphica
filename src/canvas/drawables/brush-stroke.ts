import { Bezier } from 'bezier-js'; // TODO - can this be code split inside web worker?
import type { Drawable, DrawableOptions, DrawableUpdateOptions } from '@/types';

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
}

export interface BrushStrokeData {
    color?: string; // Hex code
    points?: BrushStrokePoint[];
    smoothing?: number; // Number of historical points to check for line smoothing. A value of 1 averages 3 points: previous, current, next.
}

export default class BrushStroke implements Drawable<BrushStrokeData> {
    private color: string = '#000000';
    private points: BrushStrokePoint[] = [];
    private smoothing: number = 1;
    private pointBeziers: { forward: Bezier[], backward: Bezier[] }[] = [];

    constructor(options: DrawableOptions<BrushStrokeData>) {
        if (options.data) this.update(options.data, { refresh: true });
    }

    update(data: BrushStrokeData, { refresh }: DrawableUpdateOptions = {}) {
        this.color = data?.color ?? '#000000';
        this.points = data?.points ?? [];
        this.smoothing = data?.smoothing ?? 1;

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        let startPointIndex = (refresh ? 0 : Math.max(0, this.points.length - 3 - this.smoothing));
        this.pointBeziers = this.pointBeziers.slice(0, startPointIndex);

        for (let i = startPointIndex; i < this.points.length; i++) {
            const { x, y, size } = this.points[i];
            const drawMargin = size + 16;
            if (x - drawMargin < left) left = x - drawMargin;
            if (x + drawMargin > right) right = x + drawMargin;
            if (y - drawMargin < top) top = y - drawMargin;
            if (y + drawMargin > bottom) bottom = y + drawMargin;

            if (i == 0) continue;

            const isBezierEndPoint = i % 2 == 0;
            if (!isBezierEndPoint) {
                continue;
            }

            const prevIndex = i - 1;
            const nextIndex = Math.min(this.points.length - 1, i + 1);

            const p0x = (this.points[prevIndex].x + x) / 2;
            const p0y = (this.points[prevIndex].y + y) / 2;
            const p2x = (this.points[nextIndex].x + x) / 2;
            const p2y = (this.points[nextIndex].y + y) / 2;

            const bezier = new Bezier(p0x, p0y, x, y, p2x, p2y);
            this.pointBeziers.push({
                forward: bezier.offset(size / 2) as Bezier[],
                backward: bezier.offset(-size / 2) as Bezier[],
            });
        }

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

        const points = this.points;

        if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, points[0].size / 2, 0, 1.999999 * Math.PI);
            ctx.fill();
        }

        // if (this.pointBeziers.length === 0) return;

        // ctx.beginPath();
        // ctx.moveTo(this.pointBeziers[0].forward[0].points[0].x, this.pointBeziers[0].forward[0].points[0].y);

        // for (let i = 0; i < this.pointBeziers.length; i++) {
        //     const beziers = this.pointBeziers[i].forward;
        //     for (const bezier of beziers) {
        //         if (bezier.points.length === 4) {
        //             ctx.bezierCurveTo(bezier.points[1].x, bezier.points[1].y, bezier.points[2].x, bezier.points[2].y, bezier.points[3].x, bezier.points[3].y);
        //         } else if (bezier.points.length === 3) {
        //             ctx.quadraticCurveTo(bezier.points[1].x, bezier.points[1].y, bezier.points[2].x, bezier.points[2].y);
        //         }
        //     }
        // }

        // const lastPointBezier = this.pointBeziers[this.pointBeziers.length - 1];
        // const lastPointBezierLastBackward = lastPointBezier.backward[lastPointBezier.backward.length - 1];
        // if (lastPointBezierLastBackward) {
        //     ctx.lineTo(
        //         lastPointBezierLastBackward.points[lastPointBezierLastBackward.points.length - 1].x,
        //         lastPointBezierLastBackward.points[lastPointBezierLastBackward.points.length - 1].y
        //     );
        //     }

        // for (let i = this.pointBeziers.length - 1; i >= 0; i--) {
        //     const beziers = this.pointBeziers[i].backward;
        //     for (let j = beziers.length - 1; j >= 0; j--) {
        //         const bezier = beziers[j];
        //         if (bezier.points.length === 4) {
        //             ctx.bezierCurveTo(bezier.points[2].x, bezier.points[2].y, bezier.points[1].x, bezier.points[1].y, bezier.points[0].x, bezier.points[0].y);
        //         } else if (bezier.points.length === 3) {
        //             ctx.quadraticCurveTo(bezier.points[1].x, bezier.points[1].y, bezier.points[0].x, bezier.points[0].y);
        //         }
        //     }
        // }

        // ctx.fillStyle = this.color;
        // ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        let averageX = 0;
        let averageY = 0;
        for (let i = 1; i < points.length; i++) {
            let previousPoint1 = {
                x: points[i - 1].x,
                y: points[i - 1].y,
            };
            let nextPoint1 = {
                x: points[i].x,
                y: points[i].y,
            };
            averageX = (previousPoint1.x + nextPoint1.x) / 2;
            averageY = (previousPoint1.y + nextPoint1.y) / 2;
            ctx.quadraticCurveTo(previousPoint1.x, previousPoint1.y, averageX, averageY);
        }
        ctx.lineWidth = points[0].size;
        ctx.strokeStyle = this.color;
        ctx.stroke();
    }

    drawWebgl() {
        // Pass
    }

    dispose() {
        // Pass
    }
}

// import { Bezier } from 'bezier-js'; // TODO - can this be code split inside web worker?
import type { Drawable, DrawableOptions } from '@/types';

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
    smoothing?: number; // Number of points to check for line smoothing
}

export default class BrushStroke implements Drawable<BrushStrokeData> {
    private color: string = '#000000';
    private points: BrushStrokePoint[] = [];
    private smoothing: number = 0;

    constructor(options: DrawableOptions<BrushStrokeData>) {
        if (options.data) this.update(options.data);
    }

    update(data: BrushStrokeData) {
        this.color = data?.color ?? '#000000';
        this.points = data?.points ?? [];
        this.smoothing = data?.smoothing ?? 0;
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

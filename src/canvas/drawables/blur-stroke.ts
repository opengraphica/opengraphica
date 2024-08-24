import { Bezier } from 'bezier-js';
import type { Drawable, DrawableDrawInfo, DrawableOptions, DrawableUpdateOptions } from '@/types';

export interface BlurStrokePoint {
    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
}

export interface BlurStrokeData {
    points?: BlurStrokePoint[];
    radius?: number; // Blur radius
    smoothing?: number; // Number of historical points to check for line smoothing. A value of 1 averages 3 points: previous, current, next.
}

const stackBlurMulTable = [
    512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512,
    454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512,
    482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456,
    437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512,
    497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328,
    320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456,
    446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335,
    329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512,
    505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405,
    399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328,
    324, 320, 316, 312, 309, 305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271,
    268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456,
    451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388,
    385, 381, 377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335,
    332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292,
    289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259];

const stackBlurShgTable = [
    9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
    17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
    19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
    20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
    22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
    22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24];

interface BlurStack {
    r: number;
    g: number;
    b: number;
    a: number;
    next: BlurStack;
}

function createBlurStack(): BlurStack {
    return {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        next: null as unknown as BlurStack,
    }
}

export default class BlurStroke implements Drawable<BlurStrokeData> {
    private points: BlurStrokePoint[] = [];
    private radius: number = 1;
    private smoothing: number = 1;
    private pointBeziers: { forward: Bezier[], backward: Bezier[] }[] = [];

    private destinationCanvas: HTMLCanvasElement | ImageBitmap | undefined;
    private destinationCanvasTransform: DOMMatrix | undefined;

    constructor(options: DrawableOptions<BlurStrokeData>) {
        if (options.data) this.update(options.data, { refresh: true });
    }

    update(data: BlurStrokeData, { refresh, destinationCanvas, destinationCanvasTransform }: DrawableUpdateOptions = {}) {
        this.points = data?.points ?? [];
        this.radius = data?.radius ?? 1;
        this.smoothing = data?.smoothing ?? 1;
        this.destinationCanvas = destinationCanvas;
        this.destinationCanvasTransform = destinationCanvasTransform;

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
        }

        return {
            left,
            right,
            top,
            bottom,
        };
    }

    draw2d(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, { left, right, top, bottom }: DrawableDrawInfo) {
        if (!this.destinationCanvas || !this.destinationCanvasTransform) return;

        ctx.save();
        const { a, b, c, d, e, f } = this.destinationCanvasTransform;
        ctx.transform(a, b, c, d, e, f);
        ctx.fillStyle = '#ffff00';
        // ctx.fillRect(0, 0, this.destinationCanvas.width, this.destinationCanvas.height);
        ctx.drawImage(this.destinationCanvas, 0, 0);
        
        // const imageData = ctx.getImageData(0, 0, right - left, bottom - top);
        // const blurredImageData = this.stackBlur(imageData, 20);
        // for (let i = 0; i < imageData.data.length; i += 4) {
        //     imageData.data[i] = 0;
        // }
        // this.drawImageData(ctx, imageData, left, top);

        ctx.restore();

        const imageData = ctx.getImageData(-left, -top, right - left, bottom - top);
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 0;
            imageData.data[i + 3] = 1;
        }
        this.drawImageData(ctx, imageData, 0, 0);

        // ctx.globalCompositeOperation = 'destination-in';

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#000000';

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
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';

        this.destinationCanvas = undefined;
        this.destinationCanvasTransform = undefined;
    }

    drawWebgl() {
        // Pass
    }

    dispose() {
        // Pass
    }
    
    private drawImageData(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        imageData: ImageData,
        x: number,
        y: number,
    ) {
        let canvas!: HTMLCanvasElement | OffscreenCanvas;
        if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
            canvas = new OffscreenCanvas(imageData.width, imageData.height);
        } else {
            canvas = document.createElement('canvas');
        }
        const imageDataCtx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        if (imageDataCtx) {
            imageDataCtx.putImageData(imageData, 0, 0);
        }
        ctx.drawImage(canvas, x, y);
    }

    private stackBlur(srcImageData: ImageData, radius: number) {
		const srcPixels = srcImageData.data,
			srcWidth = srcImageData.width,
			srcHeight = srcImageData.height,
			srcLength = srcPixels.length,
			dstImageData = new ImageData(
                new Uint8ClampedArray(srcImageData.data),
                srcImageData.width,
                srcImageData.height,
            ),
			dstPixels = dstImageData.data;

		let x, y, i, p, yp, yi, yw,
			rSum, gSum, bSum, aSum,
			rOutSum, gOutSum, bOutSum, aOutSum,
			rInSum, gInSum, bInSum, aInSum,
			pr, pg, pb, pa, rbs,
			div = radius + radius + 1,
			w4 = srcWidth << 2,
			widthMinus1 = srcWidth - 1,
			heightMinus1 = srcHeight - 1,
			radiusPlus1 = radius + 1,
			sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2,
			stackStart = createBlurStack(),
			stack: BlurStack = stackStart,
			stackIn: BlurStack, stackOut: BlurStack, stackEnd!: BlurStack,
			mulSum = stackBlurMulTable[radius],
			shgSum = stackBlurShgTable[radius];

		for (i = 1; i < div; i += 1) {
			stack = (stack.next = createBlurStack());
			if (i == radiusPlus1) {
				stackEnd = stack;
			}
		}

		stack.next = stackStart;
		yw = yi = 0;

		for (y = 0; y < srcHeight; y += 1) {
			rInSum = gInSum = bInSum = aInSum = rSum = gSum = bSum = aSum = 0;

			rOutSum = radiusPlus1 * (pr = dstPixels[yi]);
			gOutSum = radiusPlus1 * (pg = dstPixels[yi + 1]);
			bOutSum = radiusPlus1 * (pb = dstPixels[yi + 2]);
			aOutSum = radiusPlus1 * (pa = dstPixels[yi + 3]);

			rSum += sumFactor * pr;
			gSum += sumFactor * pg;
			bSum += sumFactor * pb;
			aSum += sumFactor * pa;

			stack = stackStart;

			for (i = 0; i < radiusPlus1; i += 1) {
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack.a = pa;
				stack = stack.next;
			}

			for (i = 1; i < radiusPlus1; i += 1) {
				p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
				rSum += (stack.r = (pr = dstPixels[p])) * (rbs = radiusPlus1 - i);
				gSum += (stack.g = (pg = dstPixels[p + 1])) * rbs;
				bSum += (stack.b = (pb = dstPixels[p + 2])) * rbs;
				aSum += (stack.a = (pa = dstPixels[p + 3])) * rbs;

				rInSum += pr;
				gInSum += pg;
				bInSum += pb;
				aInSum += pa;

				stack = stack.next;
			}

			stackIn = stackStart;
			stackOut = stackEnd;

			for (x = 0; x < srcWidth; x += 1) {
				dstPixels[yi] = (rSum * mulSum) >> shgSum;
				dstPixels[yi + 1] = (gSum * mulSum) >> shgSum;
				dstPixels[yi + 2] = (bSum * mulSum) >> shgSum;
				dstPixels[yi + 3] = (aSum * mulSum) >> shgSum;

				rSum -= rOutSum;
				gSum -= gOutSum;
				bSum -= bOutSum;
				aSum -= aOutSum;

				rOutSum -= stackIn.r;
				gOutSum -= stackIn.g;
				bOutSum -= stackIn.b;
				aOutSum -= stackIn.a;

				p = (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2;

				rInSum += (stackIn.r = dstPixels[p]);
				gInSum += (stackIn.g = dstPixels[p + 1]);
				bInSum += (stackIn.b = dstPixels[p + 2]);
				aInSum += (stackIn.a = dstPixels[p + 3]);

				rSum += rInSum;
				gSum += gInSum;
				bSum += bInSum;
				aSum += aInSum;

				stackIn = stackIn.next;

				rOutSum += (pr = stackOut.r);
				gOutSum += (pg = stackOut.g);
				bOutSum += (pb = stackOut.b);
				aOutSum += (pa = stackOut.a);

				rInSum -= pr;
				gInSum -= pg;
				bInSum -= pb;
				aInSum -= pa;

				stackOut = stackOut.next;

				yi += 4;
			}

			yw += srcWidth;
		}

		for (x = 0; x < srcWidth; x += 1) {
			gInSum = bInSum = aInSum = rInSum = gSum = bSum = aSum = rSum = 0;

			yi = x << 2;
			rOutSum = radiusPlus1 * (pr = dstPixels[yi]);
			gOutSum = radiusPlus1 * (pg = dstPixels[yi + 1]);
			bOutSum = radiusPlus1 * (pb = dstPixels[yi + 2]);
			aOutSum = radiusPlus1 * (pa = dstPixels[yi + 3]);

			rSum += sumFactor * pr;
			gSum += sumFactor * pg;
			bSum += sumFactor * pb;
			aSum += sumFactor * pa;

			stack = stackStart;

			for (i = 0; i < radiusPlus1; i += 1) {
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack.a = pa;
				stack = stack.next;
			}

			yp = srcWidth;

			for (i = 1; i <= radius; i += 1) {
				yi = (yp + x) << 2;

				rSum += (stack.r = (pr = dstPixels[yi])) * (rbs = radiusPlus1 - i);
				gSum += (stack.g = (pg = dstPixels[yi + 1])) * rbs;
				bSum += (stack.b = (pb = dstPixels[yi + 2])) * rbs;
				aSum += (stack.a = (pa = dstPixels[yi + 3])) * rbs;

				rInSum += pr;
				gInSum += pg;
				bInSum += pb;
				aInSum += pa;

				stack = stack.next;

				if (i < heightMinus1) {
					yp += srcWidth;
				}
			}

			yi = x;
			stackIn = stackStart;
			stackOut = stackEnd;

			for (y = 0; y < srcHeight; y += 1) {
				p = yi << 2;
				dstPixels[p] = (rSum * mulSum) >> shgSum;
				dstPixels[p + 1] = (gSum * mulSum) >> shgSum;
				dstPixels[p + 2] = (bSum * mulSum) >> shgSum;
				dstPixels[p + 3] = (aSum * mulSum) >> shgSum;

				rSum -= rOutSum;
				gSum -= gOutSum;
				bSum -= bOutSum;
				aSum -= aOutSum;

				rOutSum -= stackIn.r;
				gOutSum -= stackIn.g;
				bOutSum -= stackIn.b;
				aOutSum -= stackIn.a;

				p = (x + (((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * srcWidth)) << 2;

				rSum += (rInSum += (stackIn.r = dstPixels[p]));
				gSum += (gInSum += (stackIn.g = dstPixels[p + 1]));
				bSum += (bInSum += (stackIn.b = dstPixels[p + 2]));
				aSum += (aInSum += (stackIn.a = dstPixels[p + 3]));

				stackIn = stackIn.next;

				rOutSum += (pr = stackOut.r);
				gOutSum += (pg = stackOut.g);
				bOutSum += (pb = stackOut.b);
				aOutSum += (pa = stackOut.a);

				rInSum -= pr;
				gInSum -= pg;
				bInSum -= pb;
				aInSum -= pa;

				stackOut = stackOut.next;

				yi += srcWidth;
			}
		}

		return dstImageData;
	}
}

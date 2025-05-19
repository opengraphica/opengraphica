export interface BrushStrokePoint {
    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    rendered?: boolean;
}

class BrushStrokeCatmullRomSegment {
    p0x!: number; p0y!: number;
    p1x!: number; p1y!: number;
    p2x!: number; p2y!: number;
    p3x!: number; p3y!: number;
    t0!: number; t1!: number; t2!: number; t3!: number;
    lut!: Float32Array;
    length!: number;

    constructor() {
        this.lut = new Float32Array(64 * 2);
    }

    init(p0: BrushStrokePoint, p1: BrushStrokePoint, p2: BrushStrokePoint, p3: BrushStrokePoint) {
        this.p0x = p0.x; this.p0y = p0.y;
        this.p1x = p1.x; this.p1y = p1.y;
        this.p2x = p2.x; this.p2y = p2.y;
        this.p3x = p3.x; this.p3y = p3.y;
        this.makeLUT();
    }

    distance(ax: number, ay: number, bx: number, by: number) {
        const dx = ax - bx, dy = ay - by;
        return Math.hypot(dx, dy);
    }

    getT(tPrev: number, x0: number, y0: number, x1: number, y1: number) {
        return tPrev + Math.sqrt(this.distance(x0, y0, x1, y1));
    }

    catmullRomX(tt: number) {
        const t0 = this.t0, t1 = this.t1, t2 = this.t2, t3 = this.t3;
        const A1x = (t1 - tt) / (t1 - t0) * this.p0x + (tt - t0) / (t1 - t0) * this.p1x;
        const A2x = (t2 - tt) / (t2 - t1) * this.p1x + (tt - t1) / (t2 - t1) * this.p2x;
        const A3x = (t3 - tt) / (t3 - t2) * this.p2x + (tt - t2) / (t3 - t2) * this.p3x;
        const B1x = (t2 - tt) / (t2 - t0) * A1x + (tt - t0) / (t2 - t0) * A2x;
        const B2x = (t3 - tt) / (t3 - t1) * A2x + (tt - t1) / (t3 - t1) * A3x;
        const Cx = (t2 - tt) / (t2 - t1) * B1x + (tt - t1) / (t2 - t1) * B2x;
        return isNaN(Cx) ? t1 : Cx;
    }

    catmullRomY(tt: number) {
        const t0 = this.t0, t1 = this.t1, t2 = this.t2, t3 = this.t3;
        const A1y = (t1 - tt) / (t1 - t0) * this.p0y + (tt - t0) / (t1 - t0) * this.p1y;
        const A2y = (t2 - tt) / (t2 - t1) * this.p1y + (tt - t1) / (t2 - t1) * this.p2y;
        const A3y = (t3 - tt) / (t3 - t2) * this.p2y + (tt - t2) / (t3 - t2) * this.p3y;
        const B1y = (t2 - tt) / (t2 - t0) * A1y + (tt - t0) / (t2 - t0) * A2y;
        const B2y = (t3 - tt) / (t3 - t1) * A2y + (tt - t1) / (t3 - t1) * A3y;
        const Cy = (t2 - tt) / (t2 - t1) * B1y + (tt - t1) / (t2 - t1) * B2y;
        return isNaN(Cy) ? t1 : Cy;
    }

    makeLUT() {
        const steps = 64;
        let length = 0;

        let t = 0;
        this.t0 = 0;
        this.t1 = this.getT(this.t0, this.p0x, this.p0y, this.p1x, this.p1y);
        this.t2 = this.getT(this.t1, this.p1x, this.p1y, this.p2x, this.p2y);
        this.t3 = this.getT(this.t2, this.p2x, this.p2y, this.p3x, this.p3y);
        let tt = this.t1 + (this.t2 - this.t1) * t;

        let prevX = this.catmullRomX(tt);
        let prevY = this.catmullRomY(tt);
        this.lut[0] = 0;
        this.lut[1] = 0;

        let x: number;
        let y: number;
        for (let i = 1; i <= steps; i++) {
            t = i / steps;
            tt = this.t1 + (this.t2 - this.t1) * t;
            x = this.catmullRomX(tt);
            y = this.catmullRomY(tt);
            length += this.distance(prevX, prevY, x, y);
            this.lut[i * 2] = t;
            this.lut[i * 2 + 1] = length;
            prevX = x;
            prevY = y;
        }

        this.length = length;
    }

    getTAtLength(targetLength: number): number {
        if (targetLength <= 0) return 0;
        if (targetLength >= this.length) return 1;

        let low = 0, high = (this.lut.length / 2) - 2;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midLen = this.lut[mid * 2 + 1];

            if (midLen < targetLength) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const aT = this.lut[high * 2];
        const aLength = this.lut[high * 2 + 1];
        const bT = this.lut[low * 2];
        const bLength = this.lut[low * 2 + 1];
        const ratio = (targetLength - aLength) / (bLength - aLength);
        return aT + (bT - aT) * ratio;
    }
}

export class BrushStroke {
    smoothing!: number;
    spacing!: number;

    collectedPoints: Array<BrushStrokePoint | undefined> = [];
    collectedPointRetrieveIndex: number = -1;
    collectedPointsLength: number = 0;

    lastCollectedPoint1: BrushStrokePoint;
    lastCollectedPoint2: BrushStrokePoint;
    lastCollectedPoint3: BrushStrokePoint;

    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    sX: number;
    sY: number;
    sSize: number;
    sTiltX: number;
    sTiltY: number;
    sTwist: number;

    catmullRomSegment = new BrushStrokeCatmullRomSegment();

    retrieveCatmullRomP0: BrushStrokePoint | undefined;
    retrieveCatmullRomP1: BrushStrokePoint | undefined;
    retrieveCatmullRomP2: BrushStrokePoint | undefined;
    retrieveCatmullRomP3: BrushStrokePoint | undefined;
    retrieveCatmullRomTravel: number = 0;
    retrieveLineLength: number = 0;

    constructor(smoothing: number, spacing: number, startingPoint: BrushStrokePoint) {
        this.spacing = spacing;
        this.smoothing = smoothing;

        this.x = startingPoint.x;
        this.y = startingPoint.y;
        this.size = startingPoint.size;
        this.tiltX = startingPoint.tiltX;
        this.tiltY = startingPoint.tiltY;
        this.twist = startingPoint.twist;
        this.sX = startingPoint.x;
        this.sY = startingPoint.y;
        this.sSize = startingPoint.size;
        this.sTiltX = startingPoint.tiltX;
        this.sTiltY = startingPoint.tiltY;
        this.sTwist = startingPoint.twist;

        this.lastCollectedPoint1 = startingPoint;
        this.lastCollectedPoint2 = startingPoint;
        this.lastCollectedPoint3 = startingPoint;
    }

    addPoint(point: BrushStrokePoint) {
        this.x = point.x;
        this.y = point.y;
        this.size = point.size;
        this.tiltX = point.tiltX;
        this.tiltY = point.tiltY;
        this.twist = point.twist;
        this.sX = (1 - this.smoothing) * this.sX + this.smoothing * point.x;
        this.sY = (1 - this.smoothing) * this.sY + this.smoothing * point.y;
        this.sSize = (1 - this.smoothing) * this.sSize + this.smoothing * point.size;
        this.sTiltX = (1 - this.smoothing) * this.sTiltX + this.smoothing * point.tiltX;
        this.sTiltY = (1 - this.smoothing) * this.sTiltY + this.smoothing * point.tiltY;
        this.sTwist = (1 - this.smoothing) * this.sTwist + this.smoothing * point.twist;
        point.x = this.sX;
        point.y = this.sY;
        point.size = this.sSize;
        point.tiltX = this.sTiltX;
        point.tiltY = this.sTiltY;
        point.twist = this.sTwist;
        this.addCollectedPoint(point);
    }

    advanceLine() {
        if (Math.abs(this.x - this.sX) > 1.0 || Math.abs(this.y - this.sY) > 1.0) {
            this.sX += (this.x - this.sX) * 0.05;
            this.sY += (this.y - this.sY) * 0.05;
            this.sSize += (this.size - this.sSize) * 0.05;
            this.addCollectedPoint({
                x: this.sX,
                y: this.sY,
                size: this.sSize,
                tiltX: this.sTiltX,
                tiltY: this.sTiltY,
                twist: this.sTwist,
            });
            return true;
        }
        return false;
    }

    finalizeLine() {
        while (this.advanceLine());
    }

    addCollectedPoint(point: BrushStrokePoint) {
        if (this.collectedPoints.length > this.collectedPointsLength) {
            this.collectedPoints[this.collectedPointsLength] = point;
            this.collectedPointsLength++;
        } else {
            this.collectedPoints.push(point);
            this.collectedPointsLength = this.collectedPoints.length;
        }
    }

    hasCollectedPoints() {
        let isRetrievingCurve = !!(this.retrieveCatmullRomP0 && this.retrieveCatmullRomP1 && this.retrieveCatmullRomP2 && this.retrieveCatmullRomP3);
        let isRetrievingLine = !isRetrievingCurve && !!(this.retrieveCatmullRomP1 && this.retrieveCatmullRomP2);
        return this.collectedPointsLength > 0 || isRetrievingCurve || isRetrievingLine;
    }

    retrieveCollectedPoint(): BrushStrokePoint | undefined {
        this.collectedPointRetrieveIndex++;
        const collectedPoint = this.collectedPoints[this.collectedPointRetrieveIndex];
        this.collectedPoints[this.collectedPointRetrieveIndex] = undefined;
        if (collectedPoint) {
            this.lastCollectedPoint3 = this.lastCollectedPoint2;
            this.lastCollectedPoint2 = this.lastCollectedPoint1;
            this.lastCollectedPoint1 = collectedPoint;
        }
        if (!this.collectedPoints[this.collectedPointRetrieveIndex + 1]) {
            this.collectedPointRetrieveIndex = -1;
            this.collectedPointsLength = 0;
        }
        return collectedPoint;
    }

    retrieveCatmullRomSegmentPoint(): BrushStrokePoint | undefined {
        let point: BrushStrokePoint | undefined;
        let isRetrievingCurve = !!(this.retrieveCatmullRomP0 && this.retrieveCatmullRomP1 && this.retrieveCatmullRomP2 && this.retrieveCatmullRomP3);
        let isRetrievingLine = !isRetrievingCurve && !!(this.retrieveCatmullRomP1 && this.retrieveCatmullRomP2);
        if (!isRetrievingCurve && !isRetrievingLine && this.collectedPointsLength - this.collectedPointRetrieveIndex - 1 >= 1) {
            this.retrieveCatmullRomP0 = this.lastCollectedPoint3;
            this.retrieveCatmullRomP1 = this.lastCollectedPoint2;
            this.retrieveCatmullRomP2 = this.lastCollectedPoint1;
            this.retrieveCatmullRomP3 = this.retrieveCollectedPoint()!;

            if (this.retrieveCatmullRomP1.x == this.retrieveCatmullRomP2.x && this.retrieveCatmullRomP1.y == this.retrieveCatmullRomP2.y) {
                isRetrievingLine = true;
                this.retrieveCatmullRomP2 = this.retrieveCatmullRomP3;
            }
            let centerPointDistance = this.catmullRomSegment.distance(
                this.retrieveCatmullRomP1.x, this.retrieveCatmullRomP1.y,
                this.retrieveCatmullRomP2.x, this.retrieveCatmullRomP2.y,
            );
            if (isRetrievingLine || centerPointDistance <= 2) {
                isRetrievingLine = true;
                this.retrieveCatmullRomP0 = undefined;
                this.retrieveCatmullRomP3 = undefined;
                this.retrieveLineLength = centerPointDistance;
            } else {
                isRetrievingCurve = true;
                this.catmullRomSegment.init(this.retrieveCatmullRomP0, this.retrieveCatmullRomP1, this.retrieveCatmullRomP2, this.retrieveCatmullRomP3);
            }
        }
        if (isRetrievingCurve) {
            const travel = this.retrieveCatmullRomTravel;
            const travelRatio = travel / Math.max(this.catmullRomSegment.length, 0.00001);

            const brushSize = this.retrieveCatmullRomP1!.size * (1 - travelRatio) + this.retrieveCatmullRomP2!.size * travelRatio;
            const stepDistance = Math.max(1, brushSize * this.spacing);
            const bezierT = this.catmullRomSegment.getTAtLength(travel);

            const tt = this.catmullRomSegment.t1 + (this.catmullRomSegment.t2 - this.catmullRomSegment.t1) * bezierT;

            if (travel <= this.catmullRomSegment.length) {
                point = {
                    x: this.catmullRomSegment.catmullRomX(tt),
                    y: this.catmullRomSegment.catmullRomY(tt),
                    size: brushSize,
                    tiltX: this.retrieveCatmullRomP1!.tiltX, // TODO - interpolate
                    tiltY: this.retrieveCatmullRomP1!.tiltY, // TODO - interpolate
                    twist: this.retrieveCatmullRomP1!.twist, // TODO - interpolate
                }
                this.retrieveCatmullRomTravel += stepDistance;
            } else {
                this.retrieveCatmullRomP0 = undefined;
                this.retrieveCatmullRomP1 = undefined;
                this.retrieveCatmullRomP2 = undefined;
                this.retrieveCatmullRomP3 = undefined;
                this.retrieveCatmullRomTravel -= this.catmullRomSegment.length;
            }

            return point;
        }
        else if (isRetrievingLine) {
            const travel = this.retrieveCatmullRomTravel;
            const travelRatio = travel / Math.max(this.retrieveLineLength, 0.00001);

            const brushSize = this.retrieveCatmullRomP1!.size * (1 - travelRatio) + this.retrieveCatmullRomP2!.size * travelRatio;
            const stepDistance = Math.max(1, brushSize * this.spacing);

            if (travel <= this.retrieveLineLength) {
                point = {
                    x: this.retrieveCatmullRomP1!.x * (1 - travelRatio) + this.retrieveCatmullRomP2!.x * travelRatio,
                    y: this.retrieveCatmullRomP1!.y * (1 - travelRatio) + this.retrieveCatmullRomP2!.y * travelRatio,
                    size: brushSize,
                    tiltX: this.retrieveCatmullRomP1!.tiltX, // TODO - interpolate
                    tiltY: this.retrieveCatmullRomP1!.tiltY, // TODO - interpolate
                    twist: this.retrieveCatmullRomP1!.twist, // TODO - interpolate
                }
                this.retrieveCatmullRomTravel += stepDistance;
            } else {
                this.retrieveCatmullRomP1 = undefined;
                this.retrieveCatmullRomP2 = undefined;
                this.retrieveCatmullRomTravel -= this.retrieveLineLength;

            }
            return point;
        }
        return undefined;
    }

    retrieveFinalPoints(): BrushStrokePoint | undefined {
        let point: BrushStrokePoint | undefined;
        let isRetrievingLine = !!(this.retrieveCatmullRomP1 && this.retrieveCatmullRomP2);
        let isRetrieveLastPoint = false;
        if (!isRetrievingLine && this.lastCollectedPoint2 !== this.lastCollectedPoint1) {
            let centerPointDistance = this.catmullRomSegment.distance(
                this.lastCollectedPoint2.x, this.lastCollectedPoint2.y,
                this.lastCollectedPoint1.x, this.lastCollectedPoint1.y,
            );
            if (centerPointDistance > 1) {
                this.retrieveCatmullRomP0 = undefined;
                this.retrieveCatmullRomP1 = this.lastCollectedPoint2;
                this.retrieveCatmullRomP2 = this.lastCollectedPoint1;
                this.retrieveCatmullRomP3 = undefined;
                this.retrieveLineLength = centerPointDistance;
            } else if (this.retrieveCatmullRomTravel > 1) {
                this.retrieveCatmullRomTravel = 0;
                isRetrieveLastPoint = true;
            }
        }
        if (isRetrievingLine) {
            const travel = this.retrieveCatmullRomTravel;
            const travelRatio = travel / Math.max(this.retrieveLineLength, 0.00001);

            const brushSize = this.retrieveCatmullRomP1!.size * (1 - travelRatio) + this.retrieveCatmullRomP2!.size * travelRatio;
            const stepDistance = Math.max(1, brushSize * this.spacing);

            if (travel <= this.retrieveLineLength) {
                point = {
                    x: this.retrieveCatmullRomP1!.x * (1 - travelRatio) + this.retrieveCatmullRomP2!.x * travelRatio,
                    y: this.retrieveCatmullRomP1!.y * (1 - travelRatio) + this.retrieveCatmullRomP2!.y * travelRatio,
                    size: brushSize,
                    tiltX: this.retrieveCatmullRomP1!.tiltX, // TODO - interpolate
                    tiltY: this.retrieveCatmullRomP1!.tiltY, // TODO - interpolate
                    twist: this.retrieveCatmullRomP1!.twist, // TODO - interpolate
                }
                this.retrieveCatmullRomTravel += stepDistance;
            } else {
                this.retrieveCatmullRomP1 = undefined;
                this.retrieveCatmullRomP2 = undefined;
                this.lastCollectedPoint2 = this.lastCollectedPoint1;
                this.retrieveCatmullRomTravel -= this.retrieveLineLength;
                if (this.retrieveCatmullRomTravel > 1) {
                    this.retrieveCatmullRomTravel = 0;
                    isRetrieveLastPoint = true;
                }
            }
        }
        if (isRetrieveLastPoint) {
            point = {
                x: this.x,
                y: this.y,
                size: this.size,
                tiltX: this.tiltX,
                tiltY: this.tiltY,
                twist: this.twist,
            }
        }
        return point;
    }

}

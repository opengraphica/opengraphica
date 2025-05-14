export interface BrushStrokePoint {
    x: number;
    y: number;
    size: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    rendered?: boolean;
}

class BrushStrokeBezierSegment {
    p0x!: number;
    p0y!: number;
    p1x!: number;
    p1y!: number;
    p2x!: number;
    p2y!: number;
    lut!: Float32Array;
    length!: number;

    constructor() {
        this.lut = new Float32Array(64 * 2);
    }

    init(p0: BrushStrokePoint, p1: BrushStrokePoint, p2: BrushStrokePoint) {
        this.p0x = p0.x;
        this.p0y = p0.y;
        this.p1x = 2 * p1.x - 0.5 * (p0.x + p2.x);
        this.p1y = 2 * p1.y - 0.5 * (p0.y + p2.y);
        this.p2x = p2.x;
        this.p2y = p2.y;
        this.makeLUT();
    }

    distance(ax: number, ay: number, bx: number, by: number) {
        const dx = ax - bx, dy = ay - by;
        return Math.hypot(dx, dy);
    }

    bezier1d(p0: number, p1: number, p2: number, t: number) {
        const u = 1 - t;
        return u * u * p0 + 2 * u * t * p1 + t * t * p2;
    }

    bezierX(t: number) {
        return this.bezier1d(this.p0x, this.p1x, this.p2x, t);
    }

    bezierY(t: number) {
        return this.bezier1d(this.p0y, this.p1y, this.p2y, t);
    }

    makeLUT() {
        const steps = 64;

        let length = 0;
        let prevX = this.bezier1d(this.p0x, this.p1x, this.p2x, 0);
        let prevY = this.bezier1d(this.p0y, this.p1y, this.p2y, 0);
        this.lut[0] = 0;
        this.lut[1] = 0;
    
        let t: number, x: number, y: number;
        for (let i = 1; i <= steps; i++) {
            t = i / steps;
            x = this.bezier1d(this.p0x, this.p1x, this.p2x, t);
            y = this.bezier1d(this.p0y, this.p1y, this.p2y, t);
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
        const t = aT + (bT - aT) * ratio;
        return t;
    }
}

export class BrushStroke {
    smoothing!: number;
    spacing!: number;

    averageSize: number = 0;
    averageTiltX: number = 0;
    averageTiltY: number = 0;
    averageTwist: number = 0;

    buffer: Array<BrushStrokePoint | undefined> = [];
    bufferIndex: number;

    collectedPoints: Array<BrushStrokePoint | undefined> = [];
    collectedPointRetrieveIndex: number = -1;
    collectedPointsLength: number = 0;
    lastCollectedPoint: BrushStrokePoint;
    leftoverLineTravel: number = 0;

    bezierSegment = new BrushStrokeBezierSegment();

    constructor(smoothing: number, spacing: number, startingPoint: BrushStrokePoint) {
        if (smoothing < 2) smoothing = 2;
        this.spacing = spacing;
        this.smoothing = smoothing;
        this.buffer = new Array(this.smoothing);
        this.bufferIndex = -1;
        this.lastCollectedPoint = startingPoint;
    }

    addPoint(point: BrushStrokePoint) {
        this.bufferIndex++;
        if (this.bufferIndex >= this.buffer.length) {
            this.bufferIndex = 0;
        }
        this.buffer[this.bufferIndex] = point;

        this.addCollectedPoint(this.getSmoothedPoint());
    }

    advanceLine() {
        if (this.buffer[this.bufferIndex]) {
            let foundIndex = -1;
            let i: number;
            for (i = this.bufferIndex + 1; i < this.buffer.length; i++) {
                if (this.buffer[i]) {
                    foundIndex = i;
                    this.buffer[foundIndex] = undefined;
                    break;
                }
            }
            if (foundIndex === -1) {
                for (i = 0; i <= this.bufferIndex; i++) {
                    if (this.buffer[i]) {
                        foundIndex = i;
                        this.buffer[foundIndex] = undefined;
                        break;
                    }
                }
            }

            if (this.buffer[this.bufferIndex]) {
                this.addCollectedPoint(this.getSmoothedPoint());
            }
        }
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
        return this.collectedPointsLength > 0;
    }

    retrieveCollectedPoint(): BrushStrokePoint | undefined {
        this.collectedPointRetrieveIndex++;
        const collectedPoint = this.collectedPoints[this.collectedPointRetrieveIndex];
        this.collectedPoints[this.collectedPointRetrieveIndex] = undefined;
        if (collectedPoint) {
            this.lastCollectedPoint = collectedPoint;
        }
        if (!this.collectedPoints[this.collectedPointRetrieveIndex + 1]) {
            this.collectedPointRetrieveIndex = -1;
            this.collectedPointsLength = 0;
        }
        return collectedPoint;
    }

    retrieveBezierP0: BrushStrokePoint | undefined;
    retrieveBezierP1: BrushStrokePoint | undefined;
    retrieveBezierP2: BrushStrokePoint | undefined;
    retrieveBezierP01Length: number = 0;
    retrieveBezierP12Length: number = 0;
    retrieveBezierTravel: number = 0;

    retrieveBezierSegmentPoint(): BrushStrokePoint | undefined {
        let point: BrushStrokePoint | undefined;
        let isRetrievingBezier = !!(this.retrieveBezierP0 && this.retrieveBezierP1 && this.retrieveBezierP2);
        if (!isRetrievingBezier && this.retrieveBezierP2) {
            point = this.retrieveBezierP2;
            this.retrieveBezierP2 = undefined;
            return point;
        }
        if (!isRetrievingBezier && this.collectedPointsLength - this.collectedPointRetrieveIndex - 1 >= 2) {
            this.retrieveBezierP0 = this.lastCollectedPoint;
            this.retrieveBezierP1 = this.retrieveCollectedPoint()!;
            this.retrieveBezierP2 = this.retrieveCollectedPoint()!;
            this.retrieveBezierP01Length = this.bezierSegment.distance(this.retrieveBezierP0.x, this.retrieveBezierP0.y, this.retrieveBezierP1.x, this.retrieveBezierP1.y);
            this.retrieveBezierP12Length = this.bezierSegment.distance(this.retrieveBezierP1.x, this.retrieveBezierP1.y, this.retrieveBezierP2.x, this.retrieveBezierP2.y);

            if (this.retrieveBezierP01Length < 2 && this.retrieveBezierP12Length < 2) {
                point = this.retrieveBezierP1;
                this.retrieveBezierP0 = undefined;
                this.retrieveBezierP1 = undefined;
                return point;
            } else {
                isRetrievingBezier = true;
                this.bezierSegment.init(this.retrieveBezierP0, this.retrieveBezierP1, this.retrieveBezierP2);
                this.retrieveBezierTravel = this.leftoverLineTravel;
            }
        }
        if (isRetrievingBezier) {
            let travel = this.retrieveBezierTravel;
            
            let travelRatio = travel / this.bezierSegment.length;
            let brushSize = this.getBrushSize(
                this.retrieveBezierP0!, this.retrieveBezierP1!, this.retrieveBezierP2!,
                this.retrieveBezierP01Length, this.retrieveBezierP12Length, travelRatio
            );
            let stepDistance = Math.max(1, brushSize * this.spacing);
            let bezierT = this.bezierSegment.getTAtLength(travel);
            point = {
                x: this.bezierSegment.bezierX(bezierT),
                y: this.bezierSegment.bezierY(bezierT),
                size: brushSize,
                tiltX: this.retrieveBezierP1!.tiltX, // TODO - interpolate
                tiltY: this.retrieveBezierP1!.tiltY, // TODO - interpolate
                twist: this.retrieveBezierP1!.twist, // TODO - interpolate
            }

            this.retrieveBezierTravel += stepDistance;
            if (this.retrieveBezierTravel >= this.bezierSegment.length) {
                this.retrieveBezierP0 = undefined;
                this.retrieveBezierP1 = undefined;
                this.retrieveBezierP2 = undefined;
            }
            return point;
        }
        return undefined;
    }

    getBrushSize(p0: BrushStrokePoint, p1: BrushStrokePoint, p2: BrushStrokePoint, p01length: number, p12Length: number, t: number) {
        const firstSegmentT = p01length / (p01length + p12Length);
        if (t < firstSegmentT) {
            t /= firstSegmentT;
            return p0.size * (1 - t) + p1.size * t;
        } else {
            t = (t - firstSegmentT) / (1.0 - firstSegmentT);
            return p1.size * (1 - t) + p2.size * t;
        }
    }

    getSmoothedPoint(): BrushStrokePoint {
        let sumX = 0, sumY = 0, sumSize = 0, count = 0;
        let currentPoint = this.buffer[this.bufferIndex]!;
        for (let point of this.buffer) {
            point = point || currentPoint;
            count++;
            sumX += point.x;
            sumY += point.y;
            sumSize += point.size;
        }
        return {
            x: sumX / count,
            y: sumY / count,
            size: sumSize / count,
            tiltX: currentPoint.tiltX,
            tiltY: currentPoint.tiltY,
            twist: currentPoint.twist,
        };
    }

    catmullRom(p0: BrushStrokePoint, p1: BrushStrokePoint, p2: BrushStrokePoint, p3: BrushStrokePoint, t: number) {
        const t2 = t * t;
        const t3 = t2 * t;
        return {
            x: 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
            ),
            y: 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
            )
        };
    }
}


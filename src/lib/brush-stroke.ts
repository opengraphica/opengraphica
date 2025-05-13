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
    
        let low = 0, high = (this.lut.length / 2) - 1;
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

    retrieveBezierSegmentPoints(): BrushStrokePoint[] {
        const points: BrushStrokePoint[] = [];
        if (this.collectedPointsLength - this.collectedPointRetrieveIndex - 1 >= 2) {
            const p0 = this.lastCollectedPoint;
            const p1 = this.retrieveCollectedPoint()!;
            const p2 = this.retrieveCollectedPoint()!;
            let p01Length = this.bezierSegment.distance(p0.x, p0.y, p1.x, p1.y);
            let p12Length = this.bezierSegment.distance(p1.x, p1.y, p2.x, p2.y);

            if (p01Length < 2 && p12Length < 2) {
                points.push(p1);
                points.push(p2);
            } else {
                this.bezierSegment.init(p0, p1, p2);
                let travel = this.leftoverLineTravel;
                
                let stepDistance = 1;
                for (; travel < this.bezierSegment.length; travel += stepDistance) {
                    let travelRatio = travel / this.bezierSegment.length;
                    let brushSize = this.getBrushSize(p0, p1, p2, p01Length, p12Length, travelRatio);
                    stepDistance = Math.max(1, brushSize * this.spacing);
                    let bezierT = this.bezierSegment.getTAtLength(travel);
                    points.push({
                        x: this.bezierSegment.bezierX(bezierT),
                        y: this.bezierSegment.bezierY(bezierT),
                        size: brushSize,
                        tiltX: p1.tiltX, // TODO - interpolate
                        tiltY: p1.tiltY, // TODO - interpolate
                        twist: p1.twist, // TODO - interpolate
                    });
                }
            }
        }
        return points;
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


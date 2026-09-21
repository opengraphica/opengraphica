import { Path } from 'three/src/extras/core/Path';
import { Shape } from 'three/src/extras/core/Shape';
import { Vector2 } from 'three/src/math/Vector2';

import {
    angleTo, directionTo, isEqualApprox,
    cubicBezierAt, findCubicBezierDirectionAt, splitCubicBezier,
    slicePolynomial,
} from './svg-bezier';

import {
    intersectLineWithLine,
    findPolynomialIntersections,
    findCubicBezierSelfIntersections,
    type IntersectionResult,
} from './svg-intersection';

import { ellipseToCubicBeziers } from './svg-arc';

import type {
    ShapePath,
} from 'three';

export interface CreatePathStrokeShapesOptions {
    lineCap?: 'round' | 'square' | 'butt';
    lineJoin?: 'round' | 'bevel' | 'miter' | 'miter-clip' | 'arcs';
    miterLimit?: number;
    width?: number;
    closed?: boolean;
}

export function createPathStrokeShapes(
    shapePath: ShapePath,
    options?: CreatePathStrokeShapesOptions
): Array<Shape> {
    const lineCap = options?.lineCap ?? 'butt';
    const lineJoin = options?.lineJoin ?? 'miter';
    const miterLimit = options?.miterLimit ?? 4;
    const width = options?.width ?? 1;
    const halfWidth = width / 2.0;

    const shapes: Array<Shape> = [];

    for (const path of shapePath.subPaths) {
        let closed = options?.closed ?? false;
        if (path.autoClose) {
            path.closePath();
            closed = true;
        }

        const pathSize = path.curves.length;
        if (pathSize === 0) continue;

        let currentPoint = path.curves[0].getPoint(0);

        const lastInstructionIndex = closed ? -2 : 0;

        const leftPath = new Path();
        const rightPath = new Path();

        let previousInsidePoints: Vector2[] | null = null;
        let previousOutsidePoints: Vector2[] | null = null;
        let previousOutsideIsRight = false;
        let insidePoints: Vector2[] | null = null;
        let outsidePoints: Vector2[] | null = null;
        let outsideIsRight = false;

        curveLoop:
        for (let i = lastInstructionIndex; i < pathSize; i++) {
            const curveIndex = ((i % pathSize) + pathSize) % pathSize;
            const instruction = path.curves[curveIndex];

            let previousDirection = findPathDirectionAt(path, i - 1, false, closed);
            let currentDirection = findPathDirectionAt(path, i, true, closed);

            if (currentDirection.length() == 0) {
                currentDirection = new Vector2(1.0, 0.0);
            }
            if (previousDirection.length() == 0) {
                previousDirection = currentDirection;
            }

            // Create begin line caps
            if (!closed && i == 0) {
                const currentDirectionRotatedCounterClockwise = currentDirection.clone().rotateAround(new Vector2(), -Math.PI / 2);
                const currentDirectionRotatedClockwise = currentDirection.clone().rotateAround(new Vector2(), Math.PI / 2);
                switch (lineCap) {
                    case 'square':
                        if (leftPath.curves.length === 0) {
                            leftPath.moveTo(
                                currentPoint.x - (currentDirection.x * halfWidth),
                                currentPoint.y - (currentDirection.y * halfWidth),
                            );
                        }
                        let point = new Vector2(
                            currentPoint.x + (currentDirectionRotatedCounterClockwise.x * halfWidth) - (currentDirection.x * halfWidth),
                            currentPoint.y + (currentDirectionRotatedCounterClockwise.y * halfWidth) - (currentDirection.y * halfWidth),
                        );
                        if (!isEqualApprox(point, leftPath.currentPoint)) {
                            leftPath.lineTo(point.x, point.y);
                        }
                        point = new Vector2(
                            currentPoint.x + (currentDirectionRotatedCounterClockwise.x * halfWidth),
                            currentPoint.y + (currentDirectionRotatedCounterClockwise.y * halfWidth),
                        );
                        if (!isEqualApprox(point, leftPath.currentPoint)) {
                            leftPath.lineTo(point.x, point.y);
                        }
                        if (rightPath.curves.length === 0) {
                            rightPath.moveTo(
                                currentPoint.x - (currentDirection.x * halfWidth),
                                currentPoint.y - (currentDirection.y * halfWidth),
                            );
                        }
                        point = new Vector2(
                            currentPoint.x + (currentDirectionRotatedClockwise.x * halfWidth) - (currentDirection.x * halfWidth),
                            currentPoint.y + (currentDirectionRotatedClockwise.y * halfWidth) - (currentDirection.y * halfWidth),
                        );
                        if (!isEqualApprox(point, rightPath.currentPoint)) {
                            rightPath.lineTo(point.x, point.y);
                        }
                        point = new Vector2(
                            currentPoint.x + (currentDirectionRotatedClockwise.x * halfWidth),
                            currentPoint.y + (currentDirectionRotatedClockwise.y * halfWidth),
                        );
                        if (!isEqualApprox(point, rightPath.currentPoint)) {
                            rightPath.lineTo(point.x, point.y);
                        }
                        break;
                    case 'round':
                        const startPoint = currentPoint.clone().add(currentDirectionRotatedClockwise.clone().multiplyScalar(halfWidth));
                        const endPoint = currentPoint.clone().add(currentDirectionRotatedCounterClockwise.clone().multiplyScalar(halfWidth));
                        if (leftPath.curves.length === 0) {
                            leftPath.moveTo(
                                startPoint.x,
                                startPoint.y,
                            );
                        }
                        circleSegmentToQuadraticBezier(
                            leftPath,
                            startPoint,
                            endPoint,
                            currentDirection.clone().multiplyScalar(-1),
                            currentDirection,
                            width,
                            Math.PI
                        );
                        break;
                }
            }

            // Create interior lines and joints
            if (true) {
                const cornerAngle = angleTo(previousDirection, currentDirection);
                previousOutsideIsRight = outsideIsRight;
                outsideIsRight = cornerAngle <= 0;

                const insidePath: Path = outsideIsRight ? leftPath : rightPath;
                const outsidePath: Path = outsideIsRight ? rightPath : leftPath;
                const inside90Rotation = outsideIsRight ? -Math.PI / 2 : Math.PI / 2;
                const outside90Rotation = outsideIsRight ? Math.PI / 2 : -Math.PI / 2;

                const tempPreviousInsidePoints = previousInsidePoints;
                const tempPreviousOutsidePoints = previousOutsidePoints;
                previousInsidePoints = outsideIsRight == previousOutsideIsRight ? tempPreviousInsidePoints : tempPreviousOutsidePoints;
                previousOutsidePoints = outsideIsRight == previousOutsideIsRight ? tempPreviousOutsidePoints : tempPreviousInsidePoints;

                insidePoints = [currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), inside90Rotation).multiplyScalar(halfWidth))];
                outsidePoints = [currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth))];

                switch (instruction.type) {
                    case 'LineCurve': {
                        if (!isEqualApprox(instruction.v1, instruction.v2)) {
                            insidePoints.push(instruction.v2.clone().add(currentDirection.clone().rotateAround(new Vector2(), inside90Rotation).multiplyScalar(halfWidth)));
                            outsidePoints.push(instruction.v2.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth)));
                        } else {
                            continue curveLoop;
                        }
                        break;
                    }
                    case 'QuadraticBezierCurve': case 'CubicBezierCurve': {
                        const curvePoints = [currentPoint];
                        if (instruction.isQuadraticBezierCurve) {
                            curvePoints.push(
                                new Vector2(
                                    instruction.v0.x + (2 / 3) * (instruction.v1.x - instruction.v0.x),
                                    instruction.v0.y + (2 / 3) * (instruction.v1.y - instruction.v0.y),
                                )
                            );
                            curvePoints.push(
                                new Vector2(
                                    instruction.v2.x + (2 / 3) * (instruction.v1.x - instruction.v2.x),
                                    instruction.v2.y + (2 / 3) * (instruction.v1.y - instruction.v2.y),
                                )
                            );
                            curvePoints.push(instruction.v2);
                        } else {
                            curvePoints.push(instruction.v1);
                            curvePoints.push(instruction.v2);
                            curvePoints.push(instruction.v3);
                        }
                        const insideOffset = outsideIsRight ? -halfWidth : halfWidth;
                        const outsideOffset = -insideOffset;
                        insidePoints = adaptiveOffsetCurve(curvePoints, insideOffset)
                        outsidePoints = adaptiveOffsetCurve([...curvePoints], outsideOffset)
                        break;
                    }
                    case 'EllipseCurve': {
                        const curves = ellipseToCubicBeziers(instruction as never);
                        const insideOffset = outsideIsRight ? -halfWidth : halfWidth;
                        const outsideOffset = -insideOffset;
                        insidePoints = [];
                        outsidePoints = [];
                        for (const curve of curves) {
                            insidePoints = insidePoints.concat(
                                adaptiveOffsetCurve([curve.v0, curve.v1, curve.v2, curve.v3], insideOffset)
                            );
                            outsidePoints = outsidePoints.concat(
                                adaptiveOffsetCurve([curve.v0, curve.v1, curve.v2, curve.v3], outsideOffset)
                            );
                        }
                        break;
                    }
                    default:
                        console.warn('[src/renderers/webgl2/layers/vector/svg-stroke-path.ts] Unsupported curve type encountered ' + instruction.type);
                        continue;
                }

                let insideIntersectionPoint = insidePoints[0];
                if (previousInsidePoints != null && i >= 0) {
                    const insideIntersection = intersectInsidePathCorner(previousInsidePoints, insidePoints);
                    if (insidePath.curves.length > 0 && insideIntersection.previous != null) {
                        const lastInsidePathCurve = insidePath.curves[insidePath.curves.length - 1];
                        const previousIntersectionPoint = insideIntersection.previous[insideIntersection.previous.length - 1];
                        switch (lastInsidePathCurve.type) {
                            case 'LineCurve':
                                lastInsidePathCurve.v2 = previousIntersectionPoint.clone();
                                break;
                            case 'QuadraticBezierCurve':
                                lastInsidePathCurve.v2 = previousIntersectionPoint.clone();
                                break;
                            case 'CubicBezierCurve':
                                lastInsidePathCurve.v3 = previousIntersectionPoint.clone();
                                break;
                        }
                        insidePath.moveTo(previousIntersectionPoint.x, previousIntersectionPoint.y);
                    }
                    insidePoints = insideIntersection.current;
                    if (insideIntersection.previous != null) {
                        insideIntersectionPoint = insideIntersection.previous[insideIntersection.previous.length - 1];
                    }
                }

                if (previousOutsidePoints != null && i >= 0) {
                    let useLineJoin: typeof lineJoin | null = lineJoin;
                    if (useLineJoin == 'arcs') {
                        useLineJoin = 'miter';
                    }
                    
                    let miterOutsideIntersection: Vector2 | null = outsidePoints[0];
                    let calculatedMiterLimit = 0;
                    if (useLineJoin == 'miter' || useLineJoin == 'miter-clip') {
                        const previousLineStartPoint = currentPoint.clone().add(previousDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                        const currentLineStartPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                        miterOutsideIntersection = intersectLineWithLine(
                            previousLineStartPoint,
                            previousLineStartPoint.clone().add(previousDirection),
                            currentLineStartPoint,
                            currentLineStartPoint.clone().add(currentDirection.clone().multiplyScalar(-1)),
                        )[0]?.point ?? null;
                        if (miterOutsideIntersection != null) {
                            const miterLength = insideIntersectionPoint.distanceTo(miterOutsideIntersection);
                            calculatedMiterLimit = miterLength / width;
                            if (miterLimit < calculatedMiterLimit && useLineJoin == 'miter') {
                                useLineJoin = 'bevel';
                            }
                        }
                    }

                    if (isEqualApprox(previousDirection, currentDirection)) {
                        useLineJoin = null;
                    }

                    switch (useLineJoin) {
                        case 'bevel':
                            if (outsidePath.curves.length === 0) {
                                outsidePath.moveTo(
                                    previousOutsidePoints[previousOutsidePoints.length - 1].x,
                                    previousOutsidePoints[previousOutsidePoints.length - 1].y,
                                );
                            }
                            if (!isEqualApprox(outsidePoints[0], outsidePath.currentPoint)) {
                                outsidePath.lineTo(
                                    outsidePoints[0].x,
                                    outsidePoints[0].y
                                );
                            }
                            break;
                        case 'miter':
                            if (outsidePath.curves.length === 0) {
                                outsidePath.moveTo(
                                    previousOutsidePoints[previousOutsidePoints.length - 1].x,
                                    previousOutsidePoints[previousOutsidePoints.length - 1].y,
                                );
                            }
                            if (miterOutsideIntersection != null) {
                                if (!isEqualApprox(miterOutsideIntersection, outsidePath.currentPoint)) {
                                    outsidePath.lineTo(
                                        miterOutsideIntersection.x,
                                        miterOutsideIntersection.y,
                                    );
                                }
                            } else {
                                const point = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                                if (!isEqualApprox(point, outsidePath.currentPoint)) {
                                    outsidePath.lineTo(
                                        point.x,
                                        point.y,
                                    );
                                }
                            }
                            if (!isEqualApprox(outsidePoints[0], outsidePath.currentPoint)) {
                                outsidePath.lineTo(
                                    outsidePoints[0].x,
                                    outsidePoints[0].y,
                                );
                            }
                            break;
                        case 'miter-clip': // Not sure this meets the spec? https://www.w3.org/TR/SVG2/painting.html#LineJoin
                            if (outsidePath.curves.length === 0) {
                                outsidePath.moveTo(
                                    previousOutsidePoints[previousOutsidePoints.length - 1].x,
                                    previousOutsidePoints[previousOutsidePoints.length - 1].y,
                                );
                            }
                            if (miterLimit < calculatedMiterLimit) {
                                const clipLength = (miterLimit / 2) * width;
                                const cornerDirection = directionTo(insideIntersectionPoint, miterOutsideIntersection);
                                var clipPoint = currentPoint.clone().add(cornerDirection.clone().multiplyScalar(clipLength));
                                var clipDirection = cornerDirection.clone().rotateAround(new Vector2(), Math.PI / 2);
                                var outsideEdgeStart = intersectLineWithLine(
                                    currentPoint.clone().add(previousDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth)),
                                    previousDirection,
                                    clipPoint,
                                    clipDirection
                                )[0]?.point ?? currentPoint.clone();
                                var outsideEdgeEnd = intersectLineWithLine(
                                    currentPoint.add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth)),
                                    currentDirection.clone().multiplyScalar(-1),
                                    clipPoint,
                                    clipDirection
                                )[0]?.point ?? currentPoint.clone();
                                if (!isEqualApprox(outsideEdgeStart, outsidePath.currentPoint)) {
                                    outsidePath.lineTo(
                                        outsideEdgeStart.x,
                                        outsideEdgeStart.y,
                                    );
                                }
                                if (!isEqualApprox(outsideEdgeEnd, outsidePath.currentPoint)) {
                                    outsidePath.lineTo(
                                        outsideEdgeEnd.x,
                                        outsideEdgeEnd.y,
                                    );
                                }
                            } else {
                                if (miterOutsideIntersection != null) {
                                    if (!isEqualApprox(miterOutsideIntersection, outsidePath.currentPoint)) {
                                        outsidePath.lineTo(
                                            miterOutsideIntersection.x,
                                            miterOutsideIntersection.y,
                                        );
                                    }
                                } else {
                                    const point = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                                    if (!isEqualApprox(point, outsidePath.currentPoint)) {
                                        outsidePath.lineTo(
                                            point.x,
                                            point.y,
                                        );
                                    }
                                }
                            }
                            if (!isEqualApprox(outsidePoints[0], outsidePath.currentPoint)) {
                                outsidePath.lineTo(
                                    outsidePoints[0].x,
                                    outsidePoints[0].y,
                                )
                            }
                            break;
                        case 'round':
                            const startPoint = currentPoint.clone().add(previousDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                            const endPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), outside90Rotation).multiplyScalar(halfWidth));
                            if (outsidePath.curves.length === 0) {
                                outsidePath.moveTo(
                                    startPoint.x,
                                    startPoint.y,
                                );
                            }
                            circleSegmentToQuadraticBezier(
                                outsidePath,
                                startPoint,
                                endPoint,
                                previousDirection,
                                currentDirection,
                                width,
                                cornerAngle,
                            );
                            break;
                    }
                }

                if (i >= 0) {
                    if (insidePath.curves.length === 0) {
                        insidePath.moveTo(
                            insidePoints[0].x,
                            insidePoints[0].y,
                        );
                    }
                    const insideControlPoints = insidePoints.slice(1);
                    switch (insidePoints.length) {
                        case 2:
                            if (!isEqualApprox(insideControlPoints[0], insidePath.currentPoint)) {
                                insidePath.lineTo(
                                    insideControlPoints[0].x,
                                    insideControlPoints[0].y,
                                );
                            }
                            break;
                        case 3:
                            insidePath.quadraticCurveTo(
                                insideControlPoints[0].x,
                                insideControlPoints[0].y,
                                insideControlPoints[1].x,
                                insideControlPoints[1].y,
                            );
                            break;
                        case 4:
                            insidePath.bezierCurveTo(
                                insideControlPoints[0].x,
                                insideControlPoints[0].y,
                                insideControlPoints[1].x,
                                insideControlPoints[1].y,
                                insideControlPoints[2].x,
                                insideControlPoints[2].y,
                            );
                            break;
                        default: // Assume multiple cubic beziers
                            if (insidePoints.length > 0 && insidePoints.length % 4 === 0) {
                                for (let k = 0; k < insidePoints.length; k += 4) {
                                    const points = insidePoints.slice(k + 1, k + 4);
                                    insidePath.bezierCurveTo(
                                        points[0].x,
                                        points[0].y,
                                        points[1].x,
                                        points[1].y,
                                        points[2].x,
                                        points[2].y,
                                    );
                                }
                            }
                    }
                    if (outsidePath.curves.length === 0) {
                        outsidePath.moveTo(
                            outsidePoints[0].x,
                            outsidePoints[0].y,
                        );
                    }
                    const outsideControlPoints = outsidePoints.slice(1);
                    switch (outsidePoints.length) {
                        case 2:
                            if (!isEqualApprox(outsideControlPoints[0], outsidePath.currentPoint)) {
                                outsidePath.lineTo(
                                    outsideControlPoints[0].x,
                                    outsideControlPoints[0].y,
                                );
                            }
                            break;
                        case 3:
                            outsidePath.quadraticCurveTo(
                                outsideControlPoints[0].x,
                                outsideControlPoints[0].y,
                                outsideControlPoints[1].x,
                                outsideControlPoints[1].y,
                            );
                            break;
                        case 4:
                            outsidePath.bezierCurveTo(
                                outsideControlPoints[0].x,
                                outsideControlPoints[0].y,
                                outsideControlPoints[1].x,
                                outsideControlPoints[1].y,
                                outsideControlPoints[2].x,
                                outsideControlPoints[2].y,
                            );
                            break;
                        default: // Assume multiple cubic beziers
                            if (outsidePoints.length > 0 && outsidePoints.length % 4 === 0) {
                                for (let k = 0; k < outsidePoints.length; k += 4) {
                                    const points = outsidePoints.slice(k + 1, k + 4);
                                    outsidePath.bezierCurveTo(
                                        points[0].x,
                                        points[0].y,
                                        points[1].x,
                                        points[1].y,
                                        points[2].x,
                                        points[2].y,
                                    );
                                }
                            }
                    }
                }

                previousInsidePoints = insidePoints;
                previousOutsidePoints = outsidePoints;

            }

            // Reset current point to end of current line
            switch (instruction.type) {
                case 'LineCurve':
                    currentPoint = instruction.v2;
                    break;
                case 'QuadraticBezierCurve':
                    currentPoint = instruction.v2;
                    break;
                case 'CubicBezierCurve':
                    currentPoint = instruction.v3;
                    break;
            }

            // Create end line caps
            if (!closed && i == pathSize - 1) {
                switch (lineCap) {
                    case 'square':
                        if (leftPath.curves.length === 0) {
                            const moveToPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), -Math.PI / 2).multiplyScalar(halfWidth));
                            leftPath.moveTo(
                                moveToPoint.x,
                                moveToPoint.y,
                            );
                        }
                        let point = currentPoint.clone()
                            .add(currentDirection.clone().rotateAround(new Vector2(), -Math.PI / 2).multiplyScalar(halfWidth))
                            .add(currentDirection.clone().multiplyScalar(halfWidth));
                        if (!isEqualApprox(point, leftPath.currentPoint)) {
                            leftPath.lineTo(
                                point.x,
                                point.y,
                            );
                        }
                        point = currentPoint.clone().add(currentDirection.clone().multiplyScalar(halfWidth));
                        if (!isEqualApprox(point, leftPath.currentPoint)) {
                            leftPath.lineTo(
                                point.x,
                                point.y,
                            );
                        }
                        if (rightPath.curves.length === 0) {
                            const moveToPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), Math.PI / 2).multiplyScalar(halfWidth));
                            rightPath.moveTo(
                                moveToPoint.x,
                                moveToPoint.y,
                            );
                        }
                        point = currentPoint.clone()
                            .add(currentDirection.clone().rotateAround(new Vector2(), Math.PI / 2).multiplyScalar(halfWidth))
                            .add(currentDirection.clone().multiplyScalar(halfWidth));
                        if (!isEqualApprox(point, rightPath.currentPoint)) {
                            rightPath.lineTo(
                                point.x,
                                point.y,
                            );
                        }
                        point = currentPoint.clone().add(currentDirection.clone().multiplyScalar(halfWidth));
                        if (!isEqualApprox(point, rightPath.currentPoint)) {
                            rightPath.lineTo(
                                point.x,
                                point.y,
                            );
                        }
                        break;
                    case 'round':
                        const startPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), Math.PI / 2).multiplyScalar(halfWidth));
                        const endPoint = currentPoint.clone().add(currentDirection.clone().rotateAround(new Vector2(), -Math.PI / 2).multiplyScalar(halfWidth));
                        if (rightPath.curves.length === 0) {
                            rightPath.moveTo(
                                startPoint.x,
                                startPoint.y,
                            );
                        }
                        circleSegmentToQuadraticBezier(
                            rightPath,
                            startPoint,
                            endPoint,
                            currentDirection,
                            currentDirection.clone().multiplyScalar(-1),
                            width,
                            Math.PI,
                        );
                        break;
                    default:
                        if (leftPath.curves.length === 0) {
                            leftPath.moveTo(
                                currentPoint.x,
                                currentPoint.y,
                            );
                        }
                        if (!isEqualApprox(rightPath.currentPoint, leftPath.currentPoint)) {
                            leftPath.lineTo(
                                rightPath.currentPoint.x,
                                rightPath.currentPoint.y,
                            );
                        }
                }
            }
        }

        const shape = new Shape();
        shape.curves = leftPath.curves.slice();
        const reversedRightPath = reversePath(rightPath);
        for (const curve of reversedRightPath.curves) {
            shape.add(curve);
        }
        shape.autoClose = closed;
        shapes.push(shape);
    }

    return shapes;
}

function reversePath(path: Path): Path {
    const reversed = new Path();
    const curves = path.curves.slice().reverse();

    if (curves.length === 0) return reversed;

    const firstPoint = curves[0].getPoint(1);
    reversed.moveTo(firstPoint.x, firstPoint.y);

    for (const curve of curves) {
        if (curve.type === 'LineCurve') {
            const p = curve.v1;
            reversed.lineTo(p.x, p.y);
        } else if (curve.type === 'QuadraticBezierCurve') {
            reversed.quadraticCurveTo(
                curve.v1.x,
                curve.v1.y,
                curve.v0.x,
                curve.v0.y,
            );
        } else if (curve.type === 'CubicBezierCurve') {
            reversed.bezierCurveTo(
                curve.v2.x,
                curve.v2.y,
                curve.v1.x,
                curve.v1.y,
                curve.v0.x,
                curve.v0.y,
            );
        } else if (curve.type === 'EllipseCurve') {
            reversed.absellipse(
                curve.aX,
                curve.aY,
                curve.xRadius,
                curve.yRadius,
                curve.aEndAngle,
                curve.aStartAngle,
                !curve.aClockwise,
                curve.aRotation,
            );
        } else if (curve.type === 'SplineCurve') {
            const points = curve.points
                .slice()
                .reverse()
                .map(p => p.clone());
            reversed.splineThru(points.slice(1));
        }
    }
    return reversed;
}

// Intersects two path commands and joins them at their ends
function intersectInsidePathCorner(previousPoints: Vector2[] | null, currentPoints: Vector2[]) {
    var newPreviousPoints: Vector2[] | null = null;
    var newCurrentPoints: Vector2[] | null = null;
    if (previousPoints == null) {
        newCurrentPoints = currentPoints;
    } else {
        let previousShape: Vector2[];
        switch (previousPoints.length) {
            case 2:
                previousShape = [previousPoints[0], previousPoints[1]];
                break;
            case 3:
                previousShape = [previousPoints[0], previousPoints[1], previousPoints[2]];
                break;
            case 4:
                previousShape = [previousPoints[0], previousPoints[1], previousPoints[2], previousPoints[3]];
                break;
            default:
                previousShape = [
                    previousPoints[previousPoints.length - 4],
                    previousPoints[previousPoints.length - 3],
                    previousPoints[previousPoints.length - 2],
                    previousPoints[previousPoints.length - 1],
                ];
        }
        let currentShape: Vector2[];
        switch (currentPoints.length) {
            case 2:
                currentShape = [currentPoints[0], currentPoints[1]];
                break;
            case 3:
                currentShape = [currentPoints[0], currentPoints[1], currentPoints[2]];
                break;
            case 4:
                currentShape = [currentPoints[0], currentPoints[1], currentPoints[2], currentPoints[3]];
                break;
            default:
                currentShape = [currentPoints[0], currentPoints[1], currentPoints[2], currentPoints[3]];
        }
        const intersections = findPolynomialIntersections(previousShape, currentShape);
        if (intersections.length > 0) {
            let winningIntersection: IntersectionResult | null = null;
            let winningOtherT = Infinity;
            for (let intersection of intersections) {
                if (intersection.t1 < winningOtherT) {
                    winningIntersection = intersection;
                    winningOtherT = intersection.t1;
                }
            }
            newPreviousPoints = previousPoints.slice(0, -previousShape.length).concat(
                slicePolynomial(previousShape, 0.0, winningIntersection!.t0)
            );
            newCurrentPoints = slicePolynomial(currentShape, winningIntersection!.t1, 1.0).concat(
                currentPoints.slice(currentShape.length)
            );
        } else {
            newPreviousPoints = previousPoints
            newCurrentPoints = currentPoints
        }
    }
    return {
        previous: newPreviousPoints,
        current: newCurrentPoints,
    };
}

function adaptiveOffsetCurve(curvePoints: Vector2[], offset: number, recursionCount = 0): Vector2[] {
    const hNormal = findCubicBezierDirectionAt(
        curvePoints[0].clone().add(curvePoints[1]),
        new Vector2(),
        new Vector2(),
        curvePoints[2].clone().add(curvePoints[3]),
        0.5,
    ).rotateAround(new Vector2(), Math.PI / 2).multiplyScalar(offset);

    const segment1 = offsetSegment(
        [curvePoints[1].clone().multiplyScalar(-1), curvePoints[0], curvePoints[1]],
        curvePoints[0], curvePoints[1], curvePoints[2], curvePoints[3], hNormal, offset
    );
    const segment2 = offsetSegment(
        [curvePoints[2], curvePoints[3], curvePoints[2].clone().multiplyScalar(-1)],
        curvePoints[0], curvePoints[1], curvePoints[2], curvePoints[3], hNormal, offset
    );
    if (recursionCount < 16 && findCubicBezierSelfIntersections(segment1[1], segment1[2], segment2[0], segment2[1]).length == 0) {
        const threshold = Math.min(Math.abs(offset) / 20.0, 1.0);
        const midOffset = cubicBezierAt(segment1[1], segment1[2], segment2[0], segment2[1], 0.5).distanceTo(
            cubicBezierAt(curvePoints[0], curvePoints[1], curvePoints[2], curvePoints[3], 0.5)
        );
        if (Math.abs(midOffset - Math.abs(offset)) > threshold) {
            const curveSplit = splitCubicBezier(curvePoints[0], curvePoints[1], curvePoints[2], curvePoints[3], 0.5)
            let returnSplits: Vector2[] = [];
            returnSplits = returnSplits.concat(
                adaptiveOffsetCurve([curveSplit[0], curveSplit[1], curveSplit[2], curveSplit[3]], offset, recursionCount + 1)
            );
            returnSplits = returnSplits.concat(
                adaptiveOffsetCurve([curveSplit[3], curveSplit[4], curveSplit[5], curveSplit[6]], offset, recursionCount + 1)
            );
            return returnSplits;
        }
    }
    return [segment1[1], segment1[2], segment2[0], segment2[1]];
}

function offsetSegment(segmentPoints: Vector2[], p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, handleNormal: Vector2, offset: number) {
    var isFirst = segmentPoints[1] == p0;
    var offsetVector = findCubicBezierDirectionAt(p0, p1, p2, p3, isFirst ? 0 : 1)
        .rotateAround(new Vector2(), Math.PI / 2).multiplyScalar(offset);
    var point = segmentPoints[1].clone().add(offsetVector);
    var newSegment = [point, point, point];
    var handleIndex = isFirst ? 2 : 0;
    newSegment[handleIndex] = segmentPoints[handleIndex].clone().add((handleNormal.clone().add(offsetVector)).divideScalar(2.0));
    return newSegment;
}

function circleSegmentToQuadraticBezier(
    path: Path,
    startPoint: Vector2,
    endPoint: Vector2,
    startDirection: Vector2,
    endDirection: Vector2,
    pointWidth: number,
    angle: number
) {
    const absAngle = Math.abs(angle);
    const bezierSegments = (2.0 * Math.PI) / absAngle
    const handleOffsetUnit = (4.0 / 3.0) * Math.tan(Math.PI / (2.0 * bezierSegments));
    path.bezierCurveTo(
        startPoint.x + (startDirection.x * handleOffsetUnit * (pointWidth / 2)),
        startPoint.y + (startDirection.y * handleOffsetUnit * (pointWidth / 2)),
        endPoint.x + (-endDirection.x * handleOffsetUnit * (pointWidth / 2)),
        endPoint.y + (-endDirection.y * handleOffsetUnit * (pointWidth / 2)),
        endPoint.x,
        endPoint.y,
    );
}

function findPathDirectionAt(path: Path, pathIndex: number, isStart: boolean, closed: boolean): Vector2 {
    const epsilon = 0.00001;
    const curveLength = path.curves.length;

    if (pathIndex < 0) {
        if (closed) {
            pathIndex = ((pathIndex % curveLength) + curveLength) % curveLength;
            isStart = false;
        } else {
            pathIndex = 0;
            isStart = true;
        }
    } else if (pathIndex > path.curves.length - 1) {
        if (closed) {
            pathIndex = ((pathIndex % curveLength) + curveLength) % curveLength;
            isStart = true;
        } else {
            pathIndex = path.curves.length - 1;
            isStart = false;
        }
    }

    let p0!: Vector2;
    let p1!: Vector2;
    let loopCount = 0;
    while (loopCount < 4) {
        const curve = path.curves[pathIndex];
        switch (curve.type) {
            case 'LineCurve':
                if (isEqualApprox(curve.v1, curve.v2, epsilon / 2)) {
                    p0 = curve.v1;
                    p1 = curve.v2;
                } else {
                    p0 = curve.getPointAt(0);
                    p1 = curve.getPointAt(1);
                }
                break;
            default:
                if (isStart) {
                    p0 = curve.getPointAt(0);
                    p1 = curve.getPointAt(epsilon);
                } else {
                    p0 = curve.getPointAt(1 - epsilon);
                    p1 = curve.getPointAt(1);
                }
        }
        if (!isEqualApprox(p0, p1, epsilon / 2)) {
            break;
        }
        pathIndex--;
        pathIndex = ((pathIndex % curveLength) + curveLength) % curveLength;
        loopCount++;
    }

    if (isEqualApprox(p0, p1, epsilon / 2)) {
        return new Vector2();
    } else {
        return directionTo(
            p0,
            p1,
        );
    }
}

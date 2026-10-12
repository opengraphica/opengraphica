
import wasmLoadModule, {
    path_contains_path as wasmPathContainsPath,
    path_to_polyline as wasmPathToPolyline,
    simplify_path as wasmSimplifyPath,
} from './build/vector_process_wasm';

import { Path } from 'three/src/extras/core/Path';

import { Clipper, PolyType, ClipType, Paths, PolyFillType } from '@/lib/clipper';
import { clockwiseAngle2d, findPointListBounds, isEqualApprox } from '@/lib/math';
import { serializeVectorPathCommands, parseVectorPathCommand } from '@/lib/svg';

import { VectorPathCommandType } from '@/types/vector';
import type {
    BrushDefinition, VectorPathCommand, VectorPathCommandMove, VectorPathCommandLine,
} from '@/types';

let isWasmModuleLoaded = false;
let isWasmModuleLoadError = false;

async function waitForWasmReady() {
    if (!isWasmModuleLoaded && !isWasmModuleLoadError) {
        try {
            await wasmLoadModule();
            isWasmModuleLoaded = true;
        } catch {
            isWasmModuleLoadError = true;
        }
    }
}

export async function pathToPolylines(
    pathCommands: string | VectorPathCommand[],
): Promise<Array<Array<VectorPathCommandMove | VectorPathCommandLine>>> {
    waitForWasmReady();

    if (isWasmModuleLoaded) {

        const polylineCommand = wasmPathToPolyline(
            typeof pathCommands === 'string' ? pathCommands : serializeVectorPathCommands(pathCommands)
        );

        const polylines: Array<Array<VectorPathCommandMove | VectorPathCommandLine>> = [];
        let currentPolyline: Array<VectorPathCommandMove | VectorPathCommandLine> = [];
        for (const command of parseVectorPathCommand(polylineCommand)) {
            if (command.type !== VectorPathCommandType.CLOSE) {
                currentPolyline.push(command as VectorPathCommandMove | VectorPathCommandLine);
            } else {
                polylines.push(currentPolyline);
                currentPolyline = [];
            }
        }
        if (currentPolyline.length > 0) {
            polylines.push(currentPolyline);
        }
        return polylines;

    } else {

        const commands = typeof pathCommands === 'string' ? parseVectorPathCommand(pathCommands) : pathCommands;

        const paths: Path[] = [];
        let path = new Path();
        for (const command of commands) {
            switch (command.type) {
                case VectorPathCommandType.CLOSE:
                    if (path.curves.length > 0) {
                        paths.push(path);
                        path = new Path();
                    }
                    break;
                case VectorPathCommandType.CUBIC_BEZIER_CURVE:
                    path.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
                    break;
                case VectorPathCommandType.LINE:
                    path.lineTo(command.x, command.y);
                    break;
                case VectorPathCommandType.QUADRATIC_BEZIER_CURVE:
                    path.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
                    break;
                case VectorPathCommandType.MOVE:
                    if (path.curves.length > 0) {
                        paths.push(path);
                        path = new Path();
                    }
                    path.moveTo(command.x, command.y);
                    break;
            }
        }
        if (path.curves.length > 0) {
            paths.push(path);
        }

        const polylines: Array<Array<VectorPathCommandMove | VectorPathCommandLine>> = [];
        let currentPolyline: Array<VectorPathCommandMove | VectorPathCommandLine> = [];
        for (const path of paths) {
            if (currentPolyline.length > 0) {
                polylines.push(currentPolyline);
                currentPolyline = [];
            }
            for (const point of path.getPoints()) {
                currentPolyline.push({
                    type: currentPolyline.length === 0 ? VectorPathCommandType.MOVE : VectorPathCommandType.LINE,
                    x: point.x,
                    y: point.y,
                });
            }
        }
        if (currentPolyline.length > 0) {
            polylines.push(currentPolyline);
        }
        return polylines;

    }
}

export async function polylineToSimplifiedPath(
    polyline: VectorPathCommand[],
): Promise<VectorPathCommand[]> {
    waitForWasmReady();
    if (isWasmModuleLoaded) {
        const polylineCommand = serializeVectorPathCommands(polyline);

        const pathCommand = wasmSimplifyPath(polylineCommand);

        const path = parseVectorPathCommand(pathCommand);
        
        return path;
    } else {
        return polyline;
    }
}

/**
 * Returns true if a fully contains b (b is inside of a)
 */
export async function pathContainsPath(
    a: string | VectorPathCommand[],
    b: string | VectorPathCommand[],
): Promise<boolean> {
    waitForWasmReady()

    if (isWasmModuleLoaded) {
       return wasmPathContainsPath(
            typeof a === 'string' ? a : serializeVectorPathCommands(a),
            typeof b === 'string' ? b : serializeVectorPathCommands(b),
        );
    } else {

        const aPaths = await pathToPolylines(typeof a === 'string' ? parseVectorPathCommand(a) : a);
        const bPaths = await pathToPolylines(typeof b === 'string' ? parseVectorPathCommand(b) : b);

        for (const aPath of aPaths) {
            const aBounds = findPointListBounds(aPath);
            for (const bPath of bPaths) {
                const bBounds = findPointListBounds(bPath);
                if (!(
                    bBounds.left > aBounds.right
                    || bBounds.right < aBounds.left
                    || bBounds.top > aBounds.bottom
                    || bBounds.bottom < aBounds.top
                )) {
                    return true;
                }
            }
        }

        return false;

    }
}

let brushStrokeIterator: number = 0;
let brushStrokes: Record<number, Array<Array<{ x: number, y: number }>>> = {};

export async function createPathBrushStroke(
    path: string,
): Promise<number> {
    await waitForWasmReady();

    const index = brushStrokeIterator++;
    const polylines = await pathToPolylines(path);
    brushStrokes[index] = polylines;

    return index;
}

export async function movePathBrushStroke(
    strokeIndex: number,
    path: string,
): Promise<void> {
    const clipPolylines = await pathToPolylines(path);
    const clipper = new Clipper();
    for (const path of brushStrokes[strokeIndex]) {
        clipper.AddPath(path, PolyType.ptSubject, true);
    }
    for (const clipPolyline of clipPolylines) {
        clipper.AddPath(clipPolyline, PolyType.ptClip, true);
    }
    const solution: Paths = [];
    clipper.Execute(ClipType.ctUnion, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd);
    brushStrokes[strokeIndex] = solution;
}

export async function stopPathBrushStroke(
    strokeIndex: number,
): Promise<Array<Array<VectorPathCommandMove | VectorPathCommandLine>>> {
    const brushStroke = brushStrokes[strokeIndex];
    if (!brushStroke) return [];

    const paths: Array<Array<VectorPathCommandMove | VectorPathCommandLine>> = [];
    for (const path of brushStroke) {
        paths.push(path.map((point, pointIndex) => {
            return {
                type: pointIndex == 0 ? VectorPathCommandType.MOVE : VectorPathCommandType.LINE,
                x: point.x,
                y: point.y,
            }
        }));
    }
    return paths;
}

export function createBrushShapePathCap(
    cx: number,
    cy: number,
    shape: BrushDefinition['shape'],
    size: number,
    rotation: number,
): string {
    if (shape === 'circle') {
        const k = 0.5522847498307936;
        let d = '';
        let r = size / 2;
        if (size > 0) {
            const rk = k * r;
            d = [
                `M ${cx} ${cy - r}`,
                `C ${cx + rk} ${cy - r}, ${cx + r} ${cy - rk}, ${cx + r} ${cy}`,
                `C ${cx + r} ${cy + rk}, ${cx + rk} ${cy + r}, ${cx} ${cy + r}`,
                `C ${cx - rk} ${cy + r}, ${cx - r} ${cy + rk}, ${cx - r} ${cy}`,
                `C ${cx - r} ${cy - rk}, ${cx - rk} ${cy - r}, ${cx} ${cy - r}`,
                'Z',
            ].join(' ');
        }
        return d;
    } else if (shape === 'square') {
        const r = size / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const points = [
            [-r, -r],
            [ r, -r],
            [ r,  r],
            [-r,  r],
            [-r,  -r],
        ].map(([x, y]) => [
            cx + x * cos - y * sin,
            cy + x * sin + y * cos,
        ]);
        return [
            `M ${points[0][0]},${points[0][1]}`,
            ...points.slice(1).map(([x, y]) => `L ${x},${y}`),
            'Z',
        ].join(' ');
    }
    return '';
}

type Point = { x: number; y: number };

function quarterArc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    k: number,
): string {
    const endAngle = startAngle + Math.PI / 2;
    const controlDistance = k * radius;

    const startX = x + radius * Math.cos(startAngle);
    const startY = y + radius * Math.sin(startAngle);
    const endX = x + radius * Math.cos(endAngle);
    const endY = y + radius * Math.sin(endAngle);

    const control1X = startX - controlDistance * Math.sin(startAngle);
    const control1Y = startY + controlDistance * Math.cos(startAngle);
    const control2X = endX + controlDistance * Math.sin(endAngle);
    const control2Y = endY - controlDistance * Math.cos(endAngle);

    return `C ${control1X},${control1Y} ${control2X},${control2Y} ${endX},${endY}`;
};

function getSquareCorners(x: number, y: number, squareSize: number, angle: number): Point[] {
    const half = squareSize / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
    ].map(([localX, localY]) => ({
        x: x + localX * cos - localY * sin,
        y: y + localX * sin + localY * cos,
    }));
};

function cross(o: Point, a: Point, b: Point) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function createBrushShapePathLine(
    cx: number,
    cy: number,
    prevCx: number,
    prevCy: number,
    prevPrevCx: number,
    prevPrevCy: number,
    shape: BrushDefinition['shape'],
    size: number,
    prevSize: number,
    rotation: number,
    prevRotation: number,
): string {
    const pathAngle = clockwiseAngle2d(cx, cy, prevCx, prevCy);
    const prevPathAngle = (isEqualApprox(prevCx, prevPrevCx) && isEqualApprox(prevCy, prevPrevCy))
        ? pathAngle
        : clockwiseAngle2d(prevCx, prevCy, prevPrevCx, prevPrevCy);

    if (shape === 'circle') {
        const k = 0.5522847498307936;

        const r1 = size / 2;
        const r2 = prevSize / 2;

        const path = [
            `M ${cx - r1 * Math.cos(pathAngle)},${cy - r1 * Math.sin(pathAngle)}`,
            quarterArc(cx, cy, r1, pathAngle + Math.PI, k),
            `L ${prevCx + r2 * Math.sin(prevPathAngle)},${prevCy - r2 * Math.cos(prevPathAngle)}`,
            quarterArc(prevCx, prevCy, r2, prevPathAngle - Math.PI / 2, k),
            quarterArc(prevCx, prevCy, r2, prevPathAngle, k),
            `L ${cx - r1 * Math.sin(pathAngle)},${cy + r1 * Math.cos(pathAngle)}`,
            quarterArc(cx, cy, r1, pathAngle + Math.PI / 2, k),
            'Z',
        ].join(' ');

        return path;
    } else if (shape === 'square') {

        const points = [
            ...getSquareCorners(cx, cy, size, rotation),
            ...getSquareCorners(prevCx, prevCy, prevSize, prevRotation),
        ].sort((a, b) => a.x - b.x || a.y - b.y);

        const lower: Point[] = [];
        for (const point of points) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
                lower.pop();
            }
            lower.push(point);
        }

        const upper: Point[] = [];
        for (const point of [...points].reverse()) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
                upper.pop();
            }
            upper.push(point);
        }

        const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];

        const path = [
            `M ${hull[0].x},${hull[0].y}`,
            ...hull.slice(1).map(({ x, y }) => `L ${x},${y}`),
            `L ${hull[0].x},${hull[0].y}`,
            'Z',
        ].join(' ');

        return path;
    }

    return '';
}

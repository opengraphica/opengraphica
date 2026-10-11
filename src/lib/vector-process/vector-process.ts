
import wasmLoadModule, {
    path_contains_path as wasmPathContainsPath,
    path_to_polyline as wasmPathToPolyline,
    simplify_path as wasmSimplifyPath,
    create_brush_stroke as wasmCreateBrushStroke,
    move_brush_stroke as wasmMoveBrushStroke,
    stop_brush_stroke as wasmStopBrushStroke,
} from './build/vector_process_wasm';

import { Clipper, PolyType, ClipType, Paths, PolyFillType } from '@/lib/clipper';
import { serializeVectorPathCommands, parseVectorPathCommand } from '@/lib/svg';

import { type BrushDefinition, type VectorPathCommand, type VectorPathCommandMove, type VectorPathCommandLine, VectorPathCommandType } from '@/types';

let isWasmModuleLoaded = false;
async function waitForWasmReady() {
    if (!isWasmModuleLoaded) {
        await wasmLoadModule();
        isWasmModuleLoaded = true;
    }
}

export async function pathToPolyline(
    path: string | VectorPathCommand[],
): Promise<Array<VectorPathCommandMove | VectorPathCommandLine>> {
    await waitForWasmReady();

    const pathCommand = typeof path === 'string' ? path : serializeVectorPathCommands(path);

    const polylineCommand = wasmPathToPolyline(pathCommand);

    const polyline = parseVectorPathCommand(polylineCommand) as Array<VectorPathCommandMove | VectorPathCommandLine>;

    return polyline;
}

export async function polylineToSimplifiedPath(
    polyline: VectorPathCommand[],
): Promise<VectorPathCommand[]> {
    await waitForWasmReady();

    const polylineCommand = serializeVectorPathCommands(polyline);

    const pathCommand = wasmSimplifyPath(polylineCommand);

    const path = parseVectorPathCommand(pathCommand);

    return path;
}

/**
 * Returns true if a fully contains b (b is inside of a)
 */
export async function pathContainsPath(
    a: string | VectorPathCommand[],
    b: string | VectorPathCommand[],
): Promise<boolean> {
    await waitForWasmReady();

    return wasmPathContainsPath(
        typeof a === 'string' ? a : serializeVectorPathCommands(a),
        typeof b === 'string' ? b : serializeVectorPathCommands(b),
    );
}

let brushStrokeIterator: number = 0;
let brushStrokes: Record<number, Array<Array<{ x: number, y: number }>>> = {};

export async function createPathBrushStroke(
    path: string,
): Promise<number> {
    await waitForWasmReady();

    const index = brushStrokeIterator++;
    const polyline = await pathToPolyline(path);
    brushStrokes[index] = [polyline];

    return index;
}

export async function movePathBrushStroke(
    strokeIndex: number,
    path: string,
): Promise<void> {
    const clipper = new Clipper();
    for (const path of brushStrokes[strokeIndex]) {
        clipper.AddPath(path, PolyType.ptSubject, true);
    }
    const clipPolyline = await pathToPolyline(path);
    clipper.AddPath(clipPolyline, PolyType.ptClip, true);
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

export function createBrushShapePath(
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
        // TODO - rotation
        let r = size / 2;
        return [
            `M ${cx - r},${cy - r}`,
            `L ${cx + r},${cy - r}`,
            `L ${cx + r},${cy + r}`,
            `L ${cx - r},${cy + r}`,
            'Z',
        ].join(' ');
    }
    return '';
}
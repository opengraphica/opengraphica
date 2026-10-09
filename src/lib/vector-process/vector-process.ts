
import wasmLoadModule, {
    path_contains_path as wasmPathContainsPath,
    path_to_polyline as wasmPathToPolyline,
    simplify_path as wasmSimplifyPath,
} from './build/vector_process_wasm';

import { serializeVectorPathCommands, parseVectorPathCommand } from '@/lib/svg';

import type { VectorPathCommand, VectorPathCommandMove, VectorPathCommandLine } from '@/types';

let isWasmModuleLoaded = false;
async function waitForWasmReady() {
    if (!isWasmModuleLoaded) {
        await wasmLoadModule();
        isWasmModuleLoaded = true;
    }
}

export async function pathToPolyline(
    path: VectorPathCommand[],
): Promise<Array<VectorPathCommandMove | VectorPathCommandLine>> {
    await waitForWasmReady();

    const pathCommand = serializeVectorPathCommands(path);

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
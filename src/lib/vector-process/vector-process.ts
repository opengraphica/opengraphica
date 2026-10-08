
import wasmLoadModule, {
    path_to_polyline as wasmPathToPolyline,
    polyline_to_bezier as wasmPolylineToBezier,
} from './build/vector_process_wasm';

import { VectorPathCommandType } from '@/types/vector';
import type { VectorPathCommand, VectorPathCommandMove, VectorPathCommandLine } from '@/types';

enum VectorPathCommandTransferType {
    MOVE = 0,
    LINE = 1,
    QUADRATIC_BEZIER_CURVE = 2,
    CUBIC_BEZIER_CURVE = 3,
    CLOSE = 4,
}

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
    const pathTransfer = new Float64Array(path.length * 8);
    let currentX: number = 0;
    let currentY: number = 0;
    let handleX: number = 0;
    let handleY: number = 0;
    for (const [commandIndex, command] of path.entries()) {
        const stride = commandIndex * 8;
        switch (command.type) {
            case VectorPathCommandType.MOVE:
                pathTransfer[stride] = VectorPathCommandTransferType.MOVE;
                pathTransfer[stride + 1] = command.x;
                pathTransfer[stride + 2] = command.y;
                break;
            case VectorPathCommandType.LINE:
                pathTransfer[stride] = VectorPathCommandTransferType.LINE;
                pathTransfer[stride + 1] = command.x;
                pathTransfer[stride + 2] = command.y;
                break;
            case VectorPathCommandType.HORIZONTAL_LINE:
                pathTransfer[stride] = VectorPathCommandTransferType.LINE;
                pathTransfer[stride + 1] = command.x;
                pathTransfer[stride + 2] = currentY;
                break;
            case VectorPathCommandType.VERTICAL_LINE:
                pathTransfer[stride] = VectorPathCommandTransferType.LINE;
                pathTransfer[stride + 1] = currentX;
                pathTransfer[stride + 2] = command.y;
                break;
            case VectorPathCommandType.CUBIC_BEZIER_CURVE:
                pathTransfer[stride] = VectorPathCommandTransferType.CUBIC_BEZIER_CURVE;
                pathTransfer[stride + 1] = command.x1;
                pathTransfer[stride + 2] = command.y1;
                pathTransfer[stride + 3] = command.x2;
                pathTransfer[stride + 4] = command.y2;
                pathTransfer[stride + 5] = command.x;
                pathTransfer[stride + 6] = command.y;
                break;
            case VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE:
                pathTransfer[stride] = VectorPathCommandTransferType.CUBIC_BEZIER_CURVE;
                pathTransfer[stride + 1] = handleX;
                pathTransfer[stride + 2] = handleY;
                pathTransfer[stride + 3] = command.x2;
                pathTransfer[stride + 4] = command.y2;
                pathTransfer[stride + 5] = command.x;
                pathTransfer[stride + 6] = command.y;
                break;
            case VectorPathCommandType.QUADRATIC_BEZIER_CURVE:
                pathTransfer[stride] = VectorPathCommandTransferType.QUADRATIC_BEZIER_CURVE;
                pathTransfer[stride + 1] = command.x1;
                pathTransfer[stride + 2] = command.y1;
                pathTransfer[stride + 3] = command.x;
                pathTransfer[stride + 4] = command.y;
                break;
            case VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE:
                pathTransfer[stride] = VectorPathCommandTransferType.QUADRATIC_BEZIER_CURVE;
                pathTransfer[stride + 1] = handleX;
                pathTransfer[stride + 2] = handleY;
                pathTransfer[stride + 3] = command.x;
                pathTransfer[stride + 4] = command.y;
                break;
            case VectorPathCommandType.ELLIPTICAL_ARC:
                pathTransfer[stride] = VectorPathCommandTransferType.QUADRATIC_BEZIER_CURVE;
                pathTransfer[stride + 1] = currentX;
                pathTransfer[stride + 2] = currentY;
                pathTransfer[stride + 3] = command.x;
                pathTransfer[stride + 4] = command.y;
                pathTransfer[stride + 5] = command.x;
                pathTransfer[stride + 6] = command.y;
                break;
            case VectorPathCommandType.CLOSE:
                pathTransfer[stride] = VectorPathCommandTransferType.CLOSE;
        }
        switch (command.type) {
            case VectorPathCommandType.MOVE:
            case VectorPathCommandType.LINE:
            case VectorPathCommandType.CUBIC_BEZIER_CURVE:
            case VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE:
            case VectorPathCommandType.QUADRATIC_BEZIER_CURVE:
            case VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE:
            case VectorPathCommandType.ELLIPTICAL_ARC:
                currentX = command.x;
                currentY = command.y;
                if (command.type === VectorPathCommandType.CUBIC_BEZIER_CURVE || command.type === VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE) {
                    handleX = command.x - (command.x2 - command.x);
                    handleY = command.y - (command.y2 - command.y);
                } else if (command.type === VectorPathCommandType.QUADRATIC_BEZIER_CURVE) {
                    handleX = command.x - (command.x1 - command.x);
                    handleY = command.y - (command.y1 - command.y);
                } else if (command.type === VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE) {
                    handleX = command.x - (handleX - command.x);
                    handleY = command.y - (handleY - command.y);
                } else {
                    handleX = currentX;
                    handleY = currentY;
                }
                break;
            case VectorPathCommandType.HORIZONTAL_LINE:
                currentX = command.x;
                handleX = currentX;
                break;
            case VectorPathCommandType.VERTICAL_LINE:
                currentX = command.y;
                handleY = currentY;
                break;
        }
    }
    const pointsTransfer = wasmPathToPolyline(pathTransfer);
    const points: Array<VectorPathCommandMove | VectorPathCommandLine> = [];
    for (let i = 0; i < pointsTransfer.length; i += 2) {
        points.push({
            type: i > 0 ? VectorPathCommandType.LINE : VectorPathCommandType.MOVE,
            x: pointsTransfer[i],
            y: pointsTransfer[i + 1],
        });
    }
    return points;
}

export async function polylineToBezier() {
    await waitForWasmReady();
    await wasmPolylineToBezier();
}
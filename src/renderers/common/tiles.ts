import { isCanvasBitmapTransferSupported } from '@/lib/feature-detection/canvas-bitmap-transfer';
import { createStoredImage } from '@/store/image';
import { createCanvasFromImage } from '@/lib/image';

import type { RendererTextureTile, WorkingFileLayerRasterTileUpdate } from '@/types';

export async function transferRendererTilesToRasterLayerUpdates(tiles: RendererTextureTile[]) {
    const tileUpdates: WorkingFileLayerRasterTileUpdate[] = [];
    const transfer = await isCanvasBitmapTransferSupported();
    for (const tile of tiles) {
        let oldTileCanvasUuid: string | undefined;
        if (tile.oldImage) {
            const oldTileCanvas = createCanvasFromImage(tile.oldImage, {
                transfer,
                width: tile.width,
                height: tile.height,
            });
            if (!transfer) tile.oldImage?.close();
            oldTileCanvasUuid = await createStoredImage(oldTileCanvas);
        }
        const tileCanvas = createCanvasFromImage(tile.image, {
            transfer,
            width: tile.width,
            height: tile.height,
        });
        if (!transfer) tile.image.close();
        const tileCanvasUuid = await createStoredImage(tileCanvas);
        tileUpdates.push({
            x: tile.x,
            y: tile.y,
            oldSourceUuid: oldTileCanvasUuid,
            sourceUuid: tileCanvasUuid,
            mode: 'replace',
        });
    }
    return tileUpdates;
}

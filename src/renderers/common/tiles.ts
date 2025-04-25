import { createStoredImage } from '@/store/image';
import { createCanvasFromImage } from '@/lib/image';

import type { RendererTextureTile, WorkingFileLayerRasterTileUpdate } from '@/types';

export async function transferRendererTilesToRasterLayerUpdates(tiles: RendererTextureTile[]) {
    const tileUpdates: WorkingFileLayerRasterTileUpdate[] = [];
    for (const tile of tiles) {
        let oldTileCanvasUuid: string | undefined;
        if (tile.oldImage) {
            const oldTileCanvas = createCanvasFromImage(tile.oldImage, {
                transfer: true,
                width: tile.width,
                height: tile.height,
            });
            oldTileCanvasUuid = await createStoredImage(oldTileCanvas);
        }
        const tileCanvas = createCanvasFromImage(tile.image, {
            transfer: true,
            width: tile.width,
            height: tile.height,
        });
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

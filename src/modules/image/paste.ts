import cloneDeep from 'lodash/cloneDeep';
import { generateImageBlobHash } from '@/lib/hash';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { ensureUniqueLayerSiblingName } from '@/store/working-file';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { blitSpecifiedSelectionMask } from '@/canvas/store/selection-state';
import { createImageFromCanvas } from '@/lib/image';
import type { ColorModel, WorkingFileRasterLayer } from '@/types';

export async function promptClipboardReadPermission(): Promise<boolean> {
    try {
        // The clipboard-write permission is granted automatically to pages
        // when they are the active tab. So it's not required, but it's more safe.
        const { state } = await navigator.permissions.query({ name: 'clipboard-read' } as any);
        return state === 'granted';
    }
    catch (error: any) {
        if (error.toString() === `TypeError: 'clipboard-read' (value of 'name' member of PermissionDescriptor) is not a valid value for enumeration PermissionName.` && (window as any).ClipboardItem) {
            return true;
        }
        // Browser compatibility / Security error (ONLY HTTPS) ...
        return false;
    }
}

export async function pasteFromEditorCopyBuffer() {
    const positionAfterLayer = workingFileStore.state.selectedLayerIds[0];
    historyStore.dispatch('runAction', {
        action: new BundleAction(
            'pasteLayers',
            'action.pasteLayers',
            await Promise.all(editorStore.state.clipboardBufferLayers.map(async (layer) => {
                delete (layer as any).id;
                delete (layer as any).renderer;
                const firstLayer = workingFileStore.state.layers[0];
                layer.name = ensureUniqueLayerSiblingName(positionAfterLayer ?? firstLayer ? firstLayer.id : undefined, layer.name);
                if (editorStore.state.clipboardBufferSelectionMask != null) {
                    if (layer.type === 'raster') {
                        const rasterLayer = layer as WorkingFileRasterLayer<ColorModel>;
                        if (rasterLayer.data.sourceImage) {
                            rasterLayer.thumbnailImageSrc = null;
                            rasterLayer.data = {
                                sourceImage: await createImageFromCanvas(
                                    await blitSpecifiedSelectionMask(
                                        editorStore.state.clipboardBufferSelectionMask,
                                        editorStore.state.clipboardBufferSelectionMaskCanvasOffset,
                                        rasterLayer.data.sourceImage,
                                        rasterLayer.transform,
                                        'source-in'
                                    )
                                ),
                                sourceImageIsObjectUrl: true
                            };
                        }
                    }
                }
                return new InsertLayerAction(cloneDeep(layer), positionAfterLayer == null ? 'top' : 'above', positionAfterLayer);
            }))
        )
    });
}

export async function paste() {
    if (await promptClipboardReadPermission() && navigator.clipboard?.read) {
        const clipboardContents = await navigator.clipboard.read();
        for (const item of clipboardContents) {
            let blob: Blob | undefined;
            if (item.types.includes('image/png')) {
                blob = await item.getType('image/png');
            }
            let isUseFile: boolean = true;
            if (blob) {
                const pastedImageHash = await generateImageBlobHash(blob);
                isUseFile = editorStore.state.clipboardBufferImageHash !== pastedImageHash;
            } else {
                isUseFile = false;
            }

            if (isUseFile && blob) {
                const { openFromFileList } = await import(/* webpackChunkName: 'module-file-open' */ '@/modules/file/open');
                await openFromFileList([
                    new File([blob], 'image.png')
                ], { insert: true });
            } else {
                const { pasteFromEditorCopyBuffer } = await import('@/modules/image/paste');
                await pasteFromEditorCopyBuffer();
            }
        }
    } else {
        await pasteFromEditorCopyBuffer();
    }
}

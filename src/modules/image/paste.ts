import cloneDeep from 'lodash/cloneDeep';

import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import { getStoredImageOrCanvas, createStoredImage } from '@/store/image';
import workingFileStore, { ensureUniqueLayerSiblingName } from '@/store/working-file';
import { BundleAction } from '@/actions/bundle';

import { InsertLayerAction } from '@/actions/insert-layer';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';

import { blitSpecifiedSelectionMask } from '@/canvas/store/selection-state';

import appEmitter from '@/lib/emitter';
import { generateImageBlobHash } from '@/lib/hash';

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
            (await Promise.all(editorStore.state.clipboardBufferLayers.map(async (layer) => {
                delete (layer as any).id;
                const firstLayer = workingFileStore.state.layers[0];
                layer.name = ensureUniqueLayerSiblingName(positionAfterLayer ?? firstLayer ? firstLayer.id : undefined, layer.name);
                if (editorStore.state.clipboardBufferSelectionMask != null) {
                    if (layer.type === 'raster') {
                        const rasterLayer = layer as WorkingFileRasterLayer<ColorModel>;
                        const sourceImage = getStoredImageOrCanvas(rasterLayer.data.sourceUuid);
                        if (sourceImage) {
                            rasterLayer.thumbnailImageSrc = null;
                            rasterLayer.data = {
                                sourceUuid: await createStoredImage(
                                    await blitSpecifiedSelectionMask(
                                        editorStore.state.clipboardBufferSelectionMask,
                                        editorStore.state.clipboardBufferSelectionMaskCanvasOffset,
                                        sourceImage,
                                        rasterLayer.transform,
                                        'source-in'
                                    )
                                ),
                            };
                        }
                    }
                }
                return [
                    new InsertLayerAction(cloneDeep(layer), positionAfterLayer == null ? 'top' : 'above', positionAfterLayer),
                    new TrimLayerEmptySpaceAction(-1),
                ];
            }))).flat()
        )
    });
}

export interface ImagePasteModuleProperties {
    files?: File[];
}

let isPastingImage: boolean = false;
export async function paste(options?: ImagePasteModuleProperties) {
    let files: File[] = options?.files ?? [];

    if (files.length === 0) {
        if (await promptClipboardReadPermission() && navigator.clipboard?.read) {
            const clipboardContents = await navigator.clipboard.read();
            for (const item of clipboardContents) {
                if (item.types.includes('image/png')) {
                    let blob = await item.getType('image/png');
                    files.push(new File([blob], 'clipboard.png'));
                }
            }
        } else {
            await pasteFromEditorCopyBuffer();
        }
    }

    if (files.length > 0) {
        appEmitter.emit('app.wait.startBlocking', { id: 'documentPasteImage', label: 'app.wait.loadingImage' });
        isPastingImage = true;

        for (let file of files) {
            try {
                let isUseFile: boolean = true;
                if (editorStore.state.hasClipboardUpdateSupport) {
                    if (file) {
                        const pastedImageHash = await generateImageBlobHash(file);
                        console.log('pasted hash ', pastedImageHash);
                        isUseFile = editorStore.state.clipboardBufferImageHash !== pastedImageHash;
                    } else {
                        isUseFile = false;
                    }
                } else {
                    isUseFile = file.lastModified > editorStore.state.clipboardBufferUpdateTimestamp;
                }

                if (isUseFile) {
                    const { openFromFileList } = await import(/* webpackChunkName: 'module-file-open' */ '@/modules/file/open');
                    await openFromFileList({ files: [file], dialogOptions: { insert: true } });
                } else {
                    await pasteFromEditorCopyBuffer();
                }
            } catch (error) {
                console.error('[src/modules/image/paste.ts]', error);
            }
        }

        isPastingImage = false;
        appEmitter.emit('app.wait.stopBlocking', { id: 'documentPasteImage' });
        appEmitter.emit('app.workingFile.notifyImageLoadedFromClipboard');
    }
}

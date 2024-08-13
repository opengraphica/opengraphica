import workingFileStore, { WorkingFileState, getLayersByType } from '@/store/working-file';
import historyStore from '@/store/history';
import editorStore, { updateRasterSequenceLayerWithTimeline } from '@/store/editor';

import { findPointListBounds } from '@/lib/math';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { InsertLayerAction } from '@/actions/insert-layer';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';
import { UpdateLayerAction } from '@/actions/update-layer';
import { UpdateFileAction } from '@/actions/update-file';

import type { ColorModel, WorkingFileRasterLayer, UpdateAnyLayerOptions, InsertRasterSequenceLayerOptions } from '@/types';

interface ConvertLayersToImageSequenceOptions {
    frameDelay?: number;
}

export async function convertLayersToImageSequence(options: ConvertLayersToImageSequenceOptions = {}): Promise<void> {
    let frameDelay = options.frameDelay || 1;

    // TODO - base on selected layers

    const combineLayers = getLayersByType<WorkingFileRasterLayer<ColorModel>>('raster');
    const rasterSequenceLayer: InsertRasterSequenceLayerOptions<ColorModel> = {
        type: 'rasterSequence',
        height: workingFileStore.get('height'),
        name: 'New Image Sequence',
        width: workingFileStore.get('width'),
        data: {
            sequence: []
        }
    };
    let start: number = 0;
    if (combineLayers.length > 0) {
        for (let layer of combineLayers) {
            rasterSequenceLayer.data?.sequence.push({
                start: start,
                end: Math.floor(start + frameDelay),
                image: {
                    sourceUuid: layer.data.sourceUuid,
                },
                thumbnailImageSrc: null
            });
            start = Math.floor(start + frameDelay);
        }
        rasterSequenceLayer.data && (rasterSequenceLayer.data.currentFrame = rasterSequenceLayer.data?.sequence[0].image);
        editorStore.dispatch('setTimelineCursor', start);
        updateRasterSequenceLayerWithTimeline(rasterSequenceLayer as any);
        historyStore.dispatch('runAction', {
            action: new BundleAction('convertLayersToImageSequence', 'action.convertLayersToImageSequence', [
                new DeleteLayersAction(combineLayers.map((layer) => layer.id)),
                new InsertLayerAction(rasterSequenceLayer)
            ])
        });
    }
}

interface ConvertLayersToCollageOptions {
    type?: string;
    params?: Record<string, any>;
}

export interface CollageTypeCallback {
    type: string;
    params: CollageTypeCallbackParam[];
    callback: (layers: Array<WorkingFileRasterLayer<ColorModel>>, params: Record<string, any>) => void;
}

export interface CollageTypeCallbackParam {
    name: string;
    type: 'string' | 'number' | 'boolean';
    units?: 'px';
    min?: number;
    max?: number;
    options?: Array<{ key: string, value: string | number | boolean }>;
    default?: string | number | boolean;
}

export const collageTypeCallbacks: CollageTypeCallback[] = [
    {
        type: 'verticalStack',
        params: [
            {
                name: 'horizontalAlignment',
                type: 'string',
                options: [
                    { key: 'left', value: 'left' },
                    { key: 'center', value: 'center' },
                    { key: 'right', value: 'right' },
                ],
                default: 'center',
            },
            {
                name: 'verticalMargin',
                type: 'number',
                units: 'px',
                min: 0,
                default: 0
            },
        ],
        async callback(layers, params) {
            const trimLayerActions: TrimLayerEmptySpaceAction[] = [];
            for (const layer of layers) {
                trimLayerActions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
            await historyStore.dispatch('runAction', {
                action: new BundleAction('convertLayersToCollage', 'action.convertLayersToCollage', trimLayerActions)
            });
            let maxWidth = 0;
            let totalHeight = 0;
            let layerTransformedBounds: Array<{
                left: number;
                right: number;
                top: number;
                bottom: number;
                width: number;
                height: number;
                topOffset: number;
            }> = [];
            for (const [layerIndex, layer] of layers.entries()) {
                const transformedBounds = findPointListBounds([
                    new DOMPoint(0.0, 0.0).matrixTransform(layer.transform),
                    new DOMPoint(layer.width, 0.0).matrixTransform(layer.transform),
                    new DOMPoint(0.0, layer.height).matrixTransform(layer.transform),
                    new DOMPoint(layer.width, layer.height).matrixTransform(layer.transform),
                ]);
                let transformedWidth = Math.ceil(transformedBounds.right - transformedBounds.left);
                let transformedHeight = Math.ceil(transformedBounds.bottom - transformedBounds.top);
                if (transformedWidth > maxWidth) {
                    maxWidth = transformedWidth;
                }
                layerTransformedBounds.push({
                    ...transformedBounds,
                    width: transformedWidth,
                    height: transformedHeight,
                    topOffset: totalHeight
                });
                totalHeight += transformedHeight + (layerIndex < layers.length - 1 ? (params.verticalMargin ?? 0) : 0);
            }
            const updateLayerActions: BaseAction[] = [];
            for (const [layerIndex, layer] of layers.entries()) {
                const transformBounds = layerTransformedBounds[layerIndex];
                let leftOffset = 0;
                if (params.horizontalAlignment === 'center') {
                    leftOffset = Math.round((maxWidth - transformBounds.width) / 2);
                } else if (params.horizontalAlignment === 'right') {
                    leftOffset = Math.round(maxWidth - transformBounds.width);
                }
                updateLayerActions.push(
                    new UpdateLayerAction<UpdateAnyLayerOptions>({
                        id: layer.id,
                        transform: new DOMMatrix().translate(
                            -transformBounds.left + leftOffset,
                            -transformBounds.top + transformBounds.topOffset,
                        ).multiply(layer.transform),
                    })
                );
            }
            updateLayerActions.push(
                new UpdateFileAction({
                    width: maxWidth,
                    height: totalHeight,
                })
            );
            await historyStore.dispatch('runAction', {
                action: new BundleAction('convertLayersToCollage', 'action.convertLayersToCollage', updateLayerActions),
                mergeWithHistory: 'convertLayersToCollage',
            });
        }
    },
    {
        type: 'horizontalStack',
        params: [
            {
                name: 'verticalAlignment',
                type: 'string',
                options: [
                    { key: 'top', value: 'top' },
                    { key: 'middle', value: 'middle' },
                    { key: 'bottom', value: 'bottom' },
                ],
                default: 'middle',
            },
            {
                name: 'horizontalMargin',
                type: 'number',
                units: 'px',
                min: 0,
                default: 0
            },
        ],
        async callback(layers, params) {
            const trimLayerActions: TrimLayerEmptySpaceAction[] = [];
            for (const layer of layers) {
                trimLayerActions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
            await historyStore.dispatch('runAction', {
                action: new BundleAction('convertLayersToCollage', 'action.convertLayersToCollage', trimLayerActions)
            });
            let maxHeight = 0;
            let totalWidth = 0;
            let layerTransformedBounds: Array<{
                left: number;
                right: number;
                top: number;
                bottom: number;
                width: number;
                height: number;
                leftOffset: number;
            }> = [];
            for (const [layerIndex, layer] of layers.entries()) {
                const transformedBounds = findPointListBounds([
                    new DOMPoint(0.0, 0.0).matrixTransform(layer.transform),
                    new DOMPoint(layer.width, 0.0).matrixTransform(layer.transform),
                    new DOMPoint(0.0, layer.height).matrixTransform(layer.transform),
                    new DOMPoint(layer.width, layer.height).matrixTransform(layer.transform),
                ]);
                let transformedWidth = Math.ceil(transformedBounds.right - transformedBounds.left);
                let transformedHeight = Math.ceil(transformedBounds.bottom - transformedBounds.top);
                if (transformedHeight > maxHeight) {
                    maxHeight = transformedHeight;
                }
                layerTransformedBounds.push({
                    ...transformedBounds,
                    width: transformedWidth,
                    height: transformedHeight,
                    leftOffset: totalWidth
                });
                totalWidth += transformedWidth + (layerIndex < layers.length - 1 ? (params.horizontalMargin ?? 0) : 0);
            }
            const updateLayerActions: BaseAction[] = [];
            for (const [layerIndex, layer] of layers.entries()) {
                const transformBounds = layerTransformedBounds[layerIndex];
                let topOffset = 0;
                if (params.verticalAlignment === 'middle') {
                    topOffset = Math.round((maxHeight - transformBounds.height) / 2);
                } else if (params.verticalAlignment === 'bottom') {
                    topOffset = Math.round(maxHeight - transformBounds.height);
                }
                updateLayerActions.push(
                    new UpdateLayerAction<UpdateAnyLayerOptions>({
                        id: layer.id,
                        transform: new DOMMatrix().translate(
                            -transformBounds.left + transformBounds.leftOffset,
                            -transformBounds.top + topOffset,
                        ).multiply(layer.transform),
                    })
                );
            }
            updateLayerActions.push(
                new UpdateFileAction({
                    width: totalWidth,
                    height: maxHeight,
                })
            );
            await historyStore.dispatch('runAction', {
                action: new BundleAction('convertLayersToCollage', 'action.convertLayersToCollage', updateLayerActions),
                mergeWithHistory: 'convertLayersToCollage',
            });
        }
    },
    // {
    //     type: 'grid',
    //     params: [],
    //     callback(layers, params) {

    //     }
    // },
]

export async function convertLayersToCollage(options: ConvertLayersToCollageOptions = {}): Promise<void> {
    if (!options.type) return;
    const callbackDefinition = collageTypeCallbacks.find((definition) => definition.type === options.type);
    if (!callbackDefinition) return;

    // TODO - may want to handle other layer types in the future.
    const layers = getLayersByType<WorkingFileRasterLayer<ColorModel>>('raster');
    const params = options.params ?? {};
    if (params.reverseLayerOrder) {
        layers.reverse();
    }
    await callbackDefinition.callback(layers, options.params ?? {});
}

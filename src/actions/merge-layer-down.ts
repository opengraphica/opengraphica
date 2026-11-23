
import { BaseAction } from './base';
import { DeleteLayersAction } from './delete-layers';
import { DeleteLayerFilterAction } from './delete-layer-filter';
import { InsertLayerAction } from './insert-layer';
import { UpdateLayerAction } from './update-layer';

import { createStoredImage } from '@/store/image';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getLayerById, getParentGroupByLayerId } from '@/store/working-file';

import { findRectListBounds } from '@/lib/math';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { calculateShapeAabb, generateSvgElementIds, getViewBox, parseCommonNodeAttributes } from '@/lib/svg';

import { useRenderer } from '@/renderers';

import type { InsertRasterLayerOptions, WorkingFileAnyLayer } from '@/types';

export class MergeLayerDownAction extends BaseAction {

    private mergeLayerId: number;
    private actions: BaseAction[] = [];

    constructor(mergeLayerId: number) {
        super('mergeLayerDown', 'action.mergeLayerDown');
        this.mergeLayerId = mergeLayerId;
    }

    public async do() {
        super.do();

        if (this.actions.length > 0) {
            for (const action of this.actions) {
                await action.do();
            }
            return;
        }

        const mergeLayer = getLayerById(this.mergeLayerId);
        if (!mergeLayer) {
            throw new Error('[src/actions/merge-layer-down.ts] Layer with specified id not found.');
        }

        const layerList = getParentGroupByLayerId(this.mergeLayerId)?.layers ?? workingFileStore.get('layers');
        const mergeLayerListIndex = layerList.findIndex((otherLayer) => otherLayer.id === this.mergeLayerId);
        if (mergeLayerListIndex === 0) {
            throw new Error('[src/actions/merge-layer-down.ts] No layer to merge into.');
        }
        const destinationLayer = layerList[mergeLayerListIndex - 1] as WorkingFileAnyLayer;

        if (mergeLayer.type === 'vector' && destinationLayer.type === 'vector') {
            /*--------------------------------------------------*\
            |                                                    |
            |   Merge two vector layers into one SVG document.   |
            |                                                    |
            \*--------------------------------------------------*/

            const mergeDocument = (mergeLayer.data.sourceDocument?.documentElement)
                ? mergeLayer.data.sourceDocument
                : await getStoredSvgDocument(mergeLayer.data.sourceUuid);
            const destinationDocument = (destinationLayer.data.sourceDocument?.documentElement)
                ? destinationLayer.data.sourceDocument
                : await getStoredSvgDocument(destinationLayer.data.sourceUuid);

            const viewBox = getViewBox(destinationDocument);

            const parser = new DOMParser();
            const newDocument = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"></svg>', 'image/svg+xml');

            for (const node of Array.from(destinationDocument.documentElement.children)) {
                newDocument.documentElement.append(node);
            }
            for (const node of Array.from(mergeDocument.documentElement.children)) {
                newDocument.documentElement.append(node);
            }

            generateSvgElementIds(newDocument);

            const rects = Array.from(newDocument.querySelectorAll('[data-ogr-id]'))
                .map((node) => {
                    const { transform, stroke, strokeWidth } = parseCommonNodeAttributes(node);
                    const decomposedTransform = decomposeMatrix(transform);
                    return calculateShapeAabb(
                        node,
                        transform,
                        stroke != null ? strokeWidth : 0,
                        Math.abs(decomposedTransform.scaleX * Math.cos(decomposedTransform.rotation))
                            + Math.abs(decomposedTransform.scaleY * Math.sin(decomposedTransform.rotation)),
                        Math.abs(decomposedTransform.scaleX * Math.sin(decomposedTransform.rotation))
                            + Math.abs(decomposedTransform.scaleY * Math.cos(decomposedTransform.rotation)),
                    );
                })
                .filter((aabb) => aabb != null);
            const bounds = findRectListBounds(rects, true);

            const currentViewBoxOffset = new DOMPoint(
                bounds.left - viewBox.left,
                bounds.top - viewBox.top,
            );

            let newLayerTransform = new DOMMatrix()
                .multiplySelf(
                    destinationLayer.transform,
                ).scaleSelf(
                    destinationLayer.width / viewBox.width,
                    destinationLayer.height / viewBox.height,
                ).translateSelf(
                    currentViewBoxOffset.x,
                    currentViewBoxOffset.y,
                );
            if (newLayerTransform.toFloat64Array().some(Number.isNaN)) {
                newLayerTransform = destinationLayer.transform;
            }

            newDocument.documentElement.setAttribute('viewBox', `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(newDocument).replace(/xmlns=""/g, '');

            const image = await new Promise<HTMLImageElement>((resolve) => {
                const image = new Image();
                image.onload = () => {
                    resolve(image);
                };
                image.onerror = () => {
                    resolve(image);
                }
                image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
            });

            this.actions.push(
                new UpdateLayerAction({
                    id: destinationLayer.id,
                    width: bounds.width,
                    height: bounds.height,
                    transform: newLayerTransform,
                    data: {
                        sourceUuid: await createStoredSvg(image),
                    },
                })
            );
            this.actions.push(
                new DeleteLayersAction([mergeLayer.id])
            );

        } else {
            /*------------------------------------------------------------*\
            |                                                              |
            |   Take a snapshot of both layers and replace them with it.   |
            |                                                              |
            \*------------------------------------------------------------*/

            const renderer = await useRenderer();
            
            const snapshotBitmap = await renderer.takeSnapshot(workingFileStore.state.width, workingFileStore.state.height, {
                layerIds: [mergeLayer.id, destinationLayer.id],
                disableBackground: true,
            });

            if (destinationLayer.type === 'raster') {
                this.actions.push(
                    new UpdateLayerAction({
                        id: destinationLayer.id,
                        width: snapshotBitmap.width,
                        height: snapshotBitmap.height,
                        transform: new DOMMatrix(),
                        data: {
                            // { transfer: true } creates artifacting in transparency in Firefox.
                            sourceUuid: await createStoredImage(snapshotBitmap, { transfer: false }),
                        },
                    })
                );
                for (let i = destinationLayer.filters.length - 1; i >= 0; i--) {
                    this.actions.push(
                        new DeleteLayerFilterAction(destinationLayer.id, i)
                    );
                }
                this.actions.push(
                    new DeleteLayersAction([mergeLayer.id])
                );
            } else {
                this.actions.push(
                    new InsertLayerAction<InsertRasterLayerOptions>({
                        type: 'raster',
                        name: destinationLayer.name,
                        width: snapshotBitmap.width,
                        height: snapshotBitmap.height,
                        transform: new DOMMatrix(),
                        data: {
                            // { transfer: true } creates artifacting in transparency in Firefox.
                            sourceUuid: await createStoredImage(snapshotBitmap, { transfer: false }),
                        },
                    })
                );
                this.actions.push(
                    new DeleteLayersAction([mergeLayer.id, destinationLayer.id])
                );
            }

            snapshotBitmap.close();
        }

        this.freeEstimates.database = 0;
        this.freeEstimates.memory = 0;
        for (const action of this.actions) {
            await action.do();
            this.freeEstimates.database += action.freeEstimates.database;
            this.freeEstimates.memory += action.freeEstimates.memory;
        }

    }

    public async undo() {
        super.undo();

        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i];
            await action.undo();
        }

    }

    public free() {
        super.free();
    }
}
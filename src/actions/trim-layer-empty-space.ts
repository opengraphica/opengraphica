
import { BaseAction } from './base';

import canvasStore from '@/store/canvas';
import { createStoredImage, prepareStoredImageForEditing, prepareStoredImageForArchival } from '@/store/image';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import { getLayerById, getCanvasRenderingContext2DSettings } from '@/store/working-file';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { getImageDataEmptyBounds, getImageDataFromCanvas } from '@/lib/image';
import { findPointListBounds, findRectListBounds } from '@/lib/math';
import { calculateShapeAabb, getViewBox, parseNodeTransform, parseCommonNodeAttributes } from '@/lib/svg';

import { InsertLayerAction } from './insert-layer';
import { UpdateLayerAction } from './update-layer';
// import { UpdateVectorLayerAttributesAction } from './update-vector-layer-attributes';

export class TrimLayerEmptySpaceAction extends BaseAction {

    private layerId: number;
    private updateLayerAction: InstanceType<typeof UpdateLayerAction> | null = null;

    constructor(layerId: number) {
        super('trimLayerEmptySpace', 'action.trimLayerEmptySpace');
        this.layerId = layerId;
    }

    public async do() {
        super.do();

        if (this.layerId == -1) {
            let insertLayerAction: InsertLayerAction<any> | undefined = undefined;
            for (let i = this.previousActions.length - 1; i >= 0; i--) {
                if (this.previousActions[i] instanceof InsertLayerAction) {
                    insertLayerAction = this.previousActions[i] as InsertLayerAction<any>;
                    break;
                }
            }
            if (!insertLayerAction) {
                throw new Error('[src/actions/trim-layer-empty-space.ts] Layer ID not specified and previous action not found.');
            }
            this.layerId = insertLayerAction.insertedLayerId;
        }

        const layer = getLayerById(this.layerId);
        if (!layer) throw new Error('[src/actions/trim-layer-empty-space.ts] Layer with specified id not found.');

        if (layer.type === 'raster') {
            const layerCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
            if (!layerCanvas) throw new Error('[src/actions/trim-layer-empty-space.ts] Unable to edit existing layer image.');
            const emptyBounds = getImageDataEmptyBounds(getImageDataFromCanvas(layerCanvas));
            const emptyCropBounds = findPointListBounds([
                new DOMPoint(emptyBounds.left, emptyBounds.top),
                new DOMPoint(emptyBounds.right, emptyBounds.top),
                new DOMPoint(emptyBounds.left, emptyBounds.bottom),
                new DOMPoint(emptyBounds.right, emptyBounds.bottom),
            ]);
            const newWidth = Math.ceil(emptyCropBounds.right - emptyCropBounds.left);
            const newHeight = Math.ceil(emptyCropBounds.bottom - emptyCropBounds.top);

            if (newWidth < 1 || newHeight < 1) return;

            const workingCanvas = document.createElement('canvas');
            workingCanvas.width = newWidth;
            workingCanvas.height = newHeight;
            const workingCanvasCtx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
            if (!workingCanvasCtx) throw new Error('[src/actions/trim-layer-empty-space.ts] Unable to create a new canvas for transform.');
            workingCanvasCtx.save();
            workingCanvasCtx.globalCompositeOperation = 'copy';
            workingCanvasCtx.translate(-emptyCropBounds.left, -emptyCropBounds.top);
            workingCanvasCtx.drawImage(layerCanvas, 0, 0);
            workingCanvasCtx.restore();
            const newLayerTransform = new DOMMatrix().multiplySelf(layer.transform).translateSelf(
                emptyBounds.left,
                emptyBounds.top,
            );

            prepareStoredImageForArchival(layer.data.sourceUuid);

            this.updateLayerAction = new UpdateLayerAction({
                id: this.layerId,
                width: newWidth,
                height: newHeight,
                transform: newLayerTransform,
                data: {
                    sourceUuid: await createStoredImage(workingCanvas)
                }
            });
            await this.updateLayerAction.do();

        } else if (layer.type === 'vector') {
            const svgDocument = await getStoredSvgDocument(layer.data.sourceUuid);
            if (!svgDocument) return;

            const viewBox = getViewBox(svgDocument);

            const rects = Array.from(svgDocument.querySelectorAll('[data-ogr-id]'))
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

            const newLayerTransform = new DOMMatrix()
                .multiplySelf(
                    layer.transform,
                ).scaleSelf(
                    layer.width / viewBox.width,
                    layer.height / viewBox.height,
                ).translateSelf(
                    currentViewBoxOffset.x,
                    currentViewBoxOffset.y,
                );

            svgDocument.documentElement.setAttribute('viewBox', `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgDocument).replace(/xmlns=""/g, '');

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

            this.updateLayerAction = new UpdateLayerAction({
                id: this.layerId,
                width: bounds.width,
                height: bounds.height,
                transform: newLayerTransform,
                data: {
                    sourceUuid: await createStoredSvg(image),
                },
            });
            await this.updateLayerAction.do();
        }

        canvasStore.set('dirty', true);
    }

    public async undo() {
        super.undo();

        if (this.updateLayerAction) {
            await this.updateLayerAction.undo();
            this.updateLayerAction = null;
        }

        canvasStore.set('dirty', true);
    }

    public free() {
        super.free();

        if (this.updateLayerAction) {
            this.updateLayerAction.free();
            this.updateLayerAction = null
        }
    }

}

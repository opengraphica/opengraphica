import BaseCanvasMovementController from './base-movement';

import appEmitter from '@/lib/emitter';
import { createEmptyCanvas } from '@/lib/image';
import { limitMaxDimension } from '@/lib/math';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { createHistoryReserveToken, historyBlockInteractionUntilComplete, historyReserveQueueFree } from '@/store/history';
import { createStoredImage } from '@/store/image';
import { getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers, ensureUniqueLayerSiblingName, getLayerById } from '@/store/working-file';
import { strength, feather, antialias, colorPalette, colorPaletteIndex } from '../store/draw-bucket-fill-state';
import { appliedSelectionMask, activeSelectionMask } from '../store/selection-state';

import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';
import { UpdateVectorLayerAttributesAction } from '@/actions/update-vector-layer-attributes';

import type {
    InsertRasterLayerOptions, UpdateRasterLayerOptions,
    RendererFrontend,
    WorkingFileVectorLayer,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawBucketFillController extends BaseCanvasMovementController {

    private isPreviewingFill = false;
    private pointerDownPreviewStrength = 0.5;
    private fillingRasterLayerIds: number[] = [];
    private fillingVectorLayerShapes: Array<[number, string, Record<string, string>]> = []; // [layerId, nodeId, attributes]

    private renderer: RendererFrontend | undefined;
    private maxTextureSize: number = Infinity;

    onEnter(): void {
        super.onEnter();

        useRenderer().then((renderer) => {
            this.renderer = renderer;
            this.renderer.getMaxTextureSize().then((maxTextureSize) => {
                this.maxTextureSize = maxTextureSize;
            })
        });

        appEmitter.on('editor.tool.selectAll', this.onSelectAll);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawBucketFillToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawBucketFillToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawBucketFillToolIntroduction',
                    title: t('tutorialTip.drawBucketFillToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawBucketFillToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawBucketFillToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        appEmitter.off('editor.tool.selectAll', this.onSelectAll);

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawBucketFillToolIntroduction) {
            dismissTutorialNotification('drawBucketFillToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

        if (!canvasStore.get('ready')) return;

        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.bucketFillStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();

        if (!canvasStore.get('ready')) return;

        if (this.touches.length === 1) {
            this.bucketFillStart();
        }
    }

    onPointerMove(e: PointerEvent) {
        super.onPointerMove(e);
        if (e.isPrimary) {
            this.bucketFillMove();
        }
    }

    async onPointerUp(e: PointerEvent): Promise<void> {
        super.onPointerUp(e);
        if (e.isPrimary) {
            this.bucketFillEnd();
        }
    }

    private async bucketFillStart() {
        if (!this.renderer) return;

        let { viewTransformPoint } = this.getTransformedCursorInfo();

        const startBucketFillReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startBucketFillReserveToken });

        const { width, height } = workingFileStore.state;
        const { width: textureWidth, height: textureHeight } = limitMaxDimension(width, height, this.maxTextureSize);
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster' || layer.type === 'vector' || layer.type === 'empty');
        let layerActions: BaseAction[] = [];

        // Insert raster layer if none selected
        let insertLayerAction: InsertLayerAction<InsertRasterLayerOptions> | undefined;
        if (selectedLayers.length === 0) {
            insertLayerAction = new InsertLayerAction<InsertRasterLayerOptions>({
                type: 'raster',
                name: ensureUniqueLayerSiblingName(workingFileStore.state.layers[0]?.id, t('toolbar.drawBrush.newBrushLayerName')),
                width: textureWidth,
                height: textureHeight,
                transform: new DOMMatrix().scaleSelf(width / textureWidth, height / textureHeight),
                data: {
                    sourceUuid: await createStoredImage(createEmptyCanvas(textureWidth, textureHeight)),
                },
            });
            layerActions.push(insertLayerAction);
        }

        // Convert any empty layers to raster layers
        for (let i = selectedLayers.length - 1; i >= 0; i--) {
            const selectedLayer = selectedLayers[i];
            if (selectedLayer.type === 'empty') {
                layerActions.push(
                    new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: selectedLayer.id,
                        type: 'raster',
                        width: textureWidth,
                        height: textureHeight,
                        transform: new DOMMatrix().scaleSelf(width / textureWidth, height / textureHeight),
                        data: {
                            sourceUuid: await createStoredImage(createEmptyCanvas(textureWidth, textureHeight)),
                        },
                    })
                );
            } else if (!['raster', 'vector'].includes(selectedLayer.type)) {
                selectedLayers.splice(i, 1);
            }
        }

        // Initialize bucket fill strength gradient
        try {
            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('createDrawLayer', 'action.createDrawLayer', layerActions),
                    reserveToken: startBucketFillReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: startBucketFillReserveToken });
            }

            const currentColor = colorPalette.value[colorPaletteIndex.value];

            this.fillingVectorLayerShapes = [];
            const vectorLayerIds = selectedLayers.filter((layer) => layer.type === 'vector').map((layer) => layer.id);
            for (const layerId of vectorLayerIds) {
                const layer = getLayerById<WorkingFileVectorLayer>(layerId);
                if (!layer) continue;
                const svgDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                if (!svgDocument) continue;
                layer.data.sourceDocument = svgDocument;
                const element = (await this.renderer?.pickVectorLayerElement(layerId, viewTransformPoint.x, viewTransformPoint.y))?.[0];
                if (!element) continue;
                const attributes: Record<string, string> = {};
                if (element.area === 'fill') {
                    attributes['fill'] = currentColor.alpha > 0 ? currentColor.style.slice(0, 7) : 'none';
                    attributes['fill-opacity'] = `${currentColor.alpha}`;
                } else if (element.area === 'stroke') {
                    attributes['stroke'] = currentColor.style.slice(0, 7);
                    attributes['stroke-opacity'] = `${currentColor.alpha}`;
                }
                this.renderer?.updateVectorLayerAttributes(layerId, element.id, attributes)
                this.fillingVectorLayerShapes.push([layerId, element.id, attributes]);
            }
            
            this.fillingRasterLayerIds = selectedLayers.filter((layer) => layer.type === 'raster').map((layer) => layer.id);
            if (insertLayerAction && !this.fillingRasterLayerIds.includes(insertLayerAction.insertedLayerId)) {
                this.fillingRasterLayerIds.push(insertLayerAction.insertedLayerId);
            }
            if (this.fillingRasterLayerIds.length > 0) {
                await this.renderer.createBucketFill({
                    layerIds: this.fillingRasterLayerIds,
                    color: new Float16Array([currentColor.r, currentColor.g, currentColor.b, currentColor.alpha]),
                    position: new Float16Array([viewTransformPoint.x, viewTransformPoint.y]),
                    feather: feather.value,
                    antialias: antialias.value,
                });
            }
        } catch {
            await historyStore.dispatch('unreserve', { token: startBucketFillReserveToken });
            return;
        }

        this.pointerDownPreviewStrength = strength.value;
        const primaryPointer = this.pointers.find((pointer) => pointer.primary);
        if (primaryPointer) {
            this.isPreviewingFill = true;
            if (this.fillingRasterLayerIds.length > 0) {
                this.renderer?.previewBucketFill(strength.value);
            }
        } else {
            this.applyBucketFill();
        }
    }

    private bucketFillMove() {
        if (!this.isPreviewingFill) return;
        const primaryPointer = this.pointers.find((pointer) => pointer.primary);
        if (!primaryPointer) return;

        let slideWidth = window.innerWidth / 5;
        if (slideWidth < 100) {
            slideWidth = window.innerWidth / 1.5;
        }
        const offset = (primaryPointer.move?.pageX ?? 0) - primaryPointer.down.pageX;
        strength.value = Math.max(0.0001, Math.min(0.9999, this.pointerDownPreviewStrength + (offset / slideWidth)));

        if (this.fillingRasterLayerIds.length > 0) {
            this.renderer?.previewBucketFill(strength.value);
        }
    }

    private bucketFillEnd() {
        if (!this.isPreviewingFill) return;
        this.isPreviewingFill = false;

        this.applyBucketFill();
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        return {
            viewTransformPoint,
            viewDecomposedTransform
        };
    }

    private async applyBucketFill() {
        if (!this.renderer) return;

        const updateLayerReserveToken = createHistoryReserveToken();

        await historyReserveQueueFree();

        await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

        try {
            const layerActions: BaseAction[] = [];

            if (this.fillingVectorLayerShapes.length > 0) {
                for (const [layerId, nodeId, attributes] of this.fillingVectorLayerShapes) {
                    layerActions.push(
                        new UpdateVectorLayerAttributesAction(layerId, nodeId, attributes, true)
                    );
                }
            }

            if (this.fillingRasterLayerIds.length > 0) {
                const renderTiles = await this.renderer.applyBucketFill(strength.value);
                strength.value = this.pointerDownPreviewStrength;

                for (const [renderTileIndex] of renderTiles.entries()) {
                    const layerId = this.fillingRasterLayerIds[renderTileIndex];
                    if (layerId == null) continue;
                    layerActions.push(
                        new UpdateLayerAction<UpdateRasterLayerOptions>({
                            id: layerId,
                            data: {
                                tileUpdates: await transferRendererTilesToRasterLayerUpdates([renderTiles[renderTileIndex]]),
                                alreadyRendererd: true,
                            }
                        })
                    );
                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateDrawLayer', 'action.updateDrawLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });

                for (const [layerId] of this.fillingVectorLayerShapes) {
                    const layer = getLayerById<WorkingFileVectorLayer>(layerId);
                    if (!layer) continue;
                    delete layer.data.sourceDocument;
                }
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }

        } catch (error) {
            await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
        }
    }

    onSelectAll() {
        if (activeSelectionMask.value || appliedSelectionMask.value) {
            historyStore.dispatch('runAction', {
                action: new ClearSelectionAction()
            });
        }
    }

    protected handleCursorIcon() {
        canvasStore.set('cursor', 'crosshair');
        return 'crosshair';
    }
}

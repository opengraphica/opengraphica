import BaseCanvasMovementController from './base-movement';

import appEmitter from '@/lib/emitter';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { getInheritedAttribute, generateSvgElementIds } from '@/lib/svg';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { createHistoryReserveToken, historyBlockInteractionUntilComplete, historyReserveQueueFree } from '@/store/history';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import { getLayerById, getSelectedLayers } from '@/store/working-file';
import { strength, feather, antialias, opacity } from '../store/erase-bucket-fill-state';
import { appliedSelectionMask, activeSelectionMask } from '../store/selection-state';
import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { UpdateLayerAction } from '@/actions/update-layer';
import { UpdateVectorLayerAttributesAction } from '@/actions/update-vector-layer-attributes';

import type {
    UpdateRasterLayerOptions, RendererFrontend,
    WorkingFileVectorLayer, UpdateVectorLayerOptions,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasEraseBucketFillController extends BaseCanvasMovementController {

    private isPreviewingFill = false;
    private pointerDownPreviewStrength = 0.5;
    private fillingRasterLayerIds: number[] = [];
    private fillingVectorLayerShapes: Array<[number, string, Record<string, string>, boolean]> = []; // [layerId, nodeId, attributes, delete]

    private renderer: RendererFrontend | undefined;

    onEnter(): void {
        super.onEnter();

        useRenderer().then((renderer) => {
            this.renderer = renderer;
        });

        appEmitter.on('editor.tool.selectAll', this.onSelectAll);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.eraseBucketFillToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.eraseBucketFillToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'eraseBucketFillToolIntroduction',
                    title: t('tutorialTip.eraseBucketFillToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.eraseBucketFillToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.eraseBucketFillToolIntroduction.body.mouse') as string[]).map((message) => {
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
        if (!editorStore.state.tutorialFlags.eraseBucketFillToolIntroduction) {
            dismissTutorialNotification('eraseBucketFillToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.bucketFillStart();
        }
    }

    onPointerMove(e: PointerEvent) {
        super.onPointerMove(e);
        if (e.isPrimary) {
            this.bucketFillMove();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.bucketFillStart();
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

        let selectedLayers = getSelectedLayers().filter((layer) => layer.type === 'raster' || layer.type === 'vector');
        if (selectedLayers.length === 0) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.eraseBucketFill.notification.noSelectedLayers.title'),
                message: t('toolbar.eraseBucketFill.notification.noSelectedLayers.message'),
                duration: 5000,
            });
            return;
        }

        let { viewTransformPoint } = this.getTransformedCursorInfo();

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
            let isDelete = false;
            const node = svgDocument.querySelector(`[data-ogr-id="${element.id}"]`);
            if (element.area === 'fill') {
                attributes['fill'] = 'none';
                attributes['fill-opacity'] = '0';
                const stroke = getInheritedAttribute(node, 'stroke') ?? null;
                const strokeOpacity = parseFloat(getInheritedAttribute(node, 'stroke-opacity') ?? '1');
                if (strokeOpacity <= 0 || stroke == null) {
                    isDelete = true;
                }
            } else if (element.area === 'stroke') {
                attributes['stroke'] = '#000000';
                attributes['stroke-opacity'] = `0`;
                const fill = getInheritedAttribute(node, 'fill') ?? 'none';
                const fillOpacity = parseFloat(getInheritedAttribute(node, 'fill-opacity') ?? '1');
                if (fillOpacity <= 0 || fill === 'none') {
                    isDelete = true;
                }
            }
            this.renderer?.updateVectorLayerAttributes(layerId, element.id, attributes)
            this.fillingVectorLayerShapes.push([layerId, element.id, attributes, isDelete]);
        }

        this.fillingRasterLayerIds = selectedLayers.filter((layer) => layer.type === 'raster').map((layer) => layer.id);
        if (this.fillingRasterLayerIds.length > 0) {
            await this.renderer.createBucketFill({
                layerIds: this.fillingRasterLayerIds,
                color: new Float16Array([0, 0, 0, opacity.value]),
                position: new Float16Array([viewTransformPoint.x, viewTransformPoint.y]),
                feather: feather.value,
                antialias: antialias.value,
                blendingMode: 'erase',
            });
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
                const serializer = new XMLSerializer();

                for (const [layerId, nodeId, attributes, isDelete] of this.fillingVectorLayerShapes) {
                    if (isDelete) {
                        const layer = getLayerById<WorkingFileVectorLayer>(layerId);
                        if (!layer) continue;

                        const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                        const newLayerDocument = layerDocument.cloneNode(true) as Document;
                        newLayerDocument.querySelector(`[data-ogr-id="${nodeId}"]`)?.remove();
                        generateSvgElementIds(newLayerDocument);

                        const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');
                        
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
    
                        layerActions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                            {
                                id: layer.id,
                                data: {
                                    sourceUuid: await createStoredSvg(image),
                                },
                            },
                        ));
                    } else {
                        layerActions.push(
                            new UpdateVectorLayerAttributesAction(layerId, nodeId, attributes, true)
                        );
                    }
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
                    action: new BundleAction('updateEraseLayer', 'action.updateEraseLayer', layerActions),
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

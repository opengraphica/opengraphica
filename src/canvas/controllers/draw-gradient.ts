import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import {
    cursorHoverPosition, positionHandleRadius, editingLayers,
    activeColorStops, blendColorSpace, fillType, spreadMethod,
    hasVisibleToolbarOverlay, showStopDrawer, radiusMultiplierTouch,
} from '@/canvas/store/draw-gradient-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { historyBlockInteractionUntilComplete } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform, ensureUniqueLayerSiblingName } from '@/store/working-file';

import { type BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import type {
    InsertGradientLayerOptions, UpdateGradientLayerOptions, WorkingFileAnyLayer, WorkingFileGradientFillType, WorkingFileGradientLayer, 
    WorkingFileGradientColorSpace, WorkingFileGradientSpreadMethod,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;
const controlPointNames: Array<keyof Pick<WorkingFileGradientLayer['data'], 'start' | 'end' | 'focus'>> = ['end', 'start', 'focus'];

export default class CanvasDrawGradientController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private drawingPointerId: number | null = null;

    private hasCreatedLayer: boolean = false;
    private selectedLayers: WorkingFileGradientLayer[] = [];
    private editingLayersStartData: Array<WorkingFileGradientLayer['data']> | null = null;
    private editingControlPoint: keyof Pick<WorkingFileGradientLayer['data'], 'start' | 'end' | 'focus'> | null = null;
    private hoveringControlPoint: keyof Pick<WorkingFileGradientLayer['data'], 'start' | 'end' | 'focus'> | null = null;

    onEnter(): void {
        super.onEnter();

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )

        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            this.selectedLayers = getSelectedLayers<WorkingFileGradientLayer>(newIds).filter(
                layer => layer.type === 'gradient'
            );
            editingLayers.value = getSelectedLayers<WorkingFileGradientLayer>(newIds).filter(
                layer => layer.type === 'gradient'
            );
            this.updateToolbarFromEditingLayers();
        }, { immediate: true });

        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onHistoryStep);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawGradientToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawGradientToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawGradientToolIntroduction',
                    title: t('tutorialTip.drawGradientToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawGradientToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawGradientToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        showStopDrawer.value = false;
        this.selectedLayerIdsUnwatch?.();

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawGradientToolIntroduction) {
            dismissTutorialNotification('drawGradientToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

        if (hasVisibleToolbarOverlay.value) {
            showStopDrawer.value = false;
            return;
        }

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        if (
            this.drawingPointerId == null && e.isPrimary && e.button === 0 &&
            (
                e.pointerType === 'pen' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            this.drawingPointerId = e.pointerId;
            this.drawStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.drawingPointerId = this.touches[0].id;
            this.drawStart();
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        this.hoveringControlPoint = this.getControlPointAtPosition({
            x: cursorHoverPosition.value.x,
            y: cursorHoverPosition.value.y,
        }, this.selectedLayers);

        if (
            this.drawingPointerId === e.pointerId &&
            pointer.isDragging
        ) {
            this.drawPreview();
        }

        this.handleCursorIcon();
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    protected async drawStart() {
        if (this.drawingPointerId == null) return;
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];
        if (!pointer) return;

        const { viewTransformPoint: start } = this.getTransformedCursorInfo();
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'gradient' || layer.type === 'empty');

        // See if the user clicked on any points in a selected layer.
        this.editingControlPoint = this.getControlPointAtPosition(start, selectedLayers, true);
        
        if (this.editingControlPoint == null) {
            editingLayers.value = [];
            const { width, height } = workingFileStore.state;
            let layerActions: BaseAction[] = [];
            selectedLayers = selectedLayers.filter(layer => layer.type === 'empty');

            const newGradientData: InsertGradientLayerOptions['data'] = {
                start: { x: start.x, y: start.y },
                end: { x: start.x, y: start.y },
                focus: { x: start.x, y: start.y },
                stops: JSON.parse(JSON.stringify(activeColorStops.value)),
                blendColorSpace: blendColorSpace.value,
                fillType: fillType.value,
                spreadMethod: spreadMethod.value,
            }

            // Insert gradient layer if none selected
            if (selectedLayers.length === 0) {
                layerActions.push(new InsertLayerAction<InsertGradientLayerOptions>({
                    type: 'gradient',
                    name: ensureUniqueLayerSiblingName(workingFileStore.state.layers[0]?.id, t('toolbar.drawGradient.newGradientLayerName')),
                    width,
                    height,
                    data: newGradientData,
                }));
            }
            // Convert any empty layers to raster layers
            for (let i = selectedLayers.length - 1; i >= 0; i--) {
                const selectedLayer = selectedLayers[i];
                if (selectedLayer.type === 'empty') {
                    layerActions.push(
                        new UpdateLayerAction<UpdateGradientLayerOptions>({
                            id: selectedLayer.id,
                            type: 'gradient',
                            width,
                            height,
                            data: JSON.parse(JSON.stringify(newGradientData)),
                        })
                    );
                } else if (selectedLayer.type !== 'gradient') {
                    selectedLayers.splice(i, 1);
                }
            }
            // Finalize layer creation / conversion actions.
            if (layerActions.length > 0) {
                this.hasCreatedLayer = true;
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('createDrawGradientLayer', 'action.createDrawGradientLayer', layerActions),
                });
            }   
            this.editingControlPoint = 'end';
        }

        await nextTick();

        selectedLayers = getSelectedLayers().filter(layer => layer.type === 'gradient');
        if (selectedLayers.length > 0) {
            editingLayers.value = [selectedLayers[0] as WorkingFileGradientLayer];
        } else {
            editingLayers.value = [];
        }

        this.updateToolbarFromEditingLayers();
    }

    private drawPreview() {
        if (this.editingControlPoint == null || editingLayers.value.length == 0) return;
        const { viewTransformPoint } = this.getTransformedCursorInfo();

        if (this.editingLayersStartData == null) {
            this.editingLayersStartData = [];
            for (const layer of editingLayers.value) {
                this.editingLayersStartData.push(
                    JSON.parse(JSON.stringify(layer.data))
                );
                layer.data = JSON.parse(JSON.stringify(layer.data));
            }
        }

        for (const layer of editingLayers.value) {
            const layerGlobalTransformInverse = getLayerGlobalTransform(layer).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerGlobalTransformInverse);
            if (this.editingControlPoint === 'start' && layer.data.start.x === layer.data.focus.x && layer.data.start.y === layer.data.focus.y) {
                layer.data.focus = {
                    x: layerTransformPoint.x,
                    y: layerTransformPoint.y,
                };
            }
            layer.data[this.editingControlPoint] = {
                x: layerTransformPoint.x,
                y: layerTransformPoint.y,
            };
        }

        canvasStore.set('dirty', true);
    }

    private async drawEnd(e: PointerEvent) {
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];

        if (pointer?.isDragging && this.editingControlPoint != null && editingLayers.value.length >= 0) {
            let layerActions: BaseAction[] = [];
            for (const [layerIndex, layer] of editingLayers.value.entries()) {
                layerActions.push(
                    new UpdateLayerAction<UpdateGradientLayerOptions>({
                        id: layer.id,
                        data: JSON.parse(JSON.stringify(layer.data)),
                    }, {
                        data: this.editingLayersStartData?.[layerIndex]
                    })
                )
            }
            historyStore.dispatch('runAction', {
                action: new BundleAction('updateDrawGradientLayerPosition', 'action.updateDrawGradientLayerPosition', layerActions),
                mergeWithHistory: this.hasCreatedLayer ? 'createDrawGradientLayer' : undefined,
            })
        }

        this.editingControlPoint = null;
        this.drawingPointerId = null;
        this.editingLayersStartData = null;
        this.hasCreatedLayer = false;
    }

    private getControlPointAtPosition(cursor: { x: number, y: number }, selectedLayers: WorkingFileAnyLayer[], editLayer = false) {
        const decomposedTransform = canvasStore.state.decomposedTransform;
        let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
        let controlPoint: 'start' | 'end' | 'focus' | null = null;
        for (const layer of selectedLayers as WorkingFileGradientLayer[]) {
            if (layer.type !== 'gradient') continue;
            const layerGlobalTransform = getLayerGlobalTransform(layer);
            for (const controlPointName of controlPointNames) {
                const handleRadius = (positionHandleRadius * (editorStore.get('isTouchUser') ? radiusMultiplierTouch : 1)) / appliedZoom;
                const { x, y } = layer.data[controlPointName];
                const transformedPoint = new DOMPoint(x, y).matrixTransform(layerGlobalTransform);
                if (
                    Math.abs(transformedPoint.x - cursor.x) <= handleRadius &&
                    Math.abs(transformedPoint.y - cursor.y) <= handleRadius
                ) {
                    controlPoint = controlPointName;
                    if (editLayer) {
                        editingLayers.value = [layer];
                    }
                    break;
                }
            }
        }
        return controlPoint;
    }

    private onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if ([
            'updateDrawGradientLayerFillType', 'updateDrawGradientLayerBlendColorSpace', 'updateDrawGradientLayerSpreadMethod',
            'updateDrawGradientLayerStops',
        ].includes(event?.action.id as string)) {
            this.updateToolbarFromEditingLayers();
        }
    }

    private updateToolbarFromEditingLayers() {
        if (editingLayers.value.length > 0) {
            let editingFillTypes = new Set<WorkingFileGradientFillType>();
            let editingBlendColorSpace = new Set<WorkingFileGradientColorSpace>();
            let editingSpreadMethod = new Set<WorkingFileGradientSpreadMethod>();
            for (const layer of editingLayers.value) {
                editingFillTypes.add(layer.data.fillType);
                editingBlendColorSpace.add(layer.data.blendColorSpace);
                editingSpreadMethod.add(layer.data.spreadMethod);
            }
            if (editingFillTypes.size === 1) {
                fillType.value = Array.from(editingFillTypes)[0];
            }
            if (editingBlendColorSpace.size === 1) {
                blendColorSpace.value = Array.from(editingBlendColorSpace)[0];
            }
            if (editingSpreadMethod.size === 1) {
                spreadMethod.value = Array.from(editingSpreadMethod)[0];
            }
            if (editingLayers.value.length === 1) {
                activeColorStops.value = JSON.parse(JSON.stringify(editingLayers.value[0].data.stops));
            }
        }
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        return {
            viewTransformPoint,
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon && !hasVisibleToolbarOverlay.value) {
            if (this.hoveringControlPoint == null) {
                newIcon = 'crosshair';
            } else {
                newIcon = 'grabbing';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}

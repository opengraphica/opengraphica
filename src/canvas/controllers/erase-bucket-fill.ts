import BaseCanvasMovementController from './base-movement';

import appEmitter from '@/lib/emitter';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { createHistoryReserveToken, historyBlockInteractionUntilComplete, historyReserveQueueFree } from '@/store/history';
import { getSelectedLayers } from '@/store/working-file';
import { strength, feather, antialias, opacity } from '../store/erase-bucket-fill-state';
import { appliedSelectionMask, activeSelectionMask } from '../store/selection-state';

import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { UpdateLayerAction } from '@/actions/update-layer';

import type {
    UpdateRasterLayerOptions, RendererFrontend,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasEraseBucketFillController extends BaseCanvasMovementController {

    private isPreviewingFill = false;
    private pointerDownPreviewStrength = 0.5;
    private fillingLayerIds: number[] = [];

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

        let selectedLayers = getSelectedLayers().filter((layer) => layer.type === 'raster');
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

        this.fillingLayerIds = selectedLayers.map((layer) => layer.id);

        await this.renderer.createBucketFill({
            layerIds: this.fillingLayerIds,
            color: new Float16Array([0, 0, 0, opacity.value]),
            position: new Float16Array([viewTransformPoint.x, viewTransformPoint.y]),
            feather: feather.value,
            antialias: antialias.value,
            blendingMode: 'erase',
        });

        this.pointerDownPreviewStrength = strength.value;
        const primaryPointer = this.pointers.find((pointer) => pointer.primary);
        if (primaryPointer) {
            this.isPreviewingFill = true;
            this.renderer?.previewBucketFill(strength.value);
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

        this.renderer?.previewBucketFill(strength.value);
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
            const renderTiles = await this.renderer.applyBucketFill(strength.value);
            strength.value = this.pointerDownPreviewStrength;
            const layerActions: BaseAction[] = [];

            for (const [renderTileIndex] of renderTiles.entries()) {
                const layerId = this.fillingLayerIds[renderTileIndex];
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

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateEraseLayer', 'action.updateEraseLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
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

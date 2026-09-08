import { watch, type WatchHandle } from 'vue';
import BaseCanvasMovementController from './base-movement';

import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById } from '@/store/working-file';
import {
    layerOpacityEmitter, previewOpacity,
    editingLayers, editingLayerIds, editingLayersRestoreOpacity,
} from '@/canvas/store/layer-opacity-state';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { UpdateAnyLayerOptions } from '@/types';

export default class CanvasDrawBrushController extends BaseCanvasMovementController {

    private previewOpacityUnwatch: WatchHandle | null = null;
    private previewOpacityDragStart: number = 1;
    private isPreviewOpacityDragging: boolean = false;

    onEnter(): void {
        super.onEnter();

        this.onCancel = this.onCancel.bind(this);
        this.onDone = this.onDone.bind(this);

        layerOpacityEmitter.on('cancel', this.onCancel);
        layerOpacityEmitter.on('done', this.onDone);

        if (editingLayerIds.value.length === 0) {
            editingLayerIds.value = workingFileStore.get('selectedLayerIds').slice();
        }
        editingLayersRestoreOpacity.value = [];
        let totalOpacity = 0;
        for (const layerId of editingLayerIds.value) {
            const opacity = getLayerById(layerId)?.opacity ?? 1;
            totalOpacity += opacity
            editingLayersRestoreOpacity.value.push(opacity);
        }

        previewOpacity.value = totalOpacity / editingLayerIds.value.length;
        if (isNaN(previewOpacity.value)) {
            previewOpacity.value = 1;
        }

        this.previewOpacityUnwatch = watch(() => previewOpacity.value, () => {
            for (const layer of editingLayers.value) {
                layer.opacity = previewOpacity.value;
            }
            canvasStore.set('dirty', true);
        });
    }

    onLeave(): void {
        super.onLeave();

        layerOpacityEmitter.off('cancel', this.onCancel);
        layerOpacityEmitter.off('done', this.onDone);

        this.previewOpacityUnwatch?.();
        this.previewOpacityUnwatch = null;
    }

    onCancel() {
        for (const [layerIndex, layerId] of editingLayerIds.value.entries()) {
            const layer = getLayerById(layerId);
            if (!layer) continue;
            layer.opacity = editingLayersRestoreOpacity.value[layerIndex];
        }
    }

    onDone() {
        const updateActions: UpdateLayerAction<UpdateAnyLayerOptions>[] = [];

        for (const [layerIndex, layerId] of editingLayerIds.value.entries()) {
            updateActions.push(
                new UpdateLayerAction<UpdateAnyLayerOptions>(
                    {
                        id: layerId,
                        opacity: previewOpacity.value,
                    },
                    {
                        opacity: editingLayersRestoreOpacity.value[layerIndex] ?? 1,
                    },
                )
            )
        }

        historyStore.dispatch('runAction', {
            action: new BundleAction('updateLayerOpacity', 'action.updateLayerOpacity', updateActions)
        });
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.isPreviewOpacityDragging = true;
            this.previewOpacityDragStart = previewOpacity.value;
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.isPreviewOpacityDragging = true;
            this.previewOpacityDragStart = previewOpacity.value;
        } else {
            this.isPreviewOpacityDragging = false;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (this.isPreviewOpacityDragging && this.pointers.length === 1 && this.pointers[0].down.button === 0) {
            let slideWidth = window.innerWidth / 3;
            if (slideWidth < 300) {
                slideWidth = window.innerWidth / 1.75;
            }
            const offset = (this.pointers[0].move?.pageX ?? this.pointers[0].down.pageX) - this.pointers[0].down.pageX;
            previewOpacity.value = Math.max(0, Math.min(1, this.previewOpacityDragStart + (offset / slideWidth)));
        }
    }

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (this.pointers.length === 0) {
            this.isPreviewOpacityDragging = false;
        }
    }

}

import { watch, WatchStopHandle } from 'vue';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';

import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { isInput } from '@/lib/events';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';

import { SelectLayersAction } from '@/actions/select-layers';

import { t, tm, rt } from '@/i18n';

import type { DrawWorkingFileOptions } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class EffectController extends BaseCanvasMovementController {


    onEnter(): void {
        super.onEnter();
        
        // Tutorial message
        if (!editorStore.state.tutorialFlags.effectToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.effectToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'effectToolIntroduction',
                    title: t('tutorialTip.effectToolIntroduction.title'),
                    message: {
                        touch: message,
                        mouse: message
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.effectToolIntroduction) {
            dismissTutorialNotification('effectToolIntroduction');
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.onPointerClick();
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (isInput(e.target)) return;
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.onPointerClick();
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
    }

    private async onPointerClick() {
        let { viewTransformPoint } = this.getTransformedCursorInfo();
        const pickLayerId = this.pickLayer(viewTransformPoint);
        if (pickLayerId != null) {
            await historyStore.dispatch('runAction', {
                action: new SelectLayersAction([pickLayerId]),
                mergeWithHistory: 'selectLayers',
            });
        }
    }

    private pickLayer(viewTransformPoint: DOMPoint): number | null {
        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = 1;
        workingCanvas.height = 1;
        const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) return null;
        const initialTransform = new DOMMatrix().translateSelf(-viewTransformPoint.x, -viewTransformPoint.y);
        const selectionTest: DrawWorkingFileOptions['selectionTest'] = {
            point: new DOMPoint(),
            resultId: undefined,
            resultPixelTest: undefined
        };
        drawWorkingFileToCanvas2d(workingCanvas, ctx, { initialTransform, selectionTest });
        return selectionTest.resultId != null ? selectionTest.resultId : null;
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
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}

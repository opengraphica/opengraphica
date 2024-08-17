import { watch, WatchStopHandle } from 'vue';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { t, tm, rt } from '@/i18n';

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

    onMultiTouchTap(touches: PointerTracker[]) {
        super.onMultiTouchTap(touches);
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        super.onPointerUpBeforePurge(e);
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}

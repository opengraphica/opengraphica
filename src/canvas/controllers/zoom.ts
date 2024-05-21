import { watch, WatchStopHandle } from 'vue';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { t, tm, rt } from '@/i18n';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    private ctrlKeyUnwatch: WatchStopHandle | null = null;
    private isDragging: boolean = false;

    onEnter(): void {
        super.onEnter();
        this.ctrlKeyUnwatch = watch([isCtrlOrMetaKeyPressed], ([isCtrlOrMetaKeyPressed]) => {
            this.handleCursorIcon();
        });

        // Tutorial message
        if (!editorStore.state.tutorialFlags.zoomToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.zoomToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'zoomToolIntroduction',
                    title: t('tutorialTip.zoomToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.zoomToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                zooming: `<strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> ${t('tutorialTip.zoomToolIntroduction.bodyTitle.zooming')}</strong>`,
                                panning: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.zoomToolIntroduction.bodyTitle.panning')}</strong>`,
                            })}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.zoomToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                zooming: `<strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> ${t('tutorialTip.zoomToolIntroduction.bodyTitle.zooming')}</strong>`,
                                panning: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.zoomToolIntroduction.bodyTitle.panning')}</strong>`,
                                leftClick: `<em>${t('tutorialTip.zoomToolIntroduction.bodyTitle.leftClick')}</em>`,
                                ctrlLeftClick: `<em>${t('tutorialTip.zoomToolIntroduction.bodyTitle.ctrlLeftClick')}</em>`,
                                leftMouseButton: `<em>${t('tutorialTip.zoomToolIntroduction.bodyTitle.leftMouseButton')}</em>`,
                            })}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();
        if (this.ctrlKeyUnwatch) {
            this.ctrlKeyUnwatch();
            this.ctrlKeyUnwatch = null;
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.zoomToolIntroduction) {
            dismissTutorialNotification('zoomToolIntroduction');
        }
    }

    onMultiTouchTap(touches: PointerTracker[]) {
        super.onMultiTouchTap(touches);
        if (touches.length === 1) {
            this.onZoomIn();
        } else if (touches.length === 2) {
            this.onZoomOut();
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1)) {
            if (pointer.isDragging && e.isPrimary && pointer.down.button === 0) {
                this.isDragging = true;
                this.handleCursorIcon();
                const lastCursorX = (pointer.movePrev || pointer.down).pageX;
                const lastCursorY = (pointer.movePrev || pointer.down).pageY;
                const cursorX = e.pageX;
                const cursorY = e.pageY;
                let transform = canvasStore.get('transform');
                const transformInverse = transform.inverse();
                const moveTranslateStart = new DOMPoint(lastCursorX * devicePixelRatio, lastCursorY * devicePixelRatio).matrixTransform(transformInverse);
                // Pan View
                const translateMove = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                transform.translateSelf(translateMove.x - moveTranslateStart.x, translateMove.y - moveTranslateStart.y);
                canvasStore.set('transform', transform);
                canvasStore.set('viewDirty', true);
            }
        }
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        super.onPointerUpBeforePurge(e);

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.button === 0) {
            if (pointer.isDragging) {
                this.isDragging = false;
                this.handleCursorIcon();
            } else {
                if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
                    if (isCtrlOrMetaKeyPressed.value === true) {
                        this.onZoomOut();
                    } else {
                        this.onZoomIn();
                    }
                }
            }
        }
    }

    onZoomIn() {
        this.zoomCanvas(3);
    }

    onZoomOut() {
        this.zoomCanvas(-3);
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            if (this.isDragging) {
                newIcon = 'grabbing';
            } else if (isCtrlOrMetaKeyPressed.value) {
                newIcon = 'zoom-out';
            } else {
                newIcon = 'zoom-in';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}

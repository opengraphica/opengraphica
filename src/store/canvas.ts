import { PerformantStore } from './performant-store';
import { CanvasViewResetOptions } from '@/types';
import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';
import preferencesStore from './preferences';

import type { Mesh, PlaneGeometry, ShaderMaterial, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import type { EffectComposer } from '@/canvas/renderers/webgl/postprocessing/effect-composer';

const imageSmoothingZoomRatio = preferencesStore.get('imageSmoothingZoomRatio');
let nextRenderFrameCallbacks: Array<() => void> = [];

interface CanvasState {
    bufferCanvas: HTMLCanvasElement;
    bufferCtx: CanvasRenderingContext2D;
    cursor: string | null;
    cursorX: number;
    cursorY: number;
    decomposedTransform: DecomposedMatrix;
    dirty: boolean;
    dndAreaLeft: number; // devicePixelRatio IS applied.
    dndAreaTop: number; // devicePixelRatio IS applied.
    dndAreaWidth: number; // devicePixelRatio IS applied.
    dndAreaHeight: number; // devicePixelRatio IS applied.
    drawing: boolean;
    isBufferInUse: boolean;
    isDisplayingNonRasterLayer: boolean;
    playingAnimation: boolean;
    preventPostProcess: boolean;
    renderer: '2d' | 'webgl'; // The active renderer. See preferences store for preferred renderer.
    selectionMaskCanvas: HTMLCanvasElement;
    showAreaOutsideWorkingFile: boolean;
    threejsBackground: Mesh | null;
    threejsCamera: OrthographicCamera | null;
    threejsCanvasMargin: Mesh | null;
    threejsComposer: EffectComposer | null;
    threejsRenderer: WebGLRenderer | null;
    threejsScene: Scene | null;
    threejsSelectionMask: Mesh<PlaneGeometry, ShaderMaterial> | null;
    transform: DOMMatrix;
    transformResetOptions: undefined | true | CanvasViewResetOptions;
    useCssCanvas: boolean;
    useCssViewport: boolean;
    viewCanvas: HTMLCanvasElement;
    viewCtx: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext;
    viewDirty: boolean;
    viewHeight: number; // Maps to screen height; devicePixelRatio IS applied.
    viewWidth: number; // Maps to screen width; devicePixelRatio IS applied.
    workingImageBorderColor: string;
}

interface CanvasDispatch {
    setTransformRotation: number; // Radians
    setTransformScale: number;
    setTransformTranslate: {
        x: number;
        y: number;
    },
    setTransformFlipX: boolean;
    setTransformFlipY: boolean;
}

interface CanvasStore {
    dispatch: CanvasDispatch;
    state: CanvasState;
}

let dummyCanvas: any = document.createElement('canvas');

const store = new PerformantStore<CanvasStore>({
    name: 'canvasStore',
    state: {
        bufferCanvas: dummyCanvas,
        bufferCtx: dummyCanvas.getContext('2d') as CanvasRenderingContext2D,
        cursor: null,
        cursorX: 0,
        cursorY: 0,
        decomposedTransform: decomposeMatrix(new DOMMatrix),
        dirty: true,
        dndAreaLeft: 0, // devicePixelRatio IS applied.
        dndAreaTop: 0,  // devicePixelRatio IS applied.
        dndAreaWidth: 1,  // devicePixelRatio IS applied.
        dndAreaHeight: 1,  // devicePixelRatio IS applied.
        drawing: false,
        isBufferInUse: false,
        isDisplayingNonRasterLayer: false,
        playingAnimation: false,
        preventPostProcess: false,
        renderer: '2d',
        selectionMaskCanvas: dummyCanvas,
        showAreaOutsideWorkingFile: false,
        threejsBackground: null,
        threejsCamera: null,
        threejsCanvasMargin: null,
        threejsComposer: null,
        threejsRenderer: null,
        threejsScene: null,
        threejsSelectionMask: null,
        transform: new DOMMatrix(),
        transformResetOptions: undefined,
        useCssCanvas: true,
        useCssViewport: false,
        viewCanvas: dummyCanvas,
        viewCtx: dummyCanvas.getContext('2d') as CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext,
        viewDirty: true,
        viewHeight: 100, // Maps to screen height; devicePixelRatio IS applied.
        viewWidth: 100, // Maps to screen width; devicePixelRatio IS applied.
        workingImageBorderColor: '#cccccc'
    },
    nonReactive: ['bufferCanvas', 'bufferCtx', 'isDisplayingNonRasterLayer', 'selectionMaskCanvas', 'threejsCamera', 'threejsComposer', 'threejsSelectionMask', 'viewCanvas', 'viewCtx'],
    onSet(key, value, set) {
        if (key === 'transform') {
            const previousDecomposedTransform = store.state.decomposedTransform;
            const decomposedTransform = decomposeMatrix(value as DOMMatrix);
            set('decomposedTransform', decomposedTransform);
            set('useCssViewport',
                /* store.state.renderer !== '2d' || */
                (
                    !preferencesStore.get('useCanvasViewport') &&
                    !(store.get('isDisplayingNonRasterLayer') && decomposedTransform.scaleX > 1)
                )
            );
            set('transformResetOptions', undefined);
            const imageSmoothingZoomRatioDevice = imageSmoothingZoomRatio * window.devicePixelRatio;
            if (
                (previousDecomposedTransform.scaleX > imageSmoothingZoomRatioDevice && decomposedTransform.scaleX <= imageSmoothingZoomRatioDevice) ||
                (previousDecomposedTransform.scaleX <= imageSmoothingZoomRatioDevice && decomposedTransform.scaleX > imageSmoothingZoomRatioDevice)
            ) {
                set('dirty', true);
            }
        }
    },
    onDispatch(actionName: keyof CanvasDispatch, value: any, set) {
        switch (actionName) {
            case 'setTransformRotation':
            case 'setTransformScale':
            case 'setTransformTranslate':
            case 'setTransformFlipX':
            case 'setTransformFlipY':
                const viewCanvas = store.get('viewCanvas');
                const decomposedTransform = store.get('decomposedTransform');
                let rotationDelta = 0;
                let scaleDeltaX = 0;
                let scaleDeltaY = 0;

                const transform = store.get('transform');
                const inverseTransform = transform.inverse();

                let handleX = store.get('dndAreaLeft') + (store.get('dndAreaWidth') / 2);
                let handleY = store.get('dndAreaTop') + (store.get('dndAreaHeight') / 2);
                let centerPoint = new DOMPoint(handleX, handleY).matrixTransform(inverseTransform);

                if (actionName === 'setTransformRotation') {
                    rotationDelta = (value - decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES;
                } else if (actionName === 'setTransformScale') {
                    scaleDeltaX = value / decomposedTransform.scaleX;
                    scaleDeltaY = scaleDeltaX;
                } else if (actionName === 'setTransformTranslate') {
                    decomposedTransform.translateX = value.x;
                    decomposedTransform.translateY = value.y;
                } else if (actionName === 'setTransformFlipX') {
                    scaleDeltaX = -1;
                    scaleDeltaY = 1;
                } else if (actionName === 'setTransformFlipY') {
                    scaleDeltaX = 1;
                    scaleDeltaY = -1;
                }

                transform.translateSelf(centerPoint.x, centerPoint.y);
                if (scaleDeltaX || scaleDeltaY) {
                    transform.scaleSelf(scaleDeltaX, scaleDeltaY);
                }
                if (rotationDelta) {
                    transform.rotateSelf(rotationDelta);
                }
                transform.translateSelf(-centerPoint.x, -centerPoint.y);

                store.set('transform', transform);
                store.set('viewDirty', true);
                break;
        }
    }
});

dummyCanvas = null;

async function getCanvasRenderingContext(canvas: HTMLCanvasElement) {
    const { getCanvasRenderingContext2DSettings, getWebGLContextAttributes } = await import('@/store/working-file');
    if (store.state.renderer === '2d') {
        return canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    } else if (store.state.renderer === 'webgl') {
        if (store.state.threejsRenderer?.capabilities.isWebGL2) {
            return canvas.getContext('webgl2', getWebGLContextAttributes());
        } else {
            return canvas.getContext('webgl', getWebGLContextAttributes());
        }
    }
    return null;
}

function nextRenderFrame(): Promise<void>;
function nextRenderFrame(callback: () => void): void;
function nextRenderFrame(callback?: () => void): Promise<void> | void {
    if (callback) {
        nextRenderFrameCallbacks.push(callback);
    } else {
        return new Promise((resolve) => {
            nextRenderFrameCallbacks.push(resolve);
        });
    }
}

function notifyNextRenderFrame() {
    for (const callback of nextRenderFrameCallbacks) {
        try {
            callback();
        } catch (error) {
            console.error('[src/store/canvas.ts] Error on render frame callback:', error);
        }
    }
    nextRenderFrameCallbacks = [];
}

export default store;

export {
    CanvasStore,
    CanvasState,
    getCanvasRenderingContext,
    nextRenderFrame,
    notifyNextRenderFrame,
};

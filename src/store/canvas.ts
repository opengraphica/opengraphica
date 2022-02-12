import { PerformantStore } from './performant-store';
import { CanvasRenderingContext2DEnhanced, CanvasViewResetOptions } from '@/types';
import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';
import preferencesStore from './preferences';

interface CanvasState {
    bufferCanvas: HTMLCanvasElement;
    bufferCtx: CanvasRenderingContext2DEnhanced;
    cursor: string | null;
    cursorX: number;
    cursorY: number;
    decomposedTransform: DecomposedMatrix;
    dirty: boolean;
    isBufferInUse: boolean;
    isDisplayingNonRasterLayer: boolean;
    playingAnimation: boolean;
    preventPostProcess: boolean;
    transform: DOMMatrix;
    transformResetOptions: undefined | true | CanvasViewResetOptions;
    useCssCanvas: boolean;
    useCssViewport: boolean;
    viewCanvas: HTMLCanvasElement;
    viewCtx: CanvasRenderingContext2DEnhanced;
    viewDirty: boolean;
    viewHeight: number;
    viewWidth: number;
    workingImageBorderColor: string;
}

interface CanvasDispatch {
    setTransformRotation: number; // Radians
    setTransformScale: number;
    setTransformTranslate: {
        x: number;
        y: number;
    }
}

interface CanvasStore {
    dispatch: CanvasDispatch;
    state: CanvasState;
}

let dummyCanvas: any = document.createElement('canvas');

const store = new PerformantStore<CanvasStore>({
    state: {
        bufferCanvas: dummyCanvas,
        bufferCtx: dummyCanvas.getContext('2d') as CanvasRenderingContext2DEnhanced,
        cursor: null,
        cursorX: 0,
        cursorY: 0,
        decomposedTransform: decomposeMatrix(new DOMMatrix),
        dirty: true,
        isBufferInUse: false,
        isDisplayingNonRasterLayer: false,
        playingAnimation: false,
        preventPostProcess: false,
        transform: new DOMMatrix(),
        transformResetOptions: undefined,
        useCssCanvas: true,
        useCssViewport: false,
        viewCanvas: dummyCanvas,
        viewCtx: dummyCanvas.getContext('2d') as CanvasRenderingContext2DEnhanced,
        viewDirty: true,
        viewHeight: 100, // Maps to screen height
        viewWidth: 100, // Maps to screen width
        workingImageBorderColor: '#cccccc'
    },
    nonReactive: ['bufferCanvas', 'bufferCtx', 'isDisplayingNonRasterLayer', 'viewCanvas', 'viewCtx'],
    onSet(key, value, set) {
        if (key === 'transform') {
            const decomposedTransform = decomposeMatrix(value as DOMMatrix);
            set('decomposedTransform', decomposedTransform);
            set('useCssViewport',
                !preferencesStore.get('useCanvasViewport') &&
                !(store.get('isDisplayingNonRasterLayer') && decomposedTransform.scaleX > 1)
            );
            set('transformResetOptions', undefined);
        }
    },
    onDispatch(actionName: keyof CanvasDispatch, value: any, set) {
        switch (actionName) {
            case 'setTransformRotation':
            case 'setTransformScale':
            case 'setTransformTranslate':
                const decomposedTransform = store.get('decomposedTransform');
                let rotationDelta = 0;
                let scaleDelta = 0;
                if (actionName === 'setTransformRotation') {
                    rotationDelta = (value - decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES;
                } else if (actionName === 'setTransformScale') {
                    scaleDelta = value / decomposedTransform.scaleX;
                } else if (actionName === 'setTransformTranslate') {
                    decomposedTransform.translateX = value.x;
                    decomposedTransform.translateY = value.y;
                }

                const devicePixelRatio = window.devicePixelRatio || 1;
                const transform = store.get('transform');

                // TODO - Take sidebars into account
                const handleX = store.get('viewWidth') / 2 * devicePixelRatio;
                const handleY = store.get('viewHeight') / 2 * devicePixelRatio;

                const point = new DOMPoint(handleX, handleY).matrixTransform(transform.inverse());
                transform.translateSelf(point.x, point.y);
                if (scaleDelta) {
                    transform.scaleSelf(scaleDelta, scaleDelta);
                }
                if (rotationDelta) {
                    transform.rotateSelf(rotationDelta);
                }
                transform.translateSelf(-point.x, -point.y);

                store.set('transform', transform);
                store.set('viewDirty', true);
                break;
        }
    }
});

dummyCanvas = null;

export default store;

export {
    CanvasStore,
    CanvasState
};

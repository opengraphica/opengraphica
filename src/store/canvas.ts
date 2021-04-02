import { PerformantStore } from './performant-store';
import { CanvasRenderingContext2DEnhanced } from '@/types';
import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';

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
    transform: DOMMatrix;
    useCssViewport: boolean;
    viewCanvas: HTMLCanvasElement;
    viewCtx: CanvasRenderingContext2DEnhanced;
    viewDirty: boolean;
    viewHeight: number;
    viewWidth: number;
    workingImageBorderColor: string;
}

interface CanvasStore {
    dispatch: {};
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
        transform: new DOMMatrix(),
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
            set('useCssViewport', !(store.get('isDisplayingNonRasterLayer') && decomposedTransform.scaleX > 1));
        }
    }
});

dummyCanvas = null;

export default store;

export {
    CanvasStore,
    CanvasState
};

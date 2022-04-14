import { KeyboardMapConfigCategory } from '@/types';
import { PerformantStore } from './performant-store';

interface PreferencesState {
    dragStartRadius: number; // Pixels
    enableMultiLayerBuffer: boolean;
    historyStatesMax: number;
    keyboardMapConfig: KeyboardMapConfigCategory[];
    imageSmoothingZoomRatio: number;
    menuBarPosition: 'top' | 'bottom' | 'left' | 'right';
    multiTouchDownTimeout: number;
    multiTouchTapTimeout: number;
    pointerTapTimeout: number;
    pointerPressHoldTimeout: number;
    postProcessInterpolateImage: boolean;
    preferCanvasViewport: boolean;
    showWelcomeScreenAtStart: boolean;
    snapSensitivity: number;
    touchRotation: 'on' | 'snap' | 'off';
    useCanvasViewport: boolean;
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    state: {
        dragStartRadius: 5,
        enableMultiLayerBuffer: false,
        historyStatesMax: 50,
        imageSmoothingZoomRatio: 1.25,
        keyboardMapConfig: [],
        menuBarPosition: 'left',
        multiTouchDownTimeout: 75,
        multiTouchTapTimeout: 175,
        pointerTapTimeout: 150,
        pointerPressHoldTimeout: 500,
        postProcessInterpolateImage: true,
        preferCanvasViewport: false,
        showWelcomeScreenAtStart: true,
        snapSensitivity: 5,
        touchRotation: 'off',
        useCanvasViewport: false
    },
    restore: [
        'dragStartRadius',
        'historyStatesMax',
        'menuBarPosition',
        'multiTouchDownTimeout',
        'multiTouchTapTimeout',
        'pointerTapTimeout',
        'pointerPressHoldTimeout',
        'showWelcomeScreenAtStart',
        'snapSensitivity',
        'touchRotation'
    ]
});

export default store;

export { PreferencesStore, PreferencesState };

import { KeyboardMapConfigCategory } from '@/types';
import { PerformantStore } from './performant-store';

interface PreferencesState {
    dockHideBreakpoint: number;
    dockPosition: 'left' | 'right';
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
    renderer: '2d' | 'webgl'; // The preferred renderer. May not be the active renderer if unavailable.
    showTutorialNotifications: boolean;
    showWelcomeScreenAtStart: boolean;
    snapSensitivity: number;
    tooltipShowDelay: number;
    touchRotation: 'on' | 'snap' | 'off';
    useCanvasViewport: boolean;
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    state: {
        dockHideBreakpoint: 1000,
        dockPosition: 'right',
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
        renderer: '2d',
        showTutorialNotifications: true,
        showWelcomeScreenAtStart: true,
        snapSensitivity: 5,
        tooltipShowDelay: 300,
        touchRotation: 'off',
        useCanvasViewport: false
    },
    restore: [
        'dockPosition',
        'dragStartRadius',
        'historyStatesMax',
        'menuBarPosition',
        'multiTouchDownTimeout',
        'multiTouchTapTimeout',
        'pointerTapTimeout',
        'pointerPressHoldTimeout',
        'renderer',
        'showTutorialNotifications',
        'showWelcomeScreenAtStart',
        'snapSensitivity',
        'tooltipShowDelay',
        'touchRotation'
    ]
});

export default store;

export { PreferencesStore, PreferencesState };

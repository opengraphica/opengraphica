import { KeyboardMapConfigCategory } from '@/types';
import { PerformantStore } from './performant-store';
import appEmitter from '@/lib/emitter';

interface PreferencesState {
    dockHideBreakpoint: number;
    dockPosition: 'left' | 'right';
    dragStartRadius: number; // Pixels
    enableMultiLayerBuffer: boolean;
    historyStatesMax: number;
    keyboardMapConfig: KeyboardMapConfigCategory[];
    imageSmoothingZoomRatio: number;
    languageOverride: string;
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
    textLayerSaveDelay: number;
    tooltipShowDelay: number;
    touchRotation: 'on' | 'snap' | 'off';
    useCanvasViewport: boolean;
    useMobileDebugger: boolean;
    vendorCustomSaveCallback: (() => void) | null;
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    name: 'preferencesStore',
    state: {
        dockHideBreakpoint: 1000,
        dockPosition: 'right',
        dragStartRadius: 5,
        enableMultiLayerBuffer: false,
        historyStatesMax: 50,
        imageSmoothingZoomRatio: 1.25,
        keyboardMapConfig: [],
        languageOverride: '',
        menuBarPosition: 'left',
        multiTouchDownTimeout: 75,
        multiTouchTapTimeout: 175,
        pointerTapTimeout: 150,
        pointerPressHoldTimeout: 500,
        postProcessInterpolateImage: true,
        preferCanvasViewport: true,
        renderer: 'webgl',
        showTutorialNotifications: true,
        showWelcomeScreenAtStart: true,
        snapSensitivity: 5,
        textLayerSaveDelay: 5000,
        tooltipShowDelay: 300,
        touchRotation: 'off',
        useCanvasViewport: true,
        useMobileDebugger: false,
        vendorCustomSaveCallback: null,
    },
    restore: [
        'dockPosition',
        'dragStartRadius',
        'historyStatesMax',
        'languageOverride',
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
        'touchRotation',
        'useMobileDebugger',
    ],
});

appEmitter.on('store.setPreference', (event) => {
    if (!event) return;
    if (Object.keys(store.state).includes(event.key)) {
        store.set(event.key as keyof PreferencesState, event.value);
    }
})

export default store;

export { PreferencesStore, PreferencesState };

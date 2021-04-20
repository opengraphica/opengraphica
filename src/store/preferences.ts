import { PerformantStore } from './performant-store';

interface PreferencesState {
    enableMultiLayerBuffer: boolean;
    historyStatesMax: number;
    multiTouchDownTimeout: number;
    multiTouchTapTimeout: number;
    pointerPressHoldTimeout: number;
    postProcessInterpolateImage: boolean;
    preferCanvasViewport: boolean;
    snapSensitivity: number;
    touchRotation: 'on' | 'snap' | 'off';
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    state: {
        enableMultiLayerBuffer: false,
        historyStatesMax: 50,
        multiTouchDownTimeout: 50,
        multiTouchTapTimeout: 50,
        pointerPressHoldTimeout: 500,
        postProcessInterpolateImage: true,
        preferCanvasViewport: false,
        snapSensitivity: 5,
        touchRotation: 'on'
    }
});

export default store;

export { PreferencesStore, PreferencesState };

import { PerformantStore } from './performant-store';

interface PreferencesState {
    enableMultiLayerBuffer: boolean;
    historyStatesMax: number;
    multiTouchDownTimeout: number;
    multiTouchTapTimeout: number;
    pointerPressHoldTimeout: number;
    postProcessInterpolateImage: boolean;
    preferCanvasViewport: boolean;
    touchRotation: 'on' | 'snap' | 'off';
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    state: {
        enableMultiLayerBuffer: true,
        historyStatesMax: 50,
        multiTouchDownTimeout: 50,
        multiTouchTapTimeout: 50,
        pointerPressHoldTimeout: 500,
        postProcessInterpolateImage: true,
        preferCanvasViewport: false,
        touchRotation: 'on'
    }
});

export default store;

export { PreferencesStore, PreferencesState };

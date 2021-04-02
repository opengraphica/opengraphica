import { PerformantStore } from './performant-store';

interface PreferencesState {
    enableBuffer: boolean;
    multiTouchDownTimeout: number;
    multiTouchTapTimeout: number;
    pointerPressHoldTimeout: number;
}

interface PreferencesStore {
    dispatch: {};
    state: PreferencesState;
}

const store = new PerformantStore<PreferencesStore>({
    state: {
        enableBuffer: false,
        multiTouchDownTimeout: 50,
        multiTouchTapTimeout: 50,
        pointerPressHoldTimeout: 500
    }
});

export default store;

export { PreferencesStore, PreferencesState };

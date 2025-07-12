import { KeyboardMapConfigCategory } from '@/types';
import { PerformantStore } from './performant-store';
import appEmitter from '@/lib/emitter';

interface PreferencesState {
    // Viewport-applied screen width, where docks will be hidden if the window is smaller.
    dockHideBreakpoint: number;

    // Position the UI docks display on the screen.
    dockPosition: 'left' | 'right';

    // Pixel radius that is the distance a pointer needs to move to start a drag event.
    dragStartRadius: number;

    // Was used for canvas renderer to fix seams between images next to each other; currently unused.
    enableMultiLayerBuffer: boolean;

    // Maximum number of history events before discarding.
    historyStatesMax: number;

    // Keyboard bindings.
    keyboardMapConfig: KeyboardMapConfigCategory[];

    // Zoom percentage at which to switch from smooth to per-pixel interpolation (deprecated).
    imageSmoothingZoomRatio: number;

    // Language code used for i18n.
    languageOverride: string;

    // Position of the tool selection menu on the screen.
    menuBarPosition: 'top' | 'bottom' | 'left' | 'right';

    // Delay between multiple fingers touching down to determine if it counts as a single press.
    multiTouchDownTimeout: number;

    // Delay between multiple fingers touching down to determine if it counts as a single tap.
    multiTouchTapTimeout: number;

    // Delay between pointer down events that will count as a double tap/click.
    pointerDoubleTapTimeout: number;

    // Percentage of the max pressure margin to discard. Makes max pressure easier to reach.
    // Some styluses break screens before reaching max pressure.
    pointerPenMaxPressureMargin: number;

    // Delay when pointer down and hold before the secondary action (such as a context menu) fires.
    pointerPressHoldTimeout: number;

    // Delay between pointer down/up to determine if it counts as a tap.
    pointerTapTimeout: number;

    // For canvas renderer, anti-aliases the viewport.
    postProcessInterpolateImage: boolean;

    // Handle the viewport in the canvas renderer instead of using CSS to transform it.
    preferCanvasViewport: boolean;

    // Unused at the moment.
    renderer: 'canvas2d' | 'webgl2' | 'webgl2-offscreen';

    // Shows tutorial notification popups.
    showTutorialNotifications: boolean;

    // Shows the simplified welcome screen when loading the app in mobile view.
    showWelcomeScreenAtStart: boolean;

    // Pixel radius used for snapping.
    snapSensitivity: number;

    // How long after the user stops typing in a text layer to create a history event.
    textLayerSaveDelay: number;

    // Millisecond delay for displaying tooltips.
    tooltipShowDelay: number;

    // Whether to allow two-finger rotation of the view on a touch screen.
    touchRotation: 'on' | 'snap' | 'off';

    // Handle the viewport in the canvas renderer instead of using CSS to transform it.
    useCanvasViewport: boolean;

    // Enables eruda.
    useMobileDebugger: boolean;

    // Used to implement a custom save button without modifying this codebase.
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
        pointerDoubleTapTimeout: 300,
        pointerPenMaxPressureMargin: 0.2,
        pointerPressHoldTimeout: 500,
        pointerTapTimeout: 150,
        postProcessInterpolateImage: true,
        preferCanvasViewport: true,
        renderer: 'webgl2',
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
        'pointerPenMaxPressureMargin',
        'pointerPressHoldTimeout',
        'pointerTapTimeout',
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

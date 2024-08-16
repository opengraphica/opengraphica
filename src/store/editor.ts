import { PerformantStore } from './performant-store';
import BaseCanvasController from '@/canvas/controllers/base';
import BaseCanvasMovementController from '@/canvas/controllers/base-movement';
import toolGroupsConfig from '@/config/tool-groups.json';
import { ToolGroupDefinition, WorkingFileLayer, WorkingFileGroupLayer, WorkingFileRasterSequenceLayer, ColorModel } from '@/types';
import { loadStylesheet } from '@/lib/stylesheet';
import canvasStore from './canvas';
import workingFileStore from './working-file';

interface EditorDeferredTask {
    name: string,
    priority?: 'clearQueue' | 'filter' | 'last',
    isCanceled?: boolean;
    handler: (bridge: { isCanceled: () => boolean }) => void;
}

interface TutorialFlags {
    drawToolIntroduction?: boolean;
    eraseToolIntroduction?: boolean;
    explainCanvasViewportControls?: boolean;
    freeTransformToolIntroduction?: boolean;
    selectionToolIntroduction?: boolean;
    zoomToolIntroduction?: boolean;

}

const toolGroups: { [key: string]: ToolGroupDefinition } = toolGroupsConfig as any;

interface EditorState {
    activeMenuDrawerComponentName: string | null;
    activePopoverIds: number[],
    activeTheme: { name: string, linkElement: HTMLLinkElement } | null;
    activeTool: string | null;
    activeToolGroup: string | null;
    activeToolGroupPrevious: string | null;
    activeToolGroupRestore: string | null;
    activeToolPrevious: string | null;
    activeToolbar: string | null;
    activeToolbarPosition: 'top' | 'bottom';
    activeToolOverlays: string[];
    clipboardBufferImageHash: string | null;
    clipboardBufferLayers: WorkingFileLayer<ColorModel>[];
    clipboardBufferSelectionMask: HTMLImageElement | null;
    clipboardBufferSelectionMaskCanvasOffset: DOMPoint;
    clipboardBufferUpdateTimestamp: number;
    hasClipboardUpdateSupport: boolean;
    isActiveToolbarExclusive: boolean;
    isPenUser: boolean;
    isTaskRunning: boolean;
    isTouchUser: boolean;
    lastActiveThemeName: string | null;
    loadingThemeName: string | null;
    showBackupRestore: boolean;
    tasks: EditorDeferredTask[];
    themes: {
        [themeName: string]: string;
    };
    timelineCursor: number; // Milliseconds
    timelineEnd: number; // Milliseconds
    timelinePlayStartTime: number; // Milliseconds
    timelineStart: number; // Milliseconds
    toolCanvasController: BaseCanvasController;
    tutorialFlags: TutorialFlags;
    waiting: boolean;
}

interface EditorDispatch {
    addTutorialFlag: keyof EditorState['tutorialFlags'],
    scheduleTask: EditorDeferredTask,
    setActiveTheme: string;
    setActiveTool: {
        tool?: string | null;
        group: string;
    };
    setThemes: {
        [themeName: string]: string;
    };
    setTimelineCursor: number;
}

interface EditorStore {
    dispatch: EditorDispatch;
    state: EditorState;
}

let currentTaskRunId: number = 0;

const store = new PerformantStore<EditorStore>({
    name: 'editorStore',
    state: {
        activeMenuDrawerComponentName: null,
        activePopoverIds: [],
        activeTheme: null,
        activeTool: null,
        activeToolGroup: null,
        activeToolGroupPrevious: null,
        activeToolGroupRestore: null,
        activeToolPrevious: null,
        activeToolbar: null,
        activeToolbarPosition: 'top',
        activeToolOverlays: [],
        clipboardBufferImageHash: null,
        clipboardBufferLayers: [],
        clipboardBufferSelectionMask: null,
        clipboardBufferSelectionMaskCanvasOffset: new DOMPoint,
        clipboardBufferUpdateTimestamp: 0,
        hasClipboardUpdateSupport: false,
        isActiveToolbarExclusive: false,
        isPenUser: false,
        isTaskRunning: false,
        isTouchUser: true,
        lastActiveThemeName: null,
        loadingThemeName: null,
        showBackupRestore: true,
        tasks: [],
        themes: {},
        timelineCursor: 0,
        timelineEnd: 0,
        timelinePlayStartTime: 0,
        timelineStart: 0,
        toolCanvasController: new BaseCanvasMovementController(),
        tutorialFlags: {},
        waiting: false,
    },
    readOnly: ['activeTheme', 'activeTool', 'activeToolGroup', 'themes', 'timelineCursor'],
    restore: ['activeToolGroupRestore', 'isTouchUser', 'lastActiveThemeName', 'tutorialFlags'],
    async onDispatch(actionName: string, value: any, set) {
        switch (actionName) {
            case 'addTutorialFlag':
                const tutorialFlags = store.state.tutorialFlags;
                if (!(tutorialFlags as any)[value]) {
                    (tutorialFlags as any)[value] = true;
                    set('tutorialFlags', tutorialFlags);
                }
                break;

            case 'scheduleTask':
                const newTask: EditorDeferredTask = value;
                let tasks = store.get('tasks');
                if (newTask.priority === 'clearQueue') {
                    for (let task of tasks) {
                        task.isCanceled = true;
                    }
                    set('isTaskRunning', false);
                    tasks = [];
                }
                tasks.push(newTask);
                if (tasks[0] === newTask) {
                    runTasks(++currentTaskRunId, set);
                }
                set('tasks', tasks);
                break;

            case 'setActiveTheme':
                const activeThemeName: string = value;
                const themes = store.state.themes;
                if (themes[activeThemeName]) {
                    let oldLinkElement;
                    if (store.state.activeTheme) {
                        oldLinkElement = store.state.activeTheme.linkElement;
                    }
                    set('loadingThemeName', activeThemeName);
                    const linkElement = await loadStylesheet(themes[activeThemeName]);
                    await set('activeTheme', { name: activeThemeName, linkElement });
                    set('loadingThemeName', null);
                    if (oldLinkElement && oldLinkElement.parentNode) {
                        oldLinkElement.parentNode.removeChild(oldLinkElement);
                    }
                    set('lastActiveThemeName', activeThemeName);
                }
                break;

            case 'setActiveTool':
                let { tool, group } = value as EditorDispatch['setActiveTool'];
                let activeTool = tool || null;
                const activeGroup = store.get('activeToolGroup');
                if (!tool) {
                    activeTool = Object.keys(toolGroups[group]?.tools || [])[0];
                }
                if (group !== activeGroup || activeTool !== store.get('activeTool')) {
                    const toolDefinition = toolGroups[group]?.tools[activeTool || ''];
                    let isActiveToolbarExclusive = false;
                    let activeToolbar: string | null = null;
                    let activeToolbarPosition = 'top';
                    let activeToolOverlays: string[] = [];
                    let controller;

                    let controllerName = 'base-movement';
                    if (toolDefinition?.controller) {
                        controllerName = toolDefinition.controller;
                    }
                    const CanvasControllerGenericClass: typeof BaseCanvasController =
                        (await import(/* webpackChunkName: 'canvas-controller-[request]' */ `../canvas/controllers/${controllerName}.ts`)).default;
                    controller = new CanvasControllerGenericClass();
                    if (this.state.toolCanvasController) {
                        try {
                            this.state.toolCanvasController.onLeave();
                        } catch (error: any) {
                            console.error('[src/store/editor.ts] Error while leaving tool. ', error);
                        }
                    }
                    set('toolCanvasController', controller);
                    if (toolDefinition?.toolbar) {
                        isActiveToolbarExclusive = !!toolDefinition.toolbar.exclusive;
                        activeToolbarPosition = toolDefinition.toolbar.position || 'top';
                        activeToolbar = toolDefinition.toolbar.target;
                    }
                    if (toolDefinition?.overlays) {
                        activeToolOverlays = toolDefinition.overlays;
                    }
                    set('activeToolGroupPrevious', store.get('activeToolGroup'));
                    set('activeToolGroup', group);
                    set('activeToolGroupRestore', group);
                    set('activeToolbar', activeToolbar);
                    set('isActiveToolbarExclusive', isActiveToolbarExclusive);
                    set('activeToolbarPosition', activeToolbarPosition as any);
                    set('activeToolPrevious', store.get('activeTool'));
                    set('activeToolOverlays', activeToolOverlays);
                    set('activeTool', activeTool);
                    try {
                        store.get('toolCanvasController').onEnter();
                    } catch (error: any) {}
                }
                break;

            case 'setThemes':
                set('themes', value);
                const themeNames = Object.keys(value);
                if (themeNames.length > 0) {
                    let lastActiveThemeName = store.get('lastActiveThemeName');
                    if (!lastActiveThemeName) {
                        lastActiveThemeName = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    }
                    if (!themeNames.includes(lastActiveThemeName ?? '')) lastActiveThemeName = null;
                    await store.dispatch('setActiveTheme', lastActiveThemeName ?? themeNames[0]);
                }
                break;

            case 'setTimelineCursor':
                set('timelineCursor', value);
                updateLayersWithTimeline();
                canvasStore.set('dirty', true);
                break;
        }
    },
});

async function runTasks(runId: number, set: PerformantStore<EditorStore>['directSet']) {
    if (!store.get('isTaskRunning')) {
        set('isTaskRunning', true);
        let tasks = store.get('tasks');
        while (tasks.length > 0) {
            let runningTask = tasks[0];
            await runningTask.handler({
                isCanceled() {
                    return tasks[0].isCanceled || false;
                }
            });
            if (runId !== currentTaskRunId) {
                return;
            }
            tasks = store.get('tasks');
            if (runningTask === tasks[0]) {
                tasks.shift();
            }
            set('tasks', tasks);
        }
        set('isTaskRunning', false);
    }
}

function updateLayersWithTimeline(parentLayers?: WorkingFileLayer<ColorModel>[]) {
    parentLayers = parentLayers || workingFileStore.get('layers');
    for (let layer of parentLayers) {
        if (layer.type === 'rasterSequence') {
            updateRasterSequenceLayerWithTimeline(layer as WorkingFileRasterSequenceLayer<ColorModel>);
        } else if (layer.type === 'group') {
            updateLayersWithTimeline((layer as WorkingFileGroupLayer<ColorModel>).layers);
        }
    }
}

function updateRasterSequenceLayerWithTimeline(layer: WorkingFileRasterSequenceLayer<ColorModel>) {
    const timelineCursor = store.get('timelineCursor');
    for (let frame of layer.data.sequence) {
        if (frame.start <= timelineCursor && frame.end > timelineCursor) {
            layer.data.currentFrame = frame.image;
            break;
        }
    }
}

export default store;

export { EditorStore, EditorState, TutorialFlags, updateRasterSequenceLayerWithTimeline };

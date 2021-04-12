import { PerformantStore } from './performant-store';
import BaseCanvasController from '@/canvas/controllers/base';
import toolGroupsConfig from '@/config/tool-groups.json';
import { ToolGroupDefinition } from '@/types';
import { loadStylesheet } from '@/lib/stylesheet';

interface EditorDeferredTask {
    name: string,
    priority?: 'clearQueue' | 'filter' | 'last',
    isCanceled?: boolean;
    handler: (bridge: { isCanceled: () => boolean }) => void;
}

const toolGroups: { [key: string]: ToolGroupDefinition } = toolGroupsConfig;

interface EditorState {
    activeTheme: { name: string, linkElement: HTMLLinkElement } | null;
    activeTool: string | null;
    activeToolGroup: string | null;
    isTaskRunning: boolean;
    loadingThemeName: string | null;
    tasks: EditorDeferredTask[],
    themes: {
        [themeName: string]: string;
    };
    toolCanvasController: BaseCanvasController;
}

interface EditorDispatch {
    scheduleTask: EditorDeferredTask,
    setActiveTheme: string;
    setActiveTool: {
        tool?: string;
        group: string;
    };
    setThemes: {
        [themeName: string]: string;
    };
}

interface EditorStore {
    dispatch: EditorDispatch;
    state: EditorState;
}

let currentTaskRunId: number = 0;

const store = new PerformantStore<EditorStore>({
    state: {
        activeTheme: null,
        activeTool: null,
        activeToolGroup: null,
        isTaskRunning: false,
        loadingThemeName: null,
        tasks: [],
        themes: {},
        toolCanvasController: new BaseCanvasController()
    },
    readOnly: ['activeTheme', 'activeTool', 'activeToolGroup', 'themes'],
    async onDispatch(actionName: string, value: any, set) {
        switch (actionName) {
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
                }
                break;

            case 'setActiveTool':
                let { tool, group } = value as EditorDispatch['setActiveTool'];
                let activeTool = tool || null;
                const activeGroup = store.get('activeToolGroup');
                if (group !== activeGroup) {
                    set('activeToolGroup', group);
                    activeTool = Object.keys(toolGroups[group].tools)[0];
                }
                if (activeTool !== store.get('activeTool') || group !== activeGroup) {
                    if (toolGroups[group].tools[activeTool || '']) {
                        const controllerName = toolGroups[group].tools[activeTool || ''].controller;
                        const CanvasControllerGenericClass: typeof BaseCanvasController =
                            (await import(/* webpackChunkName: 'canvas-controller-[request]' */ `../canvas/controllers/${controllerName}.ts`)).default;
                        set('toolCanvasController', new CanvasControllerGenericClass());
                    }
                    set('activeTool', activeTool);
                }
                break;

            case 'setThemes':
                set('themes', value);
                const themeNames = Object.keys(value);
                if (themeNames.length > 0) {
                    await store.dispatch('setActiveTheme', themeNames[0]);
                }
                break;
        }
    }
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

export default store;

export { EditorStore, EditorState };

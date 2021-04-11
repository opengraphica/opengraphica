import { PerformantStore } from './performant-store';
import BaseCanvasController from '@/canvas/controllers/base';
import toolGroupsConfig from '@/config/tool-groups.json';
import { ToolGroupDefinition } from '@/types';
import { loadStylesheet } from '@/lib/stylesheet';

const toolGroups: { [key: string]: ToolGroupDefinition } = toolGroupsConfig;

interface EditorState {
    activeTheme: { name: string, linkElement: HTMLLinkElement } | null;
    activeTool: string | null;
    activeToolGroup: string | null;
    loadingThemeName: string | null;
    themes: {
        [themeName: string]: string;
    };
    toolCanvasController: BaseCanvasController;
}

interface EditorDispatch {
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

const store = new PerformantStore<EditorStore>({
    state: {
        activeTheme: null,
        activeTool: null,
        activeToolGroup: null,
        loadingThemeName: null,
        themes: {},
        toolCanvasController: new BaseCanvasController()
    },
    readOnly: ['activeTheme', 'activeTool', 'activeToolGroup', 'themes'],
    async onDispatch(actionName: string, value: any, set) {
        switch (actionName) {
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

export default store;

export { EditorStore, EditorState };

import editorStore, { type PluginMenuBarToolGroup } from '@/store/editor';
import preferencesStore from '@/store/preferences';

import appEmitter from '@/lib/emitter';

import type { defineComponent, defineAsyncComponent } from 'vue';
import type BaseCanvasController from '@/tools/controllers/base';
import type { ClassType } from '@/types';

declare var __webpack_require__: any;

let moduleChunkMap: Record<string, { id: string, chunks: number[] }> | null = null;

interface CreateToolDefinition {
    name: string;
    group: string;
    controller: () => Promise<ClassType<BaseCanvasController>>;
    overlay: () => Promise<ReturnType<typeof defineComponent | typeof defineAsyncComponent>>;
    toolbar: () => Promise<ReturnType<typeof defineComponent | typeof defineAsyncComponent>>;
}

async function createTool(options: CreateToolDefinition) {
    try {
        const { name, group, controller, overlay, toolbar } = options;

        const pluginTools = editorStore.get('pluginTools');

        for (const { name: otherToolName, group: otherToolGroup } of pluginTools) {
            if (name === otherToolName && group === otherToolGroup) {
                throw new Error(`A tool with the name "${name}" and group "${group}" already exists.`);
            }
        }
        const toolGroups = await import('@/config/tool-groups.json');
        for (const otherToolGroup in toolGroups) {
            const tools = toolGroups[otherToolGroup].tools;
            for (const otherToolName in tools) {
                if (name === otherToolName && group === otherToolGroup) {
                    throw new Error(`A tool with the name "${name}" and group "${group}" already exists.`);
                }
            }
        }

        pluginTools.push({
            name,
            group,
            getController: controller,
            getOverlay: overlay,
            getToolbar: toolbar,
        })
        editorStore.set('pluginTools', pluginTools);
    } catch (error) {
        console.warn('[src/composables/editor-plugin-api.ts] Error when creating tool.', error);
    }
}

async function createMenuBarToolGroup(options: PluginMenuBarToolGroup) {
    try {
        const pluginMenuBarToolGroups = editorStore.state.pluginMenuBarToolGroups;
        pluginMenuBarToolGroups.push(options);
        editorStore.set('pluginMenuBarToolGroups', pluginMenuBarToolGroups);
    } catch (error) {
        console.warn('[src/composables/editor-plugin-api.ts] Error when creating menu bar tool group.', error);
    }
}

export function createEditorPluginApi(pluginId: string) {

    let resolvePluginInstall: () => void;
    let rejectPluginInstall: () => void;
    const pluginInstallPromise = new Promise<void>((resolve, reject) => {
        resolvePluginInstall = resolve;
        rejectPluginInstall = reject;
    });

    const notifyPluginInstallSuccess = () => {
        resolvePluginInstall();
    }

    const notifyPluginInstallError = (error) => {
        rejectPluginInstall();
        console.error('Error installing OpenGraphica plugin.', error);
        appEmitter.emit('app.runModule', {
            action: {
                type: 'ui',
                target: 'plugin-install-error',
            },
            props: {
                pluginId,
            },
        });
    };

    const pluginScopedImport = async (path: string) => {
        if (path.startsWith('#/')) {
            if (/\.(?:json)$/.test(path)) {
                return import(/*webpackIgnore: true*/ path.replace(/^#\//g, 'plugins/' + pluginId + '/'), {
                    with: {
                        type: 'json',
                    },
                });
            }
            return import(/*webpackIgnore: true*/ path.replace(/^#\//g, 'plugins/' + pluginId + '/'));
        } else if (path.startsWith('@/')) {
            if (moduleChunkMap == null) {
                moduleChunkMap = await (await fetch(
                    preferencesStore.state.assetsBasePath + 'module-chunk-map.json'
                )).json();
            }
            let normalizedPath = path.replace(/@\//g, 'src/');
            if (!/\.(?:js|json|ts)$/.test(normalizedPath)) {
                normalizedPath += '.ts';
            }
            const entry = moduleChunkMap?.[normalizedPath];
            if (!entry) {
                throw new Error(`Module wasn't included in this webpack build: ${entry}`);
            }
            if (!__webpack_require__.m[entry.id]) {
                await Promise.all(entry.chunks.map(chunkId => __webpack_require__.e(chunkId)));
            }
            const result = __webpack_require__(entry.id);
            return result;
        } else {
            switch (path) {
                case 'fflate': return import('fflate');
                case 'lodash': return import('lodash');
                case 'micromark': return import('micromark');
                case 'mitt': return import('mitt');
                case 'three': return import('three');
                case 'uuid': return import('uuid');
                case 'vue': return import('vue');
                case 'vue-i18n': return import('vue-i18n');
            }
        }
    };

    return {
        createMenuBarToolGroup,
        createTool,
        import: pluginScopedImport,
        _installPromise: pluginInstallPromise,
        _notifyPluginInstallSuccess: notifyPluginInstallSuccess,
        _notifyPluginInstallError: notifyPluginInstallError,
    }
}
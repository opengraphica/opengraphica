import preferencesStore from '@/store/preferences';

import appEmitter from '@/lib/emitter';

declare var __webpack_require__: any;

let moduleChunkMap: Record<string, { id: string, chunks: number[] }> | null = null;

export function createEditorPluginApi(pluginId: string) {

    const notifyPluginInstallError = (error) => {
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
            return __webpack_require__(entry.id);
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
        import: pluginScopedImport,
        _notifyPluginInstallError: notifyPluginInstallError,
    }
}
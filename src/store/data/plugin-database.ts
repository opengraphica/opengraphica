import { computed, readonly, ref } from 'vue';
import { compareSemver } from '@/lib/semver';

let database: IDBDatabase | null = null;
let databaseInitPromise: Promise<void> | null = null;

export async function init() {
    if (!databaseInitPromise) {
        databaseInitPromise = new Promise<void>(async (resolveInit) => {
            try {
                if (window.indexedDB) {
                    // Initialize database
                    await new Promise<void>((resolve, reject) => {
                        let openRequest = window.indexedDB.open('openGraphicaPlugins', 1);
                        openRequest.onupgradeneeded = function(event) {
                            database = openRequest.result as IDBDatabase;
                            const oldVersion = event.oldVersion;
                            if (oldVersion < 1) {
                                database.createObjectStore('meta', { keyPath: 'id' });
                                database.createObjectStore('files', { keyPath: 'id' });
                            }
                        };
                        openRequest.onerror = () => {
                            reject(openRequest.error);
                        }
                        openRequest.onsuccess = () => {
                            resolve();
                            database = openRequest.result as IDBDatabase;
                        }
                    });
                    if (!database) {
                        throw new Error('indexedDB not initialized');
                    }
                }
            } catch (error) {}
            resolveInit();
        });
        await databaseInitPromise;
    } else if (!database) {
        await databaseInitPromise;
    }
};

const pluginMetaById = ref<Record<string, Record<string, any>>>({});

export async function storePlugin(packageJson: Record<string, any>, fileBlobs: Record<string, Blob>): Promise<boolean> {
    await init();
    if (!database) return false;
    if (!packageJson.pluginId) return false;

    packageJson.version = packageJson.version ?? '1.0.0';

    for (const otherPluginId in pluginMetaById.value) {
        const otherPlugin = pluginMetaById.value[otherPluginId];
        if (otherPlugin.name === packageJson.name) {
            if (compareSemver(packageJson.version, otherPlugin.version) === 0) {
                console.warn('[src/store/data/plugin-database.ts] Plugin already exists, with equal version.');
                return false;
            } else {
                const stalePluginId = packageJson.pluginId;
                packageJson.pluginId = otherPlugin.pluginId;
                for (const key in fileBlobs) {
                    fileBlobs[key.replace(stalePluginId, otherPlugin.pluginId)] = fileBlobs[key];
                    delete fileBlobs[key];
                }
                break;
            }
        }
    }

    pluginMetaById.value[packageJson.pluginId] = packageJson;

    const transaction = (database as IDBDatabase).transaction(['meta', 'files'], 'readwrite');
    const metaStore = transaction.objectStore('meta');
    const filesStore = transaction.objectStore('files');

    let request = metaStore.put({ id: packageJson.pluginId, data: packageJson });
    await new Promise((resolve, reject) => {
        request.onsuccess = resolve;
        request.onerror = reject;
    });
    for (const filePath in fileBlobs) {
        request = filesStore.put({ id: filePath, data: fileBlobs[filePath] });
        await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }
    return true;
}

export async function readAllPlugins() {
    await init();
    if (!database) return;

    const transaction = (database as IDBDatabase).transaction(['meta', 'files'], 'readonly');
    const metaStore = transaction.objectStore('meta');
    const filesStore = transaction.objectStore('files');

    const metaRequest = metaStore.getAll();
    const metaResults = await new Promise<Record<string, any>[]>((resolve, reject) => {
        metaRequest.onsuccess = () => {
            resolve(metaRequest.result);
        };
        metaRequest.onerror = reject;
    });
    for (const meta of metaResults) {
        pluginMetaById.value[meta.id] = meta.data;
    }

    const filesRequest = filesStore.getAll();
    const filesResults = await new Promise<Record<string, any>[]>((resolve, reject) => {
        filesRequest.onsuccess = () => {
            resolve(filesRequest.result);
        };
        filesRequest.onerror = reject;
    });

    const importMapImports: Record<string, string> = {};
    for (const file of filesResults) {
        importMapImports[file.id] = URL.createObjectURL(file.data);
    }

    const importMapScript = document.createElement('script');
    importMapScript.setAttribute('type', 'importmap');
    importMapScript.textContent = JSON.stringify({ imports: importMapImports });
    document.head.appendChild(importMapScript);

    await installAllPlugins();
}

async function installAllPlugins() {
    const { createEditorPluginApi } = await import('@/composables/editor-plugin-api');
    const pluginInstallPromises: Promise<void>[] = [];
    for (const pluginId in pluginMetaById.value) {
        const { main } = pluginMetaById.value[pluginId];
        if (!main) continue;
        const editorPluginApiKey = 'editorPluginApi' + pluginId.replace(/\-/g, '');
        const pluginApi = createEditorPluginApi(pluginId);
        pluginInstallPromises.push(pluginApi._installPromise);
        (window as any)[editorPluginApiKey] = pluginApi;
        const script = document.createElement('script');
        script.setAttribute('type', 'module');
        script.textContent = `
            try {
                const { install } = await import('plugins/${pluginId}/${main}');
                install(window['${editorPluginApiKey}']);
                window['${editorPluginApiKey}']._notifyPluginInstallSuccess();
            } catch (error) {
                window['${editorPluginApiKey}']._notifyPluginInstallError(error);
            } finally {
                delete window['${editorPluginApiKey}'];
            }
        `;
        document.head.appendChild(script);
    }
    await Promise.allSettled(pluginInstallPromises);
}

export function getPluginMeta(pluginId: string): Record<string, any> {
    return pluginMetaById.value[pluginId] ?? {};
}

export const allPluginMeta = computed(() => readonly(pluginMetaById.value));

export async function deletePlugin(pluginId: string) {
    await init();
    if (!database) return;

    const transaction = (database as IDBDatabase).transaction(['meta', 'files'], 'readwrite');
    const metaStore = transaction.objectStore('meta');
    const filesStore = transaction.objectStore('files');

    const metaRequest = metaStore.delete(pluginId);
    await new Promise((resolve, reject) => {
        metaRequest.onsuccess = resolve;
        metaRequest.onerror = reject;
    });

    const filesRequest = filesStore.openCursor();
    await new Promise<void>((resolve, reject) => {
        filesRequest.onsuccess = () => {
            const cursor = filesRequest.result;
            if (!cursor) {
                resolve();
                return;
            }
            if (typeof cursor.key === 'string' && cursor.key.includes(pluginId)) {
                cursor.delete();
            }
            cursor.continue();
        };
        filesRequest.onerror = reject;
    });

    delete pluginMetaById.value[pluginId];
}
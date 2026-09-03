import { computed, ref, watch, type ComputedRef, type ObjectPlugin } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { webdavClientKey } from './injection-symbols';

import type { WebDAVClient } from 'webdav/web';
import type { PreferencesStore } from '@/store/preferences';

export interface CreateWebdavClientOptions {
    preferencesStore: PreferencesStore;
}

export interface WebdavClient extends ObjectPlugin {
    createDirectory: WebDAVClient['createDirectory'];
    getDirectoryContents: WebDAVClient['getDirectoryContents'];
    getFileContents: WebDAVClient['getFileContents'];
    putFileContents: WebDAVClient['putFileContents'];
    connected: ComputedRef<boolean>;
}

let globalClient: WebdavClient | null = null;

export function createWebdavClient(options: CreateWebdavClientOptions): WebdavClient {

    const { preferencesStore } = options;

    let client: WebDAVClient | null = null;
    let currentConnectUuid: string = '';
    let connected = ref<boolean>(false);

    watch(() => ([
        preferencesStore.state.webdavShareUrl,
        preferencesStore.state.webdavUsername,
        preferencesStore.state.webdavPassword,
    ]), async ([webdavShareUrl, webdavUsername, webdavPassword]) => {
        try {
            new URL(webdavShareUrl);
        } catch {
            return;
        }
        if (
            (webdavUsername || webdavPassword)
            && (
                (webdavUsername && !webdavPassword)
                || (!webdavUsername && webdavPassword)
            )
        ) {
            return;
        }
        currentConnectUuid = uuidv4();
        let connectUuid = currentConnectUuid;
        const { createClient } = await import('webdav/web');
        if (currentConnectUuid !== connectUuid) return;
        client = createClient(webdavShareUrl, webdavUsername ? {
            username: webdavUsername,
            password: webdavPassword,
        } : undefined);
        client.exists('/').then(() => {
            if (currentConnectUuid !== connectUuid) return;
            connected.value = true;
        }).catch(() => {
            if (currentConnectUuid !== connectUuid) return;
            connected.value = false;
        });
    }, { immediate: true });

    const webdavClient = {
        createDirectory() {
            return client?.createDirectory.apply(client, arguments as never);
        },
        getDirectoryContents() {
            return client?.getDirectoryContents.apply(client, arguments as never);
        },
        getFileContents() {
            return client?.getFileContents.apply(client, arguments as never);
        },
        putFileContents() {
            return client?.putFileContents.apply(client, arguments as never);
        },
        connected: computed(() => connected.value),
        install(app) {
            app.provide(webdavClientKey, webdavClient);
        }
    } as never as WebdavClient;

    globalClient = webdavClient;

    return webdavClient;
}

export function getGlobalWebdavClient() {
    return globalClient;
}
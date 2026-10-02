import { watch } from 'vue';
import appEmitter from '@/lib/emitter';

import type { LiveUpdateBuildInfo } from '@/types';

// Notify the user if they need to refresh the page on the website,
// because the source was rebuilt and file names changed.
export async function checkWebUpdates() {
    try {
        const buildInfoResponse = await fetch('/build-info.json', {
            headers: {
                'Cache-Control': 'no-cache',
            },
        });
        const buildInfo = await buildInfoResponse.json();
        if (buildInfo.gitCommitId !== __BUILD_GIT_COMMIT_ID__) {
            appEmitter.emit('app.updateRequired');
        }
    } catch (error) {}
}

export async function checkAppUpdates() {
    const { default: preferencesStore } = await import('@/store/preferences');
    if (preferencesStore.get('checkForAppUpdates') == false) return;
    const { default: canvasStore } = await import('@/store/canvas');
    const { default: editorStore } = await import('@/store/editor');
    const checkResult = await fetch(preferencesStore.get('appUpdateBuildListUrl'));
    if (!checkResult.ok) return;
    const { compareSemver } = await import('@/lib/semver');
    const { App } = await import('@capacitor/app');
    const { version: binaryVersion } = await App.getInfo();
    const buildList: LiveUpdateBuildInfo[] = await checkResult.json();

    const bundleVersion = editorStore.state.bundleVersion;
    let newestBuild: LiveUpdateBuildInfo | null = null;
    for (const build of buildList) {
        if (!build.version || !build.url) continue;
        if (
            compareSemver(build.version, bundleVersion) > 0
            && (!build.minBinaryVersion || compareSemver(build.minBinaryVersion, binaryVersion) <= 0)
        ) {
            newestBuild = build;
        }
    }

    if (newestBuild != null) {

        if (!canvasStore.get('ready')) {
            await new Promise<void>((resolve) => {
                watch(() => canvasStore.state.ready, () => {
                    resolve();
                }, { once: true });
            });
        }

        editorStore.set('availableLiveUpdateBuild', newestBuild);
    }
}
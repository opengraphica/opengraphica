import appEmitter from '@/lib/emitter';

export async function checkUpdates() {
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

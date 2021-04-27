import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import { CreateFileAction, CreateFileOptions } from '@/actions/create-file';

export async function createNewFile(options: CreateFileOptions) {
    await historyStore.dispatch('free', {
        memorySize: Infinity,
        databaseSize: Infinity
    });
    preferencesStore.set('useCanvasViewport', preferencesStore.get('preferCanvasViewport'));
    await historyStore.dispatch('runAction', {
        action: new CreateFileAction(options)
    });
};

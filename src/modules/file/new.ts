import historyStore from '@/store/history';
import { CreateFileAction, CreateFileOptions } from '@/actions/create-file';

export async function createNewFile(options: CreateFileOptions) {
    await historyStore.dispatch('free', {
        memorySize: Infinity,
        databaseSize: Infinity
    });
    await historyStore.dispatch('runAction', {
        action: new CreateFileAction(options)
    });
};

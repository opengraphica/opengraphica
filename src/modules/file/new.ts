import historyStore from '@/store/history';
import { CreateNewFileAction, CreateNewFileOptions } from '@/actions/create-new-file';

export default async function createNewFile(options: CreateNewFileOptions) {
    await historyStore.dispatch('runAction', {
        action: new CreateNewFileAction(options)
    });
};

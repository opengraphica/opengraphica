import historyStore from '@/store/history';

export async function undo() {
    if (historyStore.state.canUndo) {
        await historyStore.dispatch('undo');
    }
}

export async function redo() {
    if (historyStore.state.canRedo) {
        await historyStore.dispatch('redo');
    }
}

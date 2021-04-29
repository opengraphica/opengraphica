import { PerformantStore } from './performant-store';
import preferencesStore from './preferences';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';

interface HistoryState {
    actionStack: BaseAction[];
    actionStackIndex: number;
    canRedo: boolean;
    canUndo: boolean;
}

interface HistoryDispatch {
    free: {
        databaseSize?: number;
        memorySize?: number;
    };
    redo: void;
    runAction: {
        action: BaseAction;
        mergeWithHistory?: string[] | string;
    };
    undo: void;
}

interface HistoryStore {
    dispatch: HistoryDispatch;
    state: HistoryState;
}

const store = new PerformantStore<HistoryStore>({
    state: {
        actionStack: [],
        actionStackIndex: 0,
        canUndo: false,
        canRedo: false
    },
    readOnly: ['actionStack'],
    async onDispatch(actionName: keyof HistoryDispatch, value: any, set) {
        switch (actionName) {
            case 'free':
                return dispatchFree(value, set);
            case 'redo':
                return dispatchRedo(set);
            case 'runAction':
                return dispatchRunAction(value, set);
            case 'undo':
                return dispatchUndo(set);
        }
    }
});

(window as any).historyStore = store;

async function dispatchFree({ databaseSize, memorySize }: HistoryDispatch['free'], set: PerformantStore<HistoryStore>['directSet']) {
    let actionStack = store.get('actionStack');
    let actionStackIndex = store.get('actionStackIndex');
    let totalMemoryFreed = 0;
    let totalDatabaseFreed = 0;
    let hasError = false;
    let freeComplete = false;
    while (actionStackIndex > 0) {
        let action = actionStack.shift();
        if (action) {
            totalMemoryFreed += action.freeEstimates.memory;
            totalDatabaseFreed += action.freeEstimates.database;
            try {
                await action.free();
            } catch (error) {
                hasError = true;
            }
            if (totalMemoryFreed >= (memorySize || 0) && totalDatabaseFreed >= (databaseSize || 0)) {
                freeComplete = true;
                break;
            }
        }
        actionStackIndex--;
    }
    if (!freeComplete) {
        for (let i = actionStack.length - 1; i >= 0; i--) {
            let action = actionStack[i];
            totalMemoryFreed += action.freeEstimates.memory;
            totalDatabaseFreed += action.freeEstimates.database;
            try {
                await action.free();
            } catch (error) {
                hasError = true;
            }
            if (totalMemoryFreed >= (memorySize || 0) && totalDatabaseFreed >= (databaseSize || 0)) {
                freeComplete = true;
                break;
            }
        }
    }
    set('actionStack', actionStack);
    set('actionStackIndex', actionStackIndex);
    set('canUndo', actionStackIndex > 0);
    set('canRedo', actionStackIndex < actionStack.length);

    return {
        totalMemoryFreed,
        totalDatabaseFreed
    };
}

async function dispatchRunAction({ action, mergeWithHistory }: HistoryDispatch['runAction'], set: PerformantStore<HistoryStore>['directSet']) {
    let actionStack = store.get('actionStack');
    let actionStackIndex = store.get('actionStackIndex');
    let errorDuringFree: boolean = false;
    try {
        await action.do();
    } catch (error) {
        // Action aborted. This is usually expected behavior as actions throw errors if they shouldn't run.
        return { status: 'aborted', reason: error };
    }
    // Remove all redo actions from history
    if (actionStackIndex < actionStack.length) {
        const freedActions = actionStack.slice(actionStackIndex, actionStack.length).reverse();
        actionStack = actionStack.slice(0, actionStackIndex);
        for (let freedAction of freedActions) {
            try {
                await freedAction.free();
            } catch (error) {
                errorDuringFree = true;
            }
        }
    }
    // Add the new action to history
    const lastAction = actionStack[actionStack.length - 1];
    if (mergeWithHistory && lastAction) {
        if (typeof mergeWithHistory === 'string') {
            mergeWithHistory = [mergeWithHistory];
        }
        if (mergeWithHistory.includes(lastAction.id)) {
            actionStack[actionStack.length - 1] = new BundleAction(
                lastAction.id,
                lastAction.description,
                [lastAction, action]
            );
        }
    } else {
        actionStack.push(action);
        if (actionStack.length > preferencesStore.get('historyStatesMax')) {
            let actionToFree = actionStack.shift();
            try {
                if (actionToFree) {
                    await actionToFree.free();
                }
            } catch (error) {
                errorDuringFree = true;
            }
        } else {
            actionStackIndex++;
        }
    }
    set('actionStack', actionStack);
    set('actionStackIndex', actionStackIndex);
    set('canUndo', actionStackIndex > 0);
    set('canRedo', actionStackIndex < actionStack.length);

    // Chrome arbitrary method to determine memory usage, but most people use Chrome so...
    const performance = window.performance as any;
    if (performance.memory) {
        if (performance.memory.usedJSHeapSize > performance.memory.jsHeapSizeLimit * 0.8) {
            await store.dispatch('free', { memorySize: performance.memory.jsHeapSizeLimit * 0.2 });
        }
    }
    return { status: 'completed' };
}

async function dispatchUndo(set: PerformantStore<HistoryStore>['directSet']) {
    if (store.get('canUndo')) {
        const actionStack = store.get('actionStack');
        let actionStackIndex = store.get('actionStackIndex');
        actionStackIndex--;
        await actionStack[actionStackIndex].undo();
        set('actionStackIndex', actionStackIndex);
        set('canUndo', actionStackIndex > 0);
        set('canRedo', actionStackIndex < actionStack.length);
    } else {
        throw new Error('There\'s nothing to undo.');
    }
}

async function dispatchRedo(set: PerformantStore<HistoryStore>['directSet']) {
    if (store.get('canRedo')) {
        const actionStack = store.get('actionStack');
        let actionStackIndex = store.get('actionStackIndex');
        const action = actionStack[actionStackIndex];
        await action.do();
        actionStackIndex++;
        set('actionStackIndex', actionStackIndex);
        set('canUndo', actionStackIndex > 0);
        set('canRedo', actionStackIndex < actionStack.length);
    } else {
        throw new Error('There\'s nothing to redo.');
    }
}

export default store;

export { HistoryStore, HistoryState };

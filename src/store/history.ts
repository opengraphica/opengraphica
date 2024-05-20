import { nextTick } from 'vue';
import { PerformantStore } from './performant-store';
import preferencesStore from './preferences';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import appEmitter from '@/lib/emitter';
import { v4 as uuidv4 } from 'uuid';

interface ReservedAction {
    token: string;
    promise: Promise<void>;
    resolve: () => void;
}

interface HistoryState {
    actionReserveQueue: ReservedAction[];
    actionStack: BaseAction[];
    actionStackIndex: number;
    actionStackUpdateToggle: boolean;
    canRedo: boolean;
    canUndo: boolean;
}

interface HistoryDispatch {
    free: {
        databaseSize?: number;
        memorySize?: number;
    };
    redo: void;
    reserve: {
        token: string;
    };
    unreserve: {
        token: string;
    };
    runAction: {
        action: BaseAction;
        reserveToken?: string;
        mergeWithHistory?: string[] | string;
        replaceHistory?: string[] | string;
        blockInteraction?: boolean;
    };
    undo: void;
}

interface HistoryStore {
    dispatch: HistoryDispatch;
    state: HistoryState;
}

const store = new PerformantStore<HistoryStore>({
    name: 'historyStore',
    state: {
        actionReserveQueue: [],
        actionStack: [],
        actionStackIndex: 0,
        actionStackUpdateToggle: false, // Toggles between true/false every history update for watchers
        canUndo: false,
        canRedo: false
    },
    readOnly: ['actionReserveQueue', 'actionStack', 'actionStackIndex', 'canUndo', 'canRedo'],
    async onDispatch(actionName: keyof HistoryDispatch, value: any, set) {
        switch (actionName) {
            case 'free':
                return dispatchFree(value, set);
            case 'redo':
                return dispatchRedo(set);
            case 'reserve':
                return dispatchReserve(value, set);
            case 'unreserve':
                return dispatchUnreserve(value, set);
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
            } catch (error: any) {
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
            } catch (error: any) {
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
    set('actionStackUpdateToggle', !store.state.actionStackUpdateToggle);
    set('canUndo', actionStackIndex > 0);
    set('canRedo', actionStackIndex < actionStack.length);

    return {
        totalMemoryFreed,
        totalDatabaseFreed
    };
}

async function dispatchReserve({ token }: HistoryDispatch['reserve'], set: PerformantStore<HistoryStore>['directSet']) {
    let actionReserveQueue = store.get('actionReserveQueue');
    let resolve!: () => void;
    let promise = new Promise<void>((promiseResolve) => {
        resolve = promiseResolve;
    });
    actionReserveQueue.push({ token, promise, resolve });
    set('actionReserveQueue', actionReserveQueue);
}

async function dispatchUnreserve({ token }: HistoryDispatch['unreserve'], set: PerformantStore<HistoryStore>['directSet']) {
    let actionReserveQueue = store.get('actionReserveQueue');
    const reserveIndex = actionReserveQueue.findIndex(reserve => reserve.token === token);
    if (reserveIndex > -1) {
        const reserve = actionReserveQueue[reserveIndex];
        actionReserveQueue.splice(reserveIndex, 1);
        set('actionReserveQueue', actionReserveQueue);
        try { reserve.resolve(); } catch (error) {}
    }
}

async function dispatchRunAction({ action, mergeWithHistory, replaceHistory, reserveToken, blockInteraction }: HistoryDispatch['runAction'], set: PerformantStore<HistoryStore>['directSet']) {

    let actionRunStatus: { status: string, reason?: any } = { status: 'completed' };

    if (blockInteraction) {
        appEmitter.emit('editor.history.startBlocking', {
            trigger: 'do',
            actions: [{
                id: action.id,
                description: action.description,
            }],
        });
        // Give a chance for notification message to show before blocking the main thread.
        await nextTick();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        })
    }

    try {
        // Wait for reserved actions to complete
        let actionReserveQueue = store.get('actionReserveQueue');
        while (actionReserveQueue.length > 0) {
            let reserveIgnoreResolve!: () => void;
            let reserveIgnorePromise = new Promise<void>(resolve => { reserveIgnoreResolve = resolve; });
            let reserveIgnoreTimeoutHandle = setTimeout(async () => {
                actionReserveQueue = store.get('actionReserveQueue');
                const reserve = actionReserveQueue.shift();
                set('actionReserveQueue', actionReserveQueue);
                try { reserve?.resolve(); } catch (error) {}
                reserveIgnoreResolve();
            }, 5000);
            await Promise.any([
                (async () => {
                    const reserveQueueItem = actionReserveQueue[0];
                    if (reserveQueueItem.token === reserveToken) {
                        await dispatchUnreserve({ token: reserveToken }, set);
                    } else {
                        await reserveQueueItem.promise;
                    }
                })(),
                reserveIgnorePromise,
            ]);
            clearTimeout(reserveIgnoreTimeoutHandle);
            actionReserveQueue = store.get('actionReserveQueue');
        }

        // Run the action
        let actionStack = store.get('actionStack');
        let actionStackIndex = store.get('actionStackIndex');
        let errorDuringFree: boolean = false;
        await action.do();

        // Remove all redo actions from history
        if (actionStackIndex < actionStack.length) {
            const freedActions = actionStack.slice(actionStackIndex, actionStack.length).reverse();
            actionStack = actionStack.slice(0, actionStackIndex);
            for (let freedAction of freedActions) {
                try {
                    await freedAction.free();
                } catch (error: any) {
                    errorDuringFree = true;
                }
            }
        }

        // Add the new action to history
        const lastAction = actionStack[actionStack.length - 1];
        let shouldPushAction = true;
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
                shouldPushAction = false;
            }
        } else if (replaceHistory && lastAction) {
            if (typeof replaceHistory === 'string') {
                replaceHistory = [replaceHistory];
            }
            if (replaceHistory.includes(lastAction.id)) {
                actionStack[actionStack.length - 1] = action;
                shouldPushAction = false;
                try { await lastAction.free(); } catch (error) { }
            }
        }
        if (shouldPushAction) {
            actionStack.push(action);
            if (actionStack.length > preferencesStore.get('historyStatesMax')) {
                let actionToFree = actionStack.shift();
                try {
                    if (actionToFree) {
                        await actionToFree.free();
                    }
                } catch (error: any) {
                    errorDuringFree = true;
                }
            } else {
                actionStackIndex++;
            }
        }
        set('actionStack', actionStack);
        set('actionStackIndex', actionStackIndex);
        set('actionStackUpdateToggle', !store.state.actionStackUpdateToggle);
        set('canUndo', actionStackIndex > 0);
        set('canRedo', actionStackIndex < actionStack.length);

        appEmitter.emit('editor.history.step', {
            trigger: 'do',
            action: {
                id: action.id,
                description: action.description,
            }
        });

        // Chrome arbitrary method to determine memory usage, but most people use Chrome so...
        const performance = window.performance as any;
        if (performance.memory) {
            if (performance.memory.usedJSHeapSize > performance.memory.jsHeapSizeLimit * 0.8) {
                await store.dispatch('free', { memorySize: performance.memory.jsHeapSizeLimit * 0.2 });
            }
        }

    } catch (error) {
        actionRunStatus = { status: 'aborted', reason: error };
    }

    if (blockInteraction) {
        appEmitter.emit('editor.history.stopBlocking');
        await nextTick();
    }

    return actionRunStatus;
}

async function dispatchUndo(set: PerformantStore<HistoryStore>['directSet']) {
    if (store.get('canUndo')) {
        const actionStack = store.get('actionStack');
        let actionStackIndex = store.get('actionStackIndex');

        appEmitter.emit('editor.history.startBlocking', {
            trigger: 'undo',
            actions: [{
                id: actionStack[actionStackIndex - 1].id,
                description: actionStack[actionStackIndex - 1].description,
            }],
        });
        // Give a chance for notification message to show before blocking the main thread.
        await nextTick();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        })

        try {
            actionStackIndex--;
            await actionStack[actionStackIndex].undo();
            set('actionStackIndex', actionStackIndex);
            set('actionStackUpdateToggle', !store.state.actionStackUpdateToggle);
            set('canUndo', actionStackIndex > 0);
            set('canRedo', actionStackIndex < actionStack.length);
            appEmitter.emit('editor.history.step', {
                trigger: 'undo',
                action: {
                    id: actionStack[actionStackIndex].id,
                    description: actionStack[actionStackIndex].description,
                }
            });
        } catch (error) {
            console.error('[src/store/history.ts] Error during action undo:', error);
        }

        appEmitter.emit('editor.history.stopBlocking');
    } else {
        throw new Error('There\'s nothing to undo.');
    }
}

async function dispatchRedo(set: PerformantStore<HistoryStore>['directSet']) {
    if (store.get('canRedo')) {
        const actionStack = store.get('actionStack');
        let actionStackIndex = store.get('actionStackIndex');

        appEmitter.emit('editor.history.startBlocking', {
            trigger: 'redo',
            actions: [{
                id: actionStack[actionStackIndex].id,
                description: actionStack[actionStackIndex].description,
            }],
        });
        // Give a chance for notification message to show before blocking the main thread.
        await nextTick();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        })

        try {
            const action = actionStack[actionStackIndex];
            await action.do();
            actionStackIndex++;
            set('actionStackIndex', actionStackIndex);
            set('actionStackUpdateToggle', !store.state.actionStackUpdateToggle);
            set('canUndo', actionStackIndex > 0);
            set('canRedo', actionStackIndex < actionStack.length);
            appEmitter.emit('editor.history.step', {
                trigger: 'redo',
                action: {
                    id: action.id,
                    description: action.description,
                }
            });
        } catch (error) {
            console.error('[src/store/history.ts] Error during action redo:', error);
        }

        appEmitter.emit('editor.history.stopBlocking');
    } else {
        throw new Error('There\'s nothing to redo.');
    }
}

function createHistoryReserveToken() {
    return uuidv4();
}

async function historyReserveQueueFree() {
    let actionReserveQueue = store.get('actionReserveQueue');
    while (actionReserveQueue.length > 0) {
        const reserveQueueItem = actionReserveQueue[0];
        await reserveQueueItem.promise;
        actionReserveQueue = store.get('actionReserveQueue');
    }
}

export default store;

export { HistoryStore, HistoryState, createHistoryReserveToken, historyReserveQueueFree };

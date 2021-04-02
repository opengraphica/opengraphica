import { PerformantStore } from './performant-store';
import { BaseAction } from '@/actions/base';

interface HistoryState {
    actionStack: BaseAction[];
    actionStackIndex: number;
}

interface HistoryStore {
    dispatch: {};
    state: HistoryState;
}

const store = new PerformantStore<HistoryStore>({
    state: {
        actionStack: [],
        actionStackIndex: 0
    },
    readOnly: ['actionStack']
});

export default store;

export { HistoryStore, HistoryState };

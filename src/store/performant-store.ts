import { reactive, shallowReadonly, Ref, UnwrapRef } from 'vue';

interface StoreTypeMap {
    dispatch: Object;
    state: Object;
}

type OnSetCallback<T extends Object> = <K extends keyof T>(key: K, value: T[K], set: <K extends keyof T>(key: K, value: T[K]) => void) => T[K] | void;
type OnDispatchCallback<T extends StoreTypeMap> = <K extends keyof T['dispatch']>(actionName: K, value: T[K], set: <K extends keyof T['state']>(key: K, value: T['state'][K]) => void) => void;

interface PerformantStoreOptions<T extends StoreTypeMap> {
    state: T['state']; // Object of state managed by this store
    nonReactive?: string[]; // List of prop names in state that shouldn't be added to the reactive state (usually because reactivity is too expensive or will break them),
    readOnly?: string[]; // List of prop names in state that can't be set after initialization, but can be modified in the 'onSet' callback.
    onSet?: OnSetCallback<T['state']>;
    onDispatch?: OnDispatchCallback<T>;
}

export class PerformantStore<T extends StoreTypeMap> {
    private staticState!: T['state'];
    private reactiveState!: any;
    private nonReactiveProps: string[] = [];
    private readOnlyProps: string[] = [];
    private onSet: OnSetCallback<T['state']> | undefined;
    private onDispatch: OnDispatchCallback<T> | undefined;
    public state!: Readonly<{ [K in keyof T['state']]: T['state'] extends Ref ? T['state'][K] : UnwrapRef<T['state'][K]>; }>;

    constructor(options: PerformantStoreOptions<T>) {
        this.staticState = options.state;
        this.nonReactiveProps = options.nonReactive || [];
        this.readOnlyProps = options.readOnly || [];
        if (options.onSet) {
            this.onSet = options.onSet;
        }
        if (options.onDispatch) {
            this.onDispatch = options.onDispatch;
        }
        const reactiveState: Partial<T['state']> = {};
        for (let prop in this.staticState) {
            if (this.nonReactiveProps.includes(prop)) {
                reactiveState[prop] = undefined;
            } else {
                reactiveState[prop] = this.staticState[prop];
            }
        }
        this.reactiveState = reactive(reactiveState);
        this.state = shallowReadonly<T>(this.reactiveState) as any;
    }

    /**
     * use "set" instead if you don't know what you're doing.
     * @private
     */
    directSet<K extends keyof T['state']>(key: K, value: T['state'][K]) {
        (this.staticState as any)[key] = value;
        if (!this.nonReactiveProps.includes(key as string)) {
            this.reactiveState[key] = value;
        }
    }

    set<K extends keyof T['state']>(key: K, value: T['state'][K]): void;
    set(subset: Partial<T['state']>): void;
    set(keyOrSubset: any, value?: any) {
        if (typeof keyOrSubset === 'string') {
            if (this.readOnlyProps.includes(keyOrSubset)) {
                return;
            }
            if (this.onSet) {
                try {
                    const newValue = this.onSet(keyOrSubset as any, value, this.directSet.bind(this));
                    if (typeof newValue !== 'undefined') {
                        value = newValue;
                    }
                } catch (error: any) {
                    return;
                }
            }
            this.directSet(keyOrSubset as any, value);
        } else {
            for (let key in keyOrSubset) {
                this.set(key as keyof T['state'], keyOrSubset[key] as T['state'][Extract<keyof T['state'], string>]);
            }
        }
    }

    get<K extends keyof T['state']>(key: K): T['state'][K] {
        return this.staticState[key];
    }

    dispatch<K extends keyof T['dispatch']>(key: K, value: T['dispatch'][K]): Promise<any>;
    dispatch<K extends keyof T['dispatch']>(key: K): Promise<any>;
    async dispatch(actionName: any, value?: any) {
        if (this.onDispatch) {
            return await this.onDispatch(actionName, value, this.directSet.bind(this));
        }
    }
}

import { computed, reactive, shallowReadonly, watch, type Ref, type UnwrapRef, type WritableComputedRef } from 'vue';

const localStoragePrefix = 'openGraphicaStore_';

interface StoreTypeMap {
    dispatch: Object;
    state: Object;
}

type OnSetCallback<T extends Object> = <K extends keyof T>(key: K, value: T[K], set: <K extends keyof T>(key: K, value: T[K]) => void) => T[K] | void;
type OnDispatchCallback<T extends StoreTypeMap> = <K extends keyof T['dispatch']>(actionName: K, value: T[K], set: <K extends keyof T['state']>(key: K, value: T['state'][K]) => void) => void;

interface PerformantStoreOptions<T extends StoreTypeMap> {
    name: string; // Used for localStorage
    state: T['state']; // Object of state managed by this store
    nonReactive?: string[]; // List of prop names in state that shouldn't be added to the reactive state (usually because reactivity is too expensive or will break them),
    readOnly?: string[]; // List of prop names in state that can't be set after initialization, but can be modified in the 'onSet' callback.
    restore?: string[]; // List of prop names that will be stored in localStorage.
    onSet?: OnSetCallback<T['state']>;
    onDispatch?: OnDispatchCallback<T>;
}

export class PerformantStore<T extends StoreTypeMap> {
    private name: string = '';
    private staticState!: T['state'];
    private reactiveState!: any;
    private nonReactiveProps: string[] = [];
    private readOnlyProps: string[] = [];
    private restoreProps: string[] = [];
    private onSet: OnSetCallback<T['state']> | undefined;
    private onDispatch: OnDispatchCallback<T> | undefined;
    public state!: Readonly<{ [K in keyof T['state']]: T['state'] extends Ref ? T['state'][K] : UnwrapRef<T['state'][K]>; }>;

    constructor(options: PerformantStoreOptions<T>) {
        this.name = options.name ?? '';
        this.staticState = options.state;
        this.nonReactiveProps = options.nonReactive || [];
        this.readOnlyProps = options.readOnly || [];
        this.restoreProps = options.restore || [];
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
        this.state = shallowReadonly<T>(this.reactiveState) as any; // Call .get function for modification. Shallow so it doesn't impact .get return.

        // Restore rembered props from localStorage
        for (const restorePropName of this.restoreProps) {
            let localStorageValue: string | null = null;
            try {
                localStorageValue = localStorage.getItem(localStoragePrefix + this.name + '_' + restorePropName);
            } catch (error) {}
            if (localStorageValue != null) {
                const type: string = localStorageValue.split(';')[0];
                let value: any = localStorageValue.replace(type + ';', '');
                try {
                    if (type === 'boolean') {
                        value = value === 'true';
                    } else if (type === 'number') {
                        value = parseFloat(value);
                    } else if (['array', 'object'].includes(type)) {
                        value = JSON.parse(value);
                    }
                } catch (error) {}
                (this.staticState as any)[restorePropName] = value;
                if (!this.nonReactiveProps.includes(restorePropName)) {
                    this.reactiveState[restorePropName] = value;
                }
            }
        }
    }

    /**
     * @private
     */
    storeRestoreProp<K extends keyof T['state']>(key: K, value: T['state'][K]) {
        try {
            const valueType = typeof value;
            let serializedValue: string = value + '';
            if (['object', 'array'].includes(valueType)) {
                serializedValue = JSON.stringify(value);
            }
            localStorage.setItem(localStoragePrefix + this.name + '_' + (key as string), valueType + ';' + serializedValue);
        } catch (error) {
            // Does this matter?
        }
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
        if (this.restoreProps.includes(key as string)) {
            this.storeRestoreProp(key, value);
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
        return this.reactiveState[key] || this.staticState[key];
    }

    dispatch<K extends keyof T['dispatch']>(key: K, value: T['dispatch'][K]): Promise<any>;
    dispatch<K extends keyof T['dispatch']>(key: K): Promise<any>;
    async dispatch(actionName: any, value?: any) {
        if (this.onDispatch) {
            return await this.onDispatch(actionName, value, this.directSet.bind(this));
        }
    }

    /**
     * Retrieves a ref that can be used to write to a specific field in the store.
     */
    getWritableRef<K extends keyof T['state']>(key: K): WritableComputedRef<T['state'][K]> {
        return computed({
            set: (value) => {
                this.set(key, value);
            },
            get: () => {
                return this.get(key);
            }
        });
    }

    /**
     * Retrieves a ref that can be used to write to a specific field in the store.
     * Use for deep nested objects that you want to be watched for changes.
     */
    getDeepWritableRef<K extends keyof T['state']>(key: K): WritableComputedRef<T['state'][K]> {
        if (this.restoreProps.includes(key as string)) {
            watch(() => this.state[key], () => {
                this.storeRestoreProp(key, this.state[key] as never);
            }, { deep: true });
        }
        return computed({
            set: (value) => {
                this.set(key, value);
            },
            get: () => {
                return this.get(key);
            }
        });
    }
}

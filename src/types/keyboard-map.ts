export interface KeyboardMapConfigAction {
    action: {
        type: 'dock' | 'toolGroup' | 'runModule' | 'appEmit';
        target: string;
    };
    name: string;
    shortcuts: string[];
}

export interface KeyboardMapConfigCategory {
    name: string;
    actions: KeyboardMapConfigAction[];
}

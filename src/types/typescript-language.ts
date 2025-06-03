export interface ClassType<T> extends Function {
    new (...args: any[]): T;
}

export type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};
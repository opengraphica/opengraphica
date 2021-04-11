
export interface FormatChain<T> {
    value: T;
    asTitleCase(this: FormatChain<string | number>): FormatChain<string>;
}

export class BaseFormatChain<T> implements Partial<FormatChain<T>> {
    public value!: T;

    constructor(value: T) {
        this.value = value;
    }
}

export function format<T>(value: T): FormatChain<T> {
    return new BaseFormatChain<T>(value) as FormatChain<T>;
}


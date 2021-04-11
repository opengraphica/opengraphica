
interface FilterChain {
    (value: any): void;
    value: any;
}

export interface FilterAugment {
    name: string,
    handler: (value: any, ...args: any[]) => any
}

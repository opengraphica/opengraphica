
export interface ThrottleOptions {
    leading?: boolean;
    trailing?: boolean;
}

const CUBIC_BEIZER_EASE = [0.25, 0.1, 0.25, 1];
const CUBIC_BEIZER_LINEAR = [0, 0, 1, 1];
const CUBIC_BEIZER_EASE_IN = [0.42, 0, 1, 1];
const CUBIC_BEIZER_EASE_OUT = [0, 0, 0.58, 1];
const CUBIC_BEIZER_EASE_IN_OUT = [0.42, 0, 0.58, 1];

/**
 * Throttles a callback with the specified wait time and callback options
 * https://stackoverflow.com/questions/27078285/simple-throttle-in-js
 * @license CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/
 */
export function throttle<T = (...args: any) => void>(func: T, wait: number, options?: ThrottleOptions): T {
    let context: any, args: any, result: any;
    let timeout: number | null = null;
    let previous = 0;
    if (!options) options = {};
    const later = function() {
        previous = (options as ThrottleOptions).leading === false ? 0 : Date.now();
        timeout = null;
        result = (func as unknown as Function).apply(context, args);
        if (!timeout) context = args = null;
    };
    return function(this: any) {
        const now = Date.now();
        if (!previous && (options as ThrottleOptions).leading === false) previous = now;
        const remaining = wait - (now - previous);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = (func as unknown as Function).apply(context, args);
            if (!timeout) context = args = null;
        } else if (!timeout && (options as ThrottleOptions).trailing !== false) {
            timeout = window.setTimeout(later, remaining);
        }
        return result;
    } as unknown as T;
};


export class AsyncCallbackQueue {
    private queue: Array<() => Promise<void>> = [];
    private isCallbacksRunning: boolean = false;
    private waitResolvers: Array<() => void> = [];

    public push(callback: () => Promise<void>) {
        this.queue.push(callback);
        if (!this.isCallbacksRunning) {
            this.runCallbacks();
        }
    }

    private async runCallbacks() {
        this.isCallbacksRunning = true;
        try {
            while (this.queue.length > 0) {
                const callback = this.queue.shift();
                if (callback) {
                    try {
                        await callback();
                    } catch (error) {
                        console.error('[src/lib/timing.ts] Error running async callback cue callback. ', error);
                    }
                }
            }
        } finally {
            this.isCallbacksRunning = false;

            const resolvers = this.waitResolvers;
            this.waitResolvers = [];

            for (const resolve of resolvers) {
                resolve();
            }
        }
    }

    public wait(): Promise<void> {
        if (!this.isCallbacksRunning && this.queue.length === 0) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.waitResolvers.push(resolve);
            if (!this.isCallbacksRunning) {
                void this.runCallbacks();
            }
        });
    }

    public isIdle() {
        return !this.isCallbacksRunning && this.queue.length === 0;
    }
}

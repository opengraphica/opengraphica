
export interface ThrottleOptions {
    leading?: boolean,
    trailing?: boolean
}

const CUBIC_BEIZER_EASE = [.25, .1, .25, 1];
const CUBIC_BEIZER_LINEAR = [0, 0, 1, 1];
const CUBIC_BEIZER_EASE_IN = [.42, 0, 1, 1];
const CUBIC_BEIZER_EASE_OUT = [0, 0, .58, 1];
const CUBIC_BEIZER_EASE_IN_OUT = [.42, 0, .58, 1];

/**
 * Throttles a callback with the specified wait time and callback options
 * https://stackoverflow.com/questions/27078285/simple-throttle-in-js
 * @license CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/
 */
export function throttle(func: (...args: any) => void, wait: number, options?: ThrottleOptions) {
    var context: any, args: any, result: any;
    var timeout: number | null = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
        previous = (options as ThrottleOptions).leading === false ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
    };
    return function() {
        var now = Date.now();
        if (!previous && (options as ThrottleOptions).leading === false) previous = now;
        var remaining = wait - (now - previous);
        // @ts-ignore
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
            clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        } else if (!timeout && (options as ThrottleOptions).trailing !== false) {
            timeout = window.setTimeout(later, remaining);
        }
        return result;
    };
};


export class AsyncCallbackQueue {
    private queue: Array<() => Promise<void>> = [];
    private isCallbacksRunning: boolean = false;

    public push(callback: () => Promise<void>) {
        this.queue.push(callback);
        if (!this.isCallbacksRunning) {
            this.runCallbacks();
        }
    }

    private async runCallbacks() {
        this.isCallbacksRunning = true;
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
        this.isCallbacksRunning = false;
    }
}

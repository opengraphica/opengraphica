
export interface ThrottleOptions {
    leading?: boolean,
    trailing?: boolean
}

/**
 * Throttles a callback with the specified wait time and callback options
 * https://stackoverflow.com/questions/27078285/simple-throttle-in-js
 * @license CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/
 */
export function throttle(func: any, wait: number, options?: ThrottleOptions) {
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

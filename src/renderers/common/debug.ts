export function installWebGLCommandLogger(canvas, options = {}) {
    const {
        log = console?.log,
        includeArguments = true,
        includeReturns = false,
    } = options as any;

    let commandNumber = 0;

    // Only extension objects are proxied. WebGL resources must remain native.
    const extensionProxyCache = new WeakMap();

    function summarize(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            return value;
        }

        if (typeof value === "bigint") {
            return `${value}n`;
        }

        if (ArrayBuffer.isView(value)) {
            return `${value.constructor.name}(${(value as any).length})`;
        }

        if (value instanceof ArrayBuffer) {
            return `ArrayBuffer(${value.byteLength})`;
        }

        if (typeof value === "object") {
            return Object.prototype.toString.call(value);
        }

        return String(value);
    }

    function wrapExtension(extension, label) {
        if (
            extension === null ||
            typeof extension !== "object"
        ) {
            return extension;
        }

        if (extensionProxyCache.has(extension)) {
            return extensionProxyCache.get(extension);
        }

        const proxy = new Proxy(extension, {
            get(target, property) {
                const original = Reflect.get(target, property, target);

                if (typeof property === "symbol") {
                    return original;
                }

                if (typeof original !== "function") {
                    return original;
                }

                return function (...args) {
                    const id = ++commandNumber;
                    const command = `${label}.${String(property)}`;

                    log(command.replace('webgl2.', 'gl.') + '(' + args.map(summarize).join(', ') + ');');

                    // log({
                    //     id,
                    //     command,
                    //     args: includeArguments
                    //         ? args.map(summarize)
                    //         : undefined,
                    // });

                    // Use the real extension object as `this`.
                    const result = Reflect.apply(
                        original,
                        target,
                        args
                    );

                    if (includeReturns) {
                        log({
                            id,
                            command,
                            returnValue: summarize(result),
                        });
                    }

                    // Do not proxy returned WebGL resources.
                    return result;
                };
            },
        });

        extensionProxyCache.set(extension, proxy);
        return proxy;
    }

    const originalGetContext = canvas.getContext.bind(canvas);

    canvas.getContext = function (type, attributes) {
        const context = originalGetContext(type, attributes);

        if (
            type !== "webgl" &&
            type !== "experimental-webgl" &&
            type !== "webgl2"
        ) {
            return context;
        }

        const contextProxy = new Proxy(context, {
            get(target, property) {
                const original = Reflect.get(target, property, target);

                if (typeof property === "symbol") {
                    return original;
                }

                if (typeof original !== "function") {
                    return original;
                }

                return function (...args) {
                    const id = ++commandNumber;
                    const command = `${type}.${String(property)}`;

                    log(command.replace('webgl2.', 'gl.') + '(' + args.map(summarize).join(', ') + ');');

                    // log({
                    //     id,
                    //     command,
                    //     args: includeArguments
                    //         ? args.map(summarize)
                    //         : undefined,
                    // });

                    // Native WebGL methods generally require the original
                    // context as `this`, not the Proxy.
                    const result = Reflect.apply(
                        original,
                        target,
                        args
                    );

                    if (includeReturns) {
                        log({
                            id,
                            command,
                            returnValue: summarize(result),
                        });
                    }

                    // getExtension is the one object-returning call we
                    // specially proxy so extension methods are traceable.
                    if (property === "getExtension") {
                        const extensionName = args[0] || "extension";

                        return wrapExtension(
                            result,
                            `${type}.${extensionName}`
                        );
                    }

                    // Keep WebGLTexture, WebGLBuffer, WebGLProgram,
                    // WebGLUniformLocation, etc. completely unproxied.
                    return result;
                };
            },

            set(target, property, value) {
                // Important: use the real WebGL context as the setter receiver.
                return Reflect.set(target, property, value, target);
            },
        });

        return contextProxy;
    };

    return function uninstall() {
        canvas.getContext = originalGetContext;
    };
}

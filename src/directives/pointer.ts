import { ObjectDirective, DirectiveBinding, toRefs } from 'vue';
import preferencesStore from '@/store/preferences';
import { translateTouchEventToPointerEvents, translateMouseEventToPointerEvent } from '@/lib/events';

const { multiTouchDownTimeout, multiTouchTapTimeout } = toRefs(preferencesStore.state);

interface EventHandlerMap {
    [key: string]: { // Emulated event name
        [key: string]: Function; // Real event name
    }
}

interface CallbackBindingMap {
    [key: string]: Function;
}

const eventHandlerMap = new WeakMap<any, EventHandlerMap>();
const callbackBindingMap = new WeakMap<any, CallbackBindingMap>();

function getEventName(binding: DirectiveBinding<any>): string {
    let eventName: string = '';
    if (binding.modifiers.tap) {
        eventName = 'tap';
    } else if (binding.modifiers.dragstart) {
        eventName = 'dragstart';
    }
    return eventName;
}

function storeBinding(el: any, eventName: string, binding: DirectiveBinding<any>) {
    const bindingMap = callbackBindingMap.get(el) || {};
    bindingMap[eventName] = binding.value;
    callbackBindingMap.set(el, bindingMap);
}

function runCallback(el: any, eventName: string, binding: DirectiveBinding<any>, callbackArg?: any) {
    const bindingMap = callbackBindingMap.get(el) || {};
    const callback = bindingMap[eventName];
    if (callback) {
        callback.call(binding.instance, callbackArg);
    } else {
        console.error('[v-pointer] Callback function not provided to directive or was undefined.');
    }
}

const PointerDirective: ObjectDirective = {
    async mounted(el, binding) {
        const eventName = getEventName(binding);
        storeBinding(el, eventName, binding);

        /* Handle Tap */
        if (eventName === 'tap') {
            const callbackHandles = eventHandlerMap.get(el) || {};
            let pointerDownTimeoutHandle: number | undefined;
            let pointerDownType: string = '';
            let isPointerDownValid: boolean = false;
            function onMouseDown(e: MouseEvent) {
                pointerDownType = 'mouse';
                isPointerDownValid = true;
                clearTimeout(pointerDownTimeoutHandle);
                pointerDownTimeoutHandle = setTimeout(() => {
                    isPointerDownValid = false;
                }, multiTouchTapTimeout.value);
            }
            function onMouseUp(e: MouseEvent) {
                if (pointerDownType === 'mouse' && isPointerDownValid) {
                    runCallback(el, eventName, binding, translateMouseEventToPointerEvent('pointerup', e));
                }
            }
            function onPointerDown(e: PointerEvent) {
                if (e.pointerType === 'pen') {
                    pointerDownType = 'pen';
                    isPointerDownValid = true;
                    clearTimeout(pointerDownTimeoutHandle);
                    pointerDownTimeoutHandle = setTimeout(() => {
                        isPointerDownValid = false;
                    }, multiTouchTapTimeout.value);
                }
            }
            function onPointerUp(e: PointerEvent) {
                if (e.pointerType === 'pen' && pointerDownType === 'pen' && isPointerDownValid) {
                    runCallback(el, eventName, binding, e);
                }
            }
            function onTouchStart(e: TouchEvent) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                        pointerDownType = 'touch';
                        isPointerDownValid = true;
                        clearTimeout(pointerDownTimeoutHandle);
                        pointerDownTimeoutHandle = setTimeout(() => {
                            isPointerDownValid = false;
                        }, multiTouchTapTimeout.value);
                    }
                }
            }
            function onTouchEnd(e: TouchEvent) {
                if (pointerDownType === 'touch' && isPointerDownValid) {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        const touch = e.changedTouches[i];
                        if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                            runCallback(el, eventName, binding, translateTouchEventToPointerEvents('pointerup', e)[0]);
                        }
                    }
                }
            }
            callbackHandles.tap = {
                mousedown: onMouseDown,
                mouseup: onMouseUp,
                pointerdown: onPointerDown,
                pointerup: onPointerUp,
                touchstart: onTouchStart,
                touchend: onTouchEnd
            };
            for (let realEventName in callbackHandles.tap) {
                el.addEventListener(realEventName, callbackHandles.tap[realEventName], true);
            }
            eventHandlerMap.set(el, callbackHandles);
        }
    },
    async updated(el, binding) {
        const eventName = getEventName(binding);
        storeBinding(el, eventName, binding);
    },
    async unmounted(el, binding) {
        const eventName = getEventName(binding);
        const callbackHandles = eventHandlerMap.get(el) || {};
        for (let realEventName in callbackHandles.tap) {
            el.removeEventListener(realEventName, callbackHandles[eventName][realEventName]);
        }
        eventHandlerMap.delete(el);
    }
};

export default PointerDirective;
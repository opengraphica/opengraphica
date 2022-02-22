import { ObjectDirective, DirectiveBinding, toRefs } from 'vue';
import preferencesStore from '@/store/preferences';
import { translateTouchEventToPointerEvents, translateMouseEventToPointerEvent } from '@/lib/events';
import { isInput } from '@/lib/events';
import { pointDistance2d } from '@/lib/math';

const { multiTouchDownTimeout, multiTouchTapTimeout, pointerPressHoldTimeout } = toRefs(preferencesStore.state);

interface EventHandlerMap {
    [key: string]: { // Emulated event name
        [key: string]: [Window | Element, Function]; // Real event name
    }
}

interface CallbackBindingMap {
    [key: string]: Function;
}

interface DragData {
    eventsAlreadySetup?: boolean;
    pointerDownType?: string | null;
}

const eventHandlerMap = new WeakMap<any, EventHandlerMap>();
const callbackBindingMap = new WeakMap<any, CallbackBindingMap>();
const dragDataMap = new WeakMap<any, DragData>();

function getEventName(binding: DirectiveBinding<any>): string {
    let eventName: string = '';
    for (let modifier in binding.modifiers) {
        if (!['primary', 'window'].includes(modifier) && binding.modifiers[modifier]) {
            eventName = modifier;
        }
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
        // Ignore if doesn't exist, dragstart/end may call either way.
    }
}

/* Tap */
function handleTapEvent(el: any, binding: DirectiveBinding<any>) {
    const callbackHandles = eventHandlerMap.get(el) || {};
    let pointerDownTimeoutHandle: number | undefined;
    let mouseClickAfterUpTimeoutHandle: number | undefined;
    let pointerDownType: string = '';
    let isPointerDownValid: boolean = false;
    let isMouseClickAfterUpValid: boolean = false;
    function onMouseDown(e: MouseEvent) {
        pointerDownType = 'mouse';
    }
    function onMouseUp(e: MouseEvent) {
        isMouseClickAfterUpValid = true;
        mouseClickAfterUpTimeoutHandle = window.setTimeout(() => {
            isMouseClickAfterUpValid = false;
        }, 100);
    }
    function onClick(e: MouseEvent) {
        if (pointerDownType === 'mouse' && isMouseClickAfterUpValid) {
            runCallback(el, 'tap', binding, translateMouseEventToPointerEvent('pointerup', e));
        }
    }
    function onPointerDown(e: PointerEvent) {
        if (e.pointerType === 'pen' && e.isPrimary) {
            pointerDownType = 'pen';
            isPointerDownValid = true;
            clearTimeout(pointerDownTimeoutHandle);
            pointerDownTimeoutHandle = window.setTimeout(() => {
                isPointerDownValid = false;
            }, multiTouchTapTimeout.value);
        }
    }
    function onPointerUp(e: PointerEvent) {
        if (e.pointerType === 'pen' && pointerDownType === 'pen' && isPointerDownValid) {
            runCallback(el, 'tap', binding, e);
        }
    }
    function onTouchStart(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                pointerDownType = 'touch';
                isPointerDownValid = true;
                clearTimeout(pointerDownTimeoutHandle);
                pointerDownTimeoutHandle = window.setTimeout(() => {
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
                    runCallback(el, 'tap', binding, translateTouchEventToPointerEvents('pointerup', e)[0]);
                }
            }
        }
    }
    callbackHandles.tap = {
        mousedown: [el, onMouseDown],
        mouseup: [el, onMouseUp],
        click: [el, onClick],
        pointerdown: [el, onPointerDown],
        pointerup: [el, onPointerUp],
        touchstart: [el, onTouchStart],
        touchend: [el, onTouchEnd]
    };
    for (let realEventName in callbackHandles.tap) {
        const callbackConfig = callbackHandles.tap[realEventName];
        callbackConfig[0].addEventListener(realEventName, callbackConfig[1] as any);
    }
    eventHandlerMap.set(el, callbackHandles);
}

/* Press */
function handlePressEvent(el: any, binding: DirectiveBinding<any>) {
    const callbackHandles = eventHandlerMap.get(el) || {};
    let pointerDownTimeoutHandle: number | undefined;
    let pointerDownType: string = '';
    let isPointerDownValid: boolean = false;
    let pointerDownX: number = -1;
    let pointerDownY: number = -1;
    function onMouseDown(e: MouseEvent) {
        pointerDownType = 'mouse';
        isPointerDownValid = true;
        pointerDownX = e.pageX;
        pointerDownY = e.pageY;
        clearTimeout(pointerDownTimeoutHandle);
        pointerDownTimeoutHandle = window.setTimeout(() => {
            isPointerDownValid = false;
            runCallback(el, 'press', binding, translateMouseEventToPointerEvent('pointerdown', e));
        }, pointerPressHoldTimeout.value);
    }
    function onMouseMoveWindow(e: MouseEvent) {
        if (isPointerDownValid && pointerDownType === 'mouse') {
            if (pointDistance2d(pointerDownX, pointerDownY, e.pageX, e.pageY) > preferencesStore.get('dragStartRadius')) {
                clearTimeout(pointerDownTimeoutHandle);
                isPointerDownValid = false;
            }
        }
    }
    function onMouseUp(e: MouseEvent) {
        clearTimeout(pointerDownTimeoutHandle);
        isPointerDownValid = false;
    }
    function onPointerDown(e: PointerEvent) {
        if (e.pointerType === 'pen' && e.isPrimary) {
            pointerDownType = 'pen';
            isPointerDownValid = true;
            pointerDownX = e.pageX;
            pointerDownY = e.pageY;
            clearTimeout(pointerDownTimeoutHandle);
            pointerDownTimeoutHandle = window.setTimeout(() => {
                isPointerDownValid = false;
                runCallback(el, 'press', binding, e);
            }, pointerPressHoldTimeout.value);
        }
    }
    function onPointerMoveWindow(e: PointerEvent) {
        if (isPointerDownValid && pointerDownType === 'pen' && e.isPrimary) {
            if (pointDistance2d(pointerDownX, pointerDownY, e.pageX, e.pageY) > preferencesStore.get('dragStartRadius')) {
                clearTimeout(pointerDownTimeoutHandle);
                isPointerDownValid = false;
            }
        }
    }
    function onPointerUp(e: PointerEvent) {
        if (e.pointerType === 'pen' && pointerDownType === 'pen' && isPointerDownValid) {
            clearTimeout(pointerDownTimeoutHandle);
            isPointerDownValid = false;
        }
    }
    function onTouchStart(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                pointerDownType = 'touch';
                isPointerDownValid = true;
                pointerDownX = e.touches[0].pageX;
                pointerDownY = e.touches[0].pageY;
                clearTimeout(pointerDownTimeoutHandle);
                pointerDownTimeoutHandle = window.setTimeout(() => {
                    isPointerDownValid = false;
                    runCallback(el, 'press', binding, translateTouchEventToPointerEvents('pointerdown', e)[0]);
                }, pointerPressHoldTimeout.value);
            }
        }
    }
    function onTouchMoveWindow(e: TouchEvent) {
        if (isPointerDownValid && pointerDownType === 'touch') {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                    if (pointDistance2d(pointerDownX, pointerDownY, e.touches[0].pageX, e.touches[0].pageY) > preferencesStore.get('dragStartRadius')) {
                        clearTimeout(pointerDownTimeoutHandle);
                        isPointerDownValid = false;
                    }
                }
            }
        }
    }
    function onTouchEnd(e: TouchEvent) {
        if (pointerDownType === 'touch' && isPointerDownValid) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                    clearTimeout(pointerDownTimeoutHandle);
                    isPointerDownValid = false;
                }
            }
        }
    }
    callbackHandles.press = {
        mousedown: [el, onMouseDown],
        mousemove: [window, onMouseMoveWindow],
        mouseup: [el, onMouseUp],
        pointerdown: [el, onPointerDown],
        pointermove: [window, onPointerMoveWindow],
        pointerup: [el, onPointerUp],
        touchstart: [el, onTouchStart],
        touchmove: [el, onTouchMoveWindow],
        touchend: [el, onTouchEnd]
    };
    for (let realEventName in callbackHandles.press) {
        const callbackConfig = callbackHandles.press[realEventName];
        callbackConfig[0].addEventListener(realEventName, callbackConfig[1] as any);
    }
    eventHandlerMap.set(el, callbackHandles);
}

/* Move */
function handleMoveEvent(el: any, binding: DirectiveBinding<any>) {
    function onMouseMove(e: MouseEvent) {
        runCallback(el, 'move', binding, translateMouseEventToPointerEvent('pointermove', e));
    }
    function onPointerMove(e: PointerEvent) {
        if (e.type === 'pen') {
            runCallback(el, 'move', binding, e);
        }
    }
    function onTouchMove(e: TouchEvent) {
        const events = translateTouchEventToPointerEvents('pointermove', e);
        for (const event of events) {
            runCallback(el, 'move', binding, event);
        }
    }
    const callbackHandles = eventHandlerMap.get(el) || {};
    callbackHandles.move = {
        mousemove: [binding.modifiers.window ? window : el, onMouseMove],
        pointermove: [binding.modifiers.window ? window : el, onPointerMove],
        touchmove: [binding.modifiers.window ? window : el, onTouchMove]
    };
    for (let realEventName in callbackHandles.move) {
        const callbackConfig = callbackHandles.move[realEventName];
        callbackConfig[0].addEventListener(realEventName, callbackConfig[1] as any);
    }
    eventHandlerMap.set(el, callbackHandles);
}

/* Drag Start */
function handleDragEvents(el: any, eventName: string, binding: DirectiveBinding<any>) {
    const dragData = dragDataMap.get(el) || {};
    if (dragData.eventsAlreadySetup) {
        return;
    }
    dragData.eventsAlreadySetup = true;
    dragDataMap.set(el, dragData);

    const callbackHandles = eventHandlerMap.get(el) || {};
    let isDragging: boolean = false;
    let pointerDownType: string | null = null;
    let pointerDownX: number = -1;
    let pointerDownY: number = -1;
    let pointerDownEvent: MouseEvent | PointerEvent | TouchEvent;

    function onDragStart(e: DragEvent) {
        e.preventDefault();
        return false;
    }
    function onMouseDown(e: MouseEvent) {
        if (isInput(e.target)) {
            return;
        }
        pointerDownEvent = e;
        pointerDownType = 'mouse';
        pointerDownX = e.pageX;
        pointerDownY = e.pageY;
    }
    function onMouseMoveWindow(e: MouseEvent) {
        if (pointerDownType === 'mouse' && !isDragging) {
            if (pointDistance2d(pointerDownX, pointerDownY, e.pageX, e.pageY) > preferencesStore.get('dragStartRadius')) {
                isDragging = true;
                runCallback(el, 'dragstart', binding, translateMouseEventToPointerEvent('pointerdown', pointerDownEvent as MouseEvent));
            }
        }
    }
    function onMouseUpWindow(e: MouseEvent) {
        if (pointerDownType === 'mouse') {
            pointerDownType = null;
            if (isDragging) {
                isDragging = false;
                runCallback(el, 'dragend', binding, translateMouseEventToPointerEvent('pointerup', e));
            }
        }
    }
    function onPointerDown(e: PointerEvent) {
        if (isInput(e.target)) {
            return;
        }
        if (e.pointerType === 'pen' && e.isPrimary) {
            pointerDownEvent = e;
            pointerDownType = 'pen';
            pointerDownX = e.pageX;
            pointerDownY = e.pageY;
        }
    }
    function onPointerMoveWindow(e: PointerEvent) {
        if (pointerDownType === 'pen' && e.isPrimary && !isDragging) {
            if (pointDistance2d(pointerDownX, pointerDownY, e.pageX, e.pageY) > preferencesStore.get('dragStartRadius')) {
                isDragging = true;
                runCallback(el, 'dragstart', binding, pointerDownEvent);
            }
        }
    }
    function onPointerUpWindow(e: PointerEvent) {
        if (e.pointerType === 'pen') {
            pointerDownType = null;
            if (isDragging) {
                isDragging = false;
                runCallback(el, 'dragend', binding, e);
            }
        }
    }
    function onTouchStart(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                if (isInput(e.touches[0].target)) {
                    return;
                }
                pointerDownEvent = e;
                pointerDownType = 'touch';
                pointerDownX = e.touches[0].pageX;
                pointerDownY = e.touches[0].pageY;
            }
        }
    }
    function onTouchMoveWindow(e: TouchEvent) {
        if (pointerDownType === 'touch' && !isDragging) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                    if (pointDistance2d(pointerDownX, pointerDownY, e.touches[0].pageX, e.touches[0].pageY) > preferencesStore.get('dragStartRadius')) {
                        isDragging = true;
                        runCallback(el, 'dragstart', binding, translateTouchEventToPointerEvents('pointerdown', pointerDownEvent as TouchEvent)[0]);
                    }
                }
            }
        }
    }
    function onTouchEndWindow(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if ((e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0) {
                pointerDownType = null;
                if (isDragging) {
                    isDragging = false;
                    runCallback(el, 'dragend', binding, translateTouchEventToPointerEvents('pointerup', e)[0]);
                }
            }
        }
    }
    callbackHandles[eventName] = {
        dragstart: [el, onDragStart],
        mousedown: [el, onMouseDown],
        mousemove: [window, onMouseMoveWindow],
        mouseup: [window, onMouseUpWindow],
        pointerdown: [el, onPointerDown],
        pointermove: [window, onPointerMoveWindow],
        pointerup: [window, onPointerUpWindow],
        touchstart: [el, onTouchStart],
        touchmove: [window, onTouchMoveWindow],
        touchend: [window, onTouchEndWindow]
    };
    for (let realEventName in callbackHandles[eventName]) {
        const callbackConfig = callbackHandles[eventName][realEventName];
        callbackConfig[0].addEventListener(realEventName, callbackConfig[1] as any);
    }
    eventHandlerMap.set(el, callbackHandles);
}

/* Pointer Up */
function handleUpEvent(el: any, binding: DirectiveBinding<any>) {
    
    const callbackHandles = eventHandlerMap.get(el) || {};

    function onMouseUp(e: MouseEvent) {
        runCallback(el, 'up', binding, translateMouseEventToPointerEvent('pointerup', e));
    }
    function onPointerUp(e: PointerEvent) {
        if (e.pointerType === 'pen') {
            runCallback(el, 'up', binding, e);
        }
    }
    function onTouchEnd(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            runCallback(el, 'up', binding, translateTouchEventToPointerEvents('pointerup', e)[0]);
        }
    }

    if (binding.modifiers.window) {
        callbackHandles.up = {
            mouseup: [window, onMouseUp],
            pointerup: [window, onPointerUp],
            touchend: [window, onTouchEnd]
        };
    } else {
        callbackHandles.up = {
            mouseup: [el, onMouseUp],
            pointerup: [el, onPointerUp],
            touchend: [el, onTouchEnd]
        };
    }
    for (let realEventName in callbackHandles.up) {
        const callbackConfig = callbackHandles.up[realEventName];
        callbackConfig[0].addEventListener(realEventName, callbackConfig[1] as any);
    }
    eventHandlerMap.set(el, callbackHandles);
}

const PointerDirective: ObjectDirective = {
    async mounted(el, binding) {
        const eventName = getEventName(binding);
        storeBinding(el, eventName, binding);

        if (eventName === 'tap') {
            handleTapEvent(el, binding);
        } else if (eventName === 'press') {
            handlePressEvent(el, binding);
        } else if (['dragstart', 'dragend'].includes(eventName)) {
            handleDragEvents(el, eventName, binding);
        } else if (eventName === 'move') {
            handleMoveEvent(el, binding);
        } else if (eventName === 'up') {
            handleUpEvent(el, binding);
        }
    },
    async updated(el, binding) {
        const eventName = getEventName(binding);
        storeBinding(el, eventName, binding);
    },
    async unmounted(el, binding) {
        const eventName = getEventName(binding);
        const callbackHandles = eventHandlerMap.get(el) || {};
        for (let realEventName in callbackHandles[eventName]) {
            const eventDef = callbackHandles[eventName][realEventName];
            eventDef[0].removeEventListener(realEventName, eventDef[1] as any);
        }
        eventHandlerMap.delete(el);
    }
};

export default PointerDirective;
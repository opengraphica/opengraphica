
class PointerEventPolyfill {
    constructor(options: any) {
        for (let optionName in options) {
            (this as any)[optionName] = options[optionName];
        }
    }
}

let pointerIdCounter: number = 0;

/**
 * Polyfill to translate mouse event to pointer event for browsers that do not support pointer events.
 */
 export const translateMouseEventToPointerEvent = (type: string, e: MouseEvent): PointerEvent => {
    let pointerEvent = new PointerEventPolyfill({
        altKey: e.altKey,
        altitudeAngle: 1.5707963267948966, // PI / 2
        azimuthAngle: 0,
        bubbles: e.bubbles,
        button: 0,
        buttons: 1,
        cancelBubble: e.cancelBubble,
        cancelable: e.cancelable,
        clientX: e.clientX,
        clientY: e.clientY,
        composed: e.composed,
        ctrlKey: e.ctrlKey,
        currentTarget: e.currentTarget,
        defaultPrevented: e.defaultPrevented,
        detail: e.detail,
        eventPhase: e.eventPhase,
        fromElement: null,
        height: 23,
        isPrimary: true,
        isTrusted: e.isTrusted,
        layerX: e.pageX,
        layerY: e.pageY,
        metaKey: e.metaKey,
        movementX: 0, //
        movementY: 0, //
        offsetX: 0,
        offsetY: 0,
        pageX: e.pageX,
        pageY: e.pageY,
        pointerId: 0,
        pointerType: 'mouse',
        pressure: 1,
        relatedTarget: null,
        returnValue: e.returnValue,
        screenX: e.screenX,
        screenY: e.screenY,
        shiftKey: e.shiftKey,
        srcElement: e.srcElement,
        tangentialPressure: 0,
        target: e.target,
        tiltX: 0,
        tiltY: 0,
        timeStamp: e.timeStamp,
        toElement: null,
        twist: 0,
        type: type,
        view: e.view,
        which: 1,
        width: 23,
        x: e.clientX,
        y: e.clientY
    } as any) as unknown as PointerEvent
    return pointerEvent;
};

/**
 * Polyfill to translate touch events to pointer events for mobile browsers that do not support pointer events.
 */
export const translateTouchEventToPointerEvents = (type: string, e: TouchEvent): PointerEvent[] => {
    const pointerEvents: PointerEvent[] = [];
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        pointerEvents.push(
            new PointerEventPolyfill({
                altKey: e.altKey,
                altitudeAngle: 1.5707963267948966, // PI / 2
                azimuthAngle: 0,
                bubbles: e.bubbles,
                button: 0,
                buttons: 1,
                cancelBubble: e.cancelBubble,
                cancelable: e.cancelable,
                clientX: touch.clientX,
                clientY: touch.clientY,
                composed: e.composed,
                ctrlKey: e.ctrlKey,
                currentTarget: e.currentTarget,
                defaultPrevented: e.defaultPrevented,
                detail: e.detail,
                eventPhase: e.eventPhase,
                fromElement: null,
                height: 23,
                isPrimary: (e.touches[0] && e.touches[0].identifier === touch.identifier) || e.touches.length === 0,
                isTrusted: e.isTrusted,
                layerX: touch.pageX,
                layerY: touch.pageY,
                metaKey: e.metaKey,
                movementX: 0, //
                movementY: 0, //
                offsetX: 0,
                offsetY: 0,
                pageX: touch.pageX,
                pageY: touch.pageY,
                pointerId: touch.identifier,
                pointerType: 'touch',
                pressure: 1,
                relatedTarget: null,
                returnValue: e.returnValue,
                screenX: touch.screenX,
                screenY: touch.screenY,
                shiftKey: e.shiftKey,
                srcElement: e.srcElement,
                tangentialPressure: 0,
                target: e.target,
                tiltX: 0,
                tiltY: 0,
                timeStamp: e.timeStamp,
                toElement: null,
                twist: 0,
                type: type,
                view: e.view,
                which: 1,
                width: 23,
                x: touch.clientX,
                y: touch.clientY
            } as any) as unknown as PointerEvent
        );
    }
    return pointerEvents;
};

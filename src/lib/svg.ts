/**
 * Parts of this file were adapted from threejs
 * @copyright © 2010-2026 three.js authors
 * @license MIT https://github.com/mrdoob/three.js/blob/dev/LICENSE
 */

import { VectorPathCommandType, type VectorPathCommand } from '@/types';

const units = ['mm', 'cm', 'in', 'pt', 'pc', 'px'];

// Conversion: [fromUnit][toUnit] (-1 means dpi dependent)
const unitConversion = {
    'mm': {
        'mm': 1,
        'cm': 0.1,
        'in': 1 / 25.4,
        'pt': 72 / 25.4,
        'pc': 6 / 25.4,
        'px': -1,
    },
    'cm': {
        'mm': 10,
        'cm': 1,
        'in': 1 / 2.54,
        'pt': 72 / 2.54,
        'pc': 6 / 2.54,
        'px': -1,
    },
    'in': {
        'mm': 25.4,
        'cm': 2.54,
        'in': 1,
        'pt': 72,
        'pc': 6,
        'px': -1,
    },
    'pt': {
        'mm': 25.4 / 72,
        'cm': 2.54 / 72,
        'in': 1 / 72,
        'pt': 1,
        'pc': 6 / 72,
        'px': -1,
    },
    'pc': {
        'mm': 25.4 / 6,
        'cm': 2.54 / 6,
        'in': 1 / 6,
        'pt': 72 / 6,
        'pc': 1,
        'px': -1,
    },
    'px': {
        'px': 1,
    },
};

/**
 * @copyright (c) 2013 Peter-Paul van Gemerden <mail@ppvg.nl>
 * @license MIT https://github.com/ppvg/svg-numbers/blob/master/LICENSE
 */
function parseFloats(input: string, flags?: number[], stride?: number) {

    if (typeof input !== 'string') {
        throw new TypeError('Invalid input: ' + typeof input);
    }

    // Character groups
    const RE = {
        SEPARATOR: /[ \t\r\n\,.\-+]/,
        WHITESPACE: /[ \t\r\n]/,
        DIGIT: /[\d]/,
        SIGN: /[-+]/,
        POINT: /\./,
        COMMA: /,/,
        EXP: /e/i,
        FLAGS: /[01]/
    };

    // States
    const SEP = 0;
    const INT = 1;
    const FLOAT = 2;
    const EXP = 3;

    let state = SEP;
    let seenComma = true;
    let number = '', exponent = '';
    const result: Number[] = [];

    function throwSyntaxError(current, i, partial) {
        const error = new SyntaxError( 'Unexpected character "' + current + '" at index ' + i + '.' );
        (error as any).partial = partial;
        throw error;
    }

    function newNumber() {
        if (number !== '') {
            if (exponent === '') result.push(Number(number));
            else result.push(Number(number) * Math.pow(10, Number(exponent)));
        }
        number = '';
        exponent = '';
    }

    let current;
    const length = input.length;

    for (let i = 0; i < length; i ++) {
        current = input[i];

        // check for flags
        if (Array.isArray(flags) && flags.includes(result.length % stride!) && RE.FLAGS.test(current)) {
            state = INT;
            number = current;
            newNumber();
            continue;
        }

        // parse until next number
        if (state === SEP) {

            // eat whitespace
            if (RE.WHITESPACE.test(current)) {
                continue;
            }

            // start new number
            if (RE.DIGIT.test(current) || RE.SIGN.test(current)) {
                state = INT;
                number = current;
                continue;
            }

            if (RE.POINT.test(current)) {
                state = FLOAT;
                number = current;
                continue;
            }

            // throw on double commas (e.g. "1, , 2")
            if (RE.COMMA.test(current)) {
                if ( seenComma ) {
                    throwSyntaxError( current, i, result );
                }
                seenComma = true;
            }

        }

        // parse integer part
        if (state === INT) {

            if (RE.DIGIT.test(current)) {
                number += current;
                continue;
            }

            if (RE.POINT.test(current)) {
                number += current;
                state = FLOAT;
                continue;
            }

            if (RE.EXP.test(current)) {
                state = EXP;
                continue;
            }

            // throw on double signs ("-+1"), but not on sign as separator ("-1-2")
            if (RE.SIGN.test(current)
                    && number.length === 1
                    && RE.SIGN.test(number[0])) {
                throwSyntaxError(current, i, result);
            }

        }

        // parse decimal part
        if (state === FLOAT) {

            if (RE.DIGIT.test(current)) {
                number += current;
                continue;
            }

            if (RE.EXP.test(current)) {
                state = EXP;
                continue;
            }

            // throw on double decimal points (e.g. "1..2")
            if (RE.POINT.test(current) && number[number.length - 1] === '.') {
                throwSyntaxError(current, i, result);
            }

        }

        // parse exponent part
        if (state === EXP) {

            if (RE.DIGIT.test(current)) {
                exponent += current;
                continue;
            }

            if (RE.SIGN.test(current)) {
                if (exponent === '') {
                    exponent += current;
                    continue;
                }

                if (exponent.length === 1 && RE.SIGN.test(exponent)) {
                    throwSyntaxError(current, i, result);
                }
            }

        }

        // end of number
        if (RE.WHITESPACE.test(current)) {

            newNumber();
            state = SEP;
            seenComma = false;

        } else if (RE.COMMA.test(current)) {

            newNumber();
            state = SEP;
            seenComma = true;

        } else if (RE.SIGN.test(current)) {

            newNumber();
            state = INT;
            number = current;

        } else if (RE.POINT.test(current)) {

            newNumber();
            state = FLOAT;
            number = current;

        } else {

            throwSyntaxError(current, i, result);

        }

    }

    // add the last number found (if any)
    newNumber();

    return result;

}

function parseFloatWithUnits(
    string: string | String,
    defaultUnit: 'mm'|'cm'|'in'|'pt'|'pc'|'px',
    defaultDPI: number,
) {
    let theUnit = 'px';

    if (typeof string === 'string' || string instanceof String) {
        for (let i = 0, n = units.length; i < n; i ++) {
            const u = units[i];
            if (string.endsWith(u)) {
                theUnit = u;
                string = string.substring(0, string.length - u.length);
                break;
            }
        }
    }

    let scale: number | undefined = undefined;

    if (theUnit === 'px' && defaultUnit !== 'px') {
        // Conversion scale from  pixels to inches, then to default units
        scale = unitConversion['in'][defaultUnit] / defaultDPI;
    } else {
        scale = unitConversion[theUnit][defaultUnit];
        if ((scale ?? 1) < 0) {
            // Conversion scale to pixels
            scale = unitConversion[theUnit]['in'] * defaultDPI;
        }
    }

    return (scale ?? 1) * parseFloat(string as string);
}

function getReflection(a: number, b: number) {
    return a - (b - a);
}

interface ParseNodeGlobalOptions {
    defaultDPI: number;
    defaultUnit: 'mm'|'cm'|'in'|'pt'|'pc'|'px';
}

function getDefaultParseNodeGlobalOptions(options?: ParseNodeGlobalOptions) {
    if (options) return options;
    return {
        defaultDPI: 90,
        defaultUnit: 'px',
    } as ParseNodeGlobalOptions;
}

function parseTransformString(text: string, transform: DOMMatrix) {
    let tempTransform0 = new DOMMatrix();
    let tempTransform1 = new DOMMatrix();
    let tempTransform2 = new DOMMatrix();
    let tempTransform3 = new DOMMatrix();

    let currentTransform = tempTransform0;

    const transformsTexts = text.split( ')' );

    for (let tIndex = transformsTexts.length - 1; tIndex >= 0; tIndex--) {
        const transformText = transformsTexts[tIndex].trim();

        if (transformText === '') continue;

        const openParPos = transformText.indexOf('(');
        const closeParPos = transformText.length;

        if (openParPos > 0 && openParPos < closeParPos) {
            const transformType = transformText.slice(0, openParPos);

            const array = parseFloats(transformText.slice(openParPos + 1)) as number[];

            currentTransform = new DOMMatrix();

            switch (transformType) {
                case 'translate':
                    if (array.length >= 1) {
                        const tx = array[0];
                        let ty: number = 0;
                        if (array.length >= 2) {
                            ty = array[1];
                        }
                        currentTransform.translateSelf(tx, ty);
                    }
                    break;

                case 'rotate':
                    if (array.length >= 1) {
                        let angle = 0;
                        let cx = 0;
                        let cy = 0;
                        // Angle
                        angle = array[0];
                        if (array.length >= 3) {
                            // Center x, y
                            cx = array[1];
                            cy = array[2];
                        }
                        // Rotate around center (cx, cy)
                        tempTransform1 = new DOMMatrix().translateSelf(-cx, -cy);
                        tempTransform2 = new DOMMatrix().rotateSelf(angle);
                        tempTransform3 = tempTransform2.multiply(tempTransform1);
                        tempTransform1 = new DOMMatrix().translateSelf(cx, cy);
                        currentTransform = tempTransform1.multiply(tempTransform3);
                    }
                    break;

                case 'scale':
                    if (array.length >= 1) {
                        const scaleX = array[0];
                        let scaleY = scaleX;
                        if (array.length >= 2) {
                            scaleY = array[1];
                        }
                        currentTransform = new DOMMatrix().scaleSelf(scaleX, scaleY);
                    }
                    break;

                case 'skewX':
                    if (array.length === 1) {
                        currentTransform = new DOMMatrix([1, 0, Math.tan(array[0] * Math.PI / 180), 1, 0, 0]);
                    }
                    break;

                case 'skewY':
                    if (array.length === 1) {
                        currentTransform = new DOMMatrix([1, Math.tan(array[0] * Math.PI / 180), 0, 1, 0, 0]);
                    }
                    break;

                case 'matrix':
                    if ( array.length === 6 ) {
                        currentTransform = new DOMMatrix([array[0], array[1], array[2], array[3], array[4], array[5]])
                    }
                    break;

            }
            transform.preMultiplySelf(currentTransform);
        }
    }

    return transform;
}

function parseNodeTransform(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    let transform = new DOMMatrix();
    let currentNode = node;
    while (currentNode.parentElement) {
        const currentTransform = new DOMMatrix();
        
        if (currentNode.nodeName === 'use' && (currentNode.hasAttribute('x') || currentNode.hasAttribute('y'))) {
            const tx = parseFloatWithUnits(currentNode.getAttribute('x') || '0', defaultUnit, defaultDPI);
            const ty = parseFloatWithUnits(currentNode.getAttribute('y') || '0', defaultUnit, defaultDPI);
            currentTransform.translateSelf(tx, ty);
        }

        if (currentNode.hasAttribute('transform')) {
            parseTransformString(currentNode.getAttribute('transform')!, currentTransform);
        }

        transform.preMultiplySelf(currentTransform);

        currentNode = currentNode.parentElement;
    }

    return transform;
}

export function parseCommonNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const transform = parseNodeTransform(node, options);
    return { transform };
}

export function parseRectNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const x = parseFloatWithUnits(node.getAttribute('x') || '0', defaultUnit, defaultDPI);
    const y = parseFloatWithUnits(node.getAttribute('y') || '0', defaultUnit, defaultDPI);
    const rx = parseFloatWithUnits(node.getAttribute('rx') || node.getAttribute( 'ry' ) || '0', defaultUnit, defaultDPI);
    const ry = parseFloatWithUnits(node.getAttribute('ry') || node.getAttribute( 'rx' ) || '0', defaultUnit, defaultDPI);
    const width = parseFloatWithUnits(node.getAttribute('width') || '0', defaultUnit, defaultDPI);
    const height = parseFloatWithUnits(node.getAttribute('height') || '0', defaultUnit, defaultDPI);

    return { x, y, rx, ry, width, height };
}

export function parsePolygonNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const points: Array<DOMPoint> = [];

    function iterator(_: string, a: string, b: string) {
        const x = parseFloatWithUnits(a, defaultUnit, defaultDPI);
        const y = parseFloatWithUnits(b, defaultUnit, defaultDPI);
        points.push(new DOMPoint(x, y));
        index++;
        return '';
    }

    const regex = /([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g;

    let index = 0;
    node.getAttribute('points')?.replace(regex, iterator);

    return { points };
}

export function parsePolylineNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const points: Array<DOMPoint> = [];

    function iterator(_: string, a: string, b: string) {
        const x = parseFloatWithUnits(a, defaultUnit, defaultDPI);
        const y = parseFloatWithUnits(b, defaultUnit, defaultDPI);
        points.push(new DOMPoint(x, y));
        index++;
        return '';
    }

    const regex = /([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g;

    let index = 0;
    node.getAttribute( 'points' )?.replace(regex, iterator);

    return { points };
}

export function parseCircleNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const cx = parseFloatWithUnits(node.getAttribute('cx') || '0', defaultUnit, defaultDPI);
    const cy = parseFloatWithUnits(node.getAttribute('cy') || '0', defaultUnit, defaultDPI);
    const r = parseFloatWithUnits(node.getAttribute('r') || '0', defaultUnit, defaultDPI);

    return { cx, cy, r };
}

export function parseEllipseNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const cx = parseFloatWithUnits(node.getAttribute('cx') || '0', defaultUnit, defaultDPI);
    const cy = parseFloatWithUnits(node.getAttribute('cy') || '0', defaultUnit, defaultDPI);
    const rx = parseFloatWithUnits(node.getAttribute('rx') || '0', defaultUnit, defaultDPI);
    const ry = parseFloatWithUnits(node.getAttribute('ry') || '0', defaultUnit, defaultDPI);

    return { cx, cy, rx, ry };
}

export function parseLineNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const x1 = parseFloatWithUnits(node.getAttribute('x1') || '0', defaultUnit, defaultDPI);
    const y1 = parseFloatWithUnits(node.getAttribute('y1') || '0', defaultUnit, defaultDPI);
    const x2 = parseFloatWithUnits(node.getAttribute('x2') || '0', defaultUnit, defaultDPI);
    const y2 = parseFloatWithUnits(node.getAttribute('y2') || '0', defaultUnit, defaultDPI);

    return { x1, y1, x2, y2 };
}

/**
 * https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 * https://mortoray.com/2017/02/16/rendering-an-svg-elliptical-arc-as-bezier-curves/ Appendix: Endpoint to center arc conversion
 * From
 * rx ry x-axis-rotation large-arc-flag sweep-flag x y
 * To
 * aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation
 */
function parseArcCommand(rx: number, ry: number, xAxisRotation: number, largeArcFlag: number, sweepFlag: number, start: DOMPoint, end: DOMPoint): VectorPathCommand {
    if (rx == 0 || ry == 0) {
        // draw a line if either of the radii == 0
        return {
            type: VectorPathCommandType.LINE,
            x: end.x,
            y: end.y,
        };
    }

    return {
        type: VectorPathCommandType.ELLIPTICAL_ARC,
        rx,
        ry,
        xAxisRotation,
        largeArcFlag,
        sweepFlag,
        x: end.x,
        y: end.y,
    };
}

export function parsePathNodeAttributes(node: Element, options?: ParseNodeGlobalOptions) {
    const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions(options);

    const point = new DOMPoint();
    const control = new DOMPoint();

    const firstPoint = new DOMPoint();
    let isFirstPoint = true;
    let doSetFirstPoint = false;

    const dAttr = node.getAttribute('d');

    const d: VectorPathCommand[] = [];

    if (dAttr == null || dAttr === '' || dAttr === 'none') return { d };

    const commands = dAttr.match(/[a-df-z][^a-df-z]*/ig) ?? [];

    for (let i = 0, l = commands.length; i < l; i ++) {
        const command = commands[ i ];
        const type = command.charAt(0);
        const data = command.slice(1).trim();

        if (isFirstPoint === true) {
            doSetFirstPoint = true;
            isFirstPoint = false;
        }

        let numbers;

        switch (type) {
            case 'M':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    point.x = numbers[j + 0];
                    point.y = numbers[j + 1];
                    control.x = point.x;
                    control.y = point.y;

                    if (j === 0) {
                        d.push({
                            type: VectorPathCommandType.MOVE,
                            x: point.x,
                            y: point.y,
                        });
                    } else {
                        d.push({
                            type: VectorPathCommandType.LINE,
                            x: point.x,
                            y: point.y,
                        });
                    }

                    if (j === 0) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'H':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j ++ ) {
                    point.x = numbers[j];
                    control.x = point.x;
                    control.y = point.y;

                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });
                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'V':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j ++) {
                    point.y = numbers[j];
                    control.x = point.x;
                    control.y = point.y;

                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'L':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    point.x = numbers[j + 0];
                    point.y = numbers[j + 1];
                    control.x = point.x;
                    control.y = point.y;

                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'C':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 6) {
                    d.push({
                        type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                        x1: numbers[j + 0],
                        y1: numbers[j + 1],
                        x2: numbers[j + 2],
                        y2: numbers[j + 3],
                        x: numbers[j + 4],
                        y: numbers[j + 5],
                    });
                    control.x = numbers[ j + 2 ];
                    control.y = numbers[ j + 3 ];
                    point.x = numbers[ j + 4 ];
                    point.y = numbers[ j + 5 ];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'S':
                numbers = parseFloats( data );
                for (let j = 0, jl = numbers.length; j < jl; j += 4) {
                    d.push({
                        type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                        x1: getReflection(point.x, control.x),
                        y1: getReflection(point.y, control.y),
                        x2: numbers[j + 0],
                        y2: numbers[j + 1],
                        x: numbers[j + 2],
                        y: numbers[j + 3],
                    })
                    control.x = numbers[ j + 0 ];
                    control.y = numbers[ j + 1 ];
                    point.x = numbers[ j + 2 ];
                    point.y = numbers[ j + 3 ];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'Q':
                numbers = parseFloats( data );
                for (let j = 0, jl = numbers.length; j < jl; j += 4) {
                    d.push({
                        type: VectorPathCommandType.QUADRATIC_BEZIER_CURVE,
                        x1: numbers[j + 0],
                        y1: numbers[j + 1],
                        x: numbers[j + 2],
                        y: numbers[j + 3],
                    });
                    control.x = numbers[ j + 0 ];
                    control.y = numbers[ j + 1 ];
                    point.x = numbers[ j + 2 ];
                    point.y = numbers[ j + 3 ];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'T':
                numbers = parseFloats( data );
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    const rx = getReflection( point.x, control.x );
                    const ry = getReflection( point.y, control.y );
                    d.push({
                        type: VectorPathCommandType.QUADRATIC_BEZIER_CURVE,
                        x1: rx,
                        y1: ry,
                        x: numbers[j + 0],
                        y: numbers[j + 1],
                    });
                    control.x = rx;
                    control.y = ry;
                    point.x = numbers[j + 0];
                    point.y = numbers[j + 1];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'A':
                numbers = parseFloats(data, [3, 4], 7);

                for (let j = 0, jl = numbers.length; j < jl; j += 7) {
                    // skip command if start point == end point
                    if (numbers[j + 5] == point.x && numbers[j + 6] == point.y) continue;

                    const start = new DOMPoint(point.x, point.y);
                    point.x = numbers[j + 5];
                    point.y = numbers[j + 6];
                    control.x = point.x;
                    control.y = point.y;
                    d.push(
                        parseArcCommand(
                            numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
                        )
                    );

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'm':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    point.x += numbers[j + 0];
                    point.y += numbers[j + 1];
                    control.x = point.x;
                    control.y = point.y;

                    if (j === 0) {
                        d.push({
                            type: VectorPathCommandType.MOVE,
                            x: point.x,
                            y: point.y,
                        });
                    } else {
                        d.push({
                            type: VectorPathCommandType.LINE,
                            x: point.x,
                            y: point.y,
                        });
                    }

                    if (j === 0) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'h':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j ++) {
                    point.x += numbers[j];
                    control.x = point.x;
                    control.y = point.y;
                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'v':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j ++) {
                    point.y += numbers[j];
                    control.x = point.x;
                    control.y = point.y;
                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'l':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    point.x += numbers[j + 0];
                    point.y += numbers[j + 1];
                    control.x = point.x;
                    control.y = point.y;
                    d.push({
                        type: VectorPathCommandType.LINE,
                        x: point.x,
                        y: point.y,
                    });

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'c':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 6) {
                    d.push({
                        type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                        x1: numbers[j + 0],
                        y1: numbers[j + 1],
                        x2: numbers[j + 2],
                        y2: numbers[j + 3],
                        x: numbers[j + 4],
                        y: numbers[j + 5],
                    });
                    control.x = point.x + numbers[j + 2];
                    control.y = point.y + numbers[j + 3];
                    point.x += numbers[j + 4];
                    point.y += numbers[j + 5];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 's':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 4) {
                    d.push({
                        type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                        x1: getReflection(point.x, control.x),
                        y1: getReflection(point.y, control.y),
                        x2: numbers[j + 0],
                        y2: numbers[j + 1],
                        x: numbers[j + 2],
                        y: numbers[j + 3],
                    });
                    control.x = point.x + numbers[j + 0];
                    control.y = point.y + numbers[j + 1];
                    point.x += numbers[j + 2];
                    point.y += numbers[j + 3];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'q':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 4) {
                    d.push({
                        type: VectorPathCommandType.QUADRATIC_BEZIER_CURVE,
                        x1: numbers[j + 0],
                        y1: numbers[j + 1],
                        x: numbers[j + 2],
                        y: numbers[j + 3],
                    });
                    control.x = point.x + numbers[j + 0];
                    control.y = point.y + numbers[j + 1];
                    point.x += numbers[j + 2];
                    point.y += numbers[j + 3];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 't':
                numbers = parseFloats(data);
                for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                    const rx = getReflection(point.x, control.x);
                    const ry = getReflection(point.y, control.y);
                    d.push({
                        type: VectorPathCommandType.QUADRATIC_BEZIER_CURVE,
                        x1: rx,
                        y1: ry,
                        x: numbers[j + 0],
                        y: numbers[j + 1],
                    });
                    control.x = rx;
                    control.y = ry;
                    point.x = point.x + numbers[j + 0];
                    point.y = point.y + numbers[j + 1];

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'a':
                numbers = parseFloats(data, [ 3, 4 ], 7);
                for (let j = 0, jl = numbers.length; j < jl; j += 7) {

                    // skip command if no displacement
                    if (numbers[j + 5] == 0 && numbers[j + 6] == 0) continue;

                    const start = new DOMPoint(point.x, point.y);
                    point.x += numbers[j + 5];
                    point.y += numbers[j + 6];
                    control.x = point.x;
                    control.y = point.y;
                    d.push(
                        parseArcCommand(
                            numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
                        )
                    );

                    if (j === 0 && doSetFirstPoint === true) {
                        firstPoint.x = point.x;
                        firstPoint.y = point.y;
                    }
                }
                break;

            case 'Z':
            case 'z':
                d.push({
                    type: VectorPathCommandType.CLOSE,
                })
                point.x = firstPoint.x;
                point.y = firstPoint.y;
                isFirstPoint = true;
                break;

            default:
                console.warn( command );

        }

        doSetFirstPoint = false;
    }

    return { d };
}

export function serializeVectorPathCommand(current: VectorPathCommand, previous?: VectorPathCommand) {
    switch (current.type) {
        case VectorPathCommandType.CLOSE:
            return 'Z';
        case VectorPathCommandType.CUBIC_BEZIER_CURVE:
            return (previous?.type === VectorPathCommandType.CUBIC_BEZIER_CURVE ? '' : 'C ')
                + current.x1 + ' ' + current.y1 + ' ' + current.x2 + ' ' + current.y2 + ' '
                + current.x + ' ' + current.y;
        case VectorPathCommandType.ELLIPTICAL_ARC:
            return (previous?.type === VectorPathCommandType.ELLIPTICAL_ARC ? '' : 'A ')
                + current.rx + ' ' + current.ry + ' ' + current.xAxisRotation + ' '
                + current.largeArcFlag + ' ' + current.sweepFlag + ' ' + current.x + ' ' + current.y;
        case VectorPathCommandType.HORIZONTAL_LINE:
            return (previous?.type === VectorPathCommandType.HORIZONTAL_LINE ? '' : 'H ')
                + current.x;
        case VectorPathCommandType.LINE:
            return (previous?.type === VectorPathCommandType.LINE ? '' : 'L ')
                + current.x + ' ' + current.y;
        case VectorPathCommandType.MOVE:
            return (previous?.type === VectorPathCommandType.MOVE ? '' : 'M ')
                + current.x + ' ' + current.y;
        case VectorPathCommandType.QUADRATIC_BEZIER_CURVE:
            return (previous?.type === VectorPathCommandType.QUADRATIC_BEZIER_CURVE ? '' : 'Q ')
                + current.x1 + ' ' + current.y1 + ' ' + current.x + ' ' + current.y;
        case VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE:
            return (previous?.type === VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE ? '' : 'S ')
                + current.x2 + ' ' + current.y2 + ' ' + current.x + ' ' + current.y;
        case VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE:
            return (previous?.type === VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE ? '' : 'T ')
                + current.x + ' ' + current.y;
        case VectorPathCommandType.VERTICAL_LINE:
            return (previous?.type === VectorPathCommandType.VERTICAL_LINE ? '' : 'V ')
                + current.y;
    }
}

export function getViewBox(xml?: Document): DOMRect {
    if (!xml?.documentElement) return new DOMRect();
    const viewBoxSplit = (xml.documentElement.getAttribute('viewBox') ?? '').trim().split(/\s+/);
    let minX = 0;
    let minY = 0;
    let maxX = parseFloat(xml.documentElement.getAttribute('width') ?? '0');
    let maxY = parseFloat(xml.documentElement.getAttribute('height') ?? '0');
    if (viewBoxSplit.length === 4) {
        ([minX, minY, maxX, maxY] = viewBoxSplit.map(str => parseFloat(str)));
    }
    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}
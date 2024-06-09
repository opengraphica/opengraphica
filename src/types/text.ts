import { ColorModel } from './color';

import type { Glyph } from '@/lib/opentype.js';

export type TextDirection = 'ltr' | 'rtl' | 'ttb' | 'btt';
export type TextLineAlignment = 'start' | 'center' | 'end';

export interface CalculatedTextPlacement {
    lines: RenderTextLineInfo[];
    longestLineSize: number;
    lineDirection: TextDirection;
    lineDirectionSize: number;
    wrapDirectionSize: number;
    isHorizontal: boolean;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface RenderTextLineInfo {
    glyphs: RenderTextGlyphInfo[];
    heightAboveBaseline: number;
    heightBelowBaseline: number;
    largestCharacterWidth: number;
    lineAlignment: TextLineAlignment;
    lineSize: number; // If horizontal, this is the width of the light. If vertical, the height.
    lineStartOffset: number; // If horizontal, the number of pixels to offset the x starting position of the line based on text alignment.
    wrapOffset: number; // If horizontal, this is basically the y-position of the line. Vertical, x position.
    bearingOffset: DOMPoint; // Global x/y draw offset for the entire line.
    documentLineIndex: number;
}

export interface RenderTextGlyphInfo {
    glyph: InstanceType<typeof Glyph>;
    advance: number;
    advanceOffset: number;
    drawOffset: DOMPoint;
    bidiDirection: TextDirection;
    characterIndex: number;
    characterWidth: number;
    documentCharacterIndex: number;
    fontSize: number;
    fontAscender: number;
    fontDescender: number;
}

export interface FontFamilyFetchDefinition  {
    family: string;
    subsets: string[];
    variants: {
        [key: string]: {
            name: string;
            file: string;
        };
    };
}

export interface TextDocumentSelectionState {
    isActiveSideEnd: boolean;
    start: { line: number, character: number };
    end: { line: number, character: number };
}

export interface TextDocument<T extends ColorModel = ColorModel> {
    boundary: 'dynamic' | 'box';
    lineAlignment: TextLineAlignment;
    lineDirection: TextDirection;
    wrapDirection: TextDirection;
    wrapAt: 'word' | 'wordThenLetter';
    lines: TextDocumentLine<T>[];
}

export interface TextDocumentLine<T extends ColorModel = ColorModel> {
    alignment?: TextLineAlignment; // Depending on the text direction, 'start' can mean left or top, etc.
    direction?: TextDirection;
    spans: TextDocumentSpan<T>[];
}

export interface TextDocumentSpan<T extends ColorModel = ColorModel> {
    text: string;
    meta: Partial<TextDocumentSpanMeta<T>>;
}

export interface TextDocumentSpanBidiRun<T extends ColorModel = ColorModel> extends TextDocumentSpan<T> {
    isFlipped: boolean;
}

export interface TextDocumentSpanMeta<T extends ColorModel = ColorModel> {
    direction: TextDirection;
    family: string;
    size: number;
    variant: string; // Determines the bold/italic/oblique display, if such font is available
    bold: boolean; // Manually modifies the font variant to make it thicker to simulate boldness
    oblique: boolean; // Manually modifies the font variant to make it slanted to simulate obliqueness
    obliqueAngle: number;
    underline: number | null; // Offset from default position if number, null is no underline
    underlineColor: T | null;
    underlineThickness: number;
    overline: number | null; // Offset from default position if number, null is no overline
    overlineColor: T | null;
    overlineThickness: number;
    strikethrough: number | null; // Offset from default position if number, null is no strikethrough
    strikethroughColor: T | null;
    strikethroughThickness: number;
    fillColor: T;
    stroke1Color: T;
    stroke1Size: number;
    stroke1IsBehind: boolean;
    stroke2Color: T;
    stroke2Size: number;
    stroke2IsBehind: boolean;
    tracking: number; // Offset to adjust the default kerning between letters
    leading: number; // Offset to adjust the default spacing between lines of text
}

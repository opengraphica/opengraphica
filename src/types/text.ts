import { ColorModel } from './color';

import type { Glyph } from 'opentype.js';

export interface RenderTextLineInfo {
    glyphs: RenderGlyphInfo[];
    heightAboveBaseline: number;
    heightBelowBaseline: number;
    largestCharacterWidth: number;
    lineSize: number;
}

export interface RenderGlyphInfo {
    glyph: Glyph;
    advance: number;
    fontSize: number;
    characterIndex: number;
}

export interface FontFamilyFetchDefinition  {
    family: string;
    variants: {
        [key: string]: {
            name: string;
            file: string;
        };
    };
}

export type TextDirection = 'ltr' | 'rtl' | 'ttb' | 'btt';
export type TextLineAlignment = 'start' | 'center' | 'end';

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

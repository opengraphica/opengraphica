/**
 * Drawable Text
 * 
 * This class renders text to a canvas based on the TextDocument object definition.
 * 
 * Since this is a drawable, it can possibly render in an offscreen background thread.
 * Care needs to be taken about which dependencies are imported here, as they will not be
 * shared with the main thread.
 */

import bidiFactory from 'bidi-js';
const bidi = bidiFactory()

import defaultFontFamilies from '@/config/default-font-families.json';
import { FontCache } from '@/lib/font-cache';
import { textMetaDefaults } from '@/lib/text-common';
import { loadFonts, calculateTextPlacement } from '@/lib/text-render';
import { getSubsets as getUnicodeSubsets } from '@/lib/unicode';

import type {
    Drawable, DrawableOptions, DrawableUpdateOptions, RenderTextLineInfo, RenderTextGlyphInfo,
    TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanMeta, TextDocumentSpanBidiRun,
} from '@/types';
import type { Glyph, Font } from 'opentype.js';

let fontCache!: FontCache;

export interface TextData {
    wrapSize?: number;
    document?: TextDocument;
    lines?: RenderTextLineInfo[];
    longestLineSize?: number;
}

export default class Text implements Drawable<TextData> {
    private needsUpdateCallback: (data: TextData) => void;

    private linesToDraw: RenderTextLineInfo[] = [];
    private longestLineSize: number = 0;

    constructor(options: DrawableOptions<TextData>) {
        this.needsUpdateCallback = options.needsUpdateCallback;

        if (options.data) this.update(options.data, { refresh: true });
    }

    update(data: TextData, { refresh }: DrawableUpdateOptions = {}) {
        let { wrapSize, document, lines, longestLineSize } = data;

        let left = 0;
        let top = 0;
        let right = 16;
        let bottom = 16;
        let lineDirectionSize = 0;
        let wrapDirectionSize = 0;

        if (lines) {
            this.linesToDraw = lines;
            this.longestLineSize = longestLineSize ?? 0;
        } else if (document) {
            loadFonts(document).then((hadUnloadedFont) => {
                if (hadUnloadedFont) {
                    this.needsUpdateCallback(data);
                }
            });

            wrapSize = wrapSize ?? 100;

            const textPlacementResult = calculateTextPlacement(document, { wrapSize });
            ({ left, right, top, bottom, lineDirectionSize, wrapDirectionSize } = textPlacementResult);
            this.linesToDraw = textPlacementResult.lines;
            this.longestLineSize = textPlacementResult.longestLineSize;
        }

        return {
            left,
            right,
            top,
            bottom,
            updateInfo: {
                lineDirectionSize,
                wrapDirectionSize, 
            },
        };
    }

    draw2d(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        let currentLineTop = 0;
        for (const line of this.linesToDraw) {
            let currentAdvance = 0;
            for (const { glyph, advance, fontSize, characterIndex } of line.glyphs) {
                glyph.draw(ctx, currentAdvance, currentLineTop + line.heightAboveBaseline, fontSize);
                currentAdvance += advance;
            }
            currentLineTop += line.heightAboveBaseline + line.heightBelowBaseline;
        }
    }

    drawWebgl() {
        // Pass
    }

    dispose() {
        // Pass
    }
}

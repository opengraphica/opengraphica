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
import { getUnloadedFontFamilies, loadFontFamilies, calculateTextPlacement } from '@/lib/text-render';
import { getSubsets as getUnicodeSubsets } from '@/lib/unicode';

import type {
    Drawable, DrawableOptions, DrawableUpdateOptions, RenderTextLineInfo, RenderTextGlyphInfo,
    TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanMeta, TextDocumentSpanBidiRun,
    CalculatedTextPlacement,
} from '@/types';

let fontCache!: FontCache;

export interface TextData {
    wrapSize?: number;
    document?: TextDocument;
    lines?: RenderTextLineInfo[];
    longestLineSize?: number;
}

export default class Text implements Drawable<TextData> {
    private needsUpdateCallback: (data: TextData) => void;

    private calculatedTextPlacement: CalculatedTextPlacement | null = null;

    constructor(options: DrawableOptions<TextData>) {
        this.needsUpdateCallback = options.needsUpdateCallback;

        if (options.data) this.update(options.data, { refresh: true });
    }

    update(data: TextData, { refresh }: DrawableUpdateOptions = {}) {
        let { wrapSize, document } = data;

        let left = 0;
        let top = 0;
        let right = 16;
        let bottom = 16;
        let lineDirectionSize = 0;
        let wrapDirectionSize = 0;
        let waitingToLoadFontFamilies: string[] = [];

        if (document) {
            waitingToLoadFontFamilies = getUnloadedFontFamilies(document);
            loadFontFamilies(waitingToLoadFontFamilies).then((hadUnloadedFont) => {
                if (hadUnloadedFont) {
                    this.needsUpdateCallback(data);
                }
            });

            wrapSize = wrapSize ?? 100;

            this.calculatedTextPlacement = calculateTextPlacement(document, { wrapSize });
            ({ left, right, top, bottom, lineDirectionSize, wrapDirectionSize } = this.calculatedTextPlacement);
        }

        return {
            left,
            right,
            top,
            bottom,
            updateInfo: {
                lineDirectionSize,
                wrapDirectionSize,
                waitingToLoadFontFamilies,
            },
        };
    }

    draw2d(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        if (!this.calculatedTextPlacement) return;
        const { lines, lineDirection } = this.calculatedTextPlacement;
        const isHorizontal = ['ltr', 'rtl'].includes(lineDirection);

        if (isHorizontal) {
            for (const line of lines) {
                for (const { glyph, meta, advanceOffset, drawOffset, fontSize } of line.glyphs) {
                    const path = glyph.getPath(
                        line.lineStartOffset + drawOffset.x + advanceOffset,
                        line.wrapOffset + drawOffset.y + line.heightAboveBaseline,
                        fontSize,
                        {},
                    );
                    path.fill = meta.fillColor?.style ?? textMetaDefaults.fillColor.style;
                    path.draw(ctx);
                }
            }
        } else {
            for (const line of lines) {
                for (const { glyph, meta, advanceOffset, drawOffset, characterWidth, fontSize } of line.glyphs) {
                    ctx.fillStyle = meta.fillColor?.style ?? textMetaDefaults.fillColor.style;
                    const path = glyph.getPath(
                        line.wrapOffset + drawOffset.x + (line.largestCharacterWidth / 2.0) - (characterWidth / 2.0),
                        line.lineStartOffset + drawOffset.y + advanceOffset,
                        fontSize,
                        {},
                    );
                    path.fill = meta.fillColor?.style ?? textMetaDefaults.fillColor.style;
                    path.draw(ctx);
                }
            }
        }
    }

    drawWebgl() {
        // Pass
    }

    dispose() {
        // Pass
    }
}

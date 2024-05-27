import bidiFactory from 'bidi-js';
const bidi = bidiFactory()

import { FontCache } from '@/lib/font-cache';
import { textMetaDefaults } from '@/lib/text-editor';

import type {
    Drawable, DrawableOptions, DrawableUpdateOptions, RenderTextLineInfo, RenderGlyphInfo,
    TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanMeta, TextDocumentSpanBidiRun,
} from '@/types';
import type { Glyph, Font } from 'opentype.js';

let fontCache!: FontCache;

export interface TextData {
    wrapSize?: number;
    document?: TextDocument;
}

export default class Text implements Drawable<TextData> {
    private isInWorker: boolean = false;
    private needsUpdateCallback: (data: TextData) => void;

    private linesToDraw: RenderTextLineInfo[] = [];
    private longestLineSize: number = 0;

    constructor(options: DrawableOptions<TextData>) {
        this.isInWorker = options.isInWorker;
        this.needsUpdateCallback = options.needsUpdateCallback;

        if (!fontCache) {
            fontCache = new FontCache({
                fetchBaseUrl: this.isInWorker ? '../../' : ''
            });
        }

        if (options.data) this.update(options.data, { refresh: true });
    }

    private async loadFonts(document: TextDocument): Promise<boolean> {
        const fontFamilies = new Set<string>();
        fontFamilies.add(textMetaDefaults.family);
        for (const line of document.lines) {
            for (const span of line.spans) {
                if (span.meta.family) {
                    fontFamilies.add(span.meta.family);
                }
            }
        }
        let hasUnloadedFont = false;
        let loadFontPromises: Promise<unknown>[] = [];
        for (const family of Array.from(fontFamilies)) {
            if (!(await fontCache.isFontFamilyLoaded(family))) {
                hasUnloadedFont = true;
                loadFontPromises.push(
                    fontCache.loadFontFamily(family)
                );
            }
        }
        await Promise.allSettled(loadFontPromises);
        return hasUnloadedFont;
    }

    private getSpanFont(meta: Partial<TextDocumentSpanMeta>): Font | null {
        const fontFamily = fontCache.getFontFamily(meta.family ?? textMetaDefaults.family);
        return fontFamily?.variants[meta.variant ?? textMetaDefaults.variant] ?? null;
    }

    private getSpanBidiRuns(characterStartIndex: number, span: TextDocumentSpan, flips: Array<[number, number]>): TextDocumentSpanBidiRun[] {
        if (flips.length === 0) {
            return [{
                isFlipped: false,
                text: span.text,
                meta: span.meta,
            }]
        }

        const characterEndIndex = characterStartIndex + span.text.length;
        const bidiRuns: TextDocumentSpanBidiRun[] = [];

        const applicableFlips = flips.filter((flip) => {
            const [start, end] = flip;
            return end > characterStartIndex && start < characterEndIndex;
        });

        let characterIndex = characterStartIndex;
        for (let [flipIndex, [start, end]] of applicableFlips.entries()) {
            start = Math.max(start, characterStartIndex);
            end = Math.min(end, characterEndIndex);

            if (characterIndex < start) {
                bidiRuns.push({
                    isFlipped: false,
                    text: span.text.slice(characterIndex, start - characterStartIndex),
                    meta: span.meta,
                });
                characterIndex = start;
            }
            if (characterIndex >= start && characterIndex < end) {
                bidiRuns.push({
                    isFlipped: true,
                    text: span.text.slice(start - characterStartIndex, end - characterStartIndex),
                    meta: span.meta,
                });
                characterIndex = end;
            }
            if (flipIndex == applicableFlips.length - 1 && characterIndex < characterEndIndex) {
                bidiRuns.push({
                    isFlipped: false,
                    text: span.text.slice(characterIndex, characterEndIndex),
                    meta: span.meta,
                });
                characterIndex = characterEndIndex;
            }
        }

        return bidiRuns;
    }

    private getAdvanceWidth(text: string, font: Font, size: number, scale: number, isHorizontal: boolean) {
        let advanceWidth = 0;
        if (isHorizontal) {
            advanceWidth = font.getAdvanceWidth(text, size);
        } else {
            for (const character of text) {
                const glyph = font.charToGlyph(character);
                if (glyph) {
                    const bbox = glyph.getBoundingBox();
                    advanceWidth += (bbox.y2 - bbox.y1) * scale;
                }
            }
        }
        return advanceWidth;
    }

    private getLineText(line: TextDocumentLine) {
        let lineText = '';
		for (let i = 0; i < line.spans.length; i++) {
			lineText += line.spans[i].text;
		}
		return lineText;
    }

    update(data: TextData, { refresh }: DrawableUpdateOptions = {}) {
        let { wrapSize, document } = data;

        let left = 0;
        let top = 0;
        let right = 16;
        let bottom = 16;

        if (document) {
            this.loadFonts(document).then((hadUnloadedFont) => {
                if (hadUnloadedFont) {
                    this.needsUpdateCallback(data);
                }
            });

            wrapSize = wrapSize ?? 100;

            let isHorizontal = ['ltr', 'rtl'].includes(document.lineDirection);

            // Determine line wrapping based on boundary box.
            let wrappedLines = document.lines;
            if (document.boundary === 'box') {
                wrappedLines = [];
                let currentLineSpans: TextDocumentSpan[] = [];
                let currentLineSize = 0;
                for (const line of document.lines) {
                    for (const span of line.spans) {
                        const font = this.getSpanFont(span.meta);
                        if (!font) continue;
                        const unitsPerEm = font.unitsPerEm;
                        const size = span.meta.size ?? textMetaDefaults.size;
                        const glyphScale = size / unitsPerEm;

                        const spanAdvanceWidth = this.getAdvanceWidth(span.text, font, size, glyphScale, isHorizontal);

                        // The whole span fits in the line. Easy path.
                        if (currentLineSize + spanAdvanceWidth < wrapSize) {
                            currentLineSpans.push(span);
                            currentLineSize += spanAdvanceWidth;
                        } else {
                            // Need to determine which words in the span will fit in the line.
                            let words = span.text.split(' ');
                            while (words.length > 0) {
                                let fittedWords: string[] = [];
                                let fittedWordAdvanceWidth = 0;
                                let currentWordAdvanceWidth = 0;
                                for (const [wordIndex, word] of words.entries()) {
                                    currentWordAdvanceWidth = this.getAdvanceWidth((wordIndex > 0 ? ' ': '') + word, font, size, glyphScale, isHorizontal);
                                    if (currentLineSize + fittedWordAdvanceWidth + currentWordAdvanceWidth < wrapSize) {
                                        fittedWords.push(word);
                                        fittedWordAdvanceWidth += currentWordAdvanceWidth;
                                        currentWordAdvanceWidth = 0;
                                    } else {
                                        break;
                                    }
                                }

                                // Not all words fit in the line.
                                if (currentLineSize + fittedWordAdvanceWidth + currentWordAdvanceWidth > wrapSize) {
                                    // If wrapping only per-word, make a new line.
                                    if (document.wrapAt === 'word') {
                                        if (currentLineSize === 0 && fittedWords.length === 0) {
                                            fittedWords.push(words[0]);
                                        }
                                        if (fittedWords.length > 0) {
                                            currentLineSpans.push({
                                                text: fittedWords.join(' '),
                                                meta: span.meta,
                                            });
                                        }
                                        wrappedLines.push({
                                            alignment: line.alignment,
                                            direction: line.direction,
                                            spans: currentLineSpans,
                                        });
                                        currentLineSpans = [];
                                        currentLineSize = 0;
                                        words = words.slice(fittedWords.length);
                                    } else if (document.wrapAt === 'wordThenLetter') {
                                        // Add words that fit to the line.
                                        if (fittedWords.length > 0) {
                                            currentLineSpans.push({
                                                text: fittedWords.join(' '),
                                                meta: span.meta,
                                            });
                                            currentLineSize += fittedWordAdvanceWidth;
                                        }
                                        words = words.slice(fittedWords.length);
                                        if (words.length === 0) break;

                                        // Need to determine which characters will fit in the line.
                                        let characters = words[0].split('');
                                        while (characters.length > 0) {
                                            let fittedCharacters: string = '';
                                            let fittedCharacterAdvanceWidth = 0;
                                            let checkCharacterAdvanceWidth = 0;
                                            for (const character of characters) {
                                                checkCharacterAdvanceWidth = this.getAdvanceWidth(fittedCharacters + character, font, size, glyphScale, isHorizontal);
                                                if (currentLineSize + checkCharacterAdvanceWidth < wrapSize) {
                                                    fittedCharacters += character;
                                                    fittedCharacterAdvanceWidth = checkCharacterAdvanceWidth;
                                                } else {
                                                    break;
                                                }
                                            }
                                            // Not all characters fit in the line. Create a new line.
                                            if (currentLineSize + checkCharacterAdvanceWidth > wrapSize) {
                                                if (currentLineSize === 0 && fittedCharacters.length === 0) {
                                                    fittedCharacters = characters[0];
                                                }
                                                if (fittedCharacters.length > 0) {
                                                    currentLineSpans.push({
                                                        text: fittedCharacters,
                                                        meta: span.meta,
                                                    });
                                                }
                                                wrappedLines.push({
                                                    alignment: line.alignment,
                                                    direction: line.direction,
                                                    spans: currentLineSpans,
                                                });
                                                currentLineSpans = [];
                                                currentLineSize = 0;
                                                characters = characters.slice(fittedCharacters.length);
                                            } else {
                                                // All characters fit in the current line. Add them.
                                                currentLineSpans.push({
                                                    text: fittedCharacters,
                                                    meta: span.meta,
                                                });
                                                characters = [];
                                                currentLineSize += checkCharacterAdvanceWidth;
                                            }
                                        }
                                    } else {
                                        break;
                                    }
                                } else {
                                    // All words fit in the current line. Add them.
                                    currentLineSpans.push({
                                        text: fittedWords.join(' '),
                                        meta: span.meta,
                                    });
                                    words = [];
                                    currentLineSize += fittedWordAdvanceWidth + currentWordAdvanceWidth;
                                }
                            }
                        }
                    }
                }
            }

            this.linesToDraw = [];
            this.longestLineSize = 0;

            // Determine the layout of each line.
            for (const line of wrappedLines) {
                const lineInfo: RenderTextLineInfo = {
                    glyphs: [],
                    heightAboveBaseline: 0,
                    heightBelowBaseline: 0,
                    largestCharacterWidth: 0,
                    lineSize: 0,
                };

                const lineText = this.getLineText(line);
                const lineDirection = (line.direction ?? document.lineDirection === 'rtl') ? 'rtl' : 'ltr';
                const embeddingLevels = bidi.getEmbeddingLevels(lineText, lineDirection);
                const flips = bidi.getReorderSegments(lineText, embeddingLevels);
                

                let lineCharacterIndex = 0;
                let workingFlippedRun: RenderGlyphInfo[] = [];
                for (const span of line.spans) {
                    // Get current font family.
                    const fontFamily = fontCache.getFontFamily(span.meta.family ?? textMetaDefaults.family);
                    const font = fontFamily?.variants[span.meta.variant ?? textMetaDefaults.variant];
                    if (!font) {
                        lineCharacterIndex += span.text.length;
                        continue;
                    }
                    const unitsPerEm = font.unitsPerEm;
                    const size = span.meta.size ?? textMetaDefaults.size;
                    const glyphScale = size / unitsPerEm;

                    // Calculate the placement for each bidirectional run.
                    const bidiRuns = this.getSpanBidiRuns(lineCharacterIndex, span, flips);
                    let bidiRunCharacterIndex = lineCharacterIndex;
                    for (const bidiRun of bidiRuns) {
                        // If switching from flipped to non-flipped run, add the glyphs from the previous flipped run to the line.
                        if (!bidiRun.isFlipped && workingFlippedRun.length > 0) {
                            for (let glyphInfo of workingFlippedRun) {
                                lineInfo.glyphs.push(glyphInfo);
                            }
                            workingFlippedRun = [];
                        }

                        // Replace mirrored charactrs
                        let bidiRunText = bidiRun.text;
                        if (bidiRun.isFlipped) {
                            const mirrors = bidi.getMirroredCharactersMap(bidiRunText, embeddingLevels, bidiRunCharacterIndex, bidiRunCharacterIndex + bidiRunText.length);
                            for (const [mirrorIndex, mirrorCharacter] of mirrors.entries()) {
                                bidiRunText = bidiRunText.slice(0, mirrorIndex) + mirrorCharacter + bidiRunText.slice(mirrorIndex + 1);
                            }
                        }

                        // Convert characters to glyphs
                        const glyphs = font.stringToGlyphs(bidiRunText);
                        let originalTextCharacterIndex = 0;
                        for (const glyph of glyphs) {
                            const unicodes = glyph.unicodes;
                            for (; originalTextCharacterIndex < bidiRunText.length; originalTextCharacterIndex++) {
                                if (unicodes.includes(bidiRunText.charCodeAt(originalTextCharacterIndex))) break;
                            }

                            const glyphMetrics = glyph.getMetrics();
                            const glyphInfo: RenderGlyphInfo = {
                                glyph: glyph,
                                advance: (glyph.advanceWidth ?? 0) * glyphScale,
                                fontSize: size,
                                characterIndex: bidiRunCharacterIndex + originalTextCharacterIndex,
                            };
                            if (isHorizontal) {
                                lineInfo.lineSize += glyphInfo.advance;
                            } else {
                                const characterWidth = Math.abs(glyphMetrics.xMax - glyphMetrics.xMin);
                                if (characterWidth > lineInfo.largestCharacterWidth) {
                                    lineInfo.largestCharacterWidth = characterWidth;
                                }
                                lineInfo.lineSize += Math.abs(glyphMetrics.yMax - glyphMetrics.yMin);
                            }
                            const yMax = glyphMetrics.yMax * glyphScale;
                            const yMin = glyphMetrics.yMin * glyphScale;
                            if (lineInfo.heightAboveBaseline < yMax) {
                                lineInfo.heightAboveBaseline = yMax;
                            }
                            if (lineInfo.heightBelowBaseline < -yMin) {
                                lineInfo.heightBelowBaseline = -yMin;
                            }
                            if (bidiRun.isFlipped) {
                                workingFlippedRun.unshift(glyphInfo);
                            } else {
                                lineInfo.glyphs.push(glyphInfo);
                            }

                            if (unicodes.length > 0) {
                                originalTextCharacterIndex++;
                            }
                        }

                        bidiRunCharacterIndex += bidiRun.text.length;
                    }

                    lineCharacterIndex += span.text.length;
                }

                // Add final flipped run to line.
                if (workingFlippedRun.length > 0) {
                    for (let glyphInfo of workingFlippedRun) {
                        lineInfo.glyphs.push(glyphInfo);
                    }
                    workingFlippedRun = [];
                }

                // Add line to list of lines.
                if (lineInfo.lineSize > this.longestLineSize) {
                    this.longestLineSize = lineInfo.lineSize;
                }
                this.linesToDraw.push(lineInfo);
            }

            // Calculate draw bounds.
            if (isHorizontal) {
                right = this.longestLineSize; // TODO - this doesn't account for character overhang past advance width
                bottom = this.linesToDraw.reduce((previous, current) => {
                    return previous + current.heightAboveBaseline + current.heightBelowBaseline;
                }, 0);
            } else {
                right = this.linesToDraw.reduce((previous, current) => {
                    return previous + current.largestCharacterWidth;
                }, 0);
                bottom = this.longestLineSize;
            }
        }

        return {
            left,
            right,
            top,
            bottom,
        };
    }

    draw2d(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        let currentLineTop = 0;
        for (const line of this.linesToDraw) {
            let currentAdvance = 0;
            for (const { glyph, advance, fontSize } of line.glyphs) {
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

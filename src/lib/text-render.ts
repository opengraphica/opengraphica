import bidiFactory from 'bidi-js';
import fontCache from './font-cache';
import defaultFontFamilies from '@/config/default-font-families.json';
import { getSubsets as getUnicodeSubsets } from './unicode';
import { textMetaDefaults } from './text-common';

import type {
    TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanBidiRun, TextDocumentSpanMeta,
    RenderTextLineInfo, RenderTextGlyphInfo,
} from '@/types';
import type { Font, Glyph } from 'opentype.js';

const bidi = bidiFactory();

export async function loadFonts(document: TextDocument): Promise<boolean> {
    const fontFamilies = new Set<string>();
    fontFamilies.add(textMetaDefaults.family);
    const subsets = new Set<string>();
    for (const line of document.lines) {
        for (const span of line.spans) {
            for (const subset of getUnicodeSubsets(span.text)) {
                subsets.add(subset);
            }
            if (span.meta.family) {
                fontFamilies.add(span.meta.family);
            }
        }
    }
    for (const subset of subsets) {
        for (const defaultFontFamily of defaultFontFamilies) {
            if (defaultFontFamily.family.startsWith("Noto Sans") && defaultFontFamily.subsets.includes(subset)) {
                fontFamilies.add(defaultFontFamily.family);
                break;
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

export function splitSpanByAvailableFonts(span: TextDocumentSpan): Array<[Font | null, TextDocumentSpan]> {
    const userSelectedFontFamily = fontCache.getFontFamily(span.meta.family ?? textMetaDefaults.family);
    const preferredVariant = span.meta.variant ?? textMetaDefaults.variant;
    const userSelectedFont = userSelectedFontFamily?.variants[preferredVariant] ?? null;
    const userSelectedFontSubsets = userSelectedFontFamily?.subsets ?? [];
    const fontSplits: Array<[Font | null, TextDocumentSpan]> = [];
    let previousSelectedFont: Font | null = userSelectedFont;
    let currentFontSplitText = '';
    for (const character of span.text) {
        const characterSubsets = getUnicodeSubsets(character);
        let selectedFont = userSelectedFont;
        if (characterSubsets.length > 0 && !userSelectedFontSubsets.includes(characterSubsets[0])) {
            for (const characterSubset of characterSubsets) {
                const fallbackFontFamily = fontCache.getFallbackFontFamilyThatSatisfiesSubset(characterSubset);
                if (fallbackFontFamily) {
                    selectedFont = fallbackFontFamily.variants[preferredVariant] ?? fallbackFontFamily.variants['regular'] ?? fallbackFontFamily.variants[0];
                    break;
                }
            }
        }
        if (selectedFont != previousSelectedFont && currentFontSplitText.length > 0) {
            fontSplits.push([previousSelectedFont, {
                text: currentFontSplitText,
                meta: span.meta,
            }]);
            currentFontSplitText = '';
        }
        currentFontSplitText += character;
        previousSelectedFont = selectedFont;
    }
    if (currentFontSplitText.length > 0) {
        fontSplits.push([previousSelectedFont, {
            text: currentFontSplitText,
            meta: span.meta,
        }]);
    }
    return fontSplits;
}

export function getSpanBidiRuns(characterStartIndex: number, span: TextDocumentSpan, flips: Array<[number, number]>): TextDocumentSpanBidiRun[] {
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

    if (applicableFlips.length === 0) {
        bidiRuns.push({
            isFlipped: false,
            text: span.text,
            meta: span.meta,
        })
        return bidiRuns;
    }

    let characterIndex = characterStartIndex;
    for (let [flipIndex, [start, end]] of applicableFlips.entries()) {
        start = Math.max(start, characterStartIndex);
        end = Math.min(end, characterEndIndex);

        if (characterIndex < start) {
            bidiRuns.push({
                isFlipped: false,
                text: span.text.slice(0, start - characterStartIndex),
                meta: span.meta,
            });
            characterIndex = start;
        }
        if (characterIndex >= start && characterIndex < end + 1) {
            bidiRuns.push({
                isFlipped: true,
                text: span.text.slice(start - characterStartIndex, end + 1 - characterStartIndex),
                meta: span.meta,
            });
            characterIndex = end + 1;
        }
        if (flipIndex == applicableFlips.length - 1 && characterIndex < characterEndIndex) {
            bidiRuns.push({
                isFlipped: false,
                text: span.text.slice(characterIndex - characterStartIndex, characterEndIndex - characterStartIndex),
                meta: span.meta,
            });
            characterIndex = characterEndIndex;
        }
    }

    return bidiRuns;
}

export function getAdvanceWidth(text: string, font: Font, size: number, scale: number, isHorizontal: boolean) {
    let advanceWidth = 0;
    if (isHorizontal) {
        advanceWidth = font.getAdvanceWidth(text, size);
    } else {
        for (const character of text) {
            const glyph: Glyph = font.charToGlyph(character);
            if (glyph) {
                const bbox = glyph.getBoundingBox();
                advanceWidth += (bbox.y2 - bbox.y1) * scale;
            }
        }
    }
    return advanceWidth;
}

export function getLineText(line: TextDocumentLine) {
    let lineText = '';
    for (let i = 0; i < line.spans.length; i++) {
        lineText += line.spans[i].text;
    }
    return lineText;
}

export interface CalculateTextPlacementOptions {
    wrapSize?: number;
}

export function calculateTextPlacement(document: TextDocument, options: CalculateTextPlacementOptions = {}) {
    let { wrapSize } = options;
    wrapSize = wrapSize ?? 0;
    let isHorizontal = ['ltr', 'rtl'].includes(document.lineDirection);

    // Determine line wrapping based on boundary box.
    let wrappedLines = document.lines;
    if (document.boundary === 'box') {
        wrappedLines = [];
        let currentLineSpans: TextDocumentSpan[] = [];
        let currentLineSize = 0;
        for (const line of document.lines) {
            for (const fullSpan of line.spans) {
                const spanFontSplits = splitSpanByAvailableFonts(fullSpan);
                for (const [font, span] of spanFontSplits) {

                    if (!font) continue;
                    const unitsPerEm = font.unitsPerEm;
                    const size = span.meta.size ?? textMetaDefaults.size;
                    const glyphScale = size / unitsPerEm;

                    const spanAdvanceWidth = getAdvanceWidth(span.text, font, size, glyphScale, isHorizontal);

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
                                currentWordAdvanceWidth = getAdvanceWidth((wordIndex > 0 ? ' ': '') + word, font, size, glyphScale, isHorizontal);
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
                                            checkCharacterAdvanceWidth = getAdvanceWidth(fittedCharacters + character, font, size, glyphScale, isHorizontal);
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
    }

    const linesToDraw: RenderTextLineInfo[] = [];
    let longestLineSize = 0;

    // Determine the layout of each line.
    for (const line of wrappedLines) {
        const lineInfo: RenderTextLineInfo = {
            glyphs: [],
            heightAboveBaseline: 0,
            heightBelowBaseline: 0,
            largestCharacterWidth: 0,
            lineSize: 0,
        };

        const lineText = getLineText(line);
        const lineDirection = (line.direction ?? document.lineDirection === 'rtl') ? 'rtl' : 'ltr';
        const embeddingLevels = bidi.getEmbeddingLevels(lineText, lineDirection);
        const flips = bidi.getReorderSegments(lineText, embeddingLevels);

        let lineCharacterIndex = 0;
        let workingFlippedRun: RenderTextGlyphInfo[] = [];
        for (const fullSpan of line.spans) {
            const spanFontSplits = splitSpanByAvailableFonts(fullSpan);
            for (const [font, span] of spanFontSplits) {

                // Abort if no font.
                if (!font) {
                    lineCharacterIndex += span.text.length;
                    continue;
                }
                const unitsPerEm = font.unitsPerEm;
                const size = span.meta.size ?? textMetaDefaults.size;
                const glyphScale = size / unitsPerEm;

                const fontYMax = font.ascender * glyphScale;
                const fontYMin = font.descender * glyphScale;
                if (lineInfo.heightAboveBaseline < fontYMax) {
                    lineInfo.heightAboveBaseline = fontYMax;
                }
                if (lineInfo.heightBelowBaseline < -fontYMin) {
                    lineInfo.heightBelowBaseline = -fontYMin;
                }

                // Calculate the placement for each bidirectional run.
                const bidiRuns = getSpanBidiRuns(lineCharacterIndex, span, flips);
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
                        const glyphInfo: RenderTextGlyphInfo = {
                            glyph: glyph,
                            advance: (glyph.advanceWidth ?? 0) * glyphScale,
                            fontSize: size,
                            fontAscender: font.ascender * glyphScale,
                            fontDescender: font.descender * glyphScale,
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
                        if (bidiRun.isFlipped) {
                            workingFlippedRun.push(glyphInfo);
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
        }

        // Add final flipped run to line.
        if (workingFlippedRun.length > 0) {
            for (let glyphInfo of workingFlippedRun) {
                lineInfo.glyphs.push(glyphInfo);
            }
            workingFlippedRun = [];
        }

        // Add line to list of lines.
        if (lineInfo.lineSize > longestLineSize) {
            longestLineSize = lineInfo.lineSize;
        }
        linesToDraw.push(lineInfo);
    }

    // Calculate draw bounds.
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let lineDirectionSize = longestLineSize;
    let wrapDirectionSize = 0;
    if (isHorizontal) {
        wrapDirectionSize = linesToDraw.reduce((previous, current) => {
            return previous + current.heightAboveBaseline + current.heightBelowBaseline;
        }, 0);
        right = lineDirectionSize; // TODO - this doesn't account for character overhang past advance width
        bottom = wrapDirectionSize;
    } else {
        wrapDirectionSize = linesToDraw.reduce((previous, current) => {
            return previous + current.largestCharacterWidth;
        }, 0);
        right = wrapDirectionSize;
        bottom = lineDirectionSize;
    }

    return {
        lines: linesToDraw,
        longestLineSize,
        lineDirectionSize,
        wrapDirectionSize,
        left,
        right,
        top,
        bottom,
    };
}

import bidiFactory from 'bidi-js';
import fontCache from './font-cache';
import defaultFontFamilies from '@/config/default-font-families.json';
import { getSubsets as getUnicodeSubsets } from './unicode';
import { textMetaDefaults } from './text-common';

import type {
    TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanBidiRun, TextDocumentSpanMeta,
    RenderTextLineInfo, RenderTextGlyphInfo, CalculatedTextPlacement,
} from '@/types';
import type { Font, Glyph } from '@/lib/opentype.js';

const bidi = bidiFactory();

export function getUnloadedFontFamilies(document: TextDocument): string[] {
    const fontFamilies = new Set<string>();
    fontFamilies.add(textMetaDefaults.family);
    const subsets = new Set<string>();
    for (const line of document.lines) {
        for (const span of line.spans) {
            for (const subset of getUnicodeSubsets(span.text, true)) {
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
    for (const fontFamily of Array.from(fontFamilies)) {
        if (fontCache.isFontFamilyLoaded(fontFamily)) {
            fontFamilies.delete(fontFamily);
        }
    }
    return Array.from(fontFamilies);
}

export async function loadFontFamilies(unloadedFontFamilies: string[]): Promise<boolean> {
    let hadUnloadedFont = false;
    let loadFontPromises: Promise<unknown>[] = [];
    for (const family of unloadedFontFamilies) {
        if (!fontCache.isFontFamilyLoaded(family)) {
            hadUnloadedFont = true;
        }
        if (!(await fontCache.waitForFontFamilyLoaded(family))) {
            loadFontPromises.push(
                fontCache.loadFontFamily(family)
            );
        }
    }
    await Promise.allSettled(loadFontPromises);
    return hadUnloadedFont;
}

export function splitSpanByAvailableFonts(span: TextDocumentSpan, emptyCharacter: string | null = null): Array<[Font | null, TextDocumentSpan]> {
    const userSelectedFontFamily = fontCache.getFontFamily(span.meta.family ?? textMetaDefaults.family);
    const preferredVariant = span.meta.variant ?? textMetaDefaults.variant;
    const userSelectedFont = userSelectedFontFamily?.variants[preferredVariant] ?? null;
    const userSelectedFontSubsets = userSelectedFontFamily?.subsets ?? [];
    const fontSplits: Array<[Font | null, TextDocumentSpan]> = [];
    let previousSelectedFont: Font | null = userSelectedFont;
    let currentFontSplitText = '';
    for (const character of span.text) {
        const characterSubsets = getUnicodeSubsets(character, false);
        let selectedFont = userSelectedFont;
        let subsetExistsInUserSelectedFontSubsets = false;
        for (const checkSubset of characterSubsets) {
            if (userSelectedFontSubsets.includes(checkSubset)) {
                subsetExistsInUserSelectedFontSubsets = true;
                break;
            }
        }
        if (characterSubsets.length > 0 && !subsetExistsInUserSelectedFontSubsets) {
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
    if (currentFontSplitText.length > 0 || emptyCharacter != null) {
        fontSplits.push([previousSelectedFont, {
            text: currentFontSplitText.length > 0 ? currentFontSplitText : emptyCharacter as string,
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
                if (glyph.advanceHeight != null) {
                    advanceWidth += glyph.advanceHeight * scale;
                } else {
                    // TODO - this isn't accurate
                    const bbox = glyph.getBoundingBox();
                    advanceWidth += (bbox.y2 - bbox.y1) * scale;
                }
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

export function calculateTextPlacement(document: TextDocument, options: CalculateTextPlacementOptions = {}): CalculatedTextPlacement {
    let { wrapSize } = options;
    wrapSize = wrapSize ?? 0;
    let isHorizontal = ['ltr', 'rtl'].includes(document.lineDirection);

    // Determine line wrapping based on boundary box.
    let documentLines = document.lines;
    const isEmptyDocument = documentLines.length === 1 && documentLines[0].spans.length === 1 && documentLines[0].spans[0].text === '';
    if (isEmptyDocument) {
        documentLines = JSON.parse(JSON.stringify(documentLines));
        documentLines[0].spans[0].text = ' ';
    }
    let wrappedLines = documentLines;
    let originalLineIndices: number[] = [];
    if (document.boundary === 'box') {
        wrappedLines = [];
        let currentLineSpans: TextDocumentSpan[] = [];
        let currentLineSize = 0;
        let lastUsedFont: Font | null = null;
        for (const [lineIndex, line] of documentLines.entries()) {
            currentLineSpans = [];
            currentLineSize = 0;

            for (const fullSpan of line.spans) {
                let spanFontSplits = splitSpanByAvailableFonts(fullSpan);
                if (spanFontSplits.length === 0) {
                    spanFontSplits = [[lastUsedFont, {
                        text: ' ',
                        meta: fullSpan.meta,
                    }]];
                }
                for (const [font, span] of spanFontSplits) {

                    if (!font) {
                        continue;
                    }
                    lastUsedFont = font;
                    const unitsPerEm = font.unitsPerEm;
                    const size = span.meta.size ?? textMetaDefaults.size;
                    const glyphScale = size / unitsPerEm;

                    const spanAdvanceWidth = getAdvanceWidth(span.text, font, size, glyphScale, isHorizontal);

                    // The whole span fits in the line. Easy path.
                    if (currentLineSize + spanAdvanceWidth <= wrapSize) {
                        currentLineSpans.push(span);
                        currentLineSize += spanAdvanceWidth;
                    } else {
                        // Need to determine which words in the span will fit in the line.
                        let words = span.text.split(' ');
                        let maxWordIterations = 0;
                        while (words.length > 0 && maxWordIterations < 1000) {
                            maxWordIterations++;
                            let fittedWords: string[] = [];
                            let fittedWordAdvanceWidth = 0;
                            let currentWordAdvanceWidth = 0;
                            for (const [wordIndex, word] of words.entries()) {
                                currentWordAdvanceWidth = getAdvanceWidth((wordIndex > 0 ? ' ': '') + word, font, size, glyphScale, isHorizontal);
                                if (currentLineSize + fittedWordAdvanceWidth + currentWordAdvanceWidth <= wrapSize) {
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
                                if (document.wrapAt === 'word' || fittedWords.length > 0 || currentLineSize > 0) {
                                    if (currentLineSize === 0 && fittedWords.length === 0 && words[0].length > 0) {
                                        fittedWords.push(words[0]);
                                    }
                                    if (fittedWords.length > 0) {
                                        currentLineSpans.push({
                                            text: fittedWords.join(' ') + (fittedWords.length !== words.length ? ' ' : ''),
                                            meta: span.meta,
                                        });
                                    }
                                    originalLineIndices.push(lineIndex);
                                    if (currentLineSpans.length > 0) {
                                        wrappedLines.push({
                                            alignment: line.alignment,
                                            direction: line.direction,
                                            spans: currentLineSpans,
                                        });
                                    }
                                    currentLineSpans = [];
                                    currentLineSize = 0;
                                    words = words.slice(fittedWords.length);
                                } else if (document.wrapAt === 'wordThenLetter') {
                                    if (words.length === 0) break;

                                    // Need to determine which characters will fit in the line.
                                    let characters = words[0].split('');
                                    words.shift();
                                    let maxCharacterIterations = 0;
                                    while (characters.length > 0 && maxCharacterIterations < 1000) {
                                        maxCharacterIterations++;
                                        let fittedCharacters: string = '';
                                        let checkCharacterAdvanceWidth = 0;
                                        for (const character of characters) {
                                            checkCharacterAdvanceWidth = getAdvanceWidth(fittedCharacters + character, font, size, glyphScale, isHorizontal);
                                            if (currentLineSize + checkCharacterAdvanceWidth <= wrapSize) {
                                                fittedCharacters += character;
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
                                            originalLineIndices.push(lineIndex);
                                            if (currentLineSpans.length > 0) {
                                                wrappedLines.push({
                                                    alignment: line.alignment,
                                                    direction: line.direction,
                                                    spans: currentLineSpans,
                                                });
                                            }
                                            currentLineSpans = [];
                                            currentLineSize = 0;
                                            characters = characters.slice(fittedCharacters.length);
                                        } else {
                                            // All characters fit in the current line. Add them.
                                            let endingSpace = (fittedWords.length !== words.length ? ' ' : '');
                                            let endingSpaceAdvanceWidth = getAdvanceWidth(endingSpace, font, size, glyphScale, isHorizontal);
                                            if (fittedCharacters.length > 0) {
                                                currentLineSpans.push({
                                                    text: fittedCharacters + endingSpace,
                                                    meta: span.meta,
                                                });
                                            }
                                            characters = [];
                                            currentLineSize += checkCharacterAdvanceWidth + endingSpaceAdvanceWidth;
                                        }
                                    }
                                } else {
                                    break;
                                }
                            } else {
                                // All words fit in the current line. Add them.
                                if (fittedWords.length > 0) {
                                    currentLineSpans.push({
                                        text: fittedWords.join(' '),
                                        meta: span.meta,
                                    });
                                }
                                words = [];
                                currentLineSize += fittedWordAdvanceWidth + currentWordAdvanceWidth;
                            }
                        }
                    }
                }
            }
            if (currentLineSpans.length > 0) {
                originalLineIndices.push(lineIndex);
                wrappedLines.push({
                    alignment: line.alignment,
                    direction: line.direction,
                    spans: currentLineSpans,
                });
                currentLineSpans = [];
                currentLineSize = 0;
            }
        }
    }

    const linesToDraw: RenderTextLineInfo[] = [];
    let longestLineSize = 0;

    // Determine the layout of each line.
    let runningWrapOffset = 0;
    let lastHeightAboveBaseline = 0;
    let lastHeightBelowBaseline = 0;
    let runningWrapCharacterIndex = 0;
    let previousDocumentLineIndex = -1;
    for (const [lineIndex, line] of wrappedLines.entries()) {
        const lineInfo: RenderTextLineInfo = {
            glyphs: [],
            heightAboveBaseline: 0,
            heightBelowBaseline: 0,
            largestCharacterWidth: 0,
            lineAlignment: line.alignment ?? document.lineAlignment,
            lineSize: 0,
            lineStartOffset: 0,
            wrapOffset: runningWrapOffset,
            bearingOffset: new DOMPoint(),
            documentLineIndex: originalLineIndices[lineIndex] ?? lineIndex,
        };

        const lineText = getLineText(line);
        const isEmptyLine = lineText === '';
        const lineDirection = (line.direction ?? document.lineDirection === 'rtl') ? 'rtl' : 'ltr';
        const embeddingLevels = bidi.getEmbeddingLevels(lineText, lineDirection);
        const flips = bidi.getReorderSegments(lineText, embeddingLevels);

        let lineCharacterIndex = 0;
        let runningAdvanceOffset = 0;
        let isDrawCompensatingForAdvanceHeight = false;
        let wasDrawCompensatingForAdvanceHeight = false;
        let lineDrawXOffset = 0;
        let lineDrawYOffset = 0;
        let previousGlyphInfo: RenderTextGlyphInfo | null = null;
        
        // let workingFlippedRun: RenderTextGlyphInfo[] = [];
        for (const fullSpan of line.spans) {
            const spanFontSplits = splitSpanByAvailableFonts(fullSpan, isEmptyLine ? (isHorizontal ? '​' : ' ') : null);
            for (const [font, span] of spanFontSplits) {

                // Abort if no font.
                if (!font) {
                    lineCharacterIndex += span.text.length;
                    continue;
                }

                const unitsPerEm = font.unitsPerEm;
                const size = span.meta.size ?? textMetaDefaults.size;
                const glyphScale = size / unitsPerEm;
                const hGlyph = font.charToGlyph('H');
                const capHeight = font.tables?.os2?.sCapHeight 
                    ? font.tables.os2.sCapHeight + (unitsPerEm / size) * 2
                    : hGlyph.yMax
                        ? hGlyph.yMax + (unitsPerEm / size) * 2
                        : font.ascender;

                const fontYMax = font.ascender * glyphScale;
                const fontYMin = font.descender * glyphScale;
                if (lineInfo.heightAboveBaseline < fontYMax) {
                    lineInfo.heightAboveBaseline = fontYMax;
                    lastHeightAboveBaseline = lineInfo.heightAboveBaseline;
                }
                if (lineInfo.heightBelowBaseline < -fontYMin) {
                    lineInfo.heightBelowBaseline = -fontYMin;
                    lastHeightBelowBaseline = lineInfo.heightBelowBaseline;
                }

                // Calculate the placement for each bidirectional run.
                const bidiRuns = getSpanBidiRuns(lineCharacterIndex, span, flips);
                let bidiRunCharacterIndex = lineCharacterIndex;
                for (const bidiRun of bidiRuns) {
                    const bidiDirection = bidiRun.isFlipped ? (lineDirection === 'ltr' ? 'rtl' : 'ltr') : lineDirection;

                    // Replace mirrored charactrs
                    let bidiRunText = bidiRun.text;
                    if (bidiRun.isFlipped) {
                        const mirrors = bidi.getMirroredCharactersMap(bidiRunText, embeddingLevels, bidiRunCharacterIndex, bidiRunCharacterIndex + bidiRunText.length);
                        for (const [mirrorIndex, mirrorCharacter] of mirrors.entries()) {
                            bidiRunText = bidiRunText.slice(0, mirrorIndex) + mirrorCharacter + bidiRunText.slice(mirrorIndex + 1);
                        }
                    }

                    // Convert characters to glyphs
                    const glyphs = isHorizontal
                        ? font.stringToGlyphMapping(bidiRunText)
                        : bidiRunText.split('').map((char, index) => {
                            return {
                                glyph: font.charToGlyph(char),
                                replaced: [index]
                            };
                        });
                    let originalTextCharacterIndex = bidiRun.isFlipped ? bidiRunText.length - 1 : 0;
                    for (const { glyph, replaced } of glyphs) {
                        const documentCharacterCount = replaced.length;
                        
                        const glyphMetrics = glyph.getMetrics();

                        if (!isHorizontal) {
                            isDrawCompensatingForAdvanceHeight = glyph.advanceHeight != null;
                            if (!isDrawCompensatingForAdvanceHeight) {
                                lineDrawYOffset = capHeight * glyphScale;
                            } else if (isDrawCompensatingForAdvanceHeight && !wasDrawCompensatingForAdvanceHeight) {
                                lineDrawYOffset = (glyphMetrics.yMax + (glyphMetrics.topSideBearing ?? 0)) * glyphScale;
                            }
                        }

                        const glyphInfo: RenderTextGlyphInfo = {
                            glyph: glyph,
                            meta: span.meta,
                            advance: isHorizontal
                                ? (glyph.advanceWidth ?? 0) * glyphScale
                                : (
                                    glyph.advanceHeight != null
                                        ? glyph.advanceHeight * glyphScale
                                        : (font.ascender - font.descender) * glyphScale
                                ),
                            advanceOffset: runningAdvanceOffset,
                            drawOffset: new DOMPoint(lineDrawXOffset, lineDrawYOffset),
                            characterWidth: (glyph.advanceWidth ?? 0) * glyphScale,
                            fontName: span.meta.family ?? textMetaDefaults.family,
                            fontSize: size,
                            fontAscender: font.ascender * glyphScale,
                            fontDescender: font.descender * glyphScale,
                            documentCharacterIndex: runningWrapCharacterIndex + bidiRunCharacterIndex + originalTextCharacterIndex,
                            documentCharacterCount,
                            bidiDirection,
                        };
                        wasDrawCompensatingForAdvanceHeight = isDrawCompensatingForAdvanceHeight;
                        runningAdvanceOffset += glyphInfo.advance;
                        lineInfo.lineSize += glyphInfo.advance;

                        if (!isHorizontal) {
                            const characterLineWidth = Math.max(glyphInfo.characterWidth, glyphInfo.fontSize);
                            if (characterLineWidth > lineInfo.largestCharacterWidth) {
                                lineInfo.largestCharacterWidth = characterLineWidth;
                            }
                        }

                        lineInfo.glyphs.push(glyphInfo);

                        if (glyph.unicodes.length > 0) {
                            originalTextCharacterIndex += bidiRun.isFlipped ? -documentCharacterCount : documentCharacterCount;
                        }
                    }

                    bidiRunCharacterIndex += bidiRun.text.length;
                }
                lineCharacterIndex += span.text.length;
            }
        }

        // Add line to list of lines.
        if (lineInfo.lineSize > longestLineSize) {
            longestLineSize = lineInfo.lineSize;
        }
        if (isHorizontal) {
            runningWrapOffset += lineInfo.heightAboveBaseline + lineInfo.heightBelowBaseline;
        } else {
            runningWrapOffset += lineInfo.largestCharacterWidth;
        }
        if (lineInfo.heightAboveBaseline === 0 && lineInfo.heightBelowBaseline === 0) {
            lineInfo.heightAboveBaseline = lastHeightAboveBaseline;
            lineInfo.heightBelowBaseline = lastHeightBelowBaseline;
        }
        if (lineInfo.documentLineIndex !== originalLineIndices[lineIndex + 1]) {
            runningWrapCharacterIndex = 0;
        } else {
            runningWrapCharacterIndex += lineCharacterIndex;
        }

        previousDocumentLineIndex = lineInfo.documentLineIndex;

        if (lineInfo.glyphs.length > 0) {
            linesToDraw.push(lineInfo);
        }
    }

    // Now that the longest line length is known, figure out text alignment offsets.
    for (const lineInfo of linesToDraw) {
        if (lineInfo.lineAlignment === 'end') {
            lineInfo.lineStartOffset = longestLineSize - lineInfo.lineSize;
        } else if (lineInfo.lineAlignment === 'center') {
            lineInfo.lineStartOffset = (longestLineSize - lineInfo.lineSize) / 2;
        }
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
        lineDirection: document.lineDirection,
        lineDirectionSize,
        wrapDirection: document.wrapDirection,
        wrapDirectionSize,
        isHorizontal,
        left,
        right,
        top,
        bottom,
    };
}

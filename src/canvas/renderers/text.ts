import { DrawWorkingFileLayerOptions, WorkingFileTextLayer, WorkingFileTextLayerSpan, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { fontLoadedStatusMap, textLayerCache, textMetaDefaults, TextLayerCacheItem, TextLayerRenderInfoWrap } from '@/canvas/store/text-state';
import { getFontMetrics, FontMetrics } from '@/lib/metrics';
import { colorToScreenRgbaHex } from '@/lib/color';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import workingFileStore from '@/store/working-file';

export default class TextLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {

    /**
     * Returns the text string at a given line wrap (ignores formatting).
     * @param {object} wrap - The wrap definition 
     */
    getWrapText(wrap: TextLayerRenderInfoWrap<ColorModel>) {
        let wrapText = '';
        for (let i = 0; i < wrap.spans.length; i++) {
            wrapText += wrap.spans[i].text;
        }
        return wrapText;
    }

    /**
     * Calculates and caches the position of all the letters in the text layer so subsequent rendering is faster.
     */
    calculateTextPlacement(ctx: CanvasRenderingContext2D, layer: WorkingFileTextLayer<ColorModel>): TextLayerCacheItem<ColorModel> {
        const boundary = layer.data.boundary;
        const textDirection = layer.data.baseDirection;
        const wrapDirection = layer.data.wrapDirection;
        const isHorizontalTextDirection: boolean = ['ltr', 'rtl'].includes(textDirection);
        const isNegativeTextDirection: boolean = ['rtl', 'btt'].includes(textDirection);

        let totalTextDirectionSize: number = 0;
        let totalWrapDirectionSize: number = 0;
        let textDirectionMaxSize: number = isHorizontalTextDirection ? layer.width : layer.height;

        // Determine new lines based on text wrapping, if applicable
        const renderInfo: TextLayerCacheItem<ColorModel>['renderInfo'] = {
            wrapSizes: [],
            lines: []
        };
        for (const line of layer.data.lines) {
            let wrapAccumulativeSize: number = 0;
            let wrapCharacterOffsets: number[] = [0];
            let lineWraps = [];
            let currentWrapSpans: WorkingFileTextLayerSpan<ColorModel>[] = [...line.spans];
            let fontMetrics: FontMetrics | null = null;
            let character = null;
            let nextCharacter: string | null = null;
            let fontKerning: number = 0;
            let s: number = 0;
            for (s = 0; s < currentWrapSpans.length; s++) {
                const span = currentWrapSpans[s];
                const tracking = span.meta.tracking || textMetaDefaults.tracking;
                const family = span.meta.family || textMetaDefaults.family;
                const size = span.meta.size || textMetaDefaults.size;
                fontMetrics = getFontMetrics(family, size, !fontLoadedStatusMap.get(family));
                if (isHorizontalTextDirection) {
                    ctx.font =
                        ' ' + (span.meta.style ? span.meta.style : 'normal') +
                        ' ' + (span.meta.weight ? span.meta.weight : '') +
                        ' ' + size + 'px' +
                        ' ' + family;
                }
                for (let c = 0; c < span.text.length; c++) {
                    character = span.text[c];
                    if (layer.data.kerning === 'metrics') {
                        nextCharacter = span.text[c + 1];
                        if (!nextCharacter && c === span.text.length - 1 && currentWrapSpans[s + 1]) {
                            const nextSpan = currentWrapSpans[s + 1];
                            if (family === (nextSpan.meta.family || textMetaDefaults.family) && size === (nextSpan.meta.size || textMetaDefaults.size)) {
                                nextCharacter = nextSpan.text[0];
                            }
                        }
                        fontKerning = isHorizontalTextDirection && nextCharacter ? fontMetrics.getKerningOffset(character + nextCharacter) : 0;
                    }
                    const characterSize = isHorizontalTextDirection ? ctx.measureText(character).width : fontMetrics.offsetHeight;
                    wrapAccumulativeSize += characterSize + fontKerning + tracking;
                    if (boundary !== 'dynamic' && wrapAccumulativeSize > textDirectionMaxSize && ![' ', '-'].includes(character)) {
                        // Find last span with space
                        let dividerPosition = -1;
                        let bs = s;
                        for (; bs >= 0; bs--) {
                            const backwardsSpan = currentWrapSpans[bs];
                            const backwardsSpanText = (bs === s) ? backwardsSpan.text.substring(0, c) : backwardsSpan.text;
                            dividerPosition = backwardsSpanText.lastIndexOf(' ');
                            const dashPosition = backwardsSpanText.lastIndexOf('-');
                            if (dashPosition > dividerPosition) {
                                dividerPosition = dashPosition;
                            }
                            if (dividerPosition > -1) {
                                break;
                            }
                        }
                        let beforeSpans = [];
                        let afterSpans = [];
                        // Found a previous span on the current line wrap that contains a space, split the line
                        if (dividerPosition > -1) {
                            beforeSpans = currentWrapSpans.slice(0, bs);
                            afterSpans = currentWrapSpans.slice(bs + 1);
                            const beforeText = currentWrapSpans[bs].text.substring(0, dividerPosition + 1);
                            const afterText = currentWrapSpans[bs].text.substring(dividerPosition + 1);
                            if (beforeText.length > 0) {
                                beforeSpans.push({
                                    text: beforeText,
                                    meta: currentWrapSpans[bs].meta
                                });
                            }
                            if (afterText.length > 0) {
                                afterSpans.unshift({
                                    text: afterText,
                                    meta: currentWrapSpans[bs].meta
                                });
                            }
                        }
                        // For word split only, break out.
                        else if (layer.data.wrapAt === 'word') {
                            wrapCharacterOffsets.push(wrapAccumulativeSize);
                            break;
                        }
                        // Otherwise, split the word
                        else {
                            if (s === 0 && c === 0) {
                                c++;
                                wrapCharacterOffsets.push(wrapAccumulativeSize);
                            }
                            beforeSpans = currentWrapSpans.slice(0, s);
                            afterSpans = currentWrapSpans.slice(s + 1);
                            const beforeText = currentWrapSpans[s].text.substring(0, c);
                            const afterText = currentWrapSpans[s].text.substring(c);
                            if (beforeText.length > 0) {
                                beforeSpans.push({
                                    text: beforeText,
                                    meta: currentWrapSpans[s].meta
                                });
                            }
                            if (afterText.length > 0) {
                                afterSpans.unshift({
                                    text: afterText,
                                    meta: currentWrapSpans[s].meta
                                });
                            }
                        }
                        let largestOffset = wrapCharacterOffsets[wrapCharacterOffsets.length-1];
                        if (largestOffset > totalTextDirectionSize) {
                            totalTextDirectionSize = largestOffset;
                        }
                        const newWrap = {
                            characterOffsets: wrapCharacterOffsets,
                            spans: beforeSpans
                        };
                        newWrap.characterOffsets = newWrap.characterOffsets.slice(0, this.getWrapText(newWrap).length + 1);
                        lineWraps.push(newWrap);
                        currentWrapSpans = afterSpans;
                        wrapAccumulativeSize = 0;
                        wrapCharacterOffsets = [0];
                        s = -1;
                        break;
                    } else {
                        wrapCharacterOffsets.push(wrapAccumulativeSize);
                    }
                }
                if (s === -1) {
                    continue;
                }
            }
            if (currentWrapSpans.length > 0) {
                let largestOffset = wrapCharacterOffsets[wrapCharacterOffsets.length-1];
                if (largestOffset > totalTextDirectionSize) {
                    totalTextDirectionSize = largestOffset;
                }
                lineWraps.push({
                    characterOffsets: wrapCharacterOffsets,
                    spans: currentWrapSpans
                });
            }
            renderInfo.lines.push({
                align: line.align,
                firstWrapIndex: 0,
                wraps: lineWraps
            });
        }

        // Adjust offsets for alignment along the text direction
        const maxTextDirectionSize = boundary === 'dynamic' ? totalTextDirectionSize : (isHorizontalTextDirection ? layer.width : layer.height);
        for (let line of renderInfo.lines) {
            for (let wrap of line.wraps) {
                const lastSpan = wrap.spans[wrap.spans.length - 1];
                const wrapSize = wrap.characterOffsets[wrap.characterOffsets.length - 1 - (lastSpan.text[lastSpan.text.length - 1] === ' ' ? 1 : 0)];
                let startOffset = 0;
                if (line.align === 'center') {
                    startOffset = (maxTextDirectionSize / 2) - (wrapSize / 2);
                } else if (line.align === 'end') {
                    startOffset = maxTextDirectionSize - wrapSize;
                }
                if (startOffset > 0) {
                    for (let oi = 0; oi < wrap.characterOffsets.length; oi++) {
                        wrap.characterOffsets[oi] += startOffset;
                    }
                }
            }
        }

        // Determine the size of each line (e.g. line height if horizontal typing direction)
        let wrapSizeAccumulator = 0;
        let wrapCounter = 0;
        for (let line of renderInfo.lines) {
            line.firstWrapIndex = wrapCounter;
            for (let wrap of line.wraps) {
                let ascenderSize = 0;
                let descenderSize = 0;
                for (let span of wrap.spans) {
                    let fontMetrics: FontMetrics | null = null;
                    const family = span.meta.family || textMetaDefaults.family;
                    const size = span.meta.size || textMetaDefaults.size;
                    const leading = span.meta.leading != null ? span.meta.leading : textMetaDefaults.leading;
                    if (isHorizontalTextDirection) {
                        fontMetrics = getFontMetrics(family, size, !fontLoadedStatusMap.get(family));
                    } else {
                        ctx.font =
                            ' ' + (span.meta.style ? span.meta.style : 'normal') +
                            ' ' + (span.meta.weight ? span.meta.weight : '') +
                            ' ' + (span.meta.size || textMetaDefaults.size) + 'px' +
                            ' ' + family;
                    }
                    let spanAscenderSize = isHorizontalTextDirection && fontMetrics ? fontMetrics.baseline : ctx.measureText('X').width;
                    let spanDescenderSize = isHorizontalTextDirection && fontMetrics ? Math.abs(fontMetrics.baseline - fontMetrics.offsetHeight) : ctx.measureText('x').width;
                    if (leading) {
                        spanAscenderSize += leading;
                        if (spanAscenderSize < 0) {
                            spanDescenderSize += spanAscenderSize;
                            spanAscenderSize = 0;
                            if (spanDescenderSize < 0) {
                                spanDescenderSize = 0;
                            }
                        }
                    }
                    if (spanAscenderSize > ascenderSize) {
                        ascenderSize = spanAscenderSize;
                    }
                    if (spanDescenderSize > descenderSize) {
                        descenderSize = spanDescenderSize;
                    }
                }
                let lineSize = ascenderSize + descenderSize;
                renderInfo.wrapSizes.push({ size: lineSize, offset: wrapSizeAccumulator, baseline: ascenderSize });
                wrapSizeAccumulator += lineSize;
                wrapCounter++;
            }
        }
        totalWrapDirectionSize = wrapSizeAccumulator;

        let layerCacheItem: TextLayerCacheItem<ColorModel> | undefined = textLayerCache.get(layer);
        if (!layerCacheItem) {
            layerCacheItem = {};
        }
        layerCacheItem.lastCalculatedLayerWidth = layer.width;
        layerCacheItem.lastCalculatedLayerHeight = layer.height;
        layerCacheItem.textBoundaryWidth = Math.max(1, Math.round(isHorizontalTextDirection ? totalTextDirectionSize : totalWrapDirectionSize));
        layerCacheItem.textBoundaryHeight = Math.max(1, Math.round(isHorizontalTextDirection ? totalWrapDirectionSize : totalTextDirectionSize));
        layerCacheItem.renderInfo = renderInfo;
        return layerCacheItem;
    }

    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileTextLayer<ColorModel>, decomposedTransform: DecomposedMatrix, options: DrawWorkingFileLayerOptions = {}) {
        if (layer.bakedImage) {
            ctx.drawImage(
                layer.bakedImage as HTMLImageElement,
                0,
                0,
                layer.width,
                layer.height
            );
        } else {
            const { renderInfo } = this.calculateTextPlacement(ctx, layer);
            if (!renderInfo) {
                return;
            }
            try {
                let isSelectionEmpty = true; // this.selection.is_empty();
    
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
    
                const boundary = layer.data.boundary;
                let drawOffsetTop: number = 0;
                let drawOffsetLeft: number = 0;
                const textDirection = layer.data.baseDirection;
                const wrapDirection = layer.data.wrapDirection;
                const isHorizontalTextDirection = ['ltr', 'rtl'].includes(textDirection);
                const isNegativeTextDirection = ['rtl', 'btt'].includes(textDirection);
    
                const wrapSizes = renderInfo.wrapSizes;
                let lineIndex = 0;
                let wrapIndex = 0;
                const cursorLine = 0; // this.selection.isActiveSideEnd ? this.selection.end.line : this.selection.start.line;
                const cursorCharacter = 0; // this.selection.isActiveSideEnd ? this.selection.end.character : this.selection.start.character;

                for (let line of renderInfo.lines) {
                    let lineLetterCount = 0;
                    for (let [localWrapIndex, wrap] of line.wraps.entries()) {
                        let cursorStartX = null;
                        let cursorStartY = null;
                        let cursorSize = null;
                        let characterIndex = 0;
                        const characterOffsets = wrap.characterOffsets;
                        for (let [spanIndex, span] of wrap.spans.entries()) {
                            const tracking = span.meta.tracking != null ? span.meta.tracking : textMetaDefaults.tracking;
                            const weight = span.meta.weight != null ? span.meta.weight : textMetaDefaults.weight;
                            const style = span.meta.style != null ? span.meta.style : textMetaDefaults.style;
                            const underline = span.meta.underline != null ? span.meta.underline : textMetaDefaults.underline;
                            const strikethrough = span.meta.strikethrough != null ? span.meta.strikethrough : textMetaDefaults.strikethrough;
                            const family = span.meta.family || textMetaDefaults.family;
                            const size = span.meta.size || textMetaDefaults.size;
    
                            if (fontLoadedStatusMap.get(family) !== true) {
                                const variants = /* config.user_fonts[family] ? config.user_fonts[family].variants :*/ undefined;
                                // load_font_family({ family, variants }, () => {
                                //     this.hasValueChanged = true;
                                //     this.Base_layers.render();
                                // });
                            }
    
                            let fontMetrics;
                            if (underline || strikethrough) {
                                fontMetrics = getFontMetrics(family, size, !fontLoadedStatusMap.get(family));
                            }
    
                            // Set styles for drawing
                            ctx.font =
                                ' ' + (style ? style : 'normal') +
                                ' ' + (weight ? weight : '') +
                                ' ' + Math.round(span.meta.size || textMetaDefaults.size) + 'px' +
                                ' ' + family;
                            const fillColor: string = colorToScreenRgbaHex(span.meta.fillColor || textMetaDefaults.fillColor as ColorModel, workingFileStore.state.colorModel, workingFileStore.state.colorSpace);
                            let fillStyle: string = '';
                            if (fillColor.startsWith('#')) {
                                fillStyle = fillColor;
                            }
                            const strokeSize = ((span.meta.strokeSize != null) ? span.meta.strokeSize : textMetaDefaults.strokeSize);
                            let strokeStyle: string = '';
                            if (strokeSize) {
                                const strokeColor: string = colorToScreenRgbaHex(span.meta.strokeColor || textMetaDefaults.strokeColor as ColorModel, workingFileStore.state.colorModel, workingFileStore.state.colorSpace);
                                if (strokeColor.startsWith('#')) {
                                    strokeStyle = strokeColor;
                                }
                                ctx.lineWidth = strokeSize;
                            } else {
                                ctx.lineWidth = 0;
                            }
    
                            // Loop through each letter in each span and draw it
                            for (let c = 0; c < span.text.length; c++) {
                                const letter = span.text.charAt(c);
                                const lineStart = Math.round(drawOffsetTop + wrapSizes[wrapIndex].offset);
                                const letterWidth = characterOffsets[characterIndex + 1] - characterOffsets[characterIndex];
                                const letterHeight = Math.round(wrapSizes[wrapIndex].size);
                                const textDirectionOffset = drawOffsetLeft + characterOffsets[characterIndex];
                                const wrapDirectionOffset = Math.round(drawOffsetTop + wrapSizes[wrapIndex].offset + wrapSizes[wrapIndex].baseline);
                                const letterDrawX = isHorizontalTextDirection ? textDirectionOffset + tracking : wrapDirectionOffset;
                                const letterDrawY = isHorizontalTextDirection ? wrapDirectionOffset : textDirectionOffset + tracking;
                                let isLetterSelected = false;
                                // if (this.selection.isVisible) {
                                //     if (!isSelectionEmpty) {
                                //         isLetterSelected = (
                                //             (
                                //                 this.selection.start.line === lineIndex &&
                                //                 this.selection.start.character <= lineLetterCount &&
                                //                 (this.selection.end.line > lineIndex || this.selection.end.character > lineLetterCount)
                                //             ) ||
                                //             (
                                //                 this.selection.end.line === lineIndex &&
                                //                 this.selection.end.character > lineLetterCount &&
                                //                 (this.selection.start.line < lineIndex || this.selection.start.character <= lineLetterCount)
                                //             ) ||
                                //             (
                                //                 this.selection.start.line < lineIndex &&
                                //                 this.selection.end.line > lineIndex
                                //             )
                                //         );
                                //     }
                                //     if (cursorLine === lineIndex) {
                                //         if (cursorCharacter === lineLetterCount) {
                                //             cursorStartX = (isHorizontalTextDirection ? textDirectionOffset : lineStart) - 0.5;
                                //             cursorStartY = (isHorizontalTextDirection ? lineStart : textDirectionOffset) - 0.5;
                                //             cursorSize = isHorizontalTextDirection ? letterHeight : letterWidth;
                                //         }
                                //         else if (cursorCharacter === lineLetterCount + 1 && localWrapIndex === line.wraps.length - 1 && spanIndex === wrap.spans.length - 1 && c === span.text.length - 1) {
                                //             cursorStartX = (isHorizontalTextDirection ? textDirectionOffset + letterWidth : lineStart) - 0.5;
                                //             cursorStartY = (isHorizontalTextDirection ? lineStart : textDirectionOffset + letterHeight) - 0.5;
                                //             cursorSize = isHorizontalTextDirection ? letterHeight : letterWidth;
                                //         }
                                //     }
                                // }
                                // if (isLetterSelected && this.editingCtx === ctx) {
                                //     const letterStartX = isHorizontalTextDirection ? textDirectionOffset : lineStart;
                                //     const letterStartY = isHorizontalTextDirection ? lineStart : textDirectionOffset;
                                //     const letterSizeX = isHorizontalTextDirection ? letterWidth : letterHeight;
                                //     const letterSizeY = isHorizontalTextDirection ? letterHeight : letterWidth;
                                //     ctx.fillStyle = this.selectionBackgroundColor + '22';
                                //     ctx.fillRect(letterStartX, letterStartY, letterSizeX, letterSizeY);
                                //     ctx.strokeStyle = this.selectionBackgroundColor;
                                //     ctx.lineWidth = 0.75;
                                //     ctx.strokeRect(letterStartX, letterStartY, letterSizeX, letterSizeY);
                                //     ctx.lineWidth = stroke_size;
                                // }
                                ctx.fillStyle = fillStyle;
                                ctx.strokeStyle = strokeStyle;
                                ctx.fillText(letter, letterDrawX, letterDrawY);
                                if (strokeSize) {
                                    ctx.lineWidth = strokeSize;
                                    ctx.strokeText(letter, letterDrawX, letterDrawY);
                                }
                                if (strikethrough && fontMetrics) {
                                    ctx.fillStyle = fillStyle;
                                    ctx.lineWidth = Math.max(1, fontMetrics.offsetHeight / 20);
                                    ctx.fillRect(letterDrawX - 0.25 - tracking, letterDrawY - (fontMetrics.offsetHeight * .28), letterWidth + 0.5, ctx.lineWidth);
                                }
                                if (underline && fontMetrics) {
                                    ctx.fillStyle = fillStyle;
                                    ctx.lineWidth = Math.max(1, fontMetrics.offsetHeight / 20);
                                    ctx.fillRect(letterDrawX - 0.25 - tracking, letterDrawY + (ctx.lineWidth), letterWidth + 0.5, ctx.lineWidth);
                                }
                                characterIndex++;
                                lineLetterCount++;
                            }
    
                            // Offset line for empty span
                            if (span.text.length === 0) {
                                if (cursorLine === lineIndex && cursorCharacter === lineLetterCount) {
                                    const lineStart = Math.round(drawOffsetTop + wrapSizes[wrapIndex].offset);
                                    const textDirectionOffset = drawOffsetLeft + characterOffsets[0] + (lineIndex === 0 ? (boundary === 'dynamic' ? 5 : 2) : 0);
                                    const letterWidth = 3;
                                    const letterHeight = Math.round(wrapSizes[wrapIndex].size);
                                    cursorStartX = (isHorizontalTextDirection ? textDirectionOffset : lineStart) - 0.5;
                                    cursorStartY = (isHorizontalTextDirection ? lineStart : textDirectionOffset) - 0.5;
                                    cursorSize = isHorizontalTextDirection ? letterHeight : letterWidth;
                                }
                            }
                        }
    
                        // Draw cursor
                        // if (this.selection.isCursorVisible /*&& this.selection.isBlinkVisible*/ && cursorStartX && this.editingCtx == ctx) {
                        //     ctx.lineCap = 'butt';
                        //     ctx.strokeStyle = '#55555577';
                        //     ctx.lineWidth = 3;
                        //     ctx.beginPath();
                        //     ctx.moveTo(cursorStartX, cursorStartY + 1);
                        //     ctx.lineTo(cursorStartX, cursorStartY + cursorSize - 1);
                        //     if (cursorSize > 14) {
                        //         ctx.moveTo(cursorStartX - 3, cursorStartY + 2);
                        //         ctx.lineTo(cursorStartX + 3, cursorStartY + 2);
                        //         ctx.moveTo(cursorStartX - 3, cursorStartY + cursorSize - 2);
                        //         ctx.lineTo(cursorStartX + 3, cursorStartY + cursorSize - 2);
                        //     }
                        //     ctx.stroke();
                        //     ctx.strokeStyle = '#ffffffff';
                        //     ctx.lineWidth = 1;
                        //     ctx.beginPath();
                        //     ctx.moveTo(cursorStartX, cursorStartY + 2);
                        //     ctx.lineTo(cursorStartX, cursorStartY + cursorSize - 2);
                        //     if (cursorSize > 14) {
                        //         ctx.moveTo(cursorStartX - 2, cursorStartY + 2);
                        //         ctx.lineTo(cursorStartX + 2, cursorStartY + 2);
                        //         ctx.moveTo(cursorStartX - 2, cursorStartY + cursorSize - 2);
                        //         ctx.lineTo(cursorStartX + 2, cursorStartY + cursorSize - 2);
                        //     }
                        //     ctx.stroke();
                        // }
                        wrapIndex++;
                    }
                    lineIndex++;
                }
            } catch (error) {
                console.warn(error);
            }
        }
    }
}

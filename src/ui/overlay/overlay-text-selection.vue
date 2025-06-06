<template>
    <div class="og-canvas-overlay">
        <div
            v-if="editingLayerCssTransform && selectionBoxes.length > 0"
            class="og-text-selection"
            :style="{ transform: editingLayerCssTransform }"
        >
            <div
                v-for="(selectionBox, index) of selectionBoxes"
                :key="index"
                class="og-text-selection__box"
                :style="{
                    transform: `translate(${selectionBox.rect.x}px, ${selectionBox.rect.y}px)`,
                    width: selectionBox.rect.width + 'px',
                    height: selectionBox.rect.height + 'px',
                }"
            >
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, toRefs, watch } from 'vue';
import canvasStore from '@/store/canvas';
import { getLayerById, getLayerGlobalTransform } from '@/store/working-file';
import {
    isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection
} from '@/canvas/store/text-state';

export default defineComponent({
    name: 'CanvasOverlayTextSelection',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        
        interface SelectionBoxPlacement {
            layerId: number | null;
            selectionBoxes: SelectionBox[];
        }

        interface SelectionBox {
            rect: DOMRect;
            // TODO - support text transforms in the future.
        }

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const editingLayer = computed(() => {
            if (editingTextLayerId.value == null) return null;
            return getLayerById(editingTextLayerId.value);
        });

        const editingLayerCssTransform = computed<string>(() => {
            if (editingLayer.value == null) return '';
            const transform = getLayerGlobalTransform(editingLayer.value);
            return `matrix(${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f})`;
        });

        const isSwitchingLayers = ref(false);
        watch(() => editingTextLayerId.value, () => {
            isSwitchingLayers.value = true;
            nextTick(() => {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        isSwitchingLayers.value = false;
                    }, 1);
                });
            });
        });

        const selectionBoxes = computed<SelectionBox[]>(() => {
            if (!editingRenderTextPlacement.value || !editingTextDocumentSelection.value) return [];
            const { start, end } = toRefs(editingTextDocumentSelection.value);
            const { line: startLine, character: startCharacter } = start.value;
            const { line: endLine, character: endCharacter } = end.value;

            const boxes: SelectionBox[] = [];
            let currentBox: SelectionBox | null = null;
            let previousDocumentLineIndex = -1;
            const textPlacement = isSwitchingLayers.value ? null : editingRenderTextPlacement.value;
            if (!textPlacement) return [];

            const wrapSign = ['ltr', 'ttb'].includes(textPlacement.wrapDirection) ? 1 : -1;
            let wrapOffsetStart = wrapSign > 0 ? 0 : textPlacement.wrapDirectionSize;

            for (const line of textPlacement.lines) {
                const wrapOffsetLine = wrapSign > 0 ? 0 : -(textPlacement.isHorizontal ? (line.heightAboveBaseline + line.heightBelowBaseline) : line.largestCharacterWidth);

                if (line.documentLineIndex >= startLine && line.documentLineIndex <= endLine) {
                    let lineMaxCharacterIndex = 0;
                    let previousGlyphCharacterIndex = -1;
                    for (const glyph of line.glyphs) {
                        const glyphCharacterIndex = glyph.documentCharacterIndex;
                        const glyphCharacterCount = glyph.documentCharacterCount;
                        if (
                            (glyphCharacterIndex + (glyphCharacterCount - 1) >= startCharacter || line.documentLineIndex > startLine) &&
                            (glyphCharacterIndex < endCharacter || line.documentLineIndex < endLine)
                        ) {
                            const glyphSelectionStartCharacter = Math.max(
                                glyphCharacterIndex,
                                startLine === line.documentLineIndex ? startCharacter : -Infinity,
                            );
                            const glyphSelectionEndCharacter = Math.min(
                                glyphCharacterIndex + glyphCharacterCount,
                                endLine === line.documentLineIndex ? endCharacter : Infinity,
                            );
                            const advanceStartRatio = (glyphSelectionStartCharacter - glyphCharacterIndex) / glyphCharacterCount;
                            const advance = glyph.advance * ((glyphSelectionEndCharacter - glyphSelectionStartCharacter) / glyphCharacterCount);
                            let x = textPlacement.isHorizontal
                                ? glyph.advanceOffset + (glyph.advance * advanceStartRatio)
                                : wrapOffsetStart + wrapOffsetLine + (line.wrapOffset * wrapSign);
                            let y = textPlacement.isHorizontal
                                ? wrapOffsetStart + wrapOffsetLine + (line.wrapOffset * wrapSign) + line.heightAboveBaseline - glyph.fontAscender
                                : glyph.advanceOffset + (glyph.advance * advanceStartRatio);
                            let width = textPlacement.isHorizontal
                                ? advance
                                : line.largestCharacterWidth;
                            let height = textPlacement.isHorizontal
                                ? glyph.fontAscender + -glyph.fontDescender
                                : advance;
                            
                            let isCreateNewBox = false;

                            if (!currentBox) {
                                isCreateNewBox = true;
                            } else {
                                if (textPlacement.isHorizontal) {
                                    if (
                                        Math.abs(glyph.documentCharacterIndex - previousGlyphCharacterIndex) <= 1 &&
                                        currentBox.rect.y === y && currentBox.rect.height === height
                                    ) {
                                        currentBox.rect.x = Math.min(currentBox.rect.x, x);
                                        const right = Math.max(currentBox.rect.x + currentBox.rect.width, x + width);
                                        currentBox.rect.width = right - currentBox.rect.x;
                                    } else {
                                        isCreateNewBox = true;
                                    }
                                } else {
                                    if (
                                        Math.abs(glyph.documentCharacterIndex - previousGlyphCharacterIndex) <= 1 &&
                                        currentBox.rect.x === x && currentBox.rect.width === width
                                    ) {
                                        currentBox.rect.y = Math.min(currentBox.rect.y, y);
                                        const bottom = Math.max(currentBox.rect.y + currentBox.rect.height, y + height);
                                        currentBox.rect.height = bottom - currentBox.rect.y;
                                    } else {
                                        isCreateNewBox = true;
                                    }
                                }
                            }
                            if (isCreateNewBox) {
                                if (currentBox) {
                                    boxes.push(currentBox);
                                }
                                currentBox = {
                                    rect: new DOMRect(x, y, width, height),
                                };
                            }
                        }

                        if (glyph.documentCharacterIndex > lineMaxCharacterIndex) {
                            lineMaxCharacterIndex = glyph.documentCharacterIndex;
                        }
                        previousGlyphCharacterIndex = glyph.documentCharacterIndex;
                    }
                }

                if (currentBox) {
                    boxes.push(currentBox);
                    currentBox = null;
                }

                previousDocumentLineIndex = line.documentLineIndex;
            }

            return boxes;
        });

        return {
            zoom,
            isEditorTextareaFocused,
            editingLayerCssTransform,
            selectionBoxes,
        };

    }
});
</script>

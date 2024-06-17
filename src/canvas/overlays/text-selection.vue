<template>
    <div class="ogr-canvas-overlay">
        <div
            v-if="isEditorTextareaFocused"
            class="ogr-text-selection"
            :style="{ transform: editingLayerCssTransform }"
        >
            <div
                v-for="(selectionBox, index) of selectionBoxes"
                :key="index"
                class="ogr-text-selection__box"
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
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, getLayerGlobalTransform } from '@/store/working-file';
import { isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection } from '../store/text-state';

import type { CalculatedTextPlacement, RenderTextLineInfo, RenderTextGlyphInfo } from '@/types';

export default defineComponent({
    name: 'CanvasOverlayTextSelection',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        
        interface SelectionBox {
            rect: DOMRect;
            // TODO - support text transforms in the future.
        }

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const editingLayerCssTransform = computed<string>(() => {
            if (editingTextLayerId.value == null) return '';
            const layer = getLayerById(editingTextLayerId.value);
            if (layer == null) return '';
            const transform = getLayerGlobalTransform(layer);
            return `matrix(${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f})`;
        });

        const selectionBoxes = computed<SelectionBox[]>(() => {
            if (!editingRenderTextPlacement.value || !editingTextDocumentSelection.value) return [];
            const { start, end } = toRefs(editingTextDocumentSelection.value);
            const { line: startLine, character: startCharacter } = start.value;
            const { line: endLine, character: endCharacter } = end.value;

            const boxes: SelectionBox[] = [];
            let currentBox: SelectionBox | null = null;
            let previousDocumentLineIndex = -1;
            const textPlacement: CalculatedTextPlacement = editingRenderTextPlacement.value as CalculatedTextPlacement;

            for (const line of textPlacement.lines) {
                if (line.documentLineIndex >= startLine && line.documentLineIndex <= endLine) {
                    let lineMaxCharacterIndex = 0;
                    let previousGlyphCharacterIndex = -1;
                    for (const glyph of line.glyphs) {
                        const glyphCharacterIndex = glyph.documentCharacterIndex; // + lineWrapCharacterIndexIterator;
                        if (
                            (glyphCharacterIndex >= startCharacter || line.documentLineIndex > startLine) &&
                            (glyphCharacterIndex < endCharacter || line.documentLineIndex < endLine)
                        ) {
                            let x = textPlacement.isHorizontal ? glyph.advanceOffset : line.wrapOffset;
                            let y = textPlacement.isHorizontal ? line.wrapOffset + line.heightAboveBaseline - glyph.fontAscender : glyph.advanceOffset;
                            let width = textPlacement.isHorizontal ? glyph.advance : line.wrapOffset + line.largestCharacterWidth;
                            let height = textPlacement.isHorizontal ? glyph.fontAscender + -glyph.fontDescender : glyph.advance;
                            
                            let isCreateNewBox = false;

                            if (!currentBox) {
                                isCreateNewBox = true;
                            } else {
                                if (textPlacement.isHorizontal) {
                                    if (
                                        Math.abs(glyph.documentCharacterIndex -previousGlyphCharacterIndex) <= 1 &&
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
                                        Math.abs(glyph.documentCharacterIndex -previousGlyphCharacterIndex) <= 1 &&
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

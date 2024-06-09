<template>
    <div class="ogr-canvas-overlay">
        <div class="ogr-text-editor">
            <div
                v-if="selectionCursor && isEditorTextareaFocused"
                class="ogr-text-editor__selection"
                :style="{ transform: editingLayerCssTransform }"
            >
                <div
                    class="ogr-text-editor__selection__cursor"
                    :class="{
                        'ogr-text-editor__selection__cursor--no-blink': disableBlinking,
                    }"
                    :style="{
                        left: selectionCursor.position.x + 'px',
                        top: selectionCursor.position.y + 'px',
                    }"
                >
                    <svg
                        :width="selectionCursor.isHorizontal ? 3 : selectionCursor.size"
                        :height="selectionCursor.isHorizontal ? selectionCursor.size : 3"
                        :viewBox="'0 0 ' + (selectionCursor.isHorizontal ? ('3 ' + (selectionCursor.size + 2).toFixed(0)) : ((selectionCursor.size + 2).toFixed(0) + ' 3'))"
                        :style="{
                            transform: 'translate(-50%, -50%)',
                            position: 'absolute',
                        }"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <template v-if="selectionCursor.isHorizontal">
                            <rect x="0" y="0" width="3" :height="selectionCursor.size + 2" fill="white" />
                            <rect x="1" y="1" width="1" :height="selectionCursor.size" fill="black" />
                        </template>
                        <template v-else>
                            <rect x="0" y="0" height="3" :width="selectionCursor.size + 2" fill="white" />
                            <rect x="1" y="1" height="1" :width="selectionCursor.size" fill="black" />
                        </template>
                    </svg>
                </div>
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
    name: 'CanvasOverlayText',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        
        interface SelectionCursor {
            position: DOMPoint;
            size: number;
            isHorizontal: boolean;
        }

        const disableBlinking = ref(false);
        let disableBlinkingTimeoutHandle: number | undefined = undefined;

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

        const selectionCursor = computed<SelectionCursor | undefined>(() => {
            if (!editingRenderTextPlacement.value || !editingTextDocumentSelection.value) return;
            const { isActiveSideEnd, start, end } = toRefs(editingTextDocumentSelection.value);
            const cursor = isActiveSideEnd.value ? end.value : start.value;
            let lineWrapCharacterIndexIterator = 0;
            const textPlacement: CalculatedTextPlacement = editingRenderTextPlacement.value as CalculatedTextPlacement;
            const isHorizontal = ['ltr', 'rtl'].includes(textPlacement.lineDirection);

            let foundCursorLine: RenderTextLineInfo | null = null;
            let foundCursorGlyph: RenderTextGlyphInfo | null = null;
            findCursorGlyph:
            for (const line of textPlacement.lines) {
                if (cursor.line === line.documentLineIndex) {
                    foundCursorLine = line;
                    let lineMaxCharacterIndex = 0;
                    for (const glyph of line.glyphs) {
                        if (cursor.character === glyph.characterIndex + lineWrapCharacterIndexIterator) {
                            foundCursorGlyph = glyph;
                            break findCursorGlyph;
                        }
                        if (glyph.characterIndex > lineMaxCharacterIndex) {
                            lineMaxCharacterIndex = glyph.characterIndex;
                        }
                    }
                    lineWrapCharacterIndexIterator += lineMaxCharacterIndex;
                }
            }
            let position = new DOMPoint();
            let size = 10;
            if (foundCursorLine) {
                let advanceOffset = 0;
                if (foundCursorGlyph) {
                    advanceOffset = foundCursorGlyph.advanceOffset;
                } else {
                    foundCursorGlyph = foundCursorLine.glyphs[foundCursorLine.glyphs.length - 1];
                    if (foundCursorGlyph) {
                        advanceOffset = foundCursorGlyph.advanceOffset + foundCursorGlyph.advance;
                    }
                }
                if (textPlacement.isHorizontal) {
                    position.x = foundCursorLine.lineStartOffset + advanceOffset + (foundCursorGlyph.bidiDirection === 'rtl' ? foundCursorGlyph.advance : 0);
                    position.y = foundCursorLine.wrapOffset + (foundCursorLine.heightAboveBaseline + foundCursorLine.heightBelowBaseline) / 2.0;
                    size = foundCursorLine.heightAboveBaseline + foundCursorLine.heightBelowBaseline;
                } else {
                    position.x = foundCursorLine.wrapOffset + (foundCursorLine.largestCharacterWidth / 2.0);
                    position.y = foundCursorLine.lineStartOffset + advanceOffset;
                    size = foundCursorLine.largestCharacterWidth;
                }
            }

            // TODO - fix. This shouldn't be here, no side effects in computed.
            makeCursorVisiblyActive();

            return {
                position,
                size,
                isHorizontal,
            };
        });

        function makeCursorVisiblyActive() {
            disableBlinking.value = true;
            window.clearTimeout(disableBlinkingTimeoutHandle);
            disableBlinkingTimeoutHandle = window.setTimeout(() => {
                disableBlinking.value = false;
            }, 200);
        }

        return {
            zoom,
            isEditorTextareaFocused,
            disableBlinking,
            editingLayerCssTransform,
            selectionCursor,
        };

    }
});
</script>

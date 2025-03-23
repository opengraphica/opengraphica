<template>
    <div class="ogr-canvas-overlay">
        <!-- Display a resizable boundary box -->
        <div ref="editinglayerBounds"
            class="ogr-free-transform"
            v-show="editingTextLayerId != null"
            :style="{
                width: (editingLayerDimensions?.width ?? 0) + 'px',
                height: (editingLayerDimensions?.height ?? 0) + 'px',
                transform: editingLayerCssTransform,
                transformOrigin: '0% 0%',
            }"
        >
            <div class="ogr-free-transform-bounds" :style="{
                outlineWidth: (0.35/zoom) + 'rem'
            }"></div>
            <div v-show="!editingLayerIsHorizontal" class="ogr-free-transform-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="editingLayerIsHorizontal" class="ogr-free-transform-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="!editingLayerIsHorizontal" class="ogr-free-transform-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="editingLayerIsHorizontal" class="ogr-free-transform-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
        </div>
        <!-- Editing cursor (selection highlight is in text-selection.vue) -->
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
import {
    isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection,
    dragHandleHighlight, overlaySelectionCursorPosition, overlaySelectionCursorSize, editingLayerCssTransform,
} from '@/canvas/store/text-state';

import type { CalculatedTextPlacement, RenderTextLineInfo, RenderTextGlyphInfo, WorkingFileTextLayer } from '@/types';

export default defineComponent({
    name: 'CanvasOverlayText',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const editinglayerBounds = ref<HTMLDivElement>(null as any);

        const dragHandleHighlightColor: string = '#ecf5ff';
        const dragHandleHighlightBorderColor: string= '#b3d8ff';

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

        const editingLayerDimensions = computed(() => {
            if (editingTextLayerId.value == null) return null;
            const layer = getLayerById(editingTextLayerId.value);
            if (layer == null) return null;
            return { width: layer.width, height: layer.height };
        });

        const editingLayerIsHorizontal = computed<boolean>(() => {
            if (editingTextLayerId.value == null) return true;
            const layer = getLayerById(editingTextLayerId.value);
            if (layer == null) return true;
            if (layer.type !== 'text') return true;
            return ['ltr', 'rtl'].includes((layer as WorkingFileTextLayer).data.lineDirection);
        });

        const selectionCursor = computed<SelectionCursor | undefined>(() => {
            if (!editingRenderTextPlacement.value || !editingTextDocumentSelection.value) return;
            const { isActiveSideEnd, start, end } = toRefs(editingTextDocumentSelection.value);
            const cursor = isActiveSideEnd.value ? end.value : start.value;
            const textPlacement: CalculatedTextPlacement = editingRenderTextPlacement.value as CalculatedTextPlacement;
            const isHorizontal = textPlacement.isHorizontal;

            const wrapSign = ['ltr', 'ttb'].includes(textPlacement.wrapDirection) ? 1 : -1;
            let wrapOffsetStart = wrapSign > 0 ? 0 : textPlacement.wrapDirectionSize;

            let foundCursorLine: RenderTextLineInfo | null = null;
            let foundCursorGlyph: RenderTextGlyphInfo | null = null;
            findCursorGlyph:
            for (const line of textPlacement.lines) {
                if (cursor.line === line.documentLineIndex) {
                    foundCursorLine = line;
                    let lineMaxCharacterIndex = 0;
                    for (const glyph of line.glyphs) {
                        if (cursor.character >= glyph.documentCharacterIndex && cursor.character < glyph.documentCharacterIndex + glyph.documentCharacterCount) {
                            foundCursorGlyph = glyph;
                            break findCursorGlyph;
                        }
                        if (glyph.documentCharacterIndex > lineMaxCharacterIndex) {
                            lineMaxCharacterIndex = glyph.documentCharacterIndex;
                        }
                    }
                }
            }
            let position = new DOMPoint();
            let size = 10;
            if (foundCursorLine) {
                const wrapOffsetLine = wrapSign > 0 ? 0 : -(textPlacement.isHorizontal ? (foundCursorLine.heightAboveBaseline + foundCursorLine.heightBelowBaseline) : foundCursorLine.largestCharacterWidth);

                let advanceOffset = 0;
                if (foundCursorGlyph) {
                    advanceOffset = foundCursorGlyph.advanceOffset;
                    if (cursor.character > foundCursorGlyph.documentCharacterIndex) {
                        advanceOffset += (
                            (cursor.character - foundCursorGlyph.documentCharacterIndex) / foundCursorGlyph.documentCharacterCount
                        ) * foundCursorGlyph.advance;
                    }
                } else {
                    foundCursorGlyph = foundCursorLine.glyphs[foundCursorLine.glyphs.length - 1];
                    if (foundCursorGlyph) {
                        advanceOffset = foundCursorGlyph.advanceOffset + foundCursorGlyph.advance;
                    }
                }
                if (textPlacement.isHorizontal) {
                    position.x = foundCursorLine.lineStartOffset + advanceOffset + (foundCursorGlyph.bidiDirection === 'rtl' ? foundCursorGlyph.advance : 0);
                    position.y = wrapOffsetStart + wrapOffsetLine + (foundCursorLine.wrapOffset * wrapSign) + foundCursorLine.heightAboveBaseline - (foundCursorGlyph.fontAscender + foundCursorGlyph.fontDescender) / 2.0;
                    size = foundCursorGlyph.fontAscender - foundCursorGlyph.fontDescender;
                } else {
                    position.x = wrapOffsetStart + wrapOffsetLine + (foundCursorLine.wrapOffset * wrapSign) + (foundCursorLine.largestCharacterWidth / 2.0);
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

        watch(() => [selectionCursor.value?.position, selectionCursor.value?.size] as const, ([position, size]) => {
            overlaySelectionCursorPosition.value = (position as DOMPoint);
            overlaySelectionCursorSize.value = size ?? 10;
        })

        function makeCursorVisiblyActive() {
            disableBlinking.value = true;
            window.clearTimeout(disableBlinkingTimeoutHandle);
            disableBlinkingTimeoutHandle = window.setTimeout(() => {
                disableBlinking.value = false;
            }, 200);
        }

        return {
            DRAG_TYPE_ALL: 0,
            DRAG_TYPE_TOP: 1,
            DRAG_TYPE_BOTTOM: 2,
            DRAG_TYPE_LEFT: 4,
            DRAG_TYPE_RIGHT: 8,
            zoom,
            editingLayerIsHorizontal,
            editingTextLayerId,
            editinglayerBounds,
            editingLayerDimensions,
            dragHandleHighlight,
            dragHandleHighlightColor,
            dragHandleHighlightBorderColor,
            isEditorTextareaFocused,
            disableBlinking,
            editingLayerCssTransform,
            selectionCursor,
        };

    }
});
</script>

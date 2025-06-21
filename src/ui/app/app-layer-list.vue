<template>
    <ul ref="layerList"
        v-pointer.dragstart="onPointerDragStartList"
        v-pointer.dragend="onPointerDragEndList"
        v-pointer.press="onPointerPressList"
        v-pointer.move.window="onPointerMoveList"
        v-pointer.up.window="onPointerUpList"
        class="og-layer-list"
        :class="{
            'is-dnd-dragging': draggingLayerId != null,
            'grow-1': isRoot,
        }"
    >
        <template v-for="(layer, layerIndex) of reversedLayers" :key="layer.id">
            <li
                v-if="dropTargetLayerId === layer.id && dropTargetPosition === 'above'"
                class="og-layer is-dnd-placeholder"
                :style="{ height: draggingLayerHeight + 'px' }"
            />
            <li class="og-layer"
                :class="{
                    'is-dnd-hover': layer.id === hoveringLayerId,
                    'is-active': selectedLayerIds.includes(layer.id),
                    'is-expanded': isGroupLayer(layer) && layer.expanded,
                    'is-drag-insert-inside': dropTargetLayerId === layer.id && dropTargetPosition === 'inside'
                }"
                :style="{
                    '--layer-group-indent': depth + 'rem'
                }"
                :hidden="layer.id === draggingLayerId && draggingLayerHeight > 0"
                :data-layer-id="layer.id"
            >
                <!-- Name, View, Options -->
                <span class="og-layer-main">
                    <span
                        class="og-layer-dnd-handle"
                        v-pointer.tap="onPointerTapDndHandle"
                        @mouseenter="onMouseEnterDndHandle(layer)"
                        @mouseleave="onMouseLeaveDndHandle(layer)">
                        <app-layer-list-thumbnail :layer="layer" />
                        <span class="og-layer-name">
                            <span class="bi mr-1" :class="getIconClass(layer)" aria-hidden="true" />
                            {{ layer.name }}
                        </span>
                        <span v-if="layer.type === 'group'" class="og-layer-group-arrow bi" :class="{ 'bi-chevron-right': !layer.expanded, 'bi-chevron-down': layer.expanded }" aria-hidden="true"></span>
                    </span>
                    <el-button link type="primary" class="!px-2 !my-1" :aria-label="$t('app.layerList.toggleLayerVisibility')" @click="onToggleLayerVisibility(layer)">
                        <i class="bi" :class="{ 'bi-eye-fill': layer.visible, 'bi-eye-slash': !layer.visible }" aria-hidden="true"></i>
                    </el-button>
                    <el-button link type="primary" class="!px-2 !mr-2 !my-1 !ml-0" :aria-label="$t('app.layerList.layerSettings')" @click="onToggleLayerSettings($event, layer)">
                        <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                    </el-button>
                </span>
                <!-- Raster Sequence Frames -->
                <span v-if="layer.type === 'rasterSequence'" role="group" class="og-layer-attributes og-layer-frames">
                    <span class="og-layer-attributes__title">
                        <i class="bi bi-arrow-return-right" aria-hidden="true"></i> {{ $t('app.layerList.frames') }}
                        <el-button v-if="!playingAnimation" link type="primary" class="p-0 ml-1" style="min-height: 0" :aria-label="$t('app.layerList.playAnimation')" @click="onPlayRasterSequence(layer)"><i class="bi bi-play" aria-hidden="true"></i></el-button>
                        <el-button v-else link type="primary" class="p-0 ml-1" style="min-height: 0" :aria-label="$t('app.layerList.stopAnimation')" @click="onStopRasterSequence()"><i class="bi bi-stop" aria-hidden="true"></i></el-button>
                    </span>
                    <div class="flex">
                        <el-scrollbar>
                            <ul class="og-layer-frames-list">
                                <li v-for="(frame, index) in layer.data.sequence" :key="index">
                                    <app-layer-frame-thumbnail :layer="layer" :sequence-index="index" role="button" :tabindex="0" @dragstart.prevent @click="onSelectLayerFrame(layer, index)" />
                                </li>
                            </ul>
                        </el-scrollbar>
                        <el-button :aria-label="$t('app.layerList.editFrames')" class="grow-0 rounded-s-none px-2 py-0 mb-2">
                            <i class="bi bi-pencil-square" aria-hidden="true"></i>
                        </el-button>
                    </div>
                </span>
                <!-- Effects -->
                <span v-if="layer.filters?.length > 0" role="group" class="og-layer-attributes">
                    <span class="og-layer-attributes__title">
                        <span class="flex flex-row">
                            <i class="bi bi-arrow-return-right mr-1" aria-hidden="true"></i>
                            {{ $t('app.layerList.effects') }}
                            <transition name="og-transition-fade">
                                <img v-if="layer.isBaking" src="../../assets/images/loading-spinner.svg" class="self-center ml-3 mr-1" style="width: 1rem" />
                            </transition>
                            <!-- <transition name="og-transition-fade">
                                <span v-if="layer.isBaking" v-t="'app.layerList.recalculatingEffect'" class="has-color-primary" />
                            </transition> -->
                            <el-button link type="primary" class="!ml-auto !mr-1" style="min-height: 0" @click="rasterizeLayer(layer)">
                                <span class="bi bi-sign-merge-left mr-1" aria-hidden="true" />
                                {{ t('app.layerList.rasterizeEffects') }}
                            </el-button>
                        </span>
                    </span>
                    <ul class="og-layer-effect-stack">
                        <li v-for="(filter, filterIndex) of layer.filters" :key="filterIndex">
                            <el-button link :type="filter.disabled ? undefined : 'primary'" @click="onEditLayerFilter(layer, filterIndex)">
                                <i class="bi bi-pencil-square mr-1" aria-hidden="true"></i>
                                <span v-t="`layerFilter.${filter.name}.name`"></span>
                            </el-button>
                            <el-button
                                link type="primary" class="!px-2 !my-0 !ml-0"
                                :disabled="filterIndex === 0" :aria-label="$t('app.layerList.moveEffectUp')"
                                @click="onMoveLayerFilterUp(layer, filterIndex)"
                            >
                                <i class="bi bi-chevron-up" aria-hidden="true"></i>
                            </el-button>
                            <el-button
                                link type="primary" class="!px-2 !my-0 !ml-0"
                                :disabled="filterIndex === layer.filters.length - 1" :aria-label="$t('app.layerList.moveEffectDown')"
                                @click="onMoveLayerFilterDown(layer, filterIndex)"
                            >
                                <i class="bi bi-chevron-down" aria-hidden="true"></i>
                            </el-button>
                        </li>
                    </ul>
                </span>
                <!-- No Layers Alert -->
                <template v-if="isGroupLayer(layer)">
                    <el-alert
                        v-if="layer.layers && layer.expanded && layer.layers.length === 0"
                        type="info"
                        :title="$t('app.layerList.emptyGroup')"
                        show-icon
                        :closable="false"
                        class="justify-center">
                    </el-alert>
                    <app-layer-list
                        v-if="layer.layers && layer.expanded && layer.layers.length > 0"
                        :layers="layer.layers" :depth="depth + 1"
                        @dragging-layer="onChildDraggingLayer"
                    />
                </template>
            </li>
            <li
                v-if="dropTargetLayerId === layer.id && dropTargetPosition === 'below'"
                class="og-layer is-dnd-placeholder"
                :style="{ height: draggingLayerHeight + 'px' }"
            />
        </template>
        <li
            ref="draggingLayer"
            v-if="isRoot && draggingLayerId != null"
            class="og-layer is-dragging"
            aria-hidden="true"
            v-html="draggingItemHtml"
        />
    </ul>
    <og-popover
        v-model:visible="showLayerSettingsMenu"
        placement="bottom-end"
        :reference="showLayerSettingsReference"
    >
        <el-menu class="el-menu--medium el-menu--borderless" :default-active="layerSettingsActiveIndex" @select="onLayerSettingsSelect($event)">
            <el-menu-item index="rename">
                <i class="bi bi-alphabet"></i>
                <span v-t="'app.layerList.rename'"></span>
            </el-menu-item>
            <el-menu-item index="blendingMode">
                <i class="bi bi-images"></i>
                <span v-t="'app.layerList.blendingMode'"></span>
            </el-menu-item>
            <el-menu-item index="effect">
                <i class="bi bi-stars"></i>
                <span v-t="'app.layerList.addEffect'"></span>
            </el-menu-item>
            <el-menu-item index="duplicate">
                <i class="bi bi-copy"></i>
                <span v-t="'app.layerList.duplicate'"></span>
            </el-menu-item>
            <el-menu-item index="delete">
                <i class="bi bi-trash"></i>
                <span v-t="'app.layerList.delete'"></span>
            </el-menu-item>
        </el-menu>
    </og-popover>
</template>

<script setup lang="ts">
import { ref, watch, reactive, computed, onMounted, onUnmounted, toRefs, nextTick, PropType } from 'vue';
import { useI18n } from '@/i18n';

import OgPopover from '@/ui/element/popover.vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from 'element-plus/lib/components/popover/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import AppLayerListThumbnail from '@/ui/app/app-layer-list-thumbnail.vue';
import AppLayerFrameThumbnail from '@/ui/app/app-layer-frame-thumbnail.vue';

import vPointer from '@/directives/pointer';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById, isGroupLayer } from '@/store/working-file';

import appEmitter from '@/lib/emitter';
import { runModule } from '@/modules';

import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { DuplicateLayerAction } from '@/actions/duplicate-layer';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { RasterizeLayerAction } from '@/actions/rasterize-layer';
import { ReorderLayersAction } from '@/actions/reorder-layers';
import { ReorderLayerFiltersAction } from '@/actions/reorder-layer-filters';

import type { WorkingFileAnyLayer, WorkingFileGroupLayer, ColorModel, WorkingFileRasterSequenceLayer } from '@/types';

const props = defineProps({
    depth: {
        type: Number,
        default: 0,
    },
    isRoot: {
        type: Boolean,
        default: false
    },
    layers: {
        type: Array as PropType<WorkingFileAnyLayer<ColorModel>[]>,
        required: true
    },
    scrollContainerHeight: {
        type: Number,
        default: 0
    },
    scrollTop: {
        type: Number,
        default: 0
    }
});

const emit = defineEmits([
    'scroll-by',
    'dragging-layer'
]);

const { t } = useI18n();

const layerList = ref<HTMLUListElement>(null as unknown as HTMLUListElement);

const draggingLayer = ref<HTMLLIElement | null>(null);
const dropTargetLayerId = ref<number | null>(null);
const dropTargetPosition = ref<'above' | 'inside' | 'below'>('above');
const hoveringLayerId = ref<number | null>(null);
const draggingLayerHeight = ref<number>(0);
let draggingLayerPointerOffset: number = 0;
let dragItemOffsets: { isExpanded: boolean; top: number; height: number; id: number; }[] = [];
let dragItemOffsetCalculatedScrollTop: number = 0;
let lastDragPageY: number = 0;
let isDragMoveUp: boolean = false;
let dragScrollMargin: number = 20;
let draggingLayerStartPointerId: number | null = null;
const draggingLayerId = ref<number | null>(null);
const draggingItemHtml = ref<string>('');

const layerSettingsVisibility = ref<boolean[]>([]);
const showLayerSettingsReference = ref<HTMLButtonElement>();
const showLayerSettingsMenu = ref(false);
const showLayerSettingsMenuFor = ref<number | null>(null);
const layerSettingsActiveIndex = ref('');

const conditionalDragStartEventModifier: string = props.isRoot ? 'dragstart' : '';
const { playingAnimation } = toRefs(canvasStore.state);
const { selectedLayerIds } = toRefs(workingFileStore.state);

const reversedLayers = computed<WorkingFileAnyLayer<ColorModel>[]>(() => {
    return reverseLayerList(props.layers);
});

watch(() => props.layers.length, async (newLength, oldLength) => {
    if (newLength != oldLength) {
        layerSettingsVisibility.value = new Array(newLength).fill(false);
    }
}, { immediate: true });

watch(() => props.scrollTop, () => {
    if (draggingLayerId.value != null) {
        requestAnimationFrame(() => {
            calculateDropPosition(lastDragPageY);
        });
    }
});

if (!props.isRoot) {
    watch(() => ({
        id: draggingLayerId.value,
        html: draggingItemHtml.value,
    }), (draggingProps) => {
        emit('dragging-layer', draggingProps);
    });
}

onMounted(() => {
});

onUnmounted(() => {
});

function getIconClass(layer: WorkingFileAnyLayer) {
    switch (layer.type) {
        case 'gradient': return 'bi-shadows';
        case 'group': return (layer as WorkingFileGroupLayer).expanded ? 'bi-folder2-open' : 'bi-folder';
        case 'raster': return 'bi-image';
        case 'rasterSequence': return 'bi-images';
        case 'text': return 'bi-textarea-t';
        case 'vector': return 'bi-bezier2';
        case 'video': return 'bi-film';
    }
    return 'bi-question';
}

function reverseLayerList(layerList: WorkingFileAnyLayer<ColorModel>[]): WorkingFileAnyLayer<ColorModel>[] {
    const newLayersList: WorkingFileAnyLayer[] = [];
    for (let i = layerList.length - 1; i >= 0; i--) {
        newLayersList.push(reactive(layerList[i]));
    }
    return newLayersList;
}

async function onLayerSettingsSelect(action: string) {
    const layer = getLayerById(showLayerSettingsMenuFor.value ?? -1);
    if (!layer) return;

    if (action === 'rename') {
        runModule('layer', 'rename', { layerId: layer.id, });
    } else if (action === 'blendingMode') {
        runModule('layer', 'blendingMode', { layerId: layer.id });
    } else if (action === 'effect') {
        runModule('layer', 'layerEffectBrowser', { layerId: layer.id });
    } else if (action === 'duplicate') {
        historyStore.dispatch('runAction', {
            action: new DuplicateLayerAction(layer.id)
        });
    } else if (action === 'delete') {
        historyStore.dispatch('runAction', {
            action: new DeleteLayersAction([layer.id])
        });
    }
    showLayerSettingsMenu.value = false;
    showLayerSettingsMenuFor.value = null;
    layerSettingsActiveIndex.value = ' ';
    await nextTick();
    layerSettingsActiveIndex.value = '';
}

function onMouseEnterDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
    hoveringLayerId.value = layer.id;
}

function onMouseLeaveDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
    hoveringLayerId.value = null;
}

function onPointerTapDndHandle(e: PointerEvent) {
    const layerId: number = parseInt((e.target as Element)?.closest('.og-layer')?.getAttribute('data-layer-id') || '-1', 10);
    const layer = getLayerById(layerId);
    if (layer) {
        if (layer.type === 'group') {
            layer.expanded = !layer.expanded;
        }
        if (!workingFileStore.get('selectedLayerIds').includes(layerId)) {
            historyStore.dispatch('runAction', {
                action: new SelectLayersAction([layerId]),
                mergeWithHistory: 'selectLayers',
            });
        }
    }
}
async function onPointerDragStartList(e: PointerEvent) {
    if (e.pointerType != 'touch') {
        handleDragStartList(e);
    }
}
function onPointerPressList(e: PointerEvent) {
    if (e.pointerType === 'touch') {
        handleDragStartList(e);
    }
}
async function handleDragStartList(e: PointerEvent) {
    draggingLayerStartPointerId = e.pointerId;
    const target = e.target;
    const pageY = e.pageY;
    lastDragPageY = pageY;
    const layerElement: Element | null | undefined = (target as Element)?.closest('.og-layer-dnd-handle')?.closest('.og-layer');

    if (layerElement?.parentNode !== layerList.value) {
        return;
    }

    const layerId: number = parseInt(layerElement?.getAttribute('data-layer-id') || '-1', 10);
    if (layerId > -1 && layerElement) {
        draggingLayerId.value = layerId;
        draggingItemHtml.value = layerElement.innerHTML;
        draggingLayerHeight.value = 0;
        await nextTick();
        if (draggingLayer.value) {
            const layerElementClientRect = layerElement.getBoundingClientRect();
            const layerListTop = layerList.value.getBoundingClientRect().top + window.scrollY;
            const layerElementTop = layerElementClientRect.top + window.scrollY;
            draggingLayerPointerOffset = pageY - layerElementTop;
            draggingLayerHeight.value = layerElementClientRect.height;
            draggingLayer.value.style.top = (pageY - layerListTop - draggingLayerPointerOffset) + 'px';
            calculateDragOffsets();
        }
    }
}
function onPointerMoveList(e: PointerEvent) {
    if (draggingLayerId.value != null) {
        const pageY = (e as any).pageY;
        calculateDropPosition(pageY);
        lastDragPageY = pageY;
    }
}
function onPointerUpList(e: PointerEvent) {
    if (e.pointerId === draggingLayerStartPointerId) {
        onPointerDragEndList(e);
    }
}
function calculateDropPosition(pageY: number) {
    if (draggingLayer.value) {
        let newDropTargetLayerId: number | null = null;
        let newDropTargetPosition: 'above' | 'inside' | 'below' = 'above';

        const previousDropTargetLayerId = dropTargetLayerId.value ?? draggingLayerId.value;
        const previousDropTargetPosition = dropTargetPosition.value ?? 'above';
        const layerListTop = layerList.value.getBoundingClientRect().top + window.scrollY;
        draggingLayer.value.style.top = pageY - layerListTop - draggingLayerPointerOffset + 'px';
        const dragItemHandleHeight = 64;
        const dragItemTop = pageY - draggingLayerPointerOffset;
        const dragItemBottom = dragItemTop + draggingLayerHeight.value;
        const dragItemTopOffset = dragItemTop + (props.scrollTop - dragItemOffsetCalculatedScrollTop);
        const dragItemBottomOffset = dragItemBottom + (props.scrollTop - dragItemOffsetCalculatedScrollTop);

        const dragItemRelativeCenter = dragItemTopOffset - layerListTop + draggingLayerHeight.value / 2;
        if (pageY < lastDragPageY) {
            isDragMoveUp = true;
        } else if (pageY > lastDragPageY) {
            isDragMoveUp = false;
        }

        findDropTarget:
        {
            let runningOffset = 0;
            let id: number, height: number, isPreviousTargetEncountered: boolean = false, nextId: number = -1, nextHeight: number = 0;
            for (let i = 0; i < dragItemOffsets.length; i++) {
                ({ id, height } = dragItemOffsets[i]);
                if (dragItemOffsets[i + 1]) {
                    ({ id: nextId, height: nextHeight } = dragItemOffsets[i + 1]);
                } else {
                    nextId = -1;
                    nextHeight = draggingLayerHeight.value;
                }

                if (i === 0 && id === previousDropTargetLayerId && previousDropTargetPosition === 'above') {
                    if (dragItemRelativeCenter < (draggingLayerHeight.value + height) / 2) {
                        newDropTargetLayerId = id;
                        newDropTargetPosition = 'above';
                        break findDropTarget;
                    }
                }

                if (isPreviousTargetEncountered) {
                    isPreviousTargetEncountered = false;
                    if (dragItemRelativeCenter < runningOffset + (draggingLayerHeight.value + height) / 2) {
                        newDropTargetLayerId = id;
                        newDropTargetPosition = 'above';
                        break findDropTarget;
                    }
                }

                if (nextId === previousDropTargetLayerId && previousDropTargetPosition === 'above') {
                    nextId = previousDropTargetLayerId;
                    nextHeight = draggingLayerHeight.value;
                    isPreviousTargetEncountered = true;
                }

                if (dragItemRelativeCenter < runningOffset + (height + nextHeight) / 2) {
                    newDropTargetLayerId = id;
                    newDropTargetPosition = 'above';
                    break findDropTarget;
                }
                runningOffset += height;
            }
            newDropTargetLayerId = dragItemOffsets[dragItemOffsets.length - 1].id;
            newDropTargetPosition = 'below';
        }

        if (dragItemTop - layerListTop - props.scrollTop < dragScrollMargin) {
            emit('scroll-by', -5);
        }
        if (dragItemBottom - layerListTop - props.scrollTop > props.scrollContainerHeight - dragScrollMargin) {
            emit('scroll-by', 5);
        }

        if (dropTargetLayerId.value !== newDropTargetLayerId || dropTargetPosition.value !== newDropTargetPosition) {
            dropTargetLayerId.value = newDropTargetLayerId;
            dropTargetPosition.value = newDropTargetPosition;
        }
    }
}
async function onPointerDragEndList(e: PointerEvent | MouseEvent | TouchEvent) {
    if (draggingLayerId.value != null && dropTargetLayerId.value != null && draggingLayerId.value !== dropTargetLayerId.value) {
        await historyStore.dispatch('runAction', {
            action: new ReorderLayersAction(
                [draggingLayerId.value],
                dropTargetLayerId.value,
                (dropTargetPosition.value === 'above'
                    ? 'above'
                    : (dropTargetPosition.value === 'inside' ? 'topChild' : 'below')
                )
            )
        });
    }
    draggingLayerId.value = null;
    draggingItemHtml.value = '';
    dropTargetLayerId.value = null;
}

function onToggleLayerSettings(event: MouseEvent, layer: WorkingFileAnyLayer<ColorModel>) {
    const button = (event.target as HTMLElement)?.closest('button');
    if (!button) return;
    showLayerSettingsReference.value = button;
    if (showLayerSettingsMenuFor.value === layer.id) {
        showLayerSettingsMenuFor.value = null;
    } else {
        showLayerSettingsMenuFor.value = layer.id;
    }
    showLayerSettingsMenu.value = false;
    nextTick(() => { showLayerSettingsMenu.value = showLayerSettingsMenuFor.value != null });
}

function onToggleLayerVisibility(layer: WorkingFileAnyLayer<ColorModel>) {
    let visibility = layer.visible;
    historyStore.dispatch('runAction', {
        action: new BundleAction('toggleLayerVisibility', 'action.toggleLayerVisibility' + (visibility ? 'Off' : 'On'), [
            new UpdateLayerAction({
                id: layer.id,
                visible: !visibility
            })
        ])
    });
}

function onSelectLayerFrame(layer: WorkingFileRasterSequenceLayer<ColorModel>, index: number) {
    editorStore.dispatch('setTimelineCursor', layer.data.sequence[index].start);
}

function onPlayRasterSequence(layer: WorkingFileRasterSequenceLayer<ColorModel>) {
    editorStore.set({
        timelineEnd: layer.data.sequence[layer.data.sequence.length - 1].end,
        timelinePlayStartTime: performance.now(),
        timelineStart: layer.data.sequence[0].start
    });
    editorStore.dispatch('setTimelineCursor', layer.data.sequence[0].start);
    canvasStore.set('playingAnimation', true);
}

function onStopRasterSequence() {
    editorStore.dispatch('setTimelineCursor', 0);
    canvasStore.set('playingAnimation', false);
}

function onEditLayerFilter(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
    runModule('layer', 'layerEffectEdit', {
        layerId: layer.id,
        filterIndex
    });
}

function onMoveLayerFilterUp(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
    historyStore.dispatch('runAction', {
        action: new ReorderLayerFiltersAction(layer.id, [filterIndex], filterIndex - 1, 'before')
    });
}

function onMoveLayerFilterDown(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
    historyStore.dispatch('runAction', {
        action: new ReorderLayerFiltersAction(layer.id, [filterIndex], filterIndex + 1, 'after')
    });
}

function onChildDraggingLayer(draggingProps: { id: number, html: string }) {
    if (props.isRoot) {
        draggingLayerId.value = draggingProps.id;
        draggingItemHtml.value = draggingProps.html;
    } else {
        emit('dragging-layer', draggingProps);
    }
}

function calculateDragOffsets() {
    dragItemOffsetCalculatedScrollTop = props.scrollTop;
    dragItemOffsets = [];
    let hasEncounteredCurrentLayer = false;
    const layers = layerList.value.querySelectorAll(':scope > .og-layer:not(.is-dragging)');
    layers.forEach((layerEl) => {
        const clientRect = layerEl.getBoundingClientRect();
        const id = parseInt(layerEl.getAttribute('data-layer-id') + '', 10);
        if (id != draggingLayerId.value) {
            if (hasEncounteredCurrentLayer) {
                hasEncounteredCurrentLayer = false;
                dropTargetLayerId.value = id;
                dropTargetPosition.value = 'above';
            }
            dragItemOffsets.push({
                isExpanded: layerEl.classList.contains('is-expanded'),
                top: clientRect.top + window.scrollY,
                height: clientRect.height,
                id,
            });
        } else {
            hasEncounteredCurrentLayer = true;
        }
    });
    if (hasEncounteredCurrentLayer) {
        dropTargetLayerId.value = dragItemOffsets[dragItemOffsets.length - 1].id;
        dropTargetPosition.value = 'below';
    }
}

function rasterizeLayer(layer: WorkingFileAnyLayer<ColorModel>) {
    historyStore.dispatch('runAction', {
        action: new RasterizeLayerAction(layer.id)
    })
}
</script>

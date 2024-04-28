<template>
    <ul ref="layerList"
        v-pointer.dragstart="onPointerDragStartList"
        v-pointer.dragend="onPointerDragEndList"
        v-pointer.press="onPointerPressList"
        v-pointer.move.window="onPointerMoveList"
        v-pointer.up.window="onPointerUpList"
        class="ogr-layer-list"
        :class="{ 'is-dnd-dragging': draggingLayerId != null }"
    >
        <template v-for="(layer, layerIndex) of reversedLayers" :key="layer.id">
            <li class="ogr-layer"
                :class="{
                    'is-dnd-hover': layer.id === hoveringLayerId,
                    'is-dnd-placeholder': layer.id === draggingLayerId,
                    'is-active': selectedLayerIds.includes(layer.id),
                    'is-expanded': layer.expanded,
                    'is-drag-insert-above': dropTargetLayerId === layer.id && dropTargetPosition === 'above',
                    'is-drag-insert-below': dropTargetLayerId === layer.id && dropTargetPosition === 'below',
                    'is-drag-insert-inside': dropTargetLayerId === layer.id && dropTargetPosition === 'inside'
                }"
                :style="{
                    '--layer-group-indent': depth + 'rem'
                }"
                :data-layer-id="layer.id"
            >
                <!-- Name, View, Options -->
                <span class="ogr-layer-main">
                    <span
                        class="ogr-layer-dnd-handle"
                        v-pointer.tap="onPointerTapDndHandle"
                        @mouseenter="onMouseEnterDndHandle(layer)"
                        @mouselealayerSettingsVisibilityve="onMouseLeaveDndHandle(layer)">
                        <app-layer-list-thumbnail :layer="layer" />
                        <span class="ogr-layer-name">{{ layer.name }}</span>
                        <span v-if="layer.type === 'group'" class="ogr-layer-group-arrow bi" :class="{ 'bi-chevron-right': !layer.expanded, 'bi-chevron-down': layer.expanded }" aria-hidden="true"></span>
                    </span>
                    <el-button link type="primary" class="px-2 my-1" :aria-label="$t('app.layerList.toggleLayerVisibility')" @click="onToggleLayerVisibility(layer)">
                        <i class="bi" :class="{ 'bi-eye-fill': layer.visible, 'bi-eye-slash': !layer.visible }" aria-hidden="true"></i>
                    </el-button>
                    <el-popover
                        v-model:visible="layerSettingsVisibility[layerIndex]"
                        trigger="click"
                        popper-class="p-0"
                    >
                        <template #reference>
                            <el-button link type="primary" class="px-2 mr-2 my-1 ml-0" :aria-label="$t('app.layerList.layerSettings')">
                                <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                            </el-button>
                        </template>
                        <el-menu class="el-menu--medium el-menu--borderless my-1" :default-active="layerSettingsActiveIndex" @select="onLayerSettingsSelect(layer, layerIndex, $event)">
                            <el-menu-item index="rename">
                                <i class="bi bi-alphabet"></i>
                                <span v-t="'app.layerList.rename'"></span>
                            </el-menu-item>
                            <el-menu-item index="delete">
                                <i class="bi bi-trash"></i>
                                <span v-t="'app.layerList.delete'"></span>
                            </el-menu-item>
                        </el-menu>
                    </el-popover>
                </span>
                <!-- Raster Sequence Frames -->
                <span v-if="layer.type === 'rasterSequence'" role="group" class="ogr-layer-attributes ogr-layer-frames">
                    <span class="ogr-layer-attributes__title">
                        <i class="bi bi-arrow-return-right" aria-hidden="true"></i> {{ $t('app.layerList.frames') }}
                        <el-button v-if="!playingAnimation" link type="primary" class="p-0 ml-1" style="min-height: 0" :aria-label="$t('app.layerList.playAnimation')" @click="onPlayRasterSequence(layer)"><i class="bi bi-play" aria-hidden="true"></i></el-button>
                        <el-button v-else link type="primary" class="p-0 ml-1" style="min-height: 0" :aria-label="$t('app.layerList.stopAnimation')" @click="onStopRasterSequence(layer)"><i class="bi bi-stop" aria-hidden="true"></i></el-button>
                    </span>
                    <div class="is-flex">
                        <el-scrollbar>
                            <ul class="ogr-layer-frames-list">
                                <li v-for="(frame, index) in layer.data.sequence" :key="index">
                                    <app-layer-frame-thumbnail :layer="layer" :sequence-index="index" role="button" :tabindex="0" @dragstart.prevent @click="onSelectLayerFrame(layer, index)" />
                                </li>
                            </ul>
                        </el-scrollbar>
                        <el-button :aria-label="$t('app.layerList.editFrames')" class="is-flex-grow-0 is-border-radius-attach-left px-2 py-0 mb-2">
                            <i class="bi bi-pencil-square" aria-hidden="true"></i>
                        </el-button>
                    </div>
                </span>
                <!-- Effects -->
                <span v-if="layer.filters?.length > 0" role="group" class="ogr-layer-attributes">
                    <span class="ogr-layer-attributes__title">
                        <span class="is-flex is-flex-direction-row">
                            <i class="bi bi-arrow-return-right mr-1" aria-hidden="true"></i>
                            {{ $t('app.layerList.effects') }}
                            <transition name="fade">
                                <img v-if="layer.isBaking" src="../assets/images/loading-spinner.svg" class="is-align-self-center ml-3 mr-1" style="width: 1rem" />
                            </transition>
                            <transition name="fade">
                                <span v-if="layer.isBaking" v-t="'app.layerList.recalculatingEffect'" class="has-color-primary" />
                            </transition>
                        </span>
                    </span>
                    <ul class="ogr-layer-effect-stack">
                        <li v-for="(filter, filterIndex) of layer.filters" :key="filterIndex">
                            <el-button link :type="filter.disabled ? undefined : 'primary'" @click="onEditLayerFilter(layer, filterIndex)">
                                <i class="bi bi-pencil-square mr-1" aria-hidden="true"></i>
                                <span v-t="`layerFilter.${filter.name}.name`"></span>
                            </el-button>
                            <el-button
                                link type="primary" class="px-2 my-0 ml-0"
                                :disabled="filterIndex === 0" :aria-label="$t('app.layerList.moveEffectUp')"
                                @click="onMoveLayerFilterUp(layer, filterIndex)"
                            >
                                <i class="bi bi-chevron-up" aria-hidden="true"></i>
                            </el-button>
                            <el-button
                                link type="primary" class="px-2 my-0 ml-0"
                                :disabled="filterIndex === layer.filters.length - 1" :aria-label="$t('app.layerList.moveEffectDown')"
                                @click="onMoveLayerFilterDown(layer, filterIndex)"
                            >
                                <i class="bi bi-chevron-down" aria-hidden="true"></i>
                            </el-button>
                        </li>
                    </ul>
                </span>
                <!-- No Layers Alert -->
                <el-alert
                    v-if="layer.layers && layer.expanded && layer.layers.length === 0"
                    type="info"
                    :title="$t('app.layerList.emptyGroup')"
                    show-icon
                    :closable="false"
                    class="is-justify-content-center">
                </el-alert>
                <app-layer-list
                    v-if="layer.layers && layer.expanded && layer.layers.length > 0"
                    :layers="layer.layers" :depth="depth + 1"
                />
            </li>
        </template>
        <li ref="draggingLayer" v-if="draggingLayerId != null" class="ogr-layer is-dragging" aria-hidden="true" v-html="draggingItemHtml"></li>
    </ul>
</template>

<script lang="ts">
import { defineComponent, ref, watch, reactive, computed, onMounted, onUnmounted, toRefs, nextTick, PropType } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from 'element-plus/lib/components/popover/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import pointerDirective from '@/directives/pointer';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById } from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import AppLayerListThumbnail from '@/ui/app-layer-list-thumbnail.vue';
import AppLayerFrameThumbnail from '@/ui/app-layer-frame-thumbnail.vue';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { ReorderLayersAction } from '@/actions/reorder-layers';
import { ReorderLayerFiltersAction } from '@/actions/reorder-layer-filters';
import { runModule } from '@/modules';

import type { WorkingFileAnyLayer, WorkingFileGroupLayer, ColorModel, WorkingFileRasterSequenceLayer } from '@/types';

export default defineComponent({
    name: 'AppLayerList',
    directives: {
        loading: ElLoading.directive,
        pointer: pointerDirective
    },
    components: {
        AppLayerListThumbnail,
        AppLayerFrameThumbnail,
        ElAlert,
        ElButton,
        ElMenu,
        ElMenuItem,
        ElPopover,
        ElScrollbar
    },
    props: {
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
    },
    emits: [
        'scroll-by'
    ],
    setup(props, { emit }) {
        const layerList = ref<HTMLUListElement>(null as unknown as HTMLUListElement);
        const draggingLayer = ref<HTMLLIElement | null>(null);
        const dropTargetLayerId = ref<number | null>(null);
        const dropTargetPosition = ref<'above' | 'inside' | 'below'>('above');
        const hoveringLayerId = ref<number | null>(null);
        let draggingLayerPointerOffset: number = 0;
        let draggingLayerHeight: number = 0;
        let dragItemOffsets: { isExpanded: boolean; top: number; height: number; id: number; }[] = [];
        let dragItemOffsetCalculatedScrollTop: number = 0;
        let lastDragPageY: number = 0;
        let isDragMoveUp: boolean = false;
        let dragScrollMargin: number = 20;
        let draggingLayerStartPointerId: number | null = null;
        const draggingLayerId = ref<number | null>(null);
        const draggingItemHtml = ref<string>('');

        const layerSettingsVisibility = ref<boolean[]>([]);
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

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        function reverseLayerList(layerList: WorkingFileAnyLayer<ColorModel>[]): WorkingFileAnyLayer<ColorModel>[] {
            const newLayersList = [];
            for (let i = layerList.length - 1; i >= 0; i--) {
                newLayersList.push(reactive(layerList[i]));
            }
            return newLayersList;
        }

        async function onLayerSettingsSelect(layer: WorkingFileAnyLayer<ColorModel>, layerIndex: number, action: string) {
            if (action === 'rename') {
                runModule('layer', 'rename', {
                    layerId: layer.id,
                })
            } else if (action === 'delete') {
                historyStore.dispatch('runAction', {
                    action: new DeleteLayersAction([layer.id])
                });
            }
            showLayerSettingsMenuFor.value = null;
            layerSettingsActiveIndex.value = ' ';
            await nextTick();
            layerSettingsActiveIndex.value = '';
            layerSettingsVisibility.value[layerIndex] = false;
        }

        function onMouseEnterDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
            hoveringLayerId.value = layer.id;
        }

        function onMouseLeaveDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
            hoveringLayerId.value = null;
        }

        function onPointerTapDndHandle(e: PointerEvent) {
            const layerId: number = parseInt((e.target as Element)?.closest('.ogr-layer')?.getAttribute('data-layer-id') || '-1', 10);
            const layer = getLayerById(layerId);
            if (layer) {
                if (layer.type === 'group') {
                    layer.expanded = !layer.expanded;
                }
                if (!workingFileStore.get('selectedLayerIds').includes(layerId)) {
                    historyStore.dispatch('runAction', {
                        action: new SelectLayersAction([layerId])
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
            const layerElement: Element | null | undefined = (target as Element)?.closest('.ogr-layer-dnd-handle')?.closest('.ogr-layer');

            if (layerElement?.parentNode !== layerList.value) {
                return;
            }

            const layerId: number = parseInt(layerElement?.getAttribute('data-layer-id') || '-1', 10);
            if (layerId > -1 && layerElement) {
                calculateDragOffsets();

                draggingLayerId.value = layerId;
                draggingItemHtml.value = layerElement.innerHTML;
                await nextTick();
                if (draggingLayer.value) {
                    const layerElementClientRect = layerElement.getBoundingClientRect();
                    const layerListTop = layerList.value.getBoundingClientRect().top + window.scrollY;
                    const layerElementTop = layerElementClientRect.top + window.scrollY;
                    draggingLayerPointerOffset = pageY - layerElementTop;
                    draggingLayerHeight = layerElementClientRect.height;
                    draggingLayer.value.style.top = (pageY - layerListTop - draggingLayerPointerOffset) + 'px';
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
                dropTargetLayerId.value = null;
                const layerListTop = layerList.value.getBoundingClientRect().top + window.scrollY;
                draggingLayer.value.style.top = pageY - layerListTop - draggingLayerPointerOffset + 'px';
                const dragItemHandleHeight = 64;
                const dragItemTop = pageY - draggingLayerPointerOffset;
                const dragItemBottom = dragItemTop + draggingLayerHeight;
                const dragItemTopOffset = dragItemTop + (props.scrollTop - dragItemOffsetCalculatedScrollTop);
                const dragItemBottomOffset = dragItemBottom + (props.scrollTop - dragItemOffsetCalculatedScrollTop);
                const dragItemHandleBottomOffset = dragItemTopOffset + dragItemHandleHeight;
                if (pageY < lastDragPageY) {
                    isDragMoveUp = true;
                } else if (pageY > lastDragPageY) {
                    isDragMoveUp = false;
                }
                let previousItemHalfHeight: number = 0;
                let previousItemId: number = -1;
                for (let i = 0; i < dragItemOffsets.length; i++) {
                    let nextItemHalfHeight: number = 0;
                    let nextItemId: number = -1;
                    if (dragItemOffsets[i + 1]) {
                        nextItemHalfHeight = dragItemOffsets[i + 1].height / 2;
                        nextItemId = dragItemOffsets[i + 1].id;
                    }
                    const offsetInfo = dragItemOffsets[i];
                    const offsetCenter = offsetInfo.top + (offsetInfo.height / 2);
                    if (offsetInfo.isExpanded &&
                        (isDragMoveUp && dragItemTopOffset > offsetInfo.top + (dragItemHandleHeight / 4) && dragItemTopOffset < offsetInfo.top + offsetInfo.height - (dragItemHandleHeight / 4)) ||
                        (!isDragMoveUp && dragItemBottomOffset > offsetInfo.top + (dragItemHandleHeight / 4) && dragItemBottomOffset < offsetInfo.top + offsetInfo.height - (dragItemHandleHeight / 4))
                    ) {
                        dropTargetLayerId.value = offsetInfo.id;
                        dropTargetPosition.value = 'inside';
                    } else if (isDragMoveUp &&
                        (
                            (dragItemTopOffset < offsetCenter && dragItemTopOffset > offsetInfo.top - previousItemHalfHeight) ||
                            (i === 0 && dragItemTopOffset < offsetCenter)
                        )
                    ) {
                        if (offsetInfo.id !== draggingLayerId.value && previousItemId !== draggingLayerId.value) {
                            dropTargetLayerId.value = offsetInfo.id;
                            dropTargetPosition.value = 'above';
                        }
                    } else if (
                        !isDragMoveUp &&
                        (
                            (dragItemBottomOffset < offsetInfo.top + offsetInfo.height + nextItemHalfHeight && dragItemBottomOffset > offsetCenter) ||
                            (i === dragItemOffsets.length - 1 && dragItemBottomOffset > offsetCenter)
                        )
                    ) {
                        if (offsetInfo.id !== draggingLayerId.value  && nextItemId !== draggingLayerId.value) {
                            dropTargetLayerId.value = offsetInfo.id;
                            dropTargetPosition.value = 'below';
                        }
                    }
                    previousItemHalfHeight = offsetInfo.height / 2;
                    previousItemId = offsetInfo.id;
                }
                if (dragItemTop - layerListTop - props.scrollTop < dragScrollMargin) {
                    emit('scroll-by', -5);
                }
                if (dragItemBottom - layerListTop - props.scrollTop > props.scrollContainerHeight - dragScrollMargin) {
                    emit('scroll-by', 5);
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

        function onToggleLayerSettings(layer: WorkingFileAnyLayer<ColorModel>) {
            if (showLayerSettingsMenuFor.value === layer.id) {
                showLayerSettingsMenuFor.value = null;
            } else {
                showLayerSettingsMenuFor.value = layer.id;
            }
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

        function calculateDragOffsets() {
            dragItemOffsetCalculatedScrollTop = props.scrollTop;
            dragItemOffsets = [];
            const layers = layerList.value.querySelectorAll(':scope > .ogr-layer:not(.is-dragging)');
            layers.forEach((layerEl) => {
                const clientRect = layerEl.getBoundingClientRect();
                dragItemOffsets.push({
                    isExpanded: layerEl.classList.contains('is-expanded'),
                    top: clientRect.top + window.scrollY,
                    height: clientRect.height,
                    id: parseInt(layerEl.getAttribute('data-layer-id') + '', 10)
                });
            });
        }

        return {
            layerList,
            draggingLayer,
            conditionalDragStartEventModifier,
            draggingLayerId,
            dropTargetLayerId,
            dropTargetPosition,
            draggingItemHtml,
            selectedLayerIds,
            playingAnimation,
            hoveringLayerId,
            layerSettingsVisibility,
            showLayerSettingsMenuFor,
            layerSettingsActiveIndex,
            onLayerSettingsSelect,
            onMouseEnterDndHandle,
            onMouseLeaveDndHandle,
            onPointerTapDndHandle,
            onPointerDragStartList,
            onPointerDragEndList,
            onPointerMoveList,
            onPointerUpList,
            onPointerPressList,
            onToggleLayerSettings,
            onToggleLayerVisibility,
            onSelectLayerFrame,
            onPlayRasterSequence,
            onStopRasterSequence,
            onEditLayerFilter,
            onMoveLayerFilterUp,
            onMoveLayerFilterDown,
            reversedLayers
        };
    },
    // Remove force update, not sure why it was added, but it breaks the reactivity of layer updates when using webgl renderer
    // mounted() {
    //     this.$watch(() => historyStore.state.actionStackUpdateToggle, () => {
    //         this.$forceUpdate();
    //     });
    // }
});
</script>

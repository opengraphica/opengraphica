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
        <template v-for="layer of reversedLayers" :key="layer.id">
            <li class="ogr-layer"
                :class="{
                    'is-dnd-hover': layer.id === hoveringLayerId,
                    'is-dnd-placeholder': layer.id === draggingLayerId,
                    'is-active': selectedLayerIds.includes(layer.id),
                    'is-drag-insert-top': dropTargetLayerId === layer.id && dropTargetPosition === 'before',
                    'is-drag-insert-bottom': dropTargetLayerId === layer.id && dropTargetPosition === 'after'
                }"
                :data-layer-id="layer.id"
            >
                <span class="ogr-layer-main">
                    <span
                        class="ogr-layer-dnd-handle"
                        v-pointer.tap="onPointerTapDndHandle"
                        @mouseenter="onMouseEnterDndHandle(layer)"
                        @mouseleave="onMouseLeaveDndHandle(layer)">
                        <app-layer-list-thumbnail :layer="layer" />
                        <span class="ogr-layer-name">{{ layer.name }}</span>
                    </span>
                    <el-button type="text" class="px-2" title="Toggle Layer Visibility" @click="onToggleLayerVisibility(layer)">
                        <i class="bi" :class="{ 'bi-eye': layer.visible, 'bi-eye-slash': !layer.visible }" aria-hidden="true"></i>
                    </el-button>
                    <el-button type="text" aria-label="Layer Settings" class="px-2 mr-2 my-0 ml-0" @click="onToggleLayerSettings(layer)">
                        <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                    </el-button>
                </span>
                <el-menu v-if="showLayerSettingsMenuFor === layer.id" class="el-menu--medium el-menu--borderless mb-1" @select="onLayerSettingsSelect(layer, $event)">
                    <el-menu-item index="delete">
                        <i class="bi bi-trash"></i>
                        <span>Delete</span>
                    </el-menu-item>
                </el-menu>
                <span v-if="layer.type === 'rasterSequence'" role="group" class="ogr-layer-attributes ogr-layer-frames">
                    <span class="ogr-layer-attributes__title">
                        <i class="bi bi-arrow-return-right" aria-hidden="true"></i> Frames
                        <el-button v-if="!playingAnimation" type="text" class="p-0 ml-1" style="min-height: 0" aria-label="Play Animation" @click="onPlayRasterSequence(layer)"><i class="bi bi-play" aria-hidden="true"></i></el-button>
                        <el-button v-else type="text" class="p-0 ml-1" style="min-height: 0" aria-label="Stop Animation" @click="onStopRasterSequence(layer)"><i class="bi bi-stop" aria-hidden="true"></i></el-button>
                    </span>
                    <div class="is-flex">
                        <el-scrollbar>
                            <ul class="ogr-layer-frames-list">
                                <li v-for="(frame, index) in layer.data.sequence" :key="index">
                                    <app-layer-frame-thumbnail :layer="layer" :sequence-index="index" role="button" :tabindex="0" @dragstart.prevent @click="onSelectLayerFrame(layer, index)" />
                                </li>
                            </ul>
                        </el-scrollbar>
                        <el-button aria-label="Edit Frames" class="is-flex-grow-0 is-border-radius-attach-left px-2 py-0 mb-2">
                            <i class="bi bi-pencil-square" aria-hidden="true"></i>
                        </el-button>
                    </div>
                </span>
            </li>
            <template v-if="layer.layers && layer.expanded">
                <app-layer-list :layers="layer.layers" />
            </template>
        </template>
        <li ref="draggingLayer" v-if="draggingLayerId != null" class="ogr-layer is-dragging" aria-hidden="true" v-html="draggingItemHtml"></li>
    </ul>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, reactive, onMounted, toRefs, nextTick, PropType, getCurrentInstance } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from 'element-plus/lib/components/popover/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import pointerDirective from '@/directives/pointer';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import AppLayerListThumbnail from '@/ui/app-layer-list-thumbnail.vue';
import AppLayerFrameThumbnail from '@/ui/app-layer-frame-thumbnail.vue';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { ReorderLayersAction } from '@/actions/reorder-layers';
import { WorkingFileAnyLayer, ColorModel, WorkingFileRasterSequenceLayer } from '@/types';

export default defineComponent({
    name: 'AppLayerList',
    directives: {
        loading: ElLoading.directive,
        pointer: pointerDirective
    },
    components: {
        AppLayerListThumbnail,
        AppLayerFrameThumbnail,
        ElButton,
        ElMenu,
        ElMenuItem,
        ElPopover,
        ElScrollbar
    },
    props: {
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
        const dropTargetPosition = ref<'before' | 'inside' | 'after'>('before');
        const hoveringLayerId = ref<number | null>(null);
        let draggingLayerPointerOffset: number = 0;
        let draggingLayerHeight: number = 0;
        let dragItemOffsets: { top: number; height: number; id: number; }[] = [];
        let dragItemOffsetCalculatedScrollTop: number = 0;
        let lastDragPageY: number = 0;
        let isDragMoveUp: boolean = false;
        let dragScrollMargin: number = 20;
        let draggingLayerStartPointerId: number | null = null;
        const draggingLayerId = ref<number | null>(null);
        const draggingItemHtml = ref<string>('');

        const showLayerSettingsMenuFor = ref<number | null>(null);

        const conditionalDragStartEventModifier: string = props.isRoot ? 'dragstart' : '';
        const { playingAnimation } = toRefs(canvasStore.state);
        const { selectedLayerIds } = toRefs(workingFileStore.state);

        const reversedLayers = ref<WorkingFileAnyLayer<ColorModel>[]>([]);

        watch(() => props.scrollTop, () => {
            if (draggingLayerId.value != null) {
                requestAnimationFrame(() => {
                    calculateDropPosition(lastDragPageY);
                });
            }
        });

        onMounted(() => {
            refreshLayerList();
        });

        async function onLayerSettingsSelect(layer: WorkingFileAnyLayer<ColorModel>, action: string) {
            if (action === 'delete') {
                historyStore.dispatch('runAction', {
                    action: new DeleteLayersAction([layer.id])
                });
                refreshLayerList();
            }
            showLayerSettingsMenuFor.value = null;
        }

        function onMouseEnterDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
            hoveringLayerId.value = layer.id;
        }

        function onMouseLeaveDndHandle(layer: WorkingFileAnyLayer<ColorModel>) {
            hoveringLayerId.value = null;
        }

        function onPointerTapDndHandle(e: PointerEvent) {
            const layerId: number = parseInt((e.target as Element)?.closest('.ogr-layer')?.getAttribute('data-layer-id') || '-1', 10);
            historyStore.dispatch('runAction', {
                action: new SelectLayersAction([layerId])
            });
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
                const dragItemTop = pageY - draggingLayerPointerOffset;
                const dragItemBottom = dragItemTop + draggingLayerHeight;
                const dragItemTopOffset = dragItemTop + (props.scrollTop - dragItemOffsetCalculatedScrollTop);
                const dragItemBottomOffset = dragItemBottom + (props.scrollTop - dragItemOffsetCalculatedScrollTop)
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
                    if (isDragMoveUp &&
                        (
                            (dragItemTopOffset < offsetInfo.top + (offsetInfo.height / 2) && dragItemTopOffset > offsetInfo.top - previousItemHalfHeight) ||
                            (i === 0 && dragItemTopOffset < offsetInfo.top + (offsetInfo.height / 2))
                        )
                    ) {
                        if (offsetInfo.id !== draggingLayerId.value && previousItemId !== draggingLayerId.value) {
                            dropTargetLayerId.value = offsetInfo.id;
                            dropTargetPosition.value = 'before';
                        }
                    } else if (
                        !isDragMoveUp &&
                        (
                            (dragItemBottomOffset < offsetInfo.top + offsetInfo.height + nextItemHalfHeight && dragItemBottomOffset > offsetInfo.top + (offsetInfo.height / 2)) ||
                            (i === dragItemOffsets.length - 1 && dragItemBottomOffset > offsetInfo.top + (offsetInfo.height / 2))
                        )
                    ) {
                        if (offsetInfo.id !== draggingLayerId.value  && nextItemId !== draggingLayerId.value) {
                            dropTargetLayerId.value = offsetInfo.id;
                            dropTargetPosition.value = 'after';
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
            if (draggingLayerId.value != null && dropTargetLayerId.value != null) {
                await historyStore.dispatch('runAction', {
                    action: new ReorderLayersAction([draggingLayerId.value], dropTargetLayerId.value, dropTargetPosition.value === 'before' ? 'above' : 'below')
                });
            }
            draggingLayerId.value = null;
            draggingItemHtml.value = '';
            dropTargetLayerId.value = null;
            refreshLayerList();
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
                action: new BundleAction('toggle_layer_visibility', 'Toggle Layer Visibility ' + (visibility ? 'Off' : 'On'), [
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

        function calculateDragOffsets() {
            dragItemOffsetCalculatedScrollTop = props.scrollTop;
            dragItemOffsets = [];
            const layers = layerList.value.querySelectorAll(':scope > .ogr-layer:not(.is-dragging)');
            layers.forEach((layerEl) => {
                const clientRect = layerEl.getBoundingClientRect();
                dragItemOffsets.push({
                    top: clientRect.top + window.scrollY,
                    height: clientRect.height,
                    id: parseInt(layerEl.getAttribute('data-layer-id') + '', 10)
                });
            });
        }

        function refreshLayerList() {
            const newLayersList = [];
            for (let i = props.layers.length - 1; i >= 0; i--) {
                newLayersList.push(reactive(props.layers[i]));
            }
            reversedLayers.value = newLayersList;
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
            showLayerSettingsMenuFor,
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
            reversedLayers
        };
    },
    mounted() {
        this.$watch(() => historyStore.state.actionStackUpdateToggle, () => {
            this.$forceUpdate();
        });
    }
});
</script>

<template>
    <ul class="ogr-layer-list">
        <template v-for="layer of reversedLayers" :key="layer.id">
            <li class="ogr-layer" :class="{ 'is-dnd-hover': layer.id === hoveringLayerId }">
                <span class="ogr-layer-main">
                    <span class="ogr-layer-dnd-handle" @mouseenter="onMouseEnterDndHandle(layer)" @mouseleave="onMouseLeaveDndHandle(layer)">
                        <app-layer-list-thumbnail :layer="layer" />
                        <span class="ogr-layer-name">{{ layer.name }}</span>
                    </span>
                    <el-button type="text" class="px-2" aria-label="Toggle Layer Visibility" @click="onToggleLayerVisibility(layer)">
                        <i class="bi" :class="{ 'bi-eye': layer.visible, 'bi-eye-slash': !layer.visible }" aria-hidden="true"></i>
                    </el-button>
                    <el-button type="text" aria-label="Layer Settings" class="px-2 mr-2 my-0 ml-0">
                        <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                    </el-button>
                </span>
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
    </ul>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, reactive, toRefs, nextTick, PropType, getCurrentInstance } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElLoading from 'element-plus/lib/el-loading';
import ElScrollbar from 'element-plus/lib/el-scrollbar';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import AppLayerListThumbnail from '@/ui/app-layer-list-thumbnail.vue';
import AppLayerFrameThumbnail from '@/ui/app-layer-frame-thumbnail.vue';
import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';
import { WorkingFileAnyLayer, RGBAColor, WorkingFileRasterSequenceLayer } from '@/types';

export default defineComponent({
    name: 'AppLayerList',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppLayerListThumbnail,
        AppLayerFrameThumbnail,
        ElButton,
        ElScrollbar
    },
    props: {
        layers: {
            type: Array as PropType<WorkingFileAnyLayer<RGBAColor>[]>,
            required: true
        }
    },
    emits: [
    ],
    setup(props, { emit }) {
        const hoveringLayerId = ref<number | null>(null);

        const { playingAnimation } = toRefs(canvasStore.state);

        const reversedLayers = computed(() => {
            const newLayersList = [];
            for (let i = props.layers.length - 1; i >= 0; i--) {
                newLayersList.push(reactive(props.layers[i]));
            }
            return newLayersList;
        });

        function onMouseEnterDndHandle(layer: WorkingFileAnyLayer<RGBAColor>) {
            hoveringLayerId.value = layer.id;
        }

        function onMouseLeaveDndHandle(layer: WorkingFileAnyLayer<RGBAColor>) {
            hoveringLayerId.value = null;
        }

        function onToggleLayerVisibility(layer: WorkingFileAnyLayer<RGBAColor>) {
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

        function onSelectLayerFrame(layer: WorkingFileRasterSequenceLayer<RGBAColor>, index: number) {
            editorStore.dispatch('setTimelineCursor', layer.data.sequence[index].start);
        }

        function onPlayRasterSequence(layer: WorkingFileRasterSequenceLayer<RGBAColor>) {
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

        return {
            playingAnimation,
            hoveringLayerId,
            onMouseEnterDndHandle,
            onMouseLeaveDndHandle,
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

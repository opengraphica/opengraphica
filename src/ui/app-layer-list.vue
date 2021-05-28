<template>
    <ul class="ogr-layer-list">
        <template v-for="layer of reversedLayers" :key="layer.id">
            <li class="ogr-layer" :class="{ 'is-dnd-hover': layer.id === hoveringLayerId }">
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
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import AppLayerListThumbnail from '@/ui/app-layer-list-thumbnail.vue';
import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';
import { WorkingFileAnyLayer, RGBAColor } from '@/types';

export default defineComponent({
    name: 'AppLayerList',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppLayerListThumbnail,
        ElButton
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
        const { ctx: vm } = getCurrentInstance() as any;

        const hoveringLayerId = ref<number | null>(null);

        const reversedLayers = computed(() => {
            const newLayersList = [];
            for (let i = props.layers.length - 1; i >= 0; i--) {
                newLayersList.push(reactive(props.layers[i]));
            }
            return newLayersList;
        });

        watch(() => historyStore.state.actionStackUpdateToggle, () => {
            vm.$forceUpdate();
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

        return {
            hoveringLayerId,
            onMouseEnterDndHandle,
            onMouseLeaveDndHandle,
            onToggleLayerVisibility,
            reversedLayers
        };
    }
});
</script>

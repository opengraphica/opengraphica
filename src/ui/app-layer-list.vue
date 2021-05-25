<template>
    <ul class="ogr-layer-list">
        <template v-for="layer of reversedLayers" :key="layer.id">
            <li class="ogr-layer">
                <app-layer-list-thumbnail :layer="layer" />
                <span class="ogr-layer-name">{{ layer.name }}</span>
                <el-button type="text" class="px-2">
                    <i class="bi bi-eye" aria-hidden="true"></i>
                </el-button>
                <el-button type="text" class="pl-2 pr-4 m-0">
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
import { defineComponent, ref, computed, toRefs, nextTick, PropType } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElLoading from 'element-plus/lib/el-loading';
import workingFileStore from '@/store/working-file';
import AppLayerListThumbnail from '@/ui/app-layer-list-thumbnail.vue';
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
        const reversedLayers = computed(() => {
            const newLayersList = [];
            for (let i = props.layers.length - 1; i >= 0; i--) {
                newLayersList.push(props.layers[i]);
            }
            return newLayersList;
        });

        return {
            reversedLayers
        };
    }
});
</script>

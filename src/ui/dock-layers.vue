<template>
    <div style="width: 350px; max-width: 100%">
        <template v-if="layers.length > 0">
            <app-layer-list :layers="layers" />
        </template>
        <template v-else>
            <p class="mx-4 has-text-centered">No Layers Yet.</p>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, nextTick } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';
import AppLayerList from '@/ui/app-layer-list.vue';
import workingFileStore from '@/store/working-file';

const activeTab = ref<string>('file');

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppLayerList
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Layers');

        const layers = workingFileStore.state.layers;

        return {
            layers
        };
    }
});
</script>

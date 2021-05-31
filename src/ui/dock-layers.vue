<template>
    <div style="width: 350px; max-width: 100%">
        <template v-if="layers.length > 0">
            <el-scrollbar>
                <app-layer-list :layers="layers" :is-root="true" />
            </el-scrollbar>
        </template>
        <template v-else>
            <p class="mx-4 has-text-centered">No Layers Yet.</p>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, nextTick } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';
import ElScrollbar from 'element-plus/lib/el-scrollbar';
import AppLayerList from '@/ui/app-layer-list.vue';
import workingFileStore from '@/store/working-file';

const activeTab = ref<string>('file');

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppLayerList,
        ElScrollbar
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Layers');

        const { layers } = toRefs(workingFileStore.state);

        return {
            layers
        };
    }
});
</script>

<template>
    <div class="ogr-dock-content">
        <el-scrollbar ref="scrollbar" @scroll="onScrollLayerList">
            <template v-if="layers.length > 0">
                <app-layer-list
                    :layers="layers"
                    :is-root="true"
                    :scroll-container-height="scrollContainerHeight"
                    :scroll-top="scrollTop"
                    @scroll-by="onScrollByAmount($event)"
                />
            </template>
            <template v-else>
                <p class="mx-4 has-text-centered">No Layers Yet.</p>
            </template>
        </el-scrollbar>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, onMounted, nextTick } from 'vue';
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
        const scrollbar = ref<typeof ElScrollbar>(null as unknown as typeof ElScrollbar);
        const scrollContainerHeight = ref<number>(0);
        const scrollTop = ref<number>(0);
        
        let scrollbarWrap = document.createElement('div');
        
        onMounted(() => {
            scrollbarWrap = scrollbar.value.$el.querySelector('.el-scrollbar__wrap');
        });

        function onScrollLayerList() {
            scrollTop.value = scrollbarWrap.scrollTop;
            scrollContainerHeight.value = scrollbarWrap.clientHeight;
        }

        function onScrollByAmount(amount: number) {
            let newScrollTop = scrollbarWrap.scrollTop + amount;
            if (newScrollTop < 0) {
                newScrollTop = 0;
            }
            if (newScrollTop > scrollbarWrap.scrollHeight - scrollbarWrap.clientHeight) {
                newScrollTop = scrollbarWrap.scrollHeight - scrollbarWrap.clientHeight;
            }
            scrollbarWrap.scrollTop = newScrollTop;
            scrollTop.value = newScrollTop;
        }

        return {
            layers,
            scrollbar,
            scrollContainerHeight,
            scrollTop,
            onScrollLayerList,
            onScrollByAmount
        };
    }
});
</script>

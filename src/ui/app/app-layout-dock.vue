<template>
    <div ref="dockLayout" class="ogr-layout-dock" :style="{ width: '320px' }">
        <div v-for="dockDefinition of config.layout" :key="dockDefinition.name" class="ogr-layout-dock__container" :style="{ 'height': (dockDefinition.ratio * 100) + '%' }">
            <div v-if="dockDefinition.title" class="ogr-dock-title" v-t="dockDefinition.title"></div>
            <dock :name="dockDefinition.name" @update:title="dockDefinition.title = $event" />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, PropType } from 'vue';
import { DndLayoutDock } from '@/types';
import Dock from '@/ui/dock/dock.vue';

export default defineComponent({
    name: 'AppLayoutDock',
    components: {
        Dock
    },
    props: {
        config: {
            type: Object as PropType<DndLayoutDock>,
            required: true
        },
        layoutPlacement: {
            type: String as PropType<'left' | 'right'>,
            default: 'right'
        }
    },
    emit: ['resize'],
    setup(props, { emit }) {
        const dockLayout = ref<HTMLDivElement>();

        onMounted(() => {
            emit('resize');
        });

        return {
            dockLayout
        };
    }
});
</script>
<template>
    <div
        ref="dockLayout"
        class="og-layout-dock"
        :class="{
            'og-layout-dock--resizing': draggingDividerIndex > -1
        }"
        :style="{ width: '320px' }"
    >
        <template v-for="(dockDefinition, dockContainerIndex) of config.layout" :key="dockDefinition.name">
            <div class="og-layout-dock__container" :style="{ 'height': (dockContainerRatios[dockContainerIndex] * 100) + '%' }">
                <div v-if="dockDefinition.title" class="og-dock-title" v-t="dockDefinition.title"></div>
                <dock :name="dockDefinition.name" @update:title="dockDefinition.title = $event" />
            </div>
            <div
                v-if="dockContainerIndex < config.layout.length - 1"
                ref="dockDivider"
                class="og-layout-dock__divider"
                tabindex="-1"
                :data-divider-index="dockContainerIndex"
                v-pointer.down="onPointerDownDivider"
                v-pointer.move.window="draggingDividerIndex > -1 ? onPointerMoveDivider : undefined"
                v-pointer.up.window="draggingDividerIndex > -1 ? onPointerUpDivider : undefined"
            />
        </template>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch, type PropType } from 'vue';
import Dock from '@/ui/dock/dock.vue';

import pointerDirective from '@/directives/pointer';

import type { DndLayoutDock } from '@/types';

export default defineComponent({
    name: 'AppLayoutDock',
    directives: {
        pointer: pointerDirective
    },
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
        const dockDivider = ref<HTMLDivElement[]>([]);

        const minContainerHeight = 40;

        const draggingDividerIndex = ref(-1);
        const draggingAvailableHeight = ref(1);
        const draggingSplitAvailableHeight = ref(1);
        const dragStartY = ref(0);
        const dragStartTopContainerRatio = ref(1);
        const dockHeight = ref(1);
        const dividerHeight = ref(1);
        const dockContainerRatios = ref<number[]>([]);

        const dividerCount = computed(() => props.config.layout.length - 1);

        watch(() => props.config.layout, (layout) => {
            dockContainerRatios.value = layout.map(layout => layout.ratio);
        }, { immediate: true });

        onMounted(() => {
            emit('resize');
        });

        function onPointerDownDivider(event: PointerEvent) {
            if (!event.target) return;

            const dividerIndex = (event.target as Element).getAttribute('data-divider-index');
            if (dividerIndex == null) return;

            draggingDividerIndex.value = parseInt(dividerIndex);
            dragStartY.value = event.pageY;
            dockHeight.value = dockLayout.value?.getBoundingClientRect().height ?? 1;
            dividerHeight.value = dockDivider.value[0]?.getBoundingClientRect().height ?? 1;
            
            dragStartTopContainerRatio.value = dockContainerRatios.value[draggingDividerIndex.value];
            draggingAvailableHeight.value = dockHeight.value - (dividerCount.value * dividerHeight.value);
            draggingSplitAvailableHeight.value = (
                draggingAvailableHeight.value *
                (dragStartTopContainerRatio.value + dockContainerRatios.value[draggingDividerIndex.value + 1])
            );
        }

        function onPointerMoveDivider(event: PointerEvent) {
            if (draggingDividerIndex.value < 0) return;

            const yOffset = event.pageY - dragStartY.value;
            let newTopContainerHeight = Math.max(
                minContainerHeight, (draggingSplitAvailableHeight.value * dragStartTopContainerRatio.value) + yOffset
            );
            if (newTopContainerHeight > draggingSplitAvailableHeight.value - minContainerHeight) {
                newTopContainerHeight = draggingSplitAvailableHeight.value - minContainerHeight;
            }
            dockContainerRatios.value[draggingDividerIndex.value] = newTopContainerHeight / draggingAvailableHeight.value;
            dockContainerRatios.value[draggingDividerIndex.value + 1] = (draggingAvailableHeight.value - newTopContainerHeight) / draggingAvailableHeight.value;
        }

        function onPointerUpDivider(event: PointerEvent) {
            if (draggingDividerIndex.value < 0) return;

            draggingDividerIndex.value = -1;
        }

        return {
            dockLayout,
            dockDivider,

            dockContainerRatios,
            draggingDividerIndex,

            onPointerDownDivider,
            onPointerMoveDivider,
            onPointerUpDivider,
        };
    }
});
</script>
<template>
    <el-tooltip
        ref="tooltipRef"
        v-bind="$attrs"
        :trigger="trigger"
        :placement="placement"
        :disabled="disabled"
        :visible="visible"
        :transition="transition"
        :popper-options="popperOptions"
        :tabindex="tabindex"
        :content="content"
        :offset="offset"
        :show-after="showAfter"
        :hide-after="hideAfter"
        :auto-close="autoClose"
        :show-arrow="showArrow"
        :aria-label="title"
        :effect="effect"
        :enterable="enterable"
        :popper-class="kls"
        :popper-style="style"
        :teleported="teleported"
        :persistent="persistent"
        :gpu-acceleration="gpuAcceleration"
        @update:visible="onUpdateVisible"
        @before-show="beforeEnter"
        @before-hide="beforeLeave"
        @show="afterEnter"
        @hide="afterLeave"
    >
        <template v-if="$slots.reference">
            <slot name="reference" />
        </template>

        <template #content>
            <div v-if="title" :class="ns.e('title')" role="title">
                {{ title }}
            </div>
            <slot>
                {{ content }}
            </slot>
        </template>
    </el-tooltip>
</template>

<script lang="ts">
import { computed, ref, unref, defineComponent, watch, onMounted, onUnmounted } from 'vue';
import { ElTooltip } from 'element-plus/lib/components/tooltip/index';
import { addUnit } from 'element-plus/lib/utils/index';
import { useNamespace } from 'element-plus/lib/hooks/index';
import { popoverEmits, popoverProps } from 'element-plus/lib/components/popover/index';
import editorStore from '@/store/editor';

import type { TooltipInstance } from 'element-plus/lib/components/tooltip/index';

let popperContainer: any = null; // Opengraphica Custom
let popoverCounter: number = 0;  // Opengraphica Custom

export default defineComponent({
    name: 'ElPopover',
    props: popoverProps,
    emits: popoverEmits,
    components: {
        ElTooltip
    },
    setup(props, { expose, emit }) {
        let isMounted: boolean = false; // Opengraphica Custom
        const trackingId: number = popoverCounter++; // Opengraphica Custom

        const updateEventKeyRaw = `onUpdate:visible` as const;
        const onUpdateVisible = computed(() => {
            return props[updateEventKeyRaw];
        });
        const ns = useNamespace('popover');
        const tooltipRef = ref<TooltipInstance>();
        const popperRef = computed(() => {
            return unref(tooltipRef)?.popperRef;
        });

        watch(() => props.visible, (newValue) => { // Opengraphica Custom
            popperContainer = document.querySelector('body > div[id^="el-popper-container"]');
            if (popperContainer) { // Opengraphica Custom
                const opengraphica = document.querySelector('.opengraphica'); // Opengraphica Custom
                if (opengraphica) { // Opengraphica Custom
                    opengraphica.appendChild(popperContainer); // Opengraphica Custom
                } // Opengraphica Custom
            } // Opengraphica Custom
        }, { immediate: true }); // Opengraphica Custom

        const style = computed(() => {
            return [
                {
                    width: addUnit(props.width),
                },
                props.popperStyle!,
            ];
        });
        const kls = computed(() => {
            return [ns.b(), props.popperClass!, { [ns.m('plain')]: !!props.content }];
        });
        const gpuAcceleration = computed(() => {
            return props.transition === `${ns.namespace.value}-fade-in-linear`;
        });

        onMounted(() => { // Opengraphica Custom
            isMounted = true; // Opengraphica Custom
        }); // Opengraphica Custom
        onUnmounted(() => { // Opengraphica Custom
            isMounted = false; // Opengraphica Custom
            editorStore.set('activePopoverIds', editorStore.get('activePopoverIds').filter(id => id !== trackingId)); // Opengraphica Custom
        }); // Opengraphica Custom

        const hide = () => {
            tooltipRef.value?.hide();
        };
        const beforeEnter = () => {
            emit('before-enter');
        };
        const beforeLeave = () => {
            emit('before-leave');
        };
        const afterEnter = () => {
            const activePopoverIds = editorStore.get('activePopoverIds'); // Opengraphica Custom
            if (!activePopoverIds.includes(trackingId) && isMounted) { // Opengraphica Custom
                activePopoverIds.push(trackingId); // Opengraphica Custom
                editorStore.set('activePopoverIds', activePopoverIds); // Opengraphica Custom
            } // Opengraphica Custom

            emit('after-enter');
        };
        const afterLeave = () => {
            editorStore.set('activePopoverIds', editorStore.get('activePopoverIds').filter(id => id !== trackingId)); // Opengraphica Custom

            emit('update:visible', false);
            emit('after-leave');
        };
        expose({
            /** @description popper ref */
            popperRef,
            /** @description hide popover */
            hide,
        });
        return {
            updateEventKeyRaw,
            onUpdateVisible,
            ns,
            tooltipRef,
            popperRef,
            style,
            kls,
            gpuAcceleration,
            hide,
            beforeEnter,
            beforeLeave,
            afterEnter,
            afterLeave
        }
    }
});
</script>

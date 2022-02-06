<template>
    <el-tooltip
        ref="tooltipRef"
        v-bind="$attrs"
        :aria-label="title"
        :effect="effect"
        :enterable="enterable"
        :popper-class="kls"
        :popper-style="style"
        :append-to="appendTo"
        :visible="visible"
        persistent
        @show="afterEnter"
        @hide="afterLeave"
    >
        <template v-if="$slots.reference">
            <slot name="reference" />
        </template>

        <template #content>
            <div v-if="title" class="el-popover__title" role="title">
                {{ title }}
            </div>
            <slot>
                {{ content }}
            </slot>
        </template>
    </el-tooltip>
</template>
<script lang="ts">
import { defineComponent, computed, ref, unref, watch } from 'vue';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import { isString } from 'element-plus/lib/utils/util';
import { usePopoverProps } from 'element-plus/lib/components/popover/src/popover';
import { useTooltipContentProps } from 'element-plus/lib/components/tooltip/src/tooltip';
import { POPPER_CONTAINER_SELECTOR } from 'element-plus/lib/components/popper/src/container';

import type { StyleValue } from 'vue';

const emits = ['update:visible', 'after-enter', 'after-leave'];

const NAME = 'ElPopover';

let popperContainer: any = null;

export default defineComponent({
    name: NAME,
    components: {
        ElTooltip,
    },
    props: {
        appendTo: useTooltipContentProps.appendTo,
        visible: useTooltipContentProps.visible,
        ...usePopoverProps
    },
    emits,
    setup(props, { emit }) {
        
        const tooltipRef = ref<InstanceType<typeof ElTooltip> | null>(null);
        const popperRef = computed(() => {
            return unref(tooltipRef)?.popperRef;
        });
        const width = computed(() => {
            if (isString(props.width)) {
                return props.width as string;
            }
            return `${props.width}px`;
        });

        if (!popperContainer) {
            watch(() => props.visible, (newValue) => {
                if (!popperContainer) {
                    const opengraphica = document.querySelector('.opengraphica');
                    if (opengraphica) {
                        popperContainer = document.querySelector('[id^="el-popper-container"]');
                        opengraphica.appendChild(popperContainer);
                    }
                }
            });
        }

        const style = computed(() => {
            return [
                {
                    width: width.value,
                },
                props.popperStyle,
            ] as StyleValue;
        });

        const kls = computed(() => {
            return [
                { 'el-popover--plain': !!props.content },
                'el-popover',
                props.popperClass,
            ];
        });

        const hide = () => {
            tooltipRef.value?.hide();
        };

        const afterEnter = () => {
            emit('after-enter')
        }

        const afterLeave = () => {
            emit('after-leave')
        }

        return {
            kls,
            style,
            tooltipRef,
            popperRef,
            hide,
            afterEnter,
            afterLeave,
        };
    },
});
</script>

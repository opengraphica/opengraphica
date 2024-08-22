<template>
    <div class="el-input el-input-group el-input-group--prepend">
        <el-tooltip v-if="prependTooltip" :content="prependTooltip" placement="top" :trigger="prependTooltip ? 'hover' : 'manual'" :show-after="tooltipShowDelay">
            <div ref="prependEl" v-if="$slots.prepend" class="el-input-group__prepend px-2">
                <slot name="prepend" />
            </div>
        </el-tooltip>
        <template v-else>
            <div ref="prependEl" v-if="$slots.prepend" class="el-input-group__prepend px-2">
                <slot name="prepend" />
            </div>
        </template>
        <slot />
        <div v-if="$slots.append" class="el-input-group__append px-2">
            <slot name="append" />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, nextTick } from 'vue';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import preferencesStore from '@/store/preferences';

export default defineComponent({
    name: 'ElInputGroup',
    components: {
        ElTooltip
    },
    props: {
        prependTooltip: {
            type: String
        }
    },
    setup(props, { emit }) {
        const prependEl = ref<HTMLDivElement>();

        return {
            tooltipShowDelay: preferencesStore.state.tooltipShowDelay,
            prependEl
        };
    }
});
</script>

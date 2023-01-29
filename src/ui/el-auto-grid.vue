<template>
    <div class="el-auto-grid" :style="{ '--item-desired-width': itemWidth, '--row-gap': rowGap, '--column-gap': columnGap }">
        <slot />
    </div>
</template>
<script lang="ts">
import { defineComponent, ref, reactive, computed, watch, nextTick } from 'vue';
export default defineComponent({
    name: 'ElAutoGrid',
    inheritAttrs: false,
    props: {
        itemWidth: {
            type: String,
            default: '10rem'
        },
        rowGap: {
            type: String,
            default: '.4rem'
        },
        columnGap: {
            type: String,
            default: '.4rem'
        }
    }
});
</script>

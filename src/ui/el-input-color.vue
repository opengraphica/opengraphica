<template>
    <div class="el-color-picker el-tooltip__trigger el-tooltip__trigger">
        <div class="el-color-picker__trigger">
            <span class="el-color-picker__color">
                <span class="el-color-picker__color-inner" style="background-color: rgb(0, 0, 0);">
                    <span class="bi bi-chevron-down el-color-picker__icon is-icon-arrow-down"></span>
                </span>
            </span>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, PropType, onMounted, nextTick } from 'vue';

export default defineComponent({
    name: 'ElInputColor',
    props: {
        modelValue: {
            type: Object
        }
    },
    setup() {

    }
});
</script>
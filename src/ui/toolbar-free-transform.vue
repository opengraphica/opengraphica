<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <!--
        <div class="ogr-toolbar-overlay p-2">
            <el-select aria-label="Layer Selection" v-model="layerPickMode" :popper-append-to-body="false" style="width: 6.5rem">
                <el-option label="Current" value="current"></el-option>
                <el-option label="Auto" value="auto"></el-option>
            </el-select>
            <el-button plain type="text" class="px-4" aria-label="Preferences">
                <i class="bi bi-sliders"></i>
            </el-button>
        </div>
        -->
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import { layerPickMode } from '@/canvas/store/free-transform-state';
import ElButton from 'element-plus/lib/components/button/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

export default defineComponent({
    name: 'ToolbarFreeTransform',
    components: {
        ElButton,
        ElOption,
        ElSelect
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
       return {
           layerPickMode
       };
    }
});
</script>

<template>
    <div class="is-flex container is-align-items-center is-justify-content-space-between mx-auto">
        Test
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';

export default defineComponent({
    name: 'ToolbarCropResize',
    directives: {
        loading: ElLoading.directive
    },
    components: {

    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
       
    }
});
</script>

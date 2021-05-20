<template>
    <div class="ogr-layer-thumbnail">
        <img :src="thumbnailImageSrc" alt="thumbnail" :class="{ 'is-larger-width': isLargerWidth }" />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, nextTick, PropType } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';
import workingFileStore from '@/store/working-file';
import { drawWorkingFileLayerToCanvas } from '@/lib/canvas';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { CanvasRenderingContext2DEnhanced, WorkingFileAnyLayer, RGBAColor } from '@/types';

export default defineComponent({
    name: 'AppLayerListThumbnail',
    directives: {
        loading: ElLoading.directive
    },
    components: {

    },
    props: {
        layer: {
            type: Object as PropType<WorkingFileAnyLayer<RGBAColor>>,
            required: true
        }
    },
    setup(props, { emit }) {
        const thumbnailSize = 70;

        const isLargerWidth = computed<boolean>(() => {
            return workingFileStore.state.width > workingFileStore.state.height;
        });

        const thumbnailImageSrc = computed<string>(() => {
            if (!props.layer.thumbnailImageSrc) {
                const canvas = document.createElement('canvas');
                const imageWidth = workingFileStore.state.width;
                const imageHeight = workingFileStore.state.height;
                let thumbnailWidth = 1;
                let thumbnailHeight = 1;
                let thumbnailScale = 1;
                if (imageWidth > imageHeight) {
                    thumbnailWidth = thumbnailSize;
                    thumbnailScale = thumbnailSize / imageWidth;
                    thumbnailHeight = Math.floor(imageHeight / imageWidth * thumbnailSize);
                } else {
                    thumbnailHeight = thumbnailSize;
                    thumbnailScale = thumbnailSize / imageHeight;
                    thumbnailWidth = Math.floor(imageWidth / imageHeight * thumbnailSize);
                }
                canvas.width = thumbnailWidth;
                canvas.height = thumbnailHeight;
                let ctx: CanvasRenderingContext2DEnhanced = canvas.getContext('2d') as CanvasRenderingContext2DEnhanced;
                ctx.scale(thumbnailScale, thumbnailScale);
                drawWorkingFileLayerToCanvas(canvas, ctx, props.layer, {
                    translateX: 0,
                    translateY: 0,
                    rotation: 0,
                    skewX: 0,
                    scaleX: 1,
                    scaleY: 1
                } as DecomposedMatrix);
                props.layer.thumbnailImageSrc = canvas.toDataURL();
            }
            return props.layer.thumbnailImageSrc;
        });

        return {
            isLargerWidth,
            thumbnailImageSrc
        };
    }
});
</script>
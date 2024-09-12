<template>
    <div class="ogr-layer-thumbnail">
        <img :src="thumbnailImageSrc" alt="thumbnail" :class="{ 'is-larger-width': isLargerWidth }" @touchstart="$event.preventDefault()" />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, nextTick, PropType } from 'vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import renderers from '@/canvas/renderers';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { WorkingFileAnyLayer, ColorModel } from '@/types';

export default defineComponent({
    name: 'AppLayerListThumbnail',
    directives: {
        loading: ElLoading.directive
    },
    components: {

    },
    props: {
        layer: {
            type: Object as PropType<WorkingFileAnyLayer<ColorModel>>,
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
                let ctx: CanvasRenderingContext2D = canvas.getContext('2d', getCanvasRenderingContext2DSettings()) as CanvasRenderingContext2D;
                ctx.scale(thumbnailScale, thumbnailScale);
                new renderers['2d'][props.layer.type]().draw(ctx, props.layer, {
                    visible: true,
                    globalCompositeOperation: 'source-over',
                });
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

<template>
    <div class="ogr-layer-thumbnail" :class="{ 'is-active': isActiveLayer }">
        <img :src="thumbnailImageSrc" alt="thumbnail" :class="{ 'is-larger-width': isLargerWidth }" />
        <div class="ogr-layer-thumbnail__label">{{ sequenceIndex }}</div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, toRefs, nextTick, PropType } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';
import editorStore from '@/store/editor';
import { CanvasRenderingContext2DEnhanced, WorkingFileRasterSequenceLayer, RGBAColor } from '@/types';

export default defineComponent({
    name: 'AppLayerFrameThumbnail',
    directives: {
        loading: ElLoading.directive
    },
    components: {

    },
    props: {
        layer: {
            type: Object as PropType<WorkingFileRasterSequenceLayer<RGBAColor>>,
            required: true
        },
        sequenceIndex: {
            type: Number,
            required: true
        }
    },
    setup(props, { emit }) {
        const thumbnailSize = 70;

        const isActiveLayer = ref<boolean>(false);

        const isLargerWidth = computed<boolean>(() => {
            return props.layer.width > props.layer.height;
        });

        const thumbnailImageSrc = computed<string>(() => {
            const frame = props.layer.data.sequence[props.sequenceIndex];
            if (!frame.thumbnailImageSrc && frame.image.sourceImage) {
                const canvas = document.createElement('canvas');
                const layerWidth = props.layer.width;
                const layerHeight = props.layer.height;
                let thumbnailWidth = 1;
                let thumbnailHeight = 1;
                let thumbnailScale = 1;
                if (layerWidth > layerHeight) {
                    thumbnailWidth = thumbnailSize;
                    thumbnailScale = thumbnailSize / layerWidth;
                    thumbnailHeight = Math.floor(layerHeight / layerWidth * thumbnailSize);
                } else {
                    thumbnailHeight = thumbnailSize;
                    thumbnailScale = thumbnailSize / layerHeight;
                    thumbnailWidth = Math.floor(layerWidth / layerHeight * thumbnailSize);
                }
                canvas.width = thumbnailWidth;
                canvas.height = thumbnailHeight;
                let ctx: CanvasRenderingContext2DEnhanced = canvas.getContext('2d') as CanvasRenderingContext2DEnhanced;
                ctx.scale(thumbnailScale, thumbnailScale);
                ctx.drawImage(frame.image.sourceImage, 0, 0);
                frame.thumbnailImageSrc = canvas.toDataURL();
            }
            return frame.thumbnailImageSrc || '';
        });

        watch(() => editorStore.state.timelineCursor, () => {
            isActiveLayer.value = props.layer.data.currentFrame === props.layer.data.sequence[props.sequenceIndex].image;
        }, { immediate: true });

        return {
            isActiveLayer,
            isLargerWidth,
            thumbnailImageSrc
        };
    }
});
</script>

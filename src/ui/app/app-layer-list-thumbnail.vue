<template>
    <div class="og-layer-thumbnail">
        <img :src="thumbnailImageSrc" alt="thumbnail" :class="{ 'is-larger-width': isLargerWidth }" @touchstart="$event.preventDefault()" />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch, PropType } from 'vue';

import ElLoading from 'element-plus/lib/components/loading/index';

import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import renderers from '@/canvas/renderers';
import { createCanvasFromImage } from '@/lib/image';

import { useRenderer } from '@/renderers';

import type { WorkingFileAnyLayer, ColorModel } from '@/types';

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

        const thumbnailImageSrc = ref<string>('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
        let thumbnailCanvas = document.createElement('canvas');
        let thumbnailCanvasCtx = thumbnailCanvas.getContext('bitmaprenderer', getCanvasRenderingContext2DSettings());

        watch(() => props.layer.thumbnailImageSrc, async (layerThumbnailSrc) => {
            if (!layerThumbnailSrc) {
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

                const renderer = await useRenderer();
                const thumbnailBitmap = await renderer.takeSnapshot(thumbnailWidth, thumbnailHeight, { layerIds: [props.layer.id] });
                if (thumbnailCanvas.width !== thumbnailBitmap.width || thumbnailCanvas.height !== thumbnailBitmap.height) {
                    thumbnailCanvas.width = thumbnailBitmap.width;
                    thumbnailCanvas.height = thumbnailBitmap.height;
                }
                thumbnailCanvasCtx?.transferFromImageBitmap(thumbnailBitmap);
                const dataUrl = thumbnailCanvas.toDataURL();
                props.layer.thumbnailImageSrc = dataUrl;
                thumbnailImageSrc.value = dataUrl;
            }
        }, { immediate: true });

        return {
            isLargerWidth,
            thumbnailImageSrc
        };
    }
});
</script>

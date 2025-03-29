<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-zoom-in my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-button-group class="el-button-group--flex">
                    <el-button size="small" plain :aria-label="$t('toolbar.zoom.zoomOut')" :title="$t('toolbar.zoom.zoomOut')" @click="isZoomLevelTouched = true; zoomLevel *= 1/1.25">
                        <i class="bi bi-zoom-out" aria-hidden="true" />
                    </el-button>
                    <el-input-number v-model.lazy="zoomLevel" :blur-on-enter="true" suffix-text="%" size="small" class="el-input--text-center" style="width: 4rem" @input="isZoomLevelTouched = true"/>
                    <el-button size="small" plain :aria-label="$t('toolbar.zoom.zoomIn')" :title="$t('toolbar.zoom.zoomIn')" @click="isZoomLevelTouched = true; zoomLevel *= 1.25">
                        <i class="bi bi-zoom-in" aria-hidden="true" />
                    </el-button>
                </el-button-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button size="small" plain :aria-label="$t('toolbar.zoom.rotateCounterClockwise')" :title="$t('toolbar.zoom.rotateCounterClockwise')" @click="isRotationAngleTouched = true; rotationAngle -= 15">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                    </el-button>
                    <el-input-number v-model.lazy="rotationAngle" :blur-on-enter="true" suffix-text="°" size="small" class="el-input--text-center" style="width: 4rem" @input="isRotationAngleTouched = true" />
                    <el-button size="small" plain :aria-label="$t('toolbar.zoom.rotateClockwise')" :title="$t('toolbar.zoom.rotateClockwise')" @click="isRotationAngleTouched = true; rotationAngle += 15">
                        <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                    </el-button>
                </el-button-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button size="small" plain @click="onResetViewFit">
                        {{ $t('toolbar.zoom.fit') }}
                    </el-button>
                    <el-button size="small" plain @click="onResetViewZoom">
                        1:1
                    </el-button>
                    <el-button size="small" plain @click="onResetViewRotation">
                        0°
                    </el-button>
                </el-button-group>
                <!-- Flipping the transform breaks a lot of things. Need research. -->
                <!-- <el-button-group class="el-button-group--flex ml-3">
                    <el-button size="small" plain @click="onFlipX">
                        {{ $t('toolbar.zoom.flip') }} X
                    </el-button>
                    <el-button size="small" plain @click="onFlipY">
                        {{ $t('toolbar.zoom.flip') }} Y
                    </el-button>
                </el-button-group> -->
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import { throttle } from '@/lib/timing';

export default defineComponent({
    name: 'ToolbarZoom',
    components: {
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputGroup,
        ElInputNumber,
        ElPopover
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const zoomLevel = ref<number>(100);
        const isZoomLevelTouched = ref<boolean>(false);
        const rotationAngle = ref<number>(0);
        const isRotationAngleTouched = ref<boolean>(false);

        watch(() => canvasStore.state.decomposedTransform, throttle((decomposedTransform) => {
            zoomLevel.value = Math.round(decomposedTransform.scaleX * 100);
            rotationAngle.value = Math.round(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES);
        }, 100), { immediate: true });

        watch([zoomLevel], ([zoomLevel]) => {
            if (isZoomLevelTouched.value) {
                canvasStore.dispatch('setTransformScale', zoomLevel / 100);
                isZoomLevelTouched.value = false;
            }
        });
        watch([rotationAngle], ([rotationAngle]) => {
            if (isRotationAngleTouched.value) {
                canvasStore.dispatch('setTransformRotation', rotationAngle * Math.DEGREES_TO_RADIANS);
                isRotationAngleTouched.value = false;
            }
        });

        function onResetViewFit() {
            appEmitter.emit('app.canvas.resetTransform');
        }
        function onResetViewRotation() {
            canvasStore.dispatch('setTransformRotation', 0);
        }
        function onResetViewZoom() {
            canvasStore.dispatch('setTransformScale', 1);
        }
        function onFlipX() {
            canvasStore.dispatch('setTransformFlipX', true);
        }
        function onFlipY() {
            canvasStore.dispatch('setTransformFlipY', true);
        }

        return {
            zoomLevel,
            isZoomLevelTouched,
            rotationAngle,
            isRotationAngleTouched,
            onResetViewFit,
            onResetViewRotation,
            onResetViewZoom,
            onFlipX,
            onFlipY
        };
    }
});
</script>

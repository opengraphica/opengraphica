<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-zoom-in mb-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description">Settings</span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-button-group class="el-button-group--flex">
                    <el-button size="small" plain aria-label="Zoom Out" title="Zoom Out" @click="zoomLevel *= 1/1.1">
                        <i class="bi bi-zoom-out" aria-hidden="true" />
                    </el-button>
                    <el-input-number v-model.lazy="zoomLevel" :blur-on-enter="true" suffix-text="%" size="small" class="el-input--text-center" style="width: 4rem" />
                    <el-button size="small" plain aria-label="Zoom In" title="Zoom In" @click="zoomLevel *= 1.1">
                        <i class="bi bi-zoom-in" aria-hidden="true" />
                    </el-button>
                </el-button-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button size="small" plain aria-label="Rotate Counterclockwise" title="Rotate Counterclockwise" @click="rotationAngle -= 15">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                    </el-button>
                    <el-input-number v-model.lazy="rotationAngle" :blur-on-enter="true" suffix-text="°" size="small" class="el-input--text-center" style="width: 4rem" />
                    <el-button size="small" plain aria-label="Rotate Clockwise" title="Rotate Clockwise" @click="rotationAngle += 15">
                        <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                    </el-button>
                </el-button-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button size="small" plain @click="onResetViewFit">
                        Fit
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
                        Flip X
                    </el-button>
                    <el-button size="small" plain @click="onFlipY">
                        Flip Y
                    </el-button>
                </el-button-group> -->
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from '@/ui/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';

export default defineComponent({
    name: 'ToolbarFreeTransform',
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElSelect,
        ElSwitch
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const zoomLevel = computed<number>({
            get() {
                const decomposedTransform = canvasStore.state.decomposedTransform;
                return Math.round(decomposedTransform.scaleX * 100);
            },
            set(value) {
                canvasStore.dispatch('setTransformScale', value / 100);
            }
        });
        const rotationAngle = computed<number>({
            get() {
                const decomposedTransform = canvasStore.state.decomposedTransform;
                return Math.round(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES);
            },
            set(value) {
                canvasStore.dispatch('setTransformRotation', value * Math.DEGREES_TO_RADIANS);
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
            rotationAngle,
            onResetViewFit,
            onResetViewRotation,
            onResetViewZoom,
            onFlipX,
            onFlipY
        };
    }
});
</script>

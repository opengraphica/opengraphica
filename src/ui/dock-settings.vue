<template>
    <el-tabs class="el-tabs--icon-tabs" v-loading="loading">
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-archive leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">File</div>
                </div>
            </template>
            <el-scrollbar>
                <el-menu class="el-menu--medium el-menu--borderless mb-1" @select="onMenuSelect('file', $event)">
                    <el-menu-item index="new">
                        <i class="bi bi-file-earmark-plus"></i>
                        <span>New</span>
                    </el-menu-item>
                    <el-menu-item index="open">
                        <i class="bi bi-folder2-open"></i>
                        <span>Open</span>
                    </el-menu-item>
                    <el-menu-item index="export">
                        <i class="bi bi-box-arrow-up"></i>
                        <span>Export</span>
                    </el-menu-item>
                    <el-menu-item index="saveAs">
                        <i class="bi bi-download"></i>
                        <span>Save As</span>
                    </el-menu-item>
                    <el-divider />
                    <el-menu-item index="insertPhoto">
                        <i class="bi bi-plus-circle"></i>
                        <span>Insert a Photo</span>
                    </el-menu-item>
                    <el-menu-item index="takePhoto">
                        <i class="bi bi-camera"></i>
                        <span>Take a Photo</span>
                    </el-menu-item>
                </el-menu>
            </el-scrollbar>
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-image leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">Image</div>
                </div>
            </template>
            <el-scrollbar>
                <el-menu class="el-menu--medium el-menu--borderless mb-1">
                    <el-menu-item index="cropResize">
                        <i class="bi bi-crop"></i>
                        <span>Crop and Resize</span>
                    </el-menu-item>
                    <el-divider />
                    <el-menu-item index="cut">
                        <i class="bi bi-scissors"></i>
                        <span>Cut</span>
                    </el-menu-item>
                    <el-menu-item index="copy">
                        <i class="bi bi-files"></i>
                        <span>Copy</span>
                    </el-menu-item>
                    <el-menu-item index="copyAll">
                        <i class="bi bi-files"></i>
                        <span>Copy All Layers</span>
                    </el-menu-item>
                    <el-menu-item index="paste">
                        <i class="bi bi-clipboard"></i>
                        <span>Paste</span>
                    </el-menu-item>
                </el-menu>
            </el-scrollbar>
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-display leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">View</div>
                </div>
            </template>
            <el-scrollbar>
                <el-form novalidate="novalidate" action="javascript:void(0)" class="mb-1">
                    <el-form-item class="el-form-item--menu-item" label="Zoom">
                        <el-button-group>
                            <el-button size="small" plain aria-label="Zoom Out">
                                <i class="bi bi-zoom-out" aria-hidden="true" />
                            </el-button>
                            <el-input-number v-model.lazy="zoomLevel" size="small" class="el-input--text-center" style="width: 5rem" />
                            <el-button size="small" plain aria-label="Zoom In">
                                <i class="bi bi-zoom-in" aria-hidden="true" />
                            </el-button>
                        </el-button-group>
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item" label="Rotate">
                        <el-button-group>
                            <el-button size="small" plain aria-label="Rotate Counterclockwise">
                                <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                            </el-button>
                            <el-input-number v-model.lazy="rotationAngle" size="small" class="el-input--text-center" style="width: 5rem" />
                            <el-button size="small" plain aria-label="Rotate Clockwise">
                                <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                            </el-button>
                        </el-button-group>
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item" label="Reset">
                        <el-button-group>
                            <el-button size="small" plain @click="onResetViewFit">
                                Fit
                            </el-button>
                            <el-button size="small" plain>
                                1:1
                            </el-button>
                            <el-button size="small" plain>
                                0°
                            </el-button>
                        </el-button-group>
                    </el-form-item>
                    <el-divider class="my-2" />
                    <el-form-item class="el-form-item--menu-item" label="Touch Rotate">
                        <el-radio-group
                            v-model="touchRotationPreference"
                            size="small">
                            <el-radio-button
                                v-for="option in touchRotationOptions"
                                :key="option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-radio-button>
                        </el-radio-group>
                    </el-form-item>
                </el-form>
            </el-scrollbar>
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-clock-history leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">History</div>
                </div>
            </template>
            <el-scrollbar>
                History Stuff
            </el-scrollbar>
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-toggle-on leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">Prefs</div>
                </div>
            </template>
            <el-scrollbar>
                <el-form novalidate="novalidate" action="javascript:void(0)">
                    <el-form-item class="el-form-item--menu-item mb-1" label="Theme">
                        <el-radio-group
                            v-model="activeTheme"
                            :disabled="!!loadingThemeName"
                            size="small">
                            <el-radio-button
                                v-for="option in themeOptions"
                                v-loading="option.value === loadingThemeName"
                                :key="option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-radio-button>
                        </el-radio-group>
                    </el-form-item>
                    <el-collapse class="el-collapse--menu-item">
                        <el-collapse-item title="Viewport">
                            <el-form-item class="el-form-item--menu-item" label="Optimize for Large Image">
                                <el-switch v-model="preferenceOptimizeLargeImages" />
                            </el-form-item>
                            <el-form-item v-if="preferenceOptimizeLargeImages" class="el-form-item--menu-item" label="Fix Adjacent Layer Seams">
                                <el-switch v-model="performanceFixLayerSeams" />
                            </el-form-item>
                            <el-form-item v-if="!preferenceOptimizeLargeImages" class="el-form-item--menu-item" label="High Quality Scaling">
                                <el-switch v-model="preferenceHighQualityScaling" />
                            </el-form-item>
                        </el-collapse-item>
                    </el-collapse>
                </el-form>
            </el-scrollbar>
        </el-tab-pane>
    </el-tabs>
</template>

<script lang="ts">
import { defineComponent, ref, computed, nextTick } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElButtonGroup from 'element-plus/lib/el-button-group';
import ElCollapse from 'element-plus/lib/el-collapse';
import ElCollapseItem from 'element-plus/lib/el-collapse-item';
import ElDivider from 'element-plus/lib/el-divider';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/el-loading';
import ElMenu from 'element-plus/lib/el-menu';
import ElMenuItem from 'element-plus/lib/el-menu-item';
import ElOption from 'element-plus/lib/el-option';
import ElRadioButton from 'element-plus/lib/el-radio-button';
import ElRadioGroup from 'element-plus/lib/el-radio-group';
import ElScrollbar from 'element-plus/lib/el-scrollbar';
import ElSelect from 'element-plus/lib/el-select';
import ElSwitch from 'element-plus/lib/el-switch';
import ElTabs from 'element-plus/lib/el-tabs';
import ElTabPane from 'element-plus/lib/el-tab-pane';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import { notifyInjector } from '@/lib/notify';
import appEmitter from '@/lib/emitter';
import { runModule } from '@/modules';
import { format } from '@/format';
import '@/format/title-case';

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElButtonGroup,
        ElCollapse,
        ElCollapseItem,
        ElDivider,
        ElForm,
        ElFormItem,
        ElInputNumber,
        ElMenu,
        ElMenuItem,
        ElOption,
        ElRadioButton,
        ElRadioGroup,
        ElScrollbar,
        ElSelect,
        ElSwitch,
        ElTabs,
        ElTabPane
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Settings');
        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(false);

        // View zoom/pan/rotate
        const zoomLevel = computed<number>({
            get() {
                return 0;
            },
            set() {}
        });
        const rotationAngle = computed<number>({
            get() {
                return 0;
            },
            set() {}
        });
        const touchRotationPreference = computed<'on' | 'off' | 'snap'>({
            get() {
                return preferencesStore.state.touchRotation;
            },
            set(newTouchRotation) {
                preferencesStore.set('touchRotation', newTouchRotation);
            }
        });
        const touchRotationOptions = [
            { value: 'on', label: 'On' },
            { value: 'snap', label: 'Snap' },
            { value: 'off', label: 'Off' }
        ];
        function onResetViewFit() {
            appEmitter.emit('app.canvas.resetTransform');
        }

        // Theme handling
        const themeOptions = computed<{ value: string, label: string }[]>(() => {
            return Object.keys(editorStore.state.themes).map((themeName) => {
                return { value: themeName, label: format(themeName).asTitleCase().value };
            });
        });
        const loadingThemeName = computed<string | null>(() => {
            return editorStore.state.loadingThemeName;
        });
        const activeTheme = computed<string>({
            get() {
                return (editorStore.state.activeTheme || {}).name || '';
            },
            set(newTheme) {
                editorStore.dispatch('setActiveTheme', newTheme);
            }
        });

        // Preferences
        const preferenceOptimizeLargeImages = computed<boolean>({
            get() {
                return preferencesStore.state.preferCanvasViewport;
            },
            set(value) {
                preferencesStore.set('preferCanvasViewport', value);
                canvasStore.set('viewDirty', true);
            }
        });
        const performanceFixLayerSeams = computed<boolean>({
            get() {
                return preferencesStore.state.enableMultiLayerBuffer;
            },
            set(value) {
                preferencesStore.set('enableMultiLayerBuffer', value);
                canvasStore.set('viewDirty', true);
            }
        });
        const preferenceHighQualityScaling = computed<boolean>({
            get() {
                return preferencesStore.state.postProcessInterpolateImage;
            },
            set(value) {
                preferencesStore.set('postProcessInterpolateImage', value);
            }
        });

        // Menu selection
        async function onMenuSelect(group: string, index: string) {
            loading.value = true;
            await nextTick();
            try {
                switch (group) {
                    case 'file':
                        switch (index) {
                            case 'new':
                                await runModule('file', 'new');
                                break;
                            case 'open':
                                await runModule('file', 'open');
                                break;
                            case 'export':
                                await runModule('file', 'export');
                                break;
                        }
                    break;
                }
            } catch (error) {
                $notify({
                    type: 'error',
                    title: 'An Error Occurred',
                    message: error.toString()
                });
            }
            loading.value = false;
            setTimeout(() => {
                emit('close');
            }, 100);
        }

        return {
            loading,
            rotationAngle,
            zoomLevel,
            touchRotationPreference,
            touchRotationOptions,
            onResetViewFit,
            themeOptions,
            loadingThemeName,
            activeTheme,
            preferenceOptimizeLargeImages,
            performanceFixLayerSeams,
            preferenceHighQualityScaling,
            onMenuSelect
        };
    }
});
</script>

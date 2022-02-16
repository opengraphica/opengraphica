<template>
    <el-tabs class="el-tabs--icon-tabs" v-model="activeTab" v-loading="loading">
        <el-tab-pane name="file">
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-archive leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">File</div>
                </div>
            </template>
            <template v-if="visitedTabs['file'] === true">
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
            </template>
        </el-tab-pane>
        <el-tab-pane name="image">
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-image leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">Image</div>
                </div>
            </template>
            <template v-if="visitedTabs['image'] === true">
                <el-scrollbar>
                    <el-menu class="el-menu--medium el-menu--borderless mb-1" @select="onMenuSelect('image', $event)">
                        <el-menu-item index="cropResize">
                            <i class="bi bi-crop"></i>
                            <span>Crop and Resize</span>
                        </el-menu-item>
                        <el-collapse class="el-collapse--menu-item my-1">
                            <el-collapse-item>
                                <template v-slot:title>
                                    Convert Layers...
                                </template>
                                <el-menu-item index="convertLayersToImageSequence">
                                    <i class="bi bi-arrow-return-right"></i>
                                    <span>To Image Sequence</span>
                                </el-menu-item>
                            </el-collapse-item>
                        </el-collapse>
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
            </template>
        </el-tab-pane>
        <el-tab-pane name="view">
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-display leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">View</div>
                </div>
            </template>
            <template v-if="visitedTabs['view'] === true">
                <el-scrollbar>
                    <el-form novalidate="novalidate" action="javascript:void(0)" class="mb-1 mt-1">
                        <el-form-item class="el-form-item--menu-item" label="Zoom">
                            <el-button-group class="el-button-group--flex">
                                <el-button size="small" plain aria-label="Zoom Out" title="Zoom Out" @click="zoomLevel *= 1/1.1">
                                    <i class="bi bi-zoom-out" aria-hidden="true" />
                                </el-button>
                                <el-input-number v-model.lazy="zoomLevel" suffix-text="%" size="small" class="el-input--text-center" style="width: 5rem" />
                                <el-button size="small" plain aria-label="Zoom In" title="Zoom In" @click="zoomLevel *= 1.1">
                                    <i class="bi bi-zoom-in" aria-hidden="true" />
                                </el-button>
                            </el-button-group>
                        </el-form-item>
                        <el-form-item class="el-form-item--menu-item" label="Rotate">
                            <el-button-group class="el-button-group--flex">
                                <el-button size="small" plain aria-label="Rotate Counterclockwise" title="Rotate Counterclockwise" @click="rotationAngle -= 15">
                                    <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                                </el-button>
                                <el-input-number v-model.lazy="rotationAngle" suffix-text="°" size="small" class="el-input--text-center" style="width: 5rem" />
                                <el-button size="small" plain aria-label="Rotate Clockwise" title="Rotate Clockwise" @click="rotationAngle += 15">
                                    <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                                </el-button>
                            </el-button-group>
                        </el-form-item>
                        <el-form-item class="el-form-item--menu-item" label="Reset">
                            <el-button-group>
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
            </template>
        </el-tab-pane>
        <el-tab-pane name="history">
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-clock-history leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">History</div>
                </div>
            </template>
            <template v-if="visitedTabs['history'] === true">
                <el-scrollbar>
                    <div class="is-flex is-justify-content-center px-4 pt-2">
                        <el-button-group>
                            <el-button size="small" :disabled="!canUndo" round plain aria-label="Undo" @click="onHistoryUndo()">
                                <i class="bi bi-arrow-90deg-left mr-1" aria-hidden="true" /> Undo
                            </el-button>
                            <el-button size="small" :disabled="!canRedo" round plain aria-label="Redo" @click="onHistoryRedo()">
                                <i class="bi bi-arrow-90deg-right mr-1" aria-hidden="true" /> Redo
                            </el-button>
                        </el-button-group>
                    </div>
                    <div v-if="historyActionStack.length === 0" class="px-4 py-3">
                        <el-alert
                            type="info"
                            title="No History Yet"
                            show-icon
                            :closable="false">
                        </el-alert>
                    </div>
                    <el-timeline v-else class="px-5 pt-4">
                        <el-timeline-item
                            v-if="historyActionStack.length > 0"
                            class="pb-1"
                            type="primary">
                            <el-link type="primary" href="javascript:void(0)" @click="onGoHistory(0)">
                                [Base Image]
                            </el-link>
                        </el-timeline-item>
                        <el-timeline-item
                            v-for="(action, index) of historyActionStack"
                            :key="action.id + '_' + index"
                            :type="historyActionStackIndex > index ? 'primary' : null"
                            class="pb-1">
                            <el-link type="primary" href="javascript:void(0)" @click="onGoHistory(index + 1)">
                                {{ action.description }}
                            </el-link>
                        </el-timeline-item>
                    </el-timeline>
                </el-scrollbar>
            </template>
        </el-tab-pane>
        <el-tab-pane name="prefs">
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-toggle-on leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">Prefs</div>
                </div>
            </template>
            <template v-if="visitedTabs['prefs'] === true">
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
                            <el-collapse-item title="Performance">
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" label="Optimize for Large Image">
                                    <el-switch v-model="preferenceOptimizeLargeImages" />
                                </el-form-item>
                                <el-form-item v-if="preferenceOptimizeLargeImages" class="el-form-item--menu-item el-form-item--has-content-right" label="Fix Adjacent Layer Seams">
                                    <el-switch v-model="performanceFixLayerSeams" />
                                </el-form-item>
                                <el-form-item v-if="!preferenceOptimizeLargeImages" class="el-form-item--menu-item el-form-item--has-content-right" label="High Quality Scaling">
                                    <el-switch v-model="preferenceHighQualityScaling" />
                                </el-form-item>
                            </el-collapse-item>
                            <el-collapse-item title="Editor">
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" label="Menu Bar Position">
                                    <el-select v-model="preferenceMenuBarPosition" size="small" style="width: 6rem;">
                                        <el-option value="top" label="Top" />
                                        <el-option value="bottom" label="Bottom" />
                                        <el-option value="left" label="Left" />
                                        <el-option value="right" label="Right" />
                                    </el-select>
                                </el-form-item>
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" label="Show Welcome Screen">
                                    <el-switch v-model="showWelcomeScreenAtStart" />
                                </el-form-item>
                            </el-collapse-item>
                        </el-collapse>
                    </el-form>
                </el-scrollbar>
            </template>
        </el-tab-pane>
    </el-tabs>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, toRefs, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElCollapse, { ElCollapseItem } from 'element-plus/lib/components/collapse/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLink from 'element-plus/lib/components/link/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import { ElRadioButton, ElRadioGroup } from 'element-plus/lib/components/radio/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElTabs, { ElTabPane } from 'element-plus/lib/components/tabs/index';
import ElTimeline, { ElTimelineItem } from 'element-plus/lib/components/timeline/index';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { HistoryState } from '@/store/history';
import preferencesStore from '@/store/preferences';
import { notifyInjector, unexpectedErrorMessage } from '@/lib/notify';
import appEmitter from '@/lib/emitter';
import { runModule } from '@/modules';
import { format } from '@/format';
import '@/format/title-case';

const activeTab = ref<string>('file');

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElCollapse,
        ElCollapseItem,
        ElDivider,
        ElForm,
        ElFormItem,
        ElInputNumber,
        ElLink,
        ElMenu,
        ElMenuItem,
        ElOption,
        ElRadioButton,
        ElRadioGroup,
        ElScrollbar,
        ElSelect,
        ElSwitch,
        ElTabs,
        ElTabPane,
        ElTimeline,
        ElTimelineItem
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Canvas Settings');
        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(false);
        const { actionStackIndex: historyActionStackIndex, canRedo, canUndo } = toRefs(historyStore.state);

        const visitedTabs = ref<{ [key: string]: boolean }>({});

        watch([activeTab], ([newActiveTab]) => {
            visitedTabs.value[newActiveTab] = true;
        }, { immediate: true });

        // View zoom/pan/rotate
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
        function onResetViewRotation() {
            canvasStore.dispatch('setTransformRotation', 0);
        }
        function onResetViewZoom() {
            canvasStore.dispatch('setTransformScale', 1);
        }

        // History
        const historyActionStack = computed<HistoryState['actionStack']>(() => {
            return historyStore.state.actionStack;
        });
        async function onHistoryUndo() {
            if (!editorStore.get('waiting')) {
                appEmitter.emit('app.wait.startBlocking', { id: 'historyUndo' });
                try {
                    await historyStore.dispatch('undo');
                } catch (error: any) {
                    $notify({
                        type: 'error',
                        title: 'Undo Error',
                        message: error
                    });
                }
                appEmitter.emit('app.wait.stopBlocking', { id: 'historyUndo' });
            }
        }
        async function onHistoryRedo() {
            if (!editorStore.get('waiting')) {
                appEmitter.emit('app.wait.startBlocking', { id: 'historyRedo' });
                try {
                    await historyStore.dispatch('redo');
                } catch (error: any) {
                    $notify({
                        type: 'error',
                        title: 'Redo Error',
                        message: error
                    });
                }
                appEmitter.emit('app.wait.stopBlocking', { id: 'historyRedo' });
            }
        }
        async function onGoHistory(index: number) {
            if (!editorStore.get('waiting')) {
                appEmitter.emit('app.wait.startBlocking', { id: 'historyStep' });
                try {
                    const actionStackIndex = historyStore.get('actionStackIndex');
                    if (index > actionStackIndex) {
                        const count = Math.abs(index - actionStackIndex);
                        for (let i = 0; i < count; i++) {
                            await historyStore.dispatch('redo');
                        }
                    } else if (index < actionStackIndex) {
                        const count = Math.abs(index - actionStackIndex);
                        for (let i = 0; i < count; i++) {
                            await historyStore.dispatch('undo');
                        }
                    }
                } catch (error: any) {
                    $notify({
                        type: 'error',
                        dangerouslyUseHTMLString: true,
                        message: unexpectedErrorMessage
                    });
                }
                appEmitter.emit('app.wait.stopBlocking', { id: 'historyStep' });
            }
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
                preferencesStore.set('useCanvasViewport', value);
                canvasStore.set('useCssViewport', !value);
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
        const preferenceMenuBarPosition = computed<'left' | 'right' | 'top' | 'bottom'>({
            get() {
                return preferencesStore.state.menuBarPosition;
            },
            async set(value) {
                preferencesStore.set('menuBarPosition', value);
                emit('close');
                await nextTick();
                appEmitter.emit('app.canvas.resetTransform');
            }
        });
        const showWelcomeScreenAtStart = computed<boolean>({
            get() {
                return preferencesStore.state.showWelcomeScreenAtStart;
            },
            set(value) {
                preferencesStore.set('showWelcomeScreenAtStart', value);
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
                            case 'saveAs':
                                await runModule('file', 'saveAs');
                                break;
                            case 'insertPhoto':
                                await runModule('file', 'insertPhoto');
                                break;
                            case 'takePhoto':
                                await runModule('file', 'takePhoto');
                                break;
                        }
                        break;
                    case 'image':
                        switch (index) {
                            case 'cropResize':
                                await editorStore.dispatch('setActiveTool', {
                                    group: 'image',
                                    tool: 'cropResize'
                                });
                                break;
                            case 'convertLayersToImageSequence':
                                await runModule('image', 'convertLayersToImageSequence');
                                break;
                            case 'cut':
                                await runModule('tmp', 'notYetImplemented');
                                break;
                            case 'copy':
                                await runModule('tmp', 'notYetImplemented');
                                break;
                            case 'copyAll':
                                await runModule('image', 'copyAll');
                                break;
                            case 'paste':
                                await runModule('tmp', 'notYetImplemented');
                                break;
                        }
                        break;
                }
            } catch (error: any) {
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
            activeTab,
            visitedTabs,
            loading,
            rotationAngle,
            zoomLevel,
            touchRotationPreference,
            touchRotationOptions,
            onResetViewFit,
            onResetViewRotation,
            onResetViewZoom,
            historyActionStack,
            historyActionStackIndex,
            canUndo,
            canRedo,
            onHistoryUndo,
            onHistoryRedo,
            onGoHistory,
            themeOptions,
            loadingThemeName,
            activeTheme,
            preferenceOptimizeLargeImages,
            performanceFixLayerSeams,
            preferenceHighQualityScaling,
            preferenceMenuBarPosition,
            showWelcomeScreenAtStart,
            onMenuSelect
        };
    }
});
</script>

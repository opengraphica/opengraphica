<template>
    <el-tabs class="el-tabs--icon-tabs" v-model="activeTab" v-loading="loading">
        <el-tab-pane v-for="tabDefinition of tabDefinitions" :key="tabDefinition.tab" :name="tabDefinition.tab">
            <template #label>
                <div class="leading-5">
                    <i class="leading-[1.375] block text-center text-lg !mt-1" :class="tabDefinition.icon" aria-hidden="true" />
                    <div class="!mb-3">{{ t(`dock.settings.${tabDefinition.tab}.tabTitle`) }}</div>
                </div>
            </template>
            <template v-if="visitedTabs[tabDefinition.tab] === true">
                <el-scrollbar>
                    <el-menu
                        v-if="tabDefinition.menu"
                        class="el-menu--medium el-menu--borderless el-menu--inactivated !mb-1"
                        @select="onMenuSelect(tabDefinition.tab, $event)"
                    >
                        <template v-for="(menuGroup, menuGroupIndex) of tabDefinition.menu">
                            <el-collapse
                                v-if="menuGroup.collapse && (menuGroup.condition ? menuGroup.condition() : true)"
                                class="el-collapse--menu-item"
                                :class="{ 'mt-1': !(tabDefinition.menu[menuGroupIndex - 1]?.collapse) }"
                            >
                                <template v-for="collapseItem of menuGroup.collapse" :key="collapseItem.title">
                                    <el-collapse-item
                                        v-if="(collapseItem.condition ? collapseItem.condition() : true)"
                                        v-el-collapse-item-smart-scroll
                                    >
                                        <template v-slot:title>
                                            {{ t(collapseItem.title) }}
                                        </template>
                                        <template v-for="menuItem of collapseItem.items" :key="menuItem.action + menuItem.name">
                                            <el-menu-item v-if="(menuItem.condition) ? menuItem.condition() : true" :index="menuItem.action">
                                                <i :class="menuItem.icon" aria-hidden="true" />
                                                <span>{{ t(menuItem.name) }}</span>
                                            </el-menu-item>
                                        </template>
                                    </el-collapse-item>
                                </template>
                            </el-collapse>
                            <template v-else-if="!menuGroup.collapse">
                                <template v-for="menuItem of menuGroup.items" :key="menuItem.action + menuItem.name">
                                    <el-menu-item v-if="(menuItem.condition) ? menuItem.condition() : true" :index="menuItem.action">
                                        <i :class="menuItem.icon" aria-hidden="true" />
                                        <span>{{ t(menuItem.name) }}</span>
                                    </el-menu-item>
                                </template>
                                <el-divider v-if="
                                    menuGroupIndex < tabDefinition.menu.length - 1
                                    && !tabDefinition.menu[menuGroupIndex + 1]?.collapse
                                    && (
                                        !tabDefinition.menu[menuGroupIndex + 1].condition
                                        || (
                                            tabDefinition.menu[menuGroupIndex + 1].condition
                                            && tabDefinition.menu[menuGroupIndex + 1].condition?.()
                                        )
                                    )
                                " />
                            </template>
                        </template>
                    </el-menu>
                    <el-form v-if="tabDefinition.form" novalidate="novalidate" action="javascript:void(0)" class="!mb-1 !mt-1">
                        <template v-for="(formGroup, formGroupIndex) of tabDefinition.form">
                            <el-collapse
                                v-if="formGroup.collapse && (formGroup.condition ? formGroup.condition() : true)"
                                class="el-collapse--menu-item"
                                :class="{ 'mt-1': !(tabDefinition.form[formGroupIndex - 1]?.collapse) }"
                                @change="onPrefsCollapseChange"
                            >
                                <template v-for="collapseItem of formGroup.collapse" :key="collapseItem.title">
                                    <el-collapse-item
                                        v-if="(collapseItem.condition ? collapseItem.condition() : true)"
                                        v-el-collapse-item-smart-scroll
                                    >
                                        <template v-slot:title>
                                            {{ t(collapseItem.title) }}
                                        </template>
                                        <template v-for="formItem of collapseItem.items" :key="formItem.slot">
                                            <template v-if="(formItem.condition) ? formItem.condition() : true">
                                                <!-- Prefs: Plugins List -->
                                                <template v-if="formItem.slot === 'prefs-plugins-list'">
                                                    <div class="px-5">
                                                        <div v-for="pluginMeta of allPluginMeta" :key="pluginMeta.pluginId" class="flex justify-between mb-2">
                                                            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
                                                                <span class="bi bi-plugin mr-1" aria-hidden="true" />
                                                                {{ pluginMeta.name }}
                                                                <span v-if="pluginMeta.version" class="ml-1" style="color: var(--el-color-info)">{{ pluginMeta.version }}</span>
                                                            </span>
                                                            <a role="button" href="#" class="whitespace-nowrap" style="color: var(--el-color-danger)" @click.prevent="onUninstallPlugin(pluginMeta.pluginId)">
                                                                <span class="bi bi-x" aria-hidden="true" /> {{ t('dock.settings.prefs.plugins.uninstall') }}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </template>
                                                <!-- Prefs: Plugins Actions -->
                                                <template v-if="formItem.slot === 'prefs-plugins-actions'">
                                                    <div class="px-5 pb-4">
                                                        <og-button type="button" outline solid small class="w-full mt-2!" @click="onSelectPluginFile">
                                                            {{ t('dock.settings.prefs.plugins.selectFile') }}
                                                        </og-button>
                                                    </div>
                                                </template>
                                                <!-- Prefs: Editor Menu Bar Position -->
                                                <template v-if="formItem.slot === 'prefs-editor-menu-bar-position'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.editor.menuBarPosition')">
                                                        <el-select v-model="preferenceMenuBarPosition" size="small" style="width: 6rem;">
                                                            <el-option value="top" :label="t('option.top')" />
                                                            <el-option value="bottom" :label="t('option.bottom')" />
                                                            <el-option value="left" :label="t('option.left')" />
                                                            <el-option value="right" :label="t('option.right')" />
                                                        </el-select>
                                                    </el-form-item>
                                                </template>
                                                <!-- Prefs: Editor Show Welcome Screen -->
                                                <template v-if="formItem.slot === 'prefs-editor-show-welcome-screen'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.editor.showWelcomeScreen')">
                                                        <el-switch v-model="showWelcomeScreenAtStart" />
                                                    </el-form-item>
                                                </template>
                                                <!-- Prefs: Editor Show Tips -->
                                                <template v-if="formItem.slot === 'prefs-editor-show-tips'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.editor.showTips')">
                                                        <el-switch v-model="showTutorialNotifications" />
                                                    </el-form-item>
                                                </template>
                                                <!-- Prefs: Network Storage WebDAV -->
                                                <template v-if="formItem.slot === 'prefs-network-storage-webdav'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.networkStorage.enableWebdavServer')">
                                                        <el-switch v-model="preferenceEnableWebdav" />
                                                    </el-form-item>
                                                    <el-form-item-group v-if="preferenceEnableWebdav" ref="webdavStorageGroup" class="px-4!">
                                                        <el-form-item :label="t('dock.settings.prefs.networkStorage.webdavServerUrl')">
                                                            <el-input v-model="preferenceWebdavShareUrl" :placeholder="t('dock.settings.prefs.networkStorage.webdavServerUrlPlaceholder')"
                                                                @blur="updatePreferenceWebdavShareUrl" @keydown.enter="updatePreferenceWebdavShareUrl"
                                                            />
                                                        </el-form-item>
                                                        <el-form-item :label="t('dock.settings.prefs.networkStorage.webdavUsername')">
                                                            <el-input v-model="preferenceWebdavUsername" autocomplete="off" @blur="updatePreferenceWebdavUsername" @keydown.enter="updatePreferenceWebdavUsername" />
                                                        </el-form-item>
                                                        <el-form-item :label="t('dock.settings.prefs.networkStorage.webdavPassword')">
                                                            <el-input v-model="preferenceWebdavPassword" autocomplete="off" class="el-input--password"
                                                                @copy.prevent @cut.prevent @blur="updatePreferenceWebdavPassword" @keydown.enter="updatePreferenceWebdavPassword"
                                                            />
                                                        </el-form-item>
                                                    </el-form-item-group>
                                                </template>
                                                <!-- Prefs: Debugging Load Mobile Debugger -->
                                                <template v-if="formItem.slot === 'prefs-debugging-load-mobile-debugger'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.debugging.useMobileDebugger')">
                                                        <el-switch v-model="useMobileDebugger" />
                                                    </el-form-item>
                                                </template>
                                                <!-- Prefs: Debugging Renderer -->
                                                <template v-if="formItem.slot === 'prefs-debugging-renderer'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.performance.renderer.label')">
                                                        <el-select v-model="preferenceRenderer" size="small" style="width: 6rem;">
                                                            <el-option value="webgl2" :label="t('dock.settings.prefs.performance.renderer.webgl2')" />
                                                            <el-option value="webgl2-offscreen" :label="t('dock.settings.prefs.performance.renderer.webgl2Offscreen')" />
                                                            <el-option value="wgpu-wasm" :label="t('dock.settings.prefs.performance.renderer.wgpuWasm')" />
                                                        </el-select>
                                                    </el-form-item>
                                                </template>
                                                <!-- Prefs: Help Links -->
                                                <template v-if="formItem.slot === 'prefs-help-links'">
                                                    <div class="el-form-item el-form-item--menu-item">
                                                        <el-link href="https://github.com/opengraphica/opengraphica/issues/" type="primary" target="_blank">
                                                            <span>{{ t('dock.settings.prefs.help.reportIssue') }}</span>
                                                            <i class="bi bi-box-arrow-up-right ml-2"></i>
                                                        </el-link>
                                                    </div>
                                                    <div class="el-form-item el-form-item--menu-item">
                                                        <el-link href="javascript:void(0)" type="primary" @click="onClickShowDesignSystem()">
                                                            <span>{{ t('dock.settings.prefs.help.designSystem') }}</span>
                                                            <i class="bi bi-box-arrow-up-right ml-2"></i>
                                                        </el-link>
                                                    </div>
                                                </template>
                                                <!-- Prefs: Update Check -->
                                                <template v-if="formItem.slot === 'prefs-update-check'">
                                                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right" :label="t('dock.settings.prefs.update.checkForUpdates')">
                                                        <el-switch v-model="preferenceCheckForAppUpdates" />
                                                    </el-form-item>
                                                </template>
                                            </template>
                                        </template>
                                    </el-collapse-item>
                                </template>
                            </el-collapse>
                            <template v-else-if="!formGroup.collapse">
                                <template v-for="formItem of formGroup.items" :key="formItem.slot">
                                    <template v-if="(formItem.condition) ? formItem.condition() : true">
                                        <!-- View: Zoom -->
                                        <template v-if="formItem.slot === 'view-zoom'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.view.zoom')">
                                                <el-button-group class="el-button-group--flex">
                                                    <el-button size="small" plain :aria-label="t('dock.settings.view.zoomOut')" :title="t('dock.settings.view.zoomOut')" @click="isZoomLevelTouched = true; zoomLevel *= 1/1.25">
                                                        <i class="bi bi-zoom-out" aria-hidden="true" />
                                                    </el-button>
                                                    <el-input-number v-model.lazy="zoomLevel" suffix-text="%" size="small" class="el-input--text-center" style="width: 5rem" @input="isZoomLevelTouched = true" />
                                                    <el-button size="small" plain :aria-label="t('dock.settings.view.zoomIn')" :title="t('dock.settings.view.zoomIn')" @click="isZoomLevelTouched = true; zoomLevel *= 1.25;">
                                                        <i class="bi bi-zoom-in" aria-hidden="true" />
                                                    </el-button>
                                                </el-button-group>
                                            </el-form-item>
                                        </template>
                                        <!-- View: Rotate -->
                                        <template v-else-if="formItem.slot === 'view-rotate'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.view.rotate')">
                                                <el-button-group class="el-button-group--flex">
                                                    <el-button size="small" plain :aria-label="t('dock.settings.view.rotateCounterClockwise')" :title="t('dock.settings.view.rotateCounterClockwise')" @click="isRotationAngleTouched = true; rotationAngle -= 15">
                                                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                                                    </el-button>
                                                    <el-input-number v-model.lazy="rotationAngle" suffix-text="°" size="small" class="el-input--text-center" style="width: 5rem" @input="isRotationAngleTouched = true" />
                                                    <el-button size="small" plain :aria-label="t('dock.settings.view.rotateClockwise')" :title="t('dock.settings.view.rotateClockwise')" @click="isRotationAngleTouched = true; rotationAngle += 15">
                                                        <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                                                    </el-button>
                                                </el-button-group>
                                            </el-form-item>
                                        </template>
                                        <!-- View: Reset -->
                                        <template v-else-if="formItem.slot === 'view-reset'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.view.reset')">
                                                <el-button-group>
                                                    <el-button size="small" plain @click="onResetViewFit">
                                                        {{ t('dock.settings.view.fit') }}
                                                    </el-button>
                                                    <el-button size="small" plain @click="onResetViewZoom">1:1</el-button>
                                                    <el-button size="small" plain @click="onResetViewRotation">0°</el-button>
                                                </el-button-group>
                                            </el-form-item>
                                        </template>
                                        <!-- View: Touch Rotate -->
                                        <template v-else-if="formItem.slot === 'view-touch-rotate'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.view.touchRotate.label')">
                                                <el-radio-group
                                                    v-model="touchRotationPreference"
                                                    size="small">
                                                    <el-radio-button
                                                        v-for="option in touchRotationOptions"
                                                        :key="option.value"
                                                        :label="option.value">
                                                        {{ t(option.label) }}
                                                    </el-radio-button>
                                                </el-radio-group>
                                            </el-form-item>
                                        </template>
                                        <!-- View: Window Fullscreen -->
                                        <template v-else-if="formItem.slot === 'view-window-fullscreen'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.view.window')">
                                                <el-button v-if="isFullscreen" size="small" plain @click="onExitFullscreen()">
                                                    <i class="bi bi-fullscreen-exit mr-2" aria-hidden="true" />
                                                    {{ t('dock.settings.view.exitFullscreen') }}
                                                </el-button>
                                                <el-button v-else size="small" plain @click="onEnterFullscreen()">
                                                    <i class="bi bi-fullscreen mr-2" aria-hidden="true" />
                                                    {{ t('dock.settings.view.enterFullscreen') }}
                                                </el-button>
                                            </el-form-item>
                                        </template>
                                        <!-- Prefs: Theme -->
                                        <template v-else-if="formItem.slot === 'prefs-theme'">
                                            <el-form-item class="el-form-item--menu-item" :label="t('dock.settings.prefs.theme')">
                                                <el-radio-group
                                                    v-model="activeTheme"
                                                    :disabled="!!loadingThemeName"
                                                    size="small">
                                                    <el-radio-button
                                                        v-for="option in themeOptions"
                                                        v-loading="option.value === loadingThemeName"
                                                        :key="option.value"
                                                        :label="option.value">
                                                        {{ t(option.label) }}
                                                    </el-radio-button>
                                                </el-radio-group>
                                            </el-form-item>
                                        </template>
                                        <!-- Prefs: Language -->
                                        <template v-else-if="formItem.slot === 'prefs-language'">
                                            <el-form-item class="el-form-item--menu-item !mb-1 el-form-item--has-content-right" :label="t('dock.settings.prefs.language')">
                                                <el-select v-model="languageOverride" size="small" style="width: 6rem;">
                                                    <el-option-group>
                                                        <el-option value="" :label="'[' + t('dock.settings.prefs.default') + ']'" />
                                                    </el-option-group>
                                                    <el-option-group>
                                                        <el-option
                                                            v-for="option in languageOptions"
                                                            :key="option.value ?? undefined"
                                                            :value="option.value ?? ''"
                                                            :label="option.label"
                                                        />
                                                    </el-option-group>
                                                </el-select>
                                            </el-form-item>
                                        </template>
                                        <!-- Prefs: Reset Settings -->
                                        <template v-if="formItem.slot === 'prefs-reset-settings'">
                                            <div class="px-5 pt-4 pb-4">
                                                <el-button size="small" class="w-full" @click="onClickResetSettings">
                                                    {{ t('dock.settings.prefs.editor.resetSettings') }}
                                                </el-button>
                                            </div>
                                        </template>
                                    </template>
                                </template>
                                <el-divider v-if="
                                    formGroupIndex < tabDefinition.form.length - 1
                                        && !tabDefinition.form[formGroupIndex + 1]?.collapse
                                        && (
                                            !tabDefinition.form[formGroupIndex + 1].condition
                                            || (
                                                tabDefinition.form[formGroupIndex + 1].condition
                                                && tabDefinition.form[formGroupIndex + 1].condition?.()
                                            )
                                        )
                                    "
                                    class="my-2!"
                                />
                            </template>
                        </template>
                    </el-form>
                    <template v-if="tabDefinition.layout">
                        <template v-for="(layoutGroup, layoutGroupIndex) of tabDefinition.layout">
                            <template v-for="layoutItem of layoutGroup.items" :key="layoutItem.slot">
                                <!-- History: Actions -->
                                <template v-if="layoutItem.slot === 'history-actions'">
                                    <div class="flex justify-center px-4 pt-2">
                                        <el-button-group>
                                            <el-button size="small" :disabled="!canUndo" round plain aria-label="Undo" @click="onHistoryUndo()">
                                                <i class="bi bi-arrow-90deg-left mr-1" aria-hidden="true" /> {{ t('dock.settings.history.undo') }}
                                            </el-button>
                                            <el-button size="small" :disabled="!canRedo" round plain aria-label="Redo" @click="onHistoryRedo()">
                                                <i class="bi bi-arrow-90deg-right mr-1" aria-hidden="true" /> {{ t('dock.settings.history.redo') }}
                                            </el-button>
                                        </el-button-group>
                                    </div>
                                </template>
                                <!-- History: Timeline -->
                                <template v-else-if="layoutItem.slot === 'history-timeline'">
                                    <div v-if="historyActionStack.length === 0" class="px-4 py-3">
                                        <el-alert
                                            type="info"
                                            :title="t('dock.settings.history.noHistory')"
                                            show-icon
                                            :closable="false">
                                        </el-alert>
                                    </div>
                                    <el-timeline v-else class="!px-5 !pt-4">
                                        <el-timeline-item
                                            v-if="historyActionStack.length > 0"
                                            class="!pb-1"
                                            type="primary">
                                            <el-link type="primary" href="javascript:void(0)" @click="onGoHistory(0)">
                                                [{{ t('dock.settings.history.baseImage') }}]
                                            </el-link>
                                        </el-timeline-item>
                                        <el-timeline-item
                                            v-for="(action, index) of historyActionStack"
                                            :key="action.id + '_' + index"
                                            :type="historyActionStackIndex > index ? 'primary' : undefined"
                                            class="!pb-1">
                                            <el-link type="primary" href="javascript:void(0)" @click="onGoHistory(index + 1)">
                                                {{ t(action.description) }}
                                            </el-link>
                                        </el-timeline-item>
                                    </el-timeline>
                                </template>
                            </template>
                            <el-divider v-if="layoutGroupIndex < tabDefinition.layout.length - 1" class="my-2!" />
                        </template>
                    </template>
                </el-scrollbar>
            </template>
        </el-tab-pane>
    </el-tabs>
</template>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { ref, computed, toRefs, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useI18n, setEditorLanguage } from '@/i18n';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElCollapse, { ElCollapseItem } from 'element-plus/lib/components/collapse/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElLink from 'element-plus/lib/components/link/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import { ElRadioButton, ElRadioGroup } from 'element-plus/lib/components/radio/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElSelect, { ElOption, ElOptionGroup } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElTabs, { ElTabPane } from 'element-plus/lib/components/tabs/index';
import ElTimeline, { ElTimelineItem } from 'element-plus/lib/components/timeline/index';

import OgButton from '@/ui/element/button.vue';

import vElCollapseItemSmartScroll from '@/directives/el-collapse-item-smart-scroll';

import languages from '@/config/languages.json';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { HistoryState } from '@/store/history';
import preferencesStore, { PreferencesState } from '@/store/preferences';
import { allPluginMeta, deletePlugin } from '@/store/data/plugin-database';
import { hasWorkingFile } from '@/store/data/working-file-database';

import appEmitter from '@/lib/emitter';
import { pickFile } from '@/lib/file';
import { runShortcutAction } from '@/lib/keyboard';
import { notifyInjector, unexpectedErrorMessage } from '@/lib/notify';
import { throttle } from '@/lib/timing';
import { runModule } from '@/modules';
import '@/format/title-case';

const { t } = useI18n();
const vLoading = ElLoading.directive;

const props = defineProps({
    isDialog: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'close',
    'update:title',
]);

const activeTab = ref<string>('file');

emit('update:title', 'dock.settings.title');
const $notify = notifyInjector('$notify');
const loading = ref<boolean>(false);
const { actionStackIndex: historyActionStackIndex, canRedo, canUndo } = toRefs(historyStore.state);

const visitedTabs = ref<{ [key: string]: boolean }>({});

watch([activeTab], ([newActiveTab]) => {
    visitedTabs.value[newActiveTab] = true;
}, { immediate: true });

interface DockSettingsTabDefinition {
    tab: string;
    icon: string;
    menu?: Array<{
        condition?: () => boolean;
        items?: Array<{
            condition?: () => boolean;
            icon: string;
            name: string;
            action: string;
        }>;
        collapse?: Array<{
            title: string;
            condition?: () => boolean;
            items: Array<{
                condition?: () => boolean;
                icon: string;
                name: string;
                action: string;
            }>;
        }>;
    }>;
    form?: Array<{
        condition?: () => boolean;
        items?: Array<{
            condition?: () => boolean;
            slot: string;
        }>;
        collapse?: Array<{
            title: string;
            condition?: () => boolean;
            items: Array<{
                condition?: () => boolean;
                slot: string;
            }>;
        }>;
    }>;
    layout?: Array<{
        collapseTitle?: string;
        condition?: () => boolean;
        items: Array<{
            condition?: () => boolean;
            slot: string;
        }>;
    }>;
}

const tabDefinitions = computed(() => {
    const tabDefinitions: DockSettingsTabDefinition[] = [
        {
            tab: 'file',
            icon: 'bi bi-archive',
            menu: [
                {
                    items: [
                        {
                            condition: () => showRestoreImage.value,
                            icon: 'bi bi-recycle',
                            name: 'dock.settings.file.menu.restore',
                            action: 'restore',
                        },
                        {
                            icon: 'bi bi-file-earmark-plus',
                            name: 'dock.settings.file.menu.new',
                            action: 'new',
                        },
                        {
                            icon: 'bi bi-folder2-open',
                            name: 'dock.settings.file.menu.open',
                            action: 'open',
                        },
                        {
                            condition: () => !!vendorCustomSaveCallback.value,
                            icon: 'bi bi-download',
                            name: 'dock.settings.file.menu.save',
                            action: 'save',
                        },
                        {
                            condition: () => !vendorCustomSaveCallback.value,
                            icon: 'bi bi-box-arrow-up',
                            name: 'dock.settings.file.menu.export',
                            action: 'export',
                        },
                        {
                            condition: () => !vendorCustomSaveCallback.value,
                            icon: 'bi bi-download',
                            name: 'dock.settings.file.menu.saveAs',
                            action: 'saveAs',
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: 'bi bi-plus-circle',
                            name: 'dock.settings.file.menu.insertPhoto',
                            action: 'insertPhoto',
                        },
                        {
                            icon: 'bi bi-camera',
                            name: 'dock.settings.file.menu.takePhoto',
                            action: 'takePhoto',
                        },
                        {
                            condition: () => canShare.value,
                            icon: 'bi bi-share',
                            name: 'dock.settings.file.menu.shareImage',
                            action: 'shareImage',
                        },
                    ],
                },
                {
                    items: [
                        {
                            condition: () => canQuit.value,
                            icon: 'bi bi-escape',
                            name: 'dock.settings.file.menu.quit',
                            action: 'quit',
                        },
                    ],
                },
            ],
        },
        {
            tab: 'image',
            icon: 'bi bi-image',
            menu: [
                {
                    items: [
                        {
                            icon: 'bi bi-crop',
                            name: 'dock.settings.image.menu.cropResize',
                            action: 'cropResize',
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: 'bi bi-scissors',
                            name: 'dock.settings.image.menu.cut',
                            action: 'cut',
                        },
                        {
                            icon: 'bi bi-files',
                            name: 'dock.settings.image.menu.copy',
                            action: 'copy',
                        },
                        {
                            icon: 'bi bi-files',
                            name: 'dock.settings.image.menu.copyAllLayers',
                            action: 'copyAll',
                        },
                        {
                            icon: 'bi bi-clipboard',
                            name: 'dock.settings.image.menu.paste',
                            action: 'paste',
                        },
                    ],
                },
                {
                    collapse: [
                        {
                            title: 'dock.settings.image.menu.transformLayers.groupTitle',
                            items: [
                                {
                                    icon: 'bi bi-arrows-collapse-vertical',
                                    name: 'dock.settings.image.menu.transformLayers.flipX',
                                    action: 'flipLayersX',
                                },
                                {
                                    icon: 'bi bi-arrows-collapse',
                                    name: 'dock.settings.image.menu.transformLayers.flipY',
                                    action: 'flipLayersY',
                                },
                                {
                                    icon: 'bi bi-arrow-clockwise',
                                    name: 'dock.settings.image.menu.transformLayers.rotateClockwise',
                                    action: 'rotateLayersClockwise',
                                },
                                {
                                    icon: 'bi bi-arrow-counterclockwise',
                                    name: 'dock.settings.image.menu.transformLayers.rotateCounterclockwise',
                                    action: 'rotateLayersCounterclockwise',
                                },
                            ],
                        },
                        {
                            title: 'dock.settings.image.menu.convertLayers.groupTitle',
                            items: [
                                {
                                    icon: 'bi bi-arrow-return-right',
                                    name: 'dock.settings.image.menu.convertLayers.toCollage',
                                    action: 'convertLayersToCollage',
                                },
                                {
                                    icon: 'bi bi-arrow-return-right',
                                    name: 'dock.settings.image.menu.convertLayers.toImageSequence',
                                    action: 'convertLayersToImageSequence',
                                },
                                {
                                    icon: 'bi bi-arrow-return-right',
                                    name: 'dock.settings.image.menu.convertLayers.flatten',
                                    action: 'convertLayersFlatten',
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            tab: 'view',
            icon: 'bi bi-display',
            form: [
                {
                    items: [
                        {
                            slot: 'view-zoom',
                        },
                        {
                            slot: 'view-rotate',
                        },
                        {
                            slot: 'view-reset',
                        },
                    ],
                },
                {
                    items: [
                        {
                            slot: 'view-touch-rotate',
                        },
                    ],
                },
                {
                    items: [
                        {
                            slot: 'view-window-fullscreen'
                        },
                    ],
                }
            ],
        },
        {
            tab: 'history',
            icon: 'bi bi-clock-history',
            layout: [
                {
                    items: [
                        {
                            slot: 'history-actions',
                        },
                        {
                            slot: 'history-timeline',
                        },
                    ],
                }
            ],
        },
        {
            tab: 'prefs',
            icon: 'bi bi-toggle-on',
            form: [
                {
                    items: [
                        {
                            slot: 'prefs-theme',
                        },
                        {
                            slot: 'prefs-language',
                        },
                    ],
                },
                {
                    collapse: [
                        {
                            title: 'dock.settings.prefs.plugins.groupTitle',
                            items: [
                                {
                                    slot: 'prefs-plugins-list',
                                },
                                {
                                    slot: 'prefs-plugins-actions',
                                },
                            ]
                        },
                        {
                            title: 'dock.settings.prefs.editor.groupTitle',
                            items: [
                                {
                                    slot: 'prefs-editor-menu-bar-position',
                                },
                                {
                                    slot: 'prefs-editor-show-welcome-screen',
                                },
                                {
                                    slot: 'prefs-editor-show-tips',
                                },
                            ],
                        },
                        {
                            title: 'dock.settings.prefs.networkStorage.groupTitle',
                            items: [
                                {
                                    slot: 'prefs-network-storage-webdav',
                                },
                            ],
                        },
                        {
                            title: 'dock.settings.prefs.debugging.groupTitle',
                            items: [
                                {
                                    slot: 'prefs-debugging-load-mobile-debugger',
                                },
                                {
                                    slot: 'prefs-debugging-renderer',
                                },
                            ],
                        },
                        {
                            title: 'dock.settings.prefs.help.groupTitle',
                            items: [
                                {
                                    slot: 'prefs-help-links',
                                },
                            ],
                        },
                        {
                            title: 'dock.settings.prefs.update.groupTitle',
                            condition: () => canUpdateApp.value,
                            items: [
                                {
                                    condition: () => canUpdateApp.value,
                                    slot: 'prefs-update-check',
                                },
                            ],
                        },
                    ],
                },
                {
                    items: [
                        {
                            slot: 'prefs-reset-settings',
                        },
                    ]
                }
            ],
        },
    ];

    for (const pluginMenuItem of editorStore.state.pluginSettingsDockMenuItems) {
        let tabDefinition = tabDefinitions.find((definition) => definition.tab === pluginMenuItem.tab);
        if (!tabDefinition) {
            tabDefinition = {
                tab: pluginMenuItem.tab,
                icon: pluginMenuItem.tab ?? 'bi bi-plugin',
            };
        }
        if (!tabDefinition.menu) {
            tabDefinition.menu = [];
        }
        const actionTabPrefix = 'plugin-' + pluginMenuItem.tab + '-';
        const newMenuItem = {
            icon: pluginMenuItem.item.icon ?? 'bi bi-plugin',
            name: `dock.settings.${pluginMenuItem.tab}.menu.${pluginMenuItem.item.name}`,
            action: actionTabPrefix + pluginMenuItem.item.name,
        }
        if (pluginMenuItem.placeAround) {
            const { otherItemName, position } = pluginMenuItem.placeAround;
            findOtherMenuItem:
            for (const menuGroup of tabDefinition.menu) {
                if (menuGroup.items) {
                    for (const itemGroup of menuGroup.items) {
                        if (itemGroup.name === otherItemName.replace(actionTabPrefix, '')) {
                            menuGroup.items.splice(position === 'before' ? 0 : 1, 0, newMenuItem);
                            break findOtherMenuItem;
                        }
                    }
                }
                if (menuGroup.collapse) {
                    for (const collapseItem of menuGroup.collapse) {
                        for (const itemGroup of collapseItem.items) {
                            if (itemGroup.name === otherItemName.replace(actionTabPrefix, '')) {
                                collapseItem.items.splice(position === 'before' ? 0 : 1, 0, newMenuItem);
                                break findOtherMenuItem;
                            }
                        }
                    }
                }
            }
        } else {
            tabDefinition.menu.push({
                items: [newMenuItem],
            });
        }
    }

    for (const definition of tabDefinitions) {
        if (definition.menu || definition.form) {
            const menuOrForm = definition.menu || definition.form!;
            for (const menuGroup of menuOrForm) {
                combineConditions:
                {
                    if (menuGroup.items) {
                        if (menuGroup.condition) break combineConditions;
                        let conditions: Array<() => boolean> = [];
                        for (const menuItem of menuGroup.items) {
                            if (!menuItem.condition) {
                                break combineConditions;
                            }
                            conditions.push(menuItem.condition);
                        }
                        menuGroup.condition = () => {
                            for (const condition of conditions) {
                                if (condition()) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    }
                }
                if (menuGroup.collapse) {
                    for (const collapseItem of menuGroup.collapse) {
                        combineConditions:
                        {
                            if (collapseItem.condition) break combineConditions;
                            let conditions: Array<() => boolean> = [];
                            for (const menuItem of collapseItem.items) {
                                if (!menuItem.condition) {
                                    break combineConditions;
                                }
                                conditions.push(menuItem.condition);
                            }
                            collapseItem.condition = () => {
                                for (const condition of conditions) {
                                    if (condition()) {
                                        return true;
                                    }
                                }
                                return false;
                            }
                        }
                    }
                }
            }
        }
    }
    return tabDefinitions;
});

// File operations
const { vendorCustomSaveCallback } = toRefs(preferencesStore.state);
const showRestoreImage = ref(false);
watch(() => editorStore.state.showBackupRestore, (showBackupRestore) => {
    if (!showBackupRestore) {
        showRestoreImage.value = false;
    }
});

const canShare = ref<boolean>(!!window.Capacitor?.isNativePlatform());
onMounted(() => { // Check if PNG sharing is possible on web.
    if (
        window.Capacitor?.isNativePlatform() || !window.isSecureContext
        || !navigator.share || !navigator.canShare
    ) {
        return;
    }
    const testFile = new File(
        [new Uint8Array([137, 80, 78, 71])],
        "test.png",
        { type: "image/png" },
    );
    canShare.value = navigator.canShare({ files: [testFile] });
});

const canQuit = ref<boolean>(!!window.Electron);

// View zoom/pan/rotate
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

const touchRotationPreference = computed<'on' | 'off' | 'snap'>({
    get() {
        return preferencesStore.state.touchRotation;
    },
    set(newTouchRotation) {
        preferencesStore.set('touchRotation', newTouchRotation);
    }
});
const touchRotationOptions = [
    { value: 'on', label: 'dock.settings.view.touchRotate.on' },
    { value: 'snap', label: 'dock.settings.view.touchRotate.snap' },
    { value: 'off', label: 'dock.settings.view.touchRotate.off' }
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

// Handle Fullscreen
const isFullscreen = ref<boolean>(false);
function onFullscreenChange() {
    if (document.fullscreenElement) {
        isFullscreen.value = true;
    } else {
        isFullscreen.value = false;
    }
}
onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange, false);

    (async () => {
        if (editorStore.get('showBackupRestore')) {
            try {
                showRestoreImage.value = await hasWorkingFile();
            } catch (error) { /* Ignore */ }
        }
    })();
});
onUnmounted(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange, false);
});
async function onEnterFullscreen() {
    await document.body.requestFullscreen({
        navigationUI: 'hide'
    });
    isFullscreen.value = true;
}
function onExitFullscreen() {
    document.exitFullscreen();
    isFullscreen.value = false;
}

// History
const historyActionStack = computed<HistoryState['actionStack']>(() => {
    return historyStore.state.actionStack;
});
async function onHistoryUndo() {
    if (!editorStore.get('waiting')) {
        try {
            await historyStore.dispatch('undo');
        } catch (error: any) {
            $notify({
                type: 'error',
                title: 'Undo Error',
                message: error
            });
        }
    }
}
async function onHistoryRedo() {
    if (!editorStore.get('waiting')) {
        try {
            await historyStore.dispatch('redo');
        } catch (error: any) {
            $notify({
                type: 'error',
                title: 'Redo Error',
                message: error
            });
        }
    }
}
async function onGoHistory(index: number) {
    if (!editorStore.get('waiting')) {
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
    }
}

// Theme handling
const themeOptions = computed<{ value: string, label: string }[]>(() => {
    return Object.keys(editorStore.state.themes).map((themeName) => {
        return { value: themeName, label: 'theme.' + themeName };
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

// Preferences - General
const languageOptions: Array<{ value: string | null, label: string }>
    = languages.map((language) => ({ value: language.code, label: language.description }));
const languageOverride = computed<string>({
    get() {
        return preferencesStore.state.languageOverride;
    },
    set(value) {
        preferencesStore.set('languageOverride', value);
        setEditorLanguage(value);
    }
});
function onPrefsCollapseChange() {
    webdavStorageGroup.value?.[0]?.calculateLabelMinWidth();
}
// Preferences - Plugins
async function onSelectPluginFile() {
    await pickFile({
        types: [
            {
                description: 'ZIP Plugin File',
                accept: {
                    'application/zip': ['.zip'],
                    'application/x-zip-compressed': ['.zip'],
                },
            },
        ]
    }).then((zip) => {
        runModule('plugin', 'installZip', { zip }).catch(() => {
            $notify({
                type: 'error',
                title: t('module.pluginInstallZip.installError.title'),
                message: t('module.pluginInstallZip.installError.message'),
                duration: 9000,
            });
        });
    });
}
async function onUninstallPlugin(pluginId: string) {
    deletePlugin(pluginId);
}
// Preferences - Editor
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
const showTutorialNotifications = computed<boolean>({
    get() {
        return preferencesStore.state.showTutorialNotifications;
    },
    set(value) {
        preferencesStore.set('showTutorialNotifications', value);
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
// Preferences - Network Storage
const preferenceEnableWebdav = computed<boolean>({
    get() {
        return preferencesStore.state.enableWebdavServer;
    },
    set(value) {
        preferencesStore.set('enableWebdavServer', value);
    }
});
const webdavStorageGroup = ref<InstanceType<typeof ElFormItemGroup>>();
const preferenceWebdavShareUrl = ref<string>(preferencesStore.get('webdavServerUrl'));
function updatePreferenceWebdavShareUrl() {
    preferencesStore.set('webdavServerUrl', preferenceWebdavShareUrl.value.trim());
}
const preferenceWebdavUsername = ref<string>(preferencesStore.get('webdavUsername'));
function updatePreferenceWebdavUsername() {
    preferencesStore.set('webdavUsername', preferenceWebdavUsername.value.trim());
}
const preferenceWebdavPassword = ref<string>(preferencesStore.get('webdavPassword'));
function updatePreferenceWebdavPassword() {
    preferencesStore.set('webdavPassword', preferenceWebdavPassword.value.trim());
}
// Preferences - Debugging
const preferenceRenderer = computed<PreferencesState['renderer']>({
    get() {
        return preferencesStore.state.renderer;
    },
    set(value) {
        preferencesStore.set('renderer', value);
        window.location.reload();
    }
});
const preferenceOptimizeLargeImages = computed<boolean>({
    get() {
        return preferencesStore.state.preferCanvasViewport;
    },
    set(value) {
        preferencesStore.set('preferCanvasViewport', value);
        preferencesStore.set('useCanvasViewport', value);
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
// Preferences - Update
const canUpdateApp = ref<boolean>(!!window.Capacitor?.isNativePlatform());
const preferenceCheckForAppUpdates = computed<boolean>({
    get() {
        return preferencesStore.state.checkForAppUpdates;
    },
    set(value) {
        preferencesStore.set('checkForAppUpdates', value);
    }
});
// Preferences - Help
function onClickShowDesignSystem() {
    runModule('developer', 'designSystem');
}
function onClickResetSettings() {
    for (let key in localStorage) {
        if (key.startsWith('openGraphica')) {
            try {
                localStorage.removeItem(key);
            } catch (error) {}
        }
    }
    window.location.reload();
}
const useMobileDebugger = computed<boolean>({
    get() {
        return preferencesStore.state.useMobileDebugger;
    },
    set(value) {
        preferencesStore.set('useMobileDebugger', value);
    }
});

// Menu selection
async function onMenuSelect(group: string, index: string) {
    loading.value = true;
    await nextTick();
    try {

        if (index.startsWith('plugin-')) {
            for (const pluginMenuItem of editorStore.state.pluginSettingsDockMenuItems) {
                const actionIndex = 'plugin-' + pluginMenuItem.tab + '-' + pluginMenuItem.item.name;
                if (actionIndex === index) {
                    runShortcutAction(pluginMenuItem.action);
                    break;
                }
            }
        } else {
            switch (group) {
                case 'file':
                    switch (index) {
                        case 'restore':
                            await runModule('file', 'restoreBackup');
                            editorStore.set('showBackupRestore', false);
                            break;
                        case 'new':
                            await runModule('file', 'new');
                            editorStore.set('showBackupRestore', false);
                            break;
                        case 'open':
                            await runModule('file', 'open');
                            editorStore.set('showBackupRestore', false);
                            break;
                        case 'export':
                            await runModule('file', 'export');
                            break;
                        case 'save':
                            if (vendorCustomSaveCallback.value) {
                                vendorCustomSaveCallback.value();
                            }
                            break;
                        case 'saveAs':
                            await runModule('file', 'saveAs');
                            break;
                        case 'insertPhoto':
                            await runModule('file', 'insertPhoto');
                            editorStore.set('showBackupRestore', false);
                            break;
                        case 'takePhoto':
                            await runModule('file', 'takePhoto');
                            editorStore.set('showBackupRestore', false);
                            break;
                        case 'shareImage':
                            await runModule('file', 'shareImage');
                            break;
                        case 'quit':
                            window.Electron?.quit();
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
                        case 'cut':
                            await runModule('image', 'cut');
                            break;
                        case 'copy':
                            await runModule('image', 'copy');
                            break;
                        case 'copyAll':
                            await runModule('image', 'copyAll');
                            break;
                        case 'paste':
                            await runModule('image', 'paste');
                            break;
                        case 'flipLayersX':
                            await runModule('image', 'flipLayersX');
                            break;
                        case 'flipLayersY':
                            await runModule('image', 'flipLayersY');
                            break;
                        case 'rotateLayersClockwise':
                            await runModule('image', 'rotateLayersClockwise');
                            break;
                        case 'rotateLayersCounterclockwise':
                            await runModule('image', 'rotateLayersCounterclockwise');
                            break;
                        case 'convertLayersToCollage':
                            await runModule('image', 'convertLayersToCollage');
                            break;
                        case 'convertLayersToImageSequence':
                            await runModule('image', 'convertLayersToImageSequence');
                            break;
                        case 'convertLayersFlatten':
                            await runModule('image', 'convertLayersFlatten');
                            break;
                    }
                    break;
            }
        }
    } catch (error: any) {
        console.error(error);
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
</script>

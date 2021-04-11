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
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-display leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">View</div>
                </div>
            </template>
            View Stuff
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-clock-history leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">History</div>
                </div>
            </template>
            View Stuff
        </el-tab-pane>
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-toggle-on leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">Prefs</div>
                </div>
            </template>
            <el-form class="mb-1">
                <el-form-item class="el-form-item--menu-item" label="Theme">
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
            </el-form>
        </el-tab-pane>
    </el-tabs>
</template>

<script lang="ts">
import { defineComponent, ref, computed, nextTick } from 'vue';
import ElDivider from 'element-plus/lib/el-divider';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElLoading from 'element-plus/lib/el-loading';
import ElMenu from 'element-plus/lib/el-menu';
import ElMenuItem from 'element-plus/lib/el-menu-item';
import ElRadioButton from 'element-plus/lib/el-radio-button';
import ElRadioGroup from 'element-plus/lib/el-radio-group';
import ElScrollbar from 'element-plus/lib/el-scrollbar';
import ElTabs from 'element-plus/lib/el-tabs';
import ElTabPane from 'element-plus/lib/el-tab-pane';
import editorStore from '@/store/editor';
import { notifyInjector } from '@/lib/notify';
import { runModule } from '@/modules';
import { format } from '@/format';
import '@/format/title-case';

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElDivider,
        ElForm,
        ElFormItem,
        ElMenu,
        ElMenuItem,
        ElRadioButton,
        ElRadioGroup,
        ElScrollbar,
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
                        }
                    break;
                }
            } catch (error) {
                console.log(error);
                $notify({
                    type: 'error',
                    title: 'An Error Occurred',
                    message: 'The module could not be loaded.'
                });
            }
            loading.value = false;
            setTimeout(() => {
                emit('close');
            }, 100);
        }

        return {
            loading,
            themeOptions,
            loadingThemeName,
            activeTheme,
            onMenuSelect
        };
    }
});
</script>

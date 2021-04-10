<template>
    <el-tabs class="el-tabs--icon-tabs" v-loading="loading">
        <el-tab-pane>
            <template #label>
                <div class="leading-tight">
                    <i class="bi bi-archive leading-snug is-block has-text-centered is-size-5 mt-1"></i>
                    <div class="mb-3">File</div>
                </div>
            </template>
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
            View Stuff
        </el-tab-pane>
    </el-tabs>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import ElDivider from 'element-plus/lib/el-divider';
import ElLoading from 'element-plus/lib/el-loading';
import ElMenu from 'element-plus/lib/el-menu';
import ElMenuItem from 'element-plus/lib/el-menu-item';
import ElTabs from 'element-plus/lib/el-tabs';
import ElTabPane from 'element-plus/lib/el-tab-pane';
import { notifyInjector } from '@/lib/notify';
import { runModule } from '@/modules';

export default defineComponent({
    name: 'DockSettings',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElDivider,
        ElMenu,
        ElMenuItem,
        ElTabs,
        ElTabPane
    },
    emits: [
        'close-popover'
    ],
    setup(props, { emit }) {
        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(false);

        async function onMenuSelect(group: string, index: string) {
            loading.value = true;
            try {
                switch (group) {
                    case 'file':
                        switch (index) {
                            case 'new':
                                await runModule('file', 'new');
                                break;
                        }
                    break;
                }
            } catch (error) {
                $notify({
                    type: 'error',
                    title: 'An Error Occurred',
                    message: 'The module could not be loaded.'
                });
            }
            loading.value = false;
            emit('close-popover');
        }

        return {
            loading,
            onMenuSelect
        };
    }
});
</script>

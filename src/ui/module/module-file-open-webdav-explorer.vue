<template>
    <og-button primary outline solid class="w-full mb-4!" @click="openLocalFile">
        {{ t('module.fileOpenWebdavExplorer.chooseLocalFile') }}
    </og-button>
    <div class="flex items-center mb-1">
        <div class="shrink-0 grow-0">
            <og-button small primary :disabled="currentFolderPath == '/'" icon @click="goBackFolder">
                <span class="sr-only">{{ t('module.fileOpenWebdavExplorer.backFolder') }}</span>
                <span class="bi bi-arrow-left" aria-hidden="true" />
            </og-button>
            <og-button small primary :disabled="forwardStack.length == 0" icon @click="goForwardFolder">
                <span class="sr-only">{{ t('module.fileOpenWebdavExplorer.forwardFolder') }}</span>
                <span class="bi bi-arrow-right" aria-hidden="true" />
            </og-button>
        </div>
        <el-breadcrumb separator="/" class="grow-1 ml-2!">
            <el-breadcrumb-item>
                <a href="#" @click.prevent="openFolder('/')">
                    <span class="sr-only">{{ t('module.fileOpenWebdavExplorer.webdavRootBreadcrumb') }}</span>
                    <span class="bi bi-hdd-network" aria-hidden="true" />
                </a>
            </el-breadcrumb-item>
            <el-breadcrumb-item
                v-for="(folderName, pathIndex) of currentFolderPathSplit"
                :key="pathIndex + '_' + folderName"
            >
                <a href="#" @click.prevent="openFolder('/' + currentFolderPathSplit.slice(0, pathIndex + 1).join('/'))">
                    {{ folderName }}
                </a>
            </el-breadcrumb-item>
            <el-breadcrumb-item />
        </el-breadcrumb>
    </div>
    <div v-if="isLoadingFolder" v-loading="true" class="w-full h-[40dvh] box-content border border-(--el-border-color) rounded-md overflow-hidden"></div>
    <el-alert
        v-else-if="isFolderLoadError"
        type="error"
        show-icon
        :closable="false"
        :title="t('module.fileOpenWebdavExplorer.folderLoadError')"
    />
    <el-scrollbar v-else class="border border-(--el-border-color) rounded-md">
        <div class="h-[40dvh]">
            <el-table
                :data="currentFolderFiles"
                highlight-current-row
                :row-class-name="() => 'cursor-pointer'"
                @current-change="onCurrentFileChange"
            >
                <template #empty>
                    {{ t('module.fileOpenWebdavExplorer.emptyFolder') }}
                </template>
                <el-table-column width="28">
                    <template #header>
                        <span class="bi bi-folder2-open" aria-hidden="true" />
                    </template>
                    <template #default="scope">
                        <span :class="getFileIcon(scope.row)" aria-hidden="true" />
                    </template>
                </el-table-column>
                <el-table-column property="basename" label="Filename" sortable />
            </el-table>
        </div>
    </el-scrollbar>
</template>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/i18n';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElBreadcrumb, { ElBreadcrumbItem } from 'element-plus/lib/components/breadcrumb/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElTable, { ElTableColumn } from 'element-plus/lib/components/table/index';

import OgButton from '@/ui/element/button.vue';

import { useWebdavClient } from '@/composables/webdav-client';

import appEmitter from '@/lib/emitter';

import { runModule } from '@/modules';

import type { FileStat } from 'webdav/web';

const { t } = useI18n();
const webdavClient = useWebdavClient();
const vLoading = ElLoading.directive;

const props = defineProps({
    insert: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    'update:title',
    'close'
]);

watch(() => props.insert, () => {
    emit('update:title', props.insert ? 'module.fileOpenWebdavExplorer.insertTitle' : 'module.fileOpenWebdavExplorer.openTitle');
}, { immediate: true });

const isLoadingFolder = ref<boolean>(false);
const currentFolderPath = ref<string>('/');
const currentFolderFiles = ref<FileStat[]>([]);
const isFolderLoadError = ref<boolean>(false);
const forwardStack = ref<string[]>([]);

const currentFolderPathSplit = computed(() => {
    return currentFolderPath.value.split('/').filter(value => value.trim().length > 0);
});

onMounted(async () => {
    openFolder('/');
});

async function openFolder(folder: string) {
    if (folder.startsWith(currentFolderPath.value)) {
        const folderPaths = folder.replace(currentFolderPath.value, '')
            .split('/').filter(value => value.trim().length > 0);
        for (const folder of folderPaths) {
            if (folder === forwardStack.value[forwardStack.value.length - 1]) {
                forwardStack.value.pop();
            } else {
                forwardStack.value = [];
                break;
            }
        }
    } else if (currentFolderPath.value.startsWith(folder)) {
        const folderPaths = currentFolderPath.value.replace(folder, '')
            .split('/').filter(value => value.trim().length > 0);
        for (const path of folderPaths.reverse()) {
            forwardStack.value.push(path);
        }
    }

    currentFolderPath.value = folder;
    isLoadingFolder.value = true;
    isFolderLoadError.value = false;
    try {
        currentFolderFiles.value = (await webdavClient.getDirectoryContents(folder)).sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (b.type === 'directory' && a.type !== 'directory') return 1;
            return a.basename.localeCompare(b.basename);
        });
    } catch (error) {
        isFolderLoadError.value = true;
        console.error('[src/ui/module/module-file-open-webdav-explorer.vue]', error);
    } finally {
        isLoadingFolder.value = false;
    }
}

function getFileIcon(file: FileStat) {
    if (file.type === 'directory') {
        return 'bi bi-folder2';
    } else {
        const extension = file.basename.split('.').pop();
        switch (extension) {
            case 'gif': return 'bi bi-filetype-gif';
            case 'jpg': case 'jpeg': return 'bi bi-filetype-jpg';
            case 'mov': return 'bi bi-filetype-mov';
            case 'mp3': return 'bi bi-filetype-mp3';
            case 'mp4': return 'bi bi-filetype-mp4';
            case 'png': return 'bi bi-filetype-png';
            case 'svg': return 'bi bi-filetype-svg';
            case 'ttf': return 'bi bi-filetype-ttf';
            case 'wav': return 'bi bi-filetype-wav';
            default: return 'bi bi-file-earmark';
        }
    }
}

function goBackFolder() {
    const folderSplit = [...currentFolderPathSplit.value];
    const forwardFolder = folderSplit.pop();
    if (!forwardFolder) return;
    openFolder('/' + folderSplit.join('/'));
}

function goForwardFolder() {
    const folder = forwardStack.value[forwardStack.value.length - 1];
    if (folder) {
        openFolder(currentFolderPath.value.replace(/\/$/, '') + '/' + folder);
    }
}

async function openLocalFile() {
    const options = props.insert ? {
        insert: true,
    } : {};
    await runModule('file', 'openFileDialog', options);
    emit('close');
}

async function onCurrentFileChange(file: FileStat | null) {
    if (!file) return;
    if (file.type === 'directory') {
        openFolder(file.filename);
    } else {
        isLoadingFolder.value = true;
        try {
            const fileContents: ArrayBuffer = await webdavClient.getFileContents(file.filename, { format: 'binary' });
            await runModule('file', 'openFileList', {
                files: [new File([new Blob([fileContents], { type: file.mime ?? 'application/octet-binary' })], file.basename)],
                dialogOptions: {
                    insert: props.insert,
                },
            });
            emit('close');
        } catch {
            appEmitter.emit('app.notify', {
                type: 'error',
                title: t('module.fileOpenWebdavExplorer.fileDownloadError.title'),
                message: t('module.fileOpenWebdavExplorer.fileDownloadError.message'),
                duration: 5000,
            });
        } finally {
            isLoadingFolder.value = false;
        }
    }
}
</script>
<template>
    <og-button primary outline solid class="w-full" @click="saveLocalFile">
        {{ t('module.fileSaveWebdavExplorer.saveLocalFile') }}
    </og-button>
    <el-divider>
        {{ t('module.fileSaveWebdavExplorer.orDivider') }}
    </el-divider>
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
    <el-form @submit.prevent="saveNetworkFile">
        <div
            v-if="isLoadingFolder"
            v-loading="true"
            class="w-full h-[30dvh] box-content border border-(--el-border-color) rounded-md overflow-hidden"
        />
        <el-alert
            v-else-if="isFolderLoadError"
            type="error"
            show-icon
            :closable="false"
            :title="t('module.fileOpenWebdavExplorer.folderLoadError')"
        />
        <el-scrollbar v-else class="border border-(--el-border-color) rounded-md">
            <div class="h-[30dvh]">
                <el-table
                    ref="webdavTableRef"
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
                    <el-table-column property="basename" label="Filename" sortable>
                        <template #default="scope">
                            <span :class="{ 'opacity-50': scope.row.type !== 'directory' }">{{ scope.row.basename }}</span>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </el-scrollbar>
        <div class="flex items-center gap-1">
            <el-form-item-group class="grow-1 my-2!">
                <el-form-item :label="t('module.fileSaveAs.fileName')" prop="fileName">
                    <el-input v-model="networkFormData.fileName" clearable></el-input>
                </el-form-item>
            </el-form-item-group>
            <og-button ref="createFolderButton" primary icon class="shrink-0 grow-0" @click.prevent="createFolder">
                <span class="sr-only">{{ t('module.fileSaveWebdavExplorer.createFolder') }}</span>
                <span class="bi bi-folder-plus" aria-hidden="true" />
            </og-button>
        </div>
        <div class="flex gap-4 mt-2!">
            <og-button type="submit" primary outline solid class="w-full">
                {{ t('module.fileSaveWebdavExplorer.saveToWebdav') }}
            </og-button>
        </div>
    </el-form>
    <el-dialog
        v-model="showCreateFolderDialog"
        :title="t('module.fileSaveWebdavExplorer.createFolder')"
        :width="360"
        :append-to-body="false"
    >
        <el-form action="#" @submit.prevent="submitCreateFolder">
            <el-form-item-group class="grow-1 my-2!">
                <el-form-item :label="t('module.fileSaveWebdavExplorer.folderName')" prop="folderName">
                    <el-input v-model="networkFormData.folderName" clearable></el-input>
                </el-form-item>
            </el-form-item-group>
            <div class="flex justify-end mt-4">
                <og-button type="submit" primary solid class="ml-auto">
                    {{ t('button.create') }}
                </og-button>
            </div>
        </el-form>
    </el-dialog>
</template>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, type PropType } from 'vue';
import { useI18n } from '@/i18n';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElBreadcrumb, { ElBreadcrumbItem } from 'element-plus/lib/components/breadcrumb/index';
import ElDialog from 'element-plus/lib/components/dialog/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElTable, { ElTableColumn } from 'element-plus/lib/components/table/index';

import OgButton from '@/ui/element/button.vue';

import workingFileStore from '@/store/working-file';
import { addFileExtension, createSaveArrayBuffer, saveImage, saveImageAs } from '@/modules/file/save';
import { exportAsImage, type ExportAsImageOptions } from '@/modules/file/export';

import { useWebdavClient } from '@/composables/webdav-client';

import { createArrayBufferFromBlob } from '@/lib/binary';
import appEmitter from '@/lib/emitter';

import type { FileStat } from 'webdav/web';

const { t } = useI18n();
const webdavClient = useWebdavClient();
const vLoading = ElLoading.directive;

const props = defineProps({
    fileHandle: {
        type: Object as PropType<FileSystemFileHandle>,
        default: undefined,
    },
    fileName: {
        type: String,
        default: undefined,
    },
    exportOptions: {
        type: Object as PropType<ExportAsImageOptions>,
        default: undefined,
    },
})

const emit = defineEmits([
    'update:title',
    'close'
]);

emit('update:title', 'module.fileSaveWebdavExplorer.title');

const webdavTableRef = ref<InstanceType<typeof ElTable>>();

const isLoadingFolder = ref<boolean>(false);
const currentFolderPath = ref<string>('/');
const currentFolderFiles = ref<FileStat[]>([]);
const isFolderLoadError = ref<boolean>(false);
const forwardStack = ref<string[]>([]);
const showCreateFolderDialog = ref<boolean>(false);

const networkFormData = reactive({
    fileName: props.fileName ?? workingFileStore.get('fileName'),
    folderName: '',
});

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

function createFolder() {
    showCreateFolderDialog.value = true;
}

async function submitCreateFolder() {
    isLoadingFolder.value = true;
    try {
        showCreateFolderDialog.value = false;
        const newFolder = currentFolderPath.value.replace(/\/$/, '') + '/' + networkFormData.folderName;
        await webdavClient.createDirectory(newFolder);
        isLoadingFolder.value = false;
        openFolder(newFolder);
    } catch (error) {
        isLoadingFolder.value = false;
        appEmitter.emit('app.notify', {
            type: 'error',
            title: t('module.fileSaveWebdavExplorer.folderCreateError.title'),
            message: t('module.fileSaveWebdavExplorer.folderCreateError.message'),
            duration: 5000,
        });
    }
}

async function saveLocalFile() {
    if (props.fileHandle) {
        await saveImage(props.fileHandle as never);
    } else if (props.exportOptions) {
        await exportAsImage(props.exportOptions);
    } else if (props.fileName) {
        await saveImageAs({
            fileName: props.fileName,
        });
    }
    emit('close');
}

async function saveNetworkFile() {
    isLoadingFolder.value = true;
    try {
        let fileName: string = '';
        let fileArrayBuffer: ArrayBuffer | undefined;
        if (props.exportOptions) {
            const exportOptions = { ...props.exportOptions };
            delete exportOptions.toFileHandle;
            exportOptions.fileName = exportOptions.fileName ?? networkFormData.fileName;
            exportOptions.toBlob = true;
            fileName = addFileExtension(exportOptions.fileName, exportOptions.fileType);
            const { blob } = await exportAsImage(exportOptions);
            if (!blob) {
                throw new Error('Export did not create a blob.');
            }
            fileArrayBuffer = await createArrayBufferFromBlob(blob);
        } else {
            fileName = addFileExtension(networkFormData.fileName, 'json');
            fileArrayBuffer = await createSaveArrayBuffer()
        }
        await webdavClient.putFileContents(
            currentFolderPath.value.replace(/\/$/, '') + '/' + fileName,
            fileArrayBuffer,
            { overwrite: true },
        );
        emit('close');
    } catch {
        appEmitter.emit('app.notify', {
            type: 'error',
            title: t('module.fileSaveWebdavExplorer.fileSaveError.title'),
            message: t('module.fileSaveWebdavExplorer.fileSaveError.message'),
            duration: 5000,
        });
    } finally {
        isLoadingFolder.value = false;
    }
}

async function onCurrentFileChange(file: FileStat | null) {
    if (!file) return;
    if (file.type === 'directory') {
        openFolder(file.filename);
    } else {
        webdavTableRef.value?.setCurrentRow(undefined);
        networkFormData.fileName = addFileExtension(file.basename);
    }
}
</script>
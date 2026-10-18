<template>
    <div v-loading="loading">
        <el-form
            ref="form"
            action="javascript:void(0)"
            label-position="left"
            novalidate="novalidate"
            hide-required-asterisk
            class="mt-3"
            @submit="onConfirm"
        >
            <el-form-item-aligned-groups>
                <el-form-item-group>
                    <el-form-item>
                        <template #label>
                            <span class="bi bi-search" aria-hidden="true" />
                            <span class="sr-only">{{ t('module.fileAddFont.search') }}</span>
                        </template>
                        <el-input
                            ref="searchTextInput"
                            v-model="searchText"
                            :placeholder="t('module.fileAddFont.searchPlaceholder')"
                            clearable
                        />
                    </el-form-item>
                </el-form-item-group>
            </el-form-item-aligned-groups>
            <template v-if="googleFontsItems.length > 0">
                <div class="rounded-md overflow-hidden bg-(--og-background-color-secondary)">
                    <label
                        v-for="googleFontItem of googleFontsItems"
                        class="flex items-center cursor-pointer h-14 overflow-hidden"
                    >
                        <span class="flex shrink-1 items-center px-4">
                            <input v-model="selectedGoogleFontFamilies" type="checkbox" :value="googleFontItem.family" class="sr-only">
                            <span :class="['bi', selectedGoogleFontFamilies.includes(googleFontItem.family) ? 'bi-check-square-fill' : 'bi-square']" />
                        </span>
                        <span class="flex flex-col grow-1">
                            <span
                                class="flex items-end text-nowrap text-base h-6"
                                :style="{ 'font-family': 'Google Font Preview ' + googleFontItem.family + ', sans-serif' }"
                            >The quick brown fox jumps over the lazy dog.</span>
                            <span class="text-sm text-(--el-color-info)">{{ googleFontItem.family }}</span>
                        </span>
                    </label>
                </div>
                <el-pagination
                    v-model:current-page="googleFontsCurrentPage"
                    :page-size="googleFontsItemsPerPage"
                    layout="prev, pager, next"
                    :total="googleFontsPageCount"
                    class="justify-center! mt-2!"
                    :style="{
                        '--el-pagination-bg-color': 'transparent',
                        '--el-pagination-button-disabled-bg-color': 'transparent',
                    }"
                />
            </template>
            <el-alert
                v-else
                type="info"
                :title="t('module.fileAddFont.noFontsFound')"
                show-icon
                :closable="false"
                class="justify-center">
            </el-alert>
            <el-divider />
            <div class="flex flex-wrap gap-3 justify-between">
                <og-button outline solid @click="onSelectFiles">{{ t('button.selectFiles') }}</og-button>
                <div class="grow-1 text-right">
                    <og-button outline solid @click="onCancel">{{ t('button.cancel') }}</og-button>
                    <og-button solid primary class="ml-3!" @click="onConfirm">{{ t('button.add') }}</og-button>
                </div>
            </div>
        </el-form>
    </div>
</template>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, WatchStopHandle, onUnmounted } from 'vue';
import { useI18n } from '@/i18n';

import defaultFontFamilies from '@/config/default-font-families.json';
import googleWebfontsList from '@/config/google-webfonts.json';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElFormItemAlignedGroups from '@/ui/el/el-form-item-aligned-groups.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElPagination from 'element-plus/lib/components/pagination/index';

import OgButton from '@/ui/element/button.vue';

import { generateFontVariantName } from '@/store/font';
import workingFileStore, { addRemoteFont } from '@/store/working-file';

import type { GoogleFontFamilyDefinition, FontFamilyFetchDefinition } from '@/types';

const { t } = useI18n();
const vLoading = ElLoading.directive;

const props = defineProps({
    isDialog: {
        type: Boolean,
        default: false
    },
    dialogOpened: {
        type: Boolean,
        default: false
    },
});

const emit = defineEmits([
    'update:title',
    'update:dialogSize',
    'close',
]);

emit('update:title', 'module.fileAddFont.title');
emit('update:dialogSize', 'medium-large');

const hasError = ref(false);
const loading = ref(false);

/*----------------*\
|                  |
|   Dialog Setup   |
|                  |
\*----------------*/

onMounted(async () => {
    nextTick(async () => {
        if (props.isDialog) {
            let stopWatch: WatchStopHandle;
            stopWatch = watch(() => props.dialogOpened, (dialogOpened) => {
                if (dialogOpened) {
                    stopWatch?.();
                    initialSetup();
                }
            }, { immediate: true });
        } else {
            initialSetup();
        }
    });
});

async function initialSetup() {
    try {
        selectedGoogleFontFamilies.value = [];
        try {
            if (searchTextInput.value) {
                const input = searchTextInput.value.ref as unknown as HTMLInputElement;
                input?.focus();
                setTimeout(() => {
                    input?.select();
                }, 0);
            }
        } catch (error) { /* Ignore */ }
    } catch (error) {
        console.error('[src/ui/module-file-add-font.vue] Error during initial setup. ', error);
    }
}

/*----------------------*\
|                        |
|   Google Font Search   |
|                        |
\*----------------------*/

const searchTextInput = ref<typeof ElInput>();
const searchText = ref<string>('');

const selectedGoogleFontFamilies = ref<string[]>([]);

const defaultFontFamilyNames = new Set<string>(defaultFontFamilies.map((definition) => definition.family));

const googleFontsCurrentPage = ref<number>(1);
const googleFontsItemsPerPage = ref<number>(Math.floor(Math.max(4, (window.innerHeight - 384) / 56)));
const filteredGoogleFontsItems = computed<GoogleFontFamilyDefinition[]>(() => {
    const searchTextLower = searchText.value.trim().toLowerCase();
    const remoteFonts = workingFileStore.state.remoteFonts;
    return (googleWebfontsList.items as unknown as GoogleFontFamilyDefinition[]).filter((item) => {
        return item.family.toLowerCase().includes(searchTextLower)
            && !remoteFonts[item.family]
            && !defaultFontFamilyNames.has(item.family);
    });
});
const googleFontsItems = computed<GoogleFontFamilyDefinition[]>(() => {
    const sliceStart = (googleFontsCurrentPage.value - 1) * googleFontsItemsPerPage.value;
    return filteredGoogleFontsItems.value.slice(sliceStart, sliceStart + googleFontsItemsPerPage.value);
});
const googleFontsPageCount = computed(() => {
    return Math.floor(filteredGoogleFontsItems.value.length / googleFontsItemsPerPage.value);
});

/*------------------------*\
|                          |
|   Google Font Previews   |
|                          |
\*------------------------*/

let googleFontPreviewStyleElement: HTMLStyleElement | undefined;
const googleFontPreviews: Record<string, string> = {};

onMounted(() => {
    if (!googleFontPreviewStyleElement) {
        googleFontPreviewStyleElement = document.createElement('style');
    }
    document.head.appendChild(googleFontPreviewStyleElement);
});

onUnmounted(() => {
    if (googleFontPreviewStyleElement) {
        document.head.removeChild(googleFontPreviewStyleElement);
    }
});

watch(() => googleFontsItems.value, () => {
    if (!googleFontPreviewStyleElement) {
        googleFontPreviewStyleElement = document.createElement('style');
    }
    for (const fontItem of googleFontsItems.value) {
        if (!googleFontPreviews[fontItem.family]) {
            googleFontPreviews[fontItem.family] = fontItem.files['regular'];
        }
    }
    let style = '';
    for (const fontFamily in googleFontPreviews) {
        style += '@font-face {\n';
        style += `  font-family: "Google Font Preview ${fontFamily}";\n`;
        style += `  src: url("${googleFontPreviews[fontFamily]}")\n`;
        style += '}\n';
    }
    googleFontPreviewStyleElement.textContent = style;
}, { immediate: true });

/*---------------------*\
|                       |
|   Select Font Files   |
|                       |
\*---------------------*/

function onSelectFiles(e: MouseEvent) {
    e.preventDefault();
}

/*------------------*\
|                    |
|   Dialog Actions   |
|                    |
\*------------------*/

function onCancel() {
    emit('close');
}

async function onConfirm() {
    if (selectedGoogleFontFamilies.value.length > 0) {
        for (const family of selectedGoogleFontFamilies.value) {
            const googleFontItem = googleWebfontsList.items.find((item) => item.family === family) as GoogleFontFamilyDefinition;
            if (!googleFontItem) continue;
            const fontDefinition: FontFamilyFetchDefinition = {
                family,
                subsets: googleFontItem.subsets,
                variants: {},
            }
            for (const variantKey in googleFontItem.files) {
                fontDefinition.variants[variantKey] = {
                    name: generateFontVariantName(variantKey),
                    file: googleFontItem.files[variantKey],
                };
            }
            addRemoteFont(fontDefinition);
        }
    }
    emit('close');
}
</script>

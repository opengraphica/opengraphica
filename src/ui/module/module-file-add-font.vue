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
            <template v-if="uploadFamilies.length > 0">
                <div
                    v-for="uploadFamily of uploadFamilies"
                    :key="uploadFamily.family"
                    class="rounded-md overflow-hidden bg-(--og-background-color-secondary) p-4 mb-4"
                >
                    <h2 class="text-lg mb-2">{{ uploadFamily.family }}</h2>
                    <div v-for="variant in uploadFamily.variants" class="flex gap-4 items-center">
                        <el-select v-model="variant.key" class="max-w-36 w-full shrink-0">
                            <el-option
                                v-for="option of variantOptions"
                                :value="option.value"
                                :label="option.text"
                            />
                        </el-select>
                        <span class="text-nowrap">{{ variant.file.name }}</span>
                    </div>
                </div>
            </template>
            <template v-else>
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
                                @keydown.enter.prevent
                            />
                        </el-form-item>
                    </el-form-item-group>
                </el-form-item-aligned-groups>
                <el-alert
                    v-if="!isOnline"
                    type="warning"
                    :title="t('module.fileAddFont.offlineFontSearch')"
                    show-icon
                    :closable="false"
                    class="justify-center"
                />
                <template v-else-if="googleFontsItems.length > 0">
                    <div class="rounded-md overflow-hidden bg-(--og-background-color-secondary)">
                        <label
                            v-for="googleFontItem of googleFontsItems"
                            :key="googleFontItem.family"
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
                    class="justify-center"
                />
            </template>
            <el-divider />
            <div class="flex flex-wrap gap-3 justify-between">
                <og-button type="button" outline solid @click="onSelectFiles">{{ t('button.selectFiles') }}</og-button>
                <div class="grow-1 text-right">
                    <og-button type="button" outline solid @click="onCancel">{{ t('button.cancel') }}</og-button>
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
import { parse as parseFont, type Font } from '@/lib/opentype';
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
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import OgButton from '@/ui/element/button.vue';

import { pickFile } from '@/lib/file';
import { notifyInjector } from '@/lib/notify';
import { toTitleCase } from '@/lib/string';

import editorStore from '@/store/editor';
import { createStoredFont, generateFontVariantName, type CreateStoredFont } from '@/store/font';
import workingFileStore, { addRemoteFont } from '@/store/working-file';

import type { GoogleFontFamilyDefinition, FontFamilyFetchDefinition } from '@/types';

const { t } = useI18n();
const vLoading = ElLoading.directive;
const $notify = notifyInjector('$notify');

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
const isOnline = computed(() => editorStore.state.isOnline);

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
        uploadFamilies.value = [];
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

interface UploadFamily {
    family: string;
    variants: Array<{
        key: string;
        file: File;
    }>;
}

const uploadFamilies = ref<UploadFamily[]>([]);

const variantKeywordMap = [
    { word: 'thin', variant: '100' },
    { word: 'extra light', variant: '200' },
    { word: 'light', variant: '300' },
    { word: 'regular', variant: 'regular' },
    { word: 'medium', variant: '500' },
    { word: 'semi bold', variant: '600' },
    { word: 'extra bold', variant: '800' },
    { word: 'bold', variant: '700' },
    { word: 'black', variant: '900' },
    { word: 'italic', variant: 'italic' },
];

const variantOptions = [
    { value: '100', text: generateFontVariantName('100') },
    { value: '100italic', text: generateFontVariantName('100italic') },
    { value: '200', text: generateFontVariantName('200') },
    { value: '200italic', text: generateFontVariantName('200italic') },
    { value: '300', text: generateFontVariantName('300') },
    { value: '300italic', text: generateFontVariantName('300italic') },
    { value: 'regular', text: generateFontVariantName('regular') },
    { value: 'italic', text: generateFontVariantName('italic') },
    { value: '500', text: generateFontVariantName('500') },
    { value: '500italic', text: generateFontVariantName('500italic') },
    { value: '600', text: generateFontVariantName('600') },
    { value: '600italic', text: generateFontVariantName('600italic') },
    { value: '700', text: generateFontVariantName('700') },
    { value: '700italic', text: generateFontVariantName('700italic') },
    { value: '800', text: generateFontVariantName('800') },
    { value: '800italic', text: generateFontVariantName('800italic') },
    { value: '900', text: generateFontVariantName('900') },
    { value: '900italic', text: generateFontVariantName('900italic') },
];

async function onSelectFiles(e: MouseEvent) {
    e.preventDefault();
    const files = await pickFile({
        multiple: true,
        types: [
            { description: 'Font files', accept: { 'font/*': ['.otf', '.ttf', '.woff'] } },
        ]
    });
    let hasError = false;
    for (const file of files) {
        try {
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
                fileReader.onerror = reject;
                fileReader.readAsArrayBuffer(file);
            })
            const font = parseFont(arrayBuffer, { lowMemory: true });

            let filename = file.name.toLowerCase().replace(/\.(eot|ttf|woff)/i, '').replace(/[_\-\s]+/g, ' ').trim();
            let filenameInferredVariant = '';
            for (let { word, variant } of variantKeywordMap) {
                if (filename.includes(word)) {
                    if (variant === 'italic') {
                        if (!filenameInferredVariant.includes('italic')) {
                            if (filenameInferredVariant === 'regular') {
                                filenameInferredVariant += 'italic';
                            } else {
                                filenameInferredVariant += 'italic';
                            }
                        }
                    } else {
                        if (filenameInferredVariant === '') {
                            filenameInferredVariant = variant;
                        }
                    }
                    filename = filename.replace(word, '');
                }
            }
            const family = (
                font.names.windows?.fontFamily?.en
                ?? font.names.macintosh?.fontFamily?.en
                ?? font.names.unicode?.fontFamily?.en
                ?? font.names.fontFamily?.en
                ?? toTitleCase(filename.trim())
            );
            let subfamily = (
                font.names.windows?.fontSubfamily?.en
                ?? font.names.macintosh?.fontSubfamily?.en
                ?? font.names.unicode?.fontSubfamily?.en
                ?? font.names.fontSubfamily?.en
                ?? ''
            ).toLowerCase();
            let subfamilyInferredVariant = '';
            for (let { word, variant } of variantKeywordMap) {
                if (subfamily.includes(word)) {
                    if (variant === 'italic') {
                        if (!subfamilyInferredVariant.includes('italic')) {
                            if (subfamilyInferredVariant === 'regular') {
                                subfamilyInferredVariant += 'italic';
                            } else {
                                subfamilyInferredVariant += 'italic';
                            }
                        }
                    } else {
                        if (subfamilyInferredVariant === '') {
                            subfamilyInferredVariant = variant;
                        }
                    }
                    subfamily = subfamily.replace(word, '');
                }
            }
            const variant = subfamilyInferredVariant || filenameInferredVariant || 'regular';

            let existingUploadFamily: UploadFamily | undefined = undefined;
            for (const uploadFamily of uploadFamilies.value) {
                if (uploadFamily.family === family) {
                    existingUploadFamily = uploadFamily;
                    break;
                }
            }
            const uploadFamily = existingUploadFamily ?? {
                family,
                variants: [],
            };
            uploadFamily.variants.push({
                key: variant,
                file,
            })
            if (!existingUploadFamily) {
                uploadFamilies.value.push(uploadFamily);
            }

        } catch (error) {
            console.error('[src/ui/module/module-file-add-font.vue]', error);
            hasError = true;
        }
    }
    if (hasError) {
        $notify({
            type: 'error',
            message: t('module.fileAddFont.uploadFontParseError'),
        })
    }
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
    if (uploadFamilies.value.length > 0) {
        for (const uploadFamily of uploadFamilies.value) {
            const definition: CreateStoredFont = {
                family: uploadFamily.family,
                subsets: [
                    'cyrillic',
                    'cyrillic-ext',
                    'devanagari',
                    'greek',
                    'greek-ext',
                    'latin',
                    'latin-ext',
                    'vietnamese',
                ],
                variants: {},
            };
            for (const variant of uploadFamily.variants) {
                definition.variants[variant.key] = variant.file;
            }
            await createStoredFont(definition);
        }
        uploadFamilies.value = [];
    }
    emit('close');
}
</script>

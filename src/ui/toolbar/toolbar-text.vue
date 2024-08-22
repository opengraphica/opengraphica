<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-type my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <!-- Font Family -->
                <el-input-group>
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.font'" />
                    </template>
                    <el-select :aria-label="$t('toolbar.text.font')" v-model="family" size="small" style="width: 6rem">
                        <el-option v-for="family of familyList" :key="family" :label="family" :value="family"></el-option>
                    </el-select>
                </el-input-group>
                <!-- Text Size -->
                <el-input-group class="ml-3">
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.size'" />
                    </template>
                    <el-input-number :aria-label="$t('toolbar.text.size')" v-model="size" size="small" style="width: 3rem"></el-input-number>
                </el-input-group>
                <el-button-group v-if="false" class="el-button-group--flex ml-3">
                    <!-- Bold -->
                    <el-button :aria-label="$t('toolbar.text.bold')" size="small" :aria-pressed="bold"
                        :plain="!bold" :type="bold ? 'primary' : undefined" class="px-3" @click="bold = !bold">
                        <span class="bi bi-type-bold" aria-hidden="true"></span>
                    </el-button>
                    <!-- Italics -->
                    <el-button :aria-label="$t('toolbar.text.italic')" size="small" :aria-pressed="oblique"
                        :plain="!oblique" :type="oblique ? 'primary' : undefined" class="px-3" @click="oblique = !oblique">
                        <span class="bi bi-type-italic" aria-hidden="true"></span>
                    </el-button>
                    <!-- Strikethrough -->
                    <el-button :aria-label="$t('toolbar.text.strikethrough')" size="small" :aria-pressed="strikethrough != null"
                        :plain="strikethrough == null" :type="strikethrough != null ? 'primary' : undefined" class="px-3" @click="strikethrough = (strikethrough === null ? 0 : null)">
                        <span class="bi bi-type-strikethrough" aria-hidden="true"></span>
                    </el-button>
                    <!-- Underline -->
                    <el-button :aria-label="$t('toolbar.text.underline')" size="small" :aria-pressed="underline != null"
                        :plain="underline == null" :type="underline != null ? 'primary' : undefined" class="px-3" @click="underline = (underline === null ? 0 : null)">
                        <span class="bi bi-type-underline" aria-hidden="true"></span>
                    </el-button>
                </el-button-group>
                <!-- Fill Color -->
                <el-input-group class="ml-3" :prepend-tooltip="$t('toolbar.text.fillTooltip')">
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.fill'">Fill</span>
                    </template>
                    <el-input-color v-model="fillColor" :aria-label="$t('toolbar.text.fill')"></el-input-color>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import defaultFontFamilies from '@/config/default-font-families.json';

import { textToolbarEmitter, toolbarTextMeta } from '@/canvas/store/text-state';

import type { RGBAColor } from '@/types';

export default defineComponent({
    name: 'ToolbarText',
    components: {
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputColor,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElSelect
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup() {

        const family = computed<string | null>({
            set(value) {
                toolbarTextMeta.family = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'family',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.family;
            }
        });
        const familyList = ref<string[]>(
            defaultFontFamilies.filter((family) => !family.isFallback).map((family) => family.family)
        );

        const size = computed<number | null>({
            set(value) {
                toolbarTextMeta.size = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'size',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.size;
            }
        });

        const bold = computed<boolean>({
            set(value) {
                toolbarTextMeta.bold = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'bold',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.bold ?? false;
            }
        });

        const oblique = computed<boolean>({
            set(value) {
                toolbarTextMeta.oblique = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'oblique',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.oblique ?? false;
            }
        });

        const strikethrough = computed<number | null>({
            set(value) {
                toolbarTextMeta.strikethrough = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'strikethrough',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.strikethrough;
            }
        });

        const underline = computed<number | null>({
            set(value) {
                toolbarTextMeta.underline = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'underline',
                    value,
                });
            },
            get() {
                return toolbarTextMeta.underline;
            }
        });

        const fillColor = computed<RGBAColor>({
            set(value) {
                toolbarTextMeta.fillColor = value;
                textToolbarEmitter.emit('toolbarMetaChanged', {
                    name: 'fillColor',
                    value,
                });
            },
            get() {
                return (toolbarTextMeta.fillColor ?? {
                    is: 'color',
                    style: '#000000',
                    r: 0, g: 0, b: 0, alpha: 1,
                }) as RGBAColor;
            }
        });

        return {
            family,
            familyList,
            size,
            bold,
            oblique,
            strikethrough,
            underline,
            fillColor,
        };
    }
});
</script>

<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-type my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <!-- Font Family -->
                <el-input-group>
                    <template #prepend>
                        <span class="text-xs" v-t="'toolbar.text.font'" />
                    </template>
                    <el-select :aria-label="$t('toolbar.text.font')" v-model="family" size="small" style="width: 6rem">
                        <el-option v-for="family of familyList" :key="family" :label="family" :value="family"></el-option>
                    </el-select>
                </el-input-group>
                <!-- Text Size -->
                <el-input-group class="ml-3">
                    <template #prepend>
                        <span class="text-xs" v-t="'toolbar.text.size'" />
                    </template>
                    <el-input-number :aria-label="$t('toolbar.text.size')" v-model="size" :precision="2" :step="0.01" size="small" style="width: 3rem"></el-input-number>
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
                        <span class="text-xs" v-t="'toolbar.text.fill'">Fill</span>
                    </template>
                    <el-input-color
                        v-model="fillColor"
                        is-custom-picker
                        :aria-label="$t('toolbar.text.fill')"
                        @pick="fillColorPaletteDockVisible = !fillColorPaletteDockVisible"
                    />
                </el-input-group>
                <!-- Alignment -->
                <el-popover
                    placement="bottom"
                    popper-class="og-dock-popover"
                    trigger="click"
                    :width="250"
                    :popper-options="{
                        modifiers: [
                            {
                                name: 'computeStyles',
                                options: {
                                    adaptive: false,
                                    enabled: false
                                }
                            }
                        ]
                    }">
                    <template #reference>
                        <el-button size="small" class="!ml-3">
                            <span class="bi bi-aspect-ratio mr-2" aria-hidden="true" /> {{ $t('toolbar.text.alignment.title') }}
                        </el-button>
                    </template>
                    <h2 class="og-dock-title" v-t="'toolbar.text.alignment.title'" />
                    <el-form novalidate="novalidate" action="javascript:void(0)">
                        <!-- Boundary Type -->
                        <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.text.alignment.boundary')">
                            <el-select v-model="boundary" size="small" style="width: 6rem">
                                <el-option :label="$t('toolbar.text.alignment.boundaryOption.dynamic')" value="dynamic" />
                                <el-option :label="$t('toolbar.text.alignment.boundaryOption.box')" value="box" />
                            </el-select>
                        </el-form-item>
                        <!-- Line Direction -->
                        <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.text.alignment.lineDirection')">
                            <el-radio-group
                                v-model="lineDirection"
                                size="small">
                                <el-radio-button label="ltr">
                                    <i class="bi bi-arrow-right" aria-hidden="true" />
                                    <span class="sr-only">{{ $t('toolbar.text.alignment.lineDirectionOption.ltr') }}</span>
                                </el-radio-button>
                                <el-radio-button label="rtl">
                                    <i class="bi bi-arrow-left" aria-hidden="true" />
                                    <span class="sr-only">{{ $t('toolbar.text.alignment.lineDirectionOption.rtl') }}</span>
                                </el-radio-button>
                                <el-radio-button label="ttb">
                                    <i class="bi bi-arrow-down" aria-hidden="true" />
                                    <span class="sr-only">{{ $t('toolbar.text.alignment.lineDirectionOption.ttb') }}</span>
                                </el-radio-button>
                            </el-radio-group>
                        </el-form-item>
                        <!-- Wrap Direction -->
                        <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.text.alignment.wrapDirection')">
                            <el-radio-group
                                v-model="wrapDirection"
                                size="small">
                                <template v-if="lineDirection === 'ttb' || lineDirection === 'btt'">
                                    <el-radio-button label="ltr">
                                        <i class="bi bi-arrow-right" aria-hidden="true" />
                                        <span class="sr-only">{{ $t('toolbar.text.alignment.wrapDirectionOption.ltr') }}</span>
                                    </el-radio-button>
                                    <el-radio-button label="rtl">
                                        <i class="bi bi-arrow-left" aria-hidden="true" />
                                        <span class="sr-only">{{ $t('toolbar.text.alignment.wrapDirectionOption.rtl') }}</span>
                                    </el-radio-button>
                                </template>
                                <template v-else>
                                    <el-radio-button label="ttb">
                                        <i class="bi bi-arrow-down" aria-hidden="true" />
                                        <span class="sr-only">{{ $t('toolbar.text.alignment.wrapDirectionOption.ttb') }}</span>
                                    </el-radio-button>
                                    <el-radio-button label="btt">
                                        <i class="bi bi-arrow-up" aria-hidden="true" />
                                        <span class="sr-only">{{ $t('toolbar.text.alignment.wrapDirectionOption.btt') }}</span>
                                    </el-radio-button>
                                </template>
                            </el-radio-group>
                        </el-form-item>
                    </el-form>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock
            v-if="fillColorPaletteDockVisible"
            v-model:top="fillColorPaletteDockTop"
            v-model:left="fillColorPaletteDockLeft"
            :visible="floatingDocksVisible"
        >
            <div class="flex flex-wrap gap-2 max-w-105">
                <og-button
                    v-for="(palette, colorIndex) of fillColorPaletteItems"
                    solid icon small toggle="active"
                    :pressed="colorIndex === fillColorPaletteIndex"
                    :aria-label="t('toolbar.text.fillColor')"
                    class="og-button--color-swatch"
                    :style="{
                        '--og-button-swatch-background': palette.color.style,
                        '--og-button-swatch-color': palette.isLight ? '#000000' : '#ffffff',
                    }"
                    @click="onClickFillColorPalette($event, colorIndex)"
                >
                    <i class="bi bi-palette-fill" aria-hidden="true" />
                </og-button>
                <og-button ref="showFillColorPaletteSettingsButton" :aria-label="t('button.settings')" small slim @click="onEditFillPaletteSettings()">
                    <span class="bi bi-gear-fill" aria-hidden="true" />
                </og-button>
                <og-popover
                    v-model:visible="showFillColorPaletteSettings"
                    placement="top" arrow :offset="16"
                    :reference="showFillColorPaletteSettingsButton?.$el"
                >
                    <div class="og-popover__content">
                        <el-form action="javascript:void(0)" label-position="top">
                            <el-form-item :label="$t('toolbar.text.paletteCount')" class="!m-0 !p-0 !max-w-30">
                                <el-input-number
                                    v-model.lazy="fillColorPaletteCount"
                                    size="small"
                                    :min="1" :max="19" :step="1"
                                    @keydown.enter="showFillColorPaletteSettings = false"
                                />
                            </el-form-item>
                        </el-form>
                    </div>
                </og-popover>
            </div>
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, toRefs, watch, nextTick } from 'vue';
import { useI18n } from '@/i18n';

import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import { ElRadioButton, ElRadioGroup } from 'element-plus/lib/components/radio/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import defaultFontFamilies from '@/config/default-font-families.json';

import { colorToHsla } from '@/lib/color';
import appEmitter from '@/lib/emitter';
import { textMetaDefaults } from '@/lib/text-common';

import {
    fillColorPalette, fillColorPaletteIndex,
    fillColorPaletteDockLeft, fillColorPaletteDockTop, fillColorPaletteDockVisible,
    editingTextLayer, textToolbarEmitter, toolbarTextMeta, toolbarTextDefaults,
} from '@/canvas/store/text-state';

import type { RGBAColor, TextDocument } from '@/types';

const { t } = useI18n();

const emit = defineEmits(['close']);

/*------------*\
| Toolbar Swap |
\*------------*/

const floatingDocksVisible = ref<boolean>(true);

onMounted(() => {
    appEmitter.on('editor.tool.toolbarSwapping', onToolbarSwap);
});

onUnmounted(() => {
    appEmitter.off('editor.tool.toolbarSwapping', onToolbarSwap);
});

function onToolbarSwap() {
    floatingDocksVisible.value = false;
}

/*-----------*\
| Font Family |
\*-----------*/

const family = computed<string>({
    set(value) {
        toolbarTextMeta.family = value;
        textToolbarEmitter.emit('toolbarMetaChanged', {
            name: 'family',
            value,
        });
    },
    get() {
        return toolbarTextMeta.family ?? textMetaDefaults.family;
    }
});
const familyList = ref<string[]>(
    defaultFontFamilies.filter((family) => !family.isFallback).map((family) => family.family)
);

/*---------*\
| Font Size |
\*---------*/

const size = computed<number>({
    set(value) {
        toolbarTextMeta.size = value;
        textToolbarEmitter.emit('toolbarMetaChanged', {
            name: 'size',
            value,
        });
    },
    get() {
        return parseFloat((toolbarTextMeta.size ?? textMetaDefaults.size).toFixed(2));
    }
});

/*------------*\
| Text Styling |
\*------------*/

const bold = computed<boolean>({
    set(value) {
        toolbarTextMeta.bold = value;
        textToolbarEmitter.emit('toolbarMetaChanged', {
            name: 'bold',
            value,
        });
    },
    get() {
        return toolbarTextMeta.bold ?? textMetaDefaults.bold;
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
        return toolbarTextMeta.oblique ?? textMetaDefaults.oblique;
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
        return toolbarTextMeta.strikethrough ?? textMetaDefaults.strikethrough;
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
        return toolbarTextMeta.underline ?? textMetaDefaults.underline;
    }
});

/*----------*\
| Fill Color |
\*----------*/

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
watch(() => fillColor.value, (newFillColor) => {
    let palleteIndex = -1;
    for (let [index, color] of fillColorPalette.value.entries()) {
        if (
            color.r === newFillColor.r
            && color.g === newFillColor.g
            && color.b === newFillColor.b
            && color.alpha === newFillColor.alpha
        ) {
            palleteIndex = index;
            break;
        }
    }
    fillColorPaletteIndex.value = palleteIndex;
});

interface ColorPaletteItem {
    isLight: boolean;
    color: RGBAColor;
}

const showFillColorPaletteSettingsButton = ref<typeof OgButton>();
const showFillColorPaletteSettings = ref<boolean>(false);

const fillColorPaletteCount = computed<number>({
    get() {
        return fillColorPalette.value.length;
    },
    set(count) {
        count = Math.round(count);
        if (isNaN(count)) return;
        if (fillColorPaletteIndex.value >= count) {
            fillColorPaletteIndex.value = 0;
        }
        if (fillColorPalette.value.length > count) {
            fillColorPalette.value = fillColorPalette.value.slice(0, count);
        } else if (fillColorPalette.value.length < count) {
            for (let i = fillColorPalette.value.length; i < count; i++) {
                fillColorPalette.value.push({
                    is: 'color',
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 1,
                    style: '#000000'
                });
            }
        }
    }
});

const fillColorPaletteItems = computed<ColorPaletteItem[]>(() => {
    return fillColorPalette.value.map((color) => {
        return {
            isLight: colorToHsla(color, 'rgba').l > 0.6,
            color,
        }
    });
});

function onClickFillColorPalette(e: MouseEvent, index: number) {
    if (index === fillColorPaletteIndex.value) {
        e.preventDefault();
        appEmitter.emit('app.dialogs.openFromDock', {
            name: 'color-picker',
            props: {
                color: fillColorPalette.value[index],
            },
            onClose: (event?: any) => {
                if (event?.color) {
                    fillColorPalette.value[index] = event.color;
                    fillColor.value = event.color;
                }
            }
        });
    } else {
        fillColorPaletteIndex.value = index;
        fillColor.value = fillColorPalette.value[index];
    }
}

function onEditFillPaletteSettings() {
    showFillColorPaletteSettings.value = !showFillColorPaletteSettings.value;
}

/*--------------*\
| Text Alignment |
\*--------------*/

const boundary = computed<TextDocument['boundary']>({
    set(value) {
        textToolbarEmitter.emit('toolbarDocumentChanged', {
            name: 'boundary',
            value,
        });
    },
    get() {
        return editingTextLayer.value?.data.boundary ?? 'dynamic';
    }
});

const lineDirection = computed<TextDocument['lineDirection']>({
    set(value) {
        textToolbarEmitter.emit('toolbarDocumentChanged', {
            name: 'lineDirection',
            value,
        });
        toolbarTextDefaults.lineDirection = value;
        if (['ltr', 'rtl'].includes(value) && !['ttb', 'btt'].includes(wrapDirection.value)) {
            textToolbarEmitter.emit('toolbarDocumentChanged', {
                name: 'wrapDirection',
                value: 'ttb',
            });
            toolbarTextDefaults.wrapDirection = 'ttb';
        } else if (['ttb', 'btt'].includes(value) && !['ltr', 'rtl'].includes(wrapDirection.value)) {
            textToolbarEmitter.emit('toolbarDocumentChanged', {
                name: 'wrapDirection',
                value: 'rtl',
            });
            toolbarTextDefaults.wrapDirection = 'rtl';
        }
    },
    get() {
        return editingTextLayer.value?.data?.lineDirection ?? 'ltr';
    }
});

const wrapDirection = computed<TextDocument['wrapDirection']>({
    set(value) {
        textToolbarEmitter.emit('toolbarDocumentChanged', {
            name: 'wrapDirection',
            value,
        });
        toolbarTextDefaults.wrapDirection = value;
    },
    get() {
        return editingTextLayer.value?.data.wrapDirection ?? 'ltr';
    }
});
</script>

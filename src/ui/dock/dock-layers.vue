<template>
    <div class="ogr-dock-header">
        <div class="is-flex is-align-items-center is-justify-content-center">
            <strong class="has-text-color-regular mr-3">{{ $t('dock.layers.add') }}:</strong>
            <el-button link type="primary" class="px-0" @click="onAddLayer">
                <span class="bi bi-file-earmark-plus mr-1" aria-hidden="true"></span>
                {{ $t('dock.layers.layer') }}
            </el-button>
            <el-button link type="primary" class="px-0" @click="onAddGroup">
                <span class="bi bi-folder-plus el-text-alignment-fix--above mr-1" aria-hidden="true"></span>
                {{ $t('dock.layers.group') }}
            </el-button>
        </div>
    </div>
    <div class="ogr-dock-content is-spaced-between">
        <el-scrollbar ref="scrollbar" @scroll="onScrollLayerList">
            <template v-if="layers.length > 0">
                <app-layer-list
                    :layers="layers"
                    :is-root="true"
                    :scroll-container-height="scrollContainerHeight"
                    :scroll-top="scrollTop"
                    @scroll-by="onScrollByAmount($event)"
                />
            </template>
            <template v-else>
                <el-alert
                    type="info"
                    :title="$t('dock.layers.noLayers')"
                    show-icon
                    :closable="false"
                    class="is-justify-content-center">
                </el-alert>
            </template>
            <ul class="ogr-layer-list">
                <li class="ogr-layer is-background" :class="{ 'is-dnd-hover': isHoveringBackground }">
                    <span class="ogr-layer-main">
                        <span
                            class="ogr-layer-dnd-handle"
                            @mouseenter="isHoveringBackground = true"
                            @mouseleave="isHoveringBackground = false"
                            @click="onChangeBackgroundColor()"
                        >
                            <div class="ogr-layer-thumbnail">
                                <div class="ogr-layer-thumbnail-custom-img" :style="{ background: backgroundStyle }" />
                            </div>
                            <span class="ogr-layer-name" v-t="'dock.layers.background'" />
                        </span>
                        <el-button link type="primary" class="px-2  mr-2" :aria-label="$t('dock.layers.toggleBackgroundVisibility')" @click="isBackgroundVisible = !isBackgroundVisible">
                            <i class="bi" :class="{ 'bi-eye-fill': isBackgroundVisible, 'bi-eye-slash': !isBackgroundVisible }" aria-hidden="true"></i>
                        </el-button>
                    </span>
                </li>
            </ul>
        </el-scrollbar>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, toRef, toRefs, onMounted, nextTick, reactive } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import AppLayerList from '@/ui/app/app-layer-list.vue';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { ensureUniqueLayerSiblingName, getLayerById } from '@/store/working-file';
import { InsertLayerAction } from '@/actions/insert-layer';
import { InsertEmptyLayerOptions, InsertGroupLayerOptions, ColorModel } from '@/types';
import appEmitter from '@/lib/emitter';

const activeTab = ref<string>('file');

export default defineComponent({
    name: 'DockSettings',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppLayerList,
        ElAlert,
        ElButton,
        ElScrollbar,
        ElTooltip
    },
    props: {
        isDialog: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'dock.layers.title');

        const { layers } = toRefs(workingFileStore.state);
        const scrollbar = ref<typeof ElScrollbar>(null as unknown as typeof ElScrollbar);
        const scrollContainerHeight = ref<number>(0);
        const scrollTop = ref<number>(0);
        const isHoveringBackground = ref<boolean>(false);
        
        let scrollbarWrap = document.createElement('div');

        const backgroundStyle = computed<string>(() => {
            return workingFileStore.state.background.color.style;
        });

        const isBackgroundVisible = computed<boolean>({
            get() {
                return workingFileStore.state.background.visible;
            },
            set(visible) {
                const background = workingFileStore.state.background;
                background.visible = visible;
                workingFileStore.set('background', background);
                canvasStore.set('dirty', true);
            }
        });
        
        onMounted(() => {
            scrollbarWrap = scrollbar.value.$el.querySelector('.el-scrollbar__wrap');
        });

        async function onAddLayerOrGroup(type: 'Layer' | 'Group') {
            let selectedLayerIds = workingFileStore.get('selectedLayerIds')
            if (selectedLayerIds.length === 0) {
                selectedLayerIds = [-1];
            }
            for (let layerId of selectedLayerIds) {
                const referenceLayer = getLayerById(layerId);
                const isReferenceLayerGroup = referenceLayer?.type === 'group' && referenceLayer?.expanded;
                await historyStore.dispatch('runAction', {
                    action: new InsertLayerAction<InsertEmptyLayerOptions<ColorModel> | InsertGroupLayerOptions<ColorModel>>({
                        type: type === 'Layer' ? 'empty' : 'group',
                        groupId: isReferenceLayerGroup ? layerId : referenceLayer?.groupId,
                        name: ensureUniqueLayerSiblingName(isReferenceLayerGroup ? referenceLayer.layers[0]?.id : layerId, 'New ' + type)
                    }, referenceLayer && !isReferenceLayerGroup ? 'above' : 'top', referenceLayer && !isReferenceLayerGroup ? layerId : undefined)
                });
            }
        }

        async function onAddLayer() {
            await onAddLayerOrGroup('Layer');
        }

        async function onAddGroup() {
            await onAddLayerOrGroup('Group');
        }

        function onChangeBackgroundColor() {
            appEmitter.emit('app.dialogs.openFromDock', {
                name: 'color-picker',
                props: {
                    color: workingFileStore.state.background.color
                },
                onClose: (event?: any) => {
                    if (event?.color) {
                        const background = workingFileStore.state.background;
                        background.color = event.color;
                        workingFileStore.set('background', background);
                        canvasStore.set('dirty', true);
                    }
                }
            })
        }

        function onScrollLayerList() {
            scrollTop.value = scrollbarWrap.scrollTop;
            scrollContainerHeight.value = scrollbarWrap.clientHeight;
        }
        
        function onScrollByAmount(amount: number) {
            let newScrollTop = scrollbarWrap.scrollTop + amount;
            if (newScrollTop < 0) {
                newScrollTop = 0;
            }
            if (newScrollTop > scrollbarWrap.scrollHeight - scrollbarWrap.clientHeight) {
                newScrollTop = scrollbarWrap.scrollHeight - scrollbarWrap.clientHeight;
            }
            scrollbarWrap.scrollTop = newScrollTop;
            scrollTop.value = newScrollTop;
        }

        return {
            layers,
            scrollbar,
            scrollContainerHeight,
            scrollTop,
            tooltipShowDelay: preferencesStore.state.tooltipShowDelay,
            isBackgroundVisible,
            isHoveringBackground,
            backgroundStyle,
            onAddLayer,
            onAddGroup,
            onChangeBackgroundColor,
            onScrollLayerList,
            onScrollByAmount
        };
    }
});
</script>

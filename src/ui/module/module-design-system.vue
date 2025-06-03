<template>
    <el-tabs tab-position="left">
        <el-tab-pane label="Button" class="pl-4">
            <el-scrollbar>
                <h2>Plain</h2>
                <div class="flex gap-2">
                    <og-button>Default</og-button>
                    <og-button primary>Primary</og-button>
                    <og-button danger>Danger</og-button>
                </div>
                <h2>Outline</h2>
                <div class="flex gap-2">
                    <og-button outline>Default</og-button>
                    <og-button outline primary>Primary</og-button>
                    <og-button outline danger>Danger</og-button>
                </div>
                <h2>Solid</h2>
                <div class="flex gap-2">
                    <og-button solid>Default</og-button>
                    <og-button solid primary>Primary</og-button>
                    <og-button solid danger>Danger</og-button>
                </div>
                <h2>Outline + Solid</h2>
                <div class="flex gap-2">
                    <og-button outline solid>Default</og-button>
                    <og-button outline solid primary>Primary</og-button>
                    <og-button outline solid danger>Danger</og-button>
                </div>
                <h2>Size</h2>
                <div class="flex gap-2 items-center">
                    <og-button outline>Medium</og-button>
                    <og-button outline small>Small</og-button>
                </div>
                <h2>Toggle</h2>
                <div class="flex gap-2 items-center">
                    <og-button outline solid toggle>Pressed</og-button>
                    <og-button outline solid small toggle>Pressed</og-button>
                    <og-button outline solid toggle="active">Active</og-button>
                    <og-button outline solid small toggle="active">Active</og-button>
                </div>
                <h2>Round</h2>
                <div class="flex gap-2 items-center">
                    <og-button outline solid round>Round</og-button>
                    <og-button outline solid small round>Round</og-button>
                </div>
                <h2>Icon</h2>
                <div class="flex gap-2 items-center">
                    <og-button outline solid icon>
                        <span class="bi bi-plus" aria-hidden="true" />
                    </og-button>
                    <og-button outline solid small icon>
                        <span class="bi bi-plus" aria-hidden="true" />
                    </og-button>
                </div>
                <h2>Slim</h2>
                <div class="flex gap-2 items-center">
                    <og-button outline solid slim>Slim</og-button>
                    <og-button outline solid small slim>Slim</og-button>
                </div>
            </el-scrollbar>
        </el-tab-pane>
    </el-tabs>
</template>

<script setup lang="ts">

import OgButton from '@/ui/element/button.vue';

import ElTabs, { ElTabPane } from 'element-plus/lib/components/tabs/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';

const emit = defineEmits([
    'update:title',
    'update:dialogSize',
    'close',
]);

emit('update:title', 'module.designSystem.title');
emit('update:dialogSize', 'fullscreen');


</script>
<style scoped>
h2 {
    margin: 2rem 0 1rem 0;
}
</style>
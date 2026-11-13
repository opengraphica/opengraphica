<template>
    <form
        action="#"
        @submit.prevent="onReload"
    >
        <p>{{ t('module.pluginInstallError.message', { pluginName }) }}</p>
        <div class="flex justify-between gap-3 mt-4 w-full">
            <og-button type="button" outline solid @click="onCancel">{{ t('button.cancel') }}</og-button>
            <div class="flex gap-3">
                <og-button type="button" danger outline solid @click="onDelete">{{ t('button.deletePlugin') }}</og-button>
                <og-button type="submit" primary solid>{{ t('button.reload') }}</og-button>
            </div>
        </div>
    </form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/i18n';

import OgButton from '@/ui/element/button.vue';

import { getPluginMeta, deletePlugin } from '@/store/data/plugin-database';

const { t } = useI18n();

const props = defineProps({
    pluginId: {
        type: String,
        required: true,
    },
});

const emit = defineEmits([
    'update:title',
    'close'
]);

emit('update:title', 'module.pluginInstallError.title');

const pluginName = computed(() => {
    return getPluginMeta(props.pluginId).name;
});

function onCancel() {
    emit('close');
}

function onDelete() {
    deletePlugin(props.pluginId);
    emit('close');
}

function onReload() {
    window.location.reload();
}

</script>
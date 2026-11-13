<template>
    <form
        action="#"
        @submit.prevent="onReload"
    >
        <p>{{ t('module.pluginInstallReloadConfirm.message') }}</p>
        <div class="flex justify-between gap-3 mt-4 w-full">
            <og-button type="button" outline @click="onCancel">{{ t('button.cancel') }}</og-button>
            <og-button type="submit" primary solid>{{ t('button.reload') }}</og-button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';

import OgButton from '@/ui/element/button.vue';

const { t } = useI18n();

const emit = defineEmits([
    'update:title',
    'close'
]);

emit('update:title', 'module.pluginInstallReloadConfirm.title');

function onCancel() {
    emit('close');
}

function onReload() {
    window.location.reload();
}

</script>
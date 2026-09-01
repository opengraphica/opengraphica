<template>
    <p
        v-for="(warningParagraph, paragraphIndex) of warningParagraphs"
        :key="paragraphIndex"
        v-html="warningParagraph"
        :class="{ 'mt-0': paragraphIndex === 0 }"
    />
    <div class="text-right">
        <el-button @click="onCancel">{{ t('button.cancel') }}</el-button>
        <el-button type="danger" @click="onDiscard">{{ t('button.discardChanges') }}</el-button>
    </div>
</template>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/i18n';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import { runModule } from '@/modules';

const { t, tm, rt } = useI18n();
const vLoading = ElLoading.directive;

const emit = defineEmits([
    'update:title',
    'close'
]);

emit('update:title', 'module.fileOpenConfirm.title');

const warningParagraphs = computed(() => {
    return (tm('module.fileOpenConfirm.warning') as string[]).map((message) => {
        return rt(message, {
            insertPhoto: '<strong class="font-bold">' + t('moduleGroup.file.modules.insertPhoto.name') + '</strong>',
        }); 
    });
});

function onCancel() {
    emit('close');
}

async function onDiscard() {
    await runModule('file', 'open', { fileDiscardConfirmed: true });
    emit('close', { disableCloseTransition: true });
}
</script>

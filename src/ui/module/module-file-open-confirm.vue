<template>
    <p
        v-for="(warningParagraph, paragraphIndex) of warningParagraphs"
        :key="paragraphIndex"
        v-html="warningParagraph"
        :class="{ 'mt-0': paragraphIndex === 0 }"
    />
    <div class="has-text-right">
        <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
        <el-button type="danger" @click="onDiscard">{{ $t('button.discardChanges') }}</el-button>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import { runModule } from '@/modules';

import { t, tm, rt } from '@/i18n';

export default defineComponent({
    name: 'ModuleFileOpenConfirm',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.fileOpenConfirm.title');

        const warningParagraphs = computed(() => {
            return (tm('module.fileOpenConfirm.warning') as string[]).map((message) => {
                return rt(message, {
                    insertPhoto: '<strong class="has-text-weight-bold">' + t('moduleGroup.file.modules.insertPhoto.name') + '</strong>',
                }); 
            });
        });

        function onCancel() {
            emit('close');
        }

        async function onDiscard() {
            await runModule('file', 'open', { fileDiscardConfirmed: true });
            emit('close');
        }

        return {
            warningParagraphs,

            onCancel,
            onDiscard,
        };
    }
});
</script>

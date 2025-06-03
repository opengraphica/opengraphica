<template>
    <og-button
        ref="moreInfoButton"
        icon small
        :aria-label="t('button.moreInfo')"
        @click="togglePopover"
    >
        <span class="bi bi-info-circle" />
    </og-button>
    <og-popover
        v-model:visible="showTooltip"
        placement="top" arrow :offset="16"
        :reference="moreInfoButton?.$el"
    >
        <span class="og-popover__content max-w-100">
            {{ props.message }}
        </span>
    </og-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/i18n';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';

const props = defineProps({
    message: {
        type: String,
        default: ''
    }
});

const { t } = useI18n();

const moreInfoButton = ref<typeof OgButton>();
const showTooltip = ref(false);

function togglePopover() {
    showTooltip.value = !showTooltip.value;
}
</script>
<template>
    <slot />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
    name: 'VFragment',
    inheritAttrs: false
});
</script>

<template>
    <div>test</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'ModuleFileNew',
    emits: [
        'dialog-title'
    ],
    setup(props, { emit }) {
        emit('dialog-title', 'New File');
        
    }
});
</script>

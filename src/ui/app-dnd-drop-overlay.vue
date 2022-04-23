<template>
    <div class="ogr-dnd-drop-overlay">
        <div class="ogr-dnd-drop-overlay__center" v-t="'app.dndDropOverlay.addImage'" />
        <div class="ogr-dnd-drop-corner-top-left">
            <svg viewBox="0 0 100 100">
                <path d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                    :fill="'white'"
                    :stroke="'#ccc'" stroke-width="3" />
            </svg>
        </div>
        <div class="ogr-dnd-drop-corner-top-right">
            <svg viewBox="0 0 100 100">
                <path d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                    :fill="'white'"
                    :stroke="'#ccc'" stroke-width="3" />
            </svg>
        </div>
        <div class="ogr-dnd-drop-corner-bottom-left">
            <svg viewBox="0 0 100 100">
                <path d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                    :fill="'white'"
                    :stroke="'#ccc'" stroke-width="3" />
            </svg>
        </div>
        <div class="ogr-dnd-drop-corner-bottom-right">
            <svg viewBox="0 0 100 100">
                <path d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                    :fill="'white'"
                    :stroke="'#ccc'" stroke-width="3" />
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'AppDndDropOverlay',
    setup(props, options) {

    }
});
</script>

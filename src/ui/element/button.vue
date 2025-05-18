<template>
    <component
        :is="props.tag"
        class="og-button"
        :class="classList"
        :aria-pressed="props.toggle ? pressed : undefined"
        @click="onClick($event)"
    >
        <span class="og-button__label">
            <slot />
        </span>
    </component>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type WatchStopHandle } from 'vue';

const props = defineProps({
    danger: {
        type: Boolean,
        default: false,
    },
    outline: {
        type: Boolean,
        default: false,
    },
    pressed: {
        type: Boolean,
        default: false,
    },
    primary: {
        type: Boolean,
        default: false,
    },
    small: {
        type: Boolean,
        default: false,
    },
    solid: {
        type: Boolean,
        default: false,
    },
    tag: {
        type: String,
        default: 'button'
    },
    toggle: {
        type: Boolean,
        default: false,
    }
});

const emit = defineEmits<{
    click: [value: MouseEvent],
    'update:pressed': [value: boolean],
}>();

const classList = computed(() => {
    return [
        props.danger ? 'og-button--danger' : undefined,
        props.outline ? 'og-button--outline' : undefined,
        props.primary ? 'og-button--primary' : undefined,
        props.small ? 'og-button--small' : undefined,
        props.solid ? 'og-button--solid' : undefined,
        pressed.value ? 'og-button--pressed' : undefined,
    ];
});

/*------*\
| Toggle |
\*------*/

const pressed = ref<boolean>(false);
let pressedWatchStop: WatchStopHandle | undefined;

onMounted(() => {
    if (props.toggle) {
        pressedWatchStop = watch(() => props.pressed, () => {
            pressed.value = props.pressed;
        }, { immediate: true });
    }
});

onUnmounted(() => {
    pressedWatchStop?.();
});

/*------*\
| Events |
\*------*/

function onClick(event: MouseEvent) {
    if (props.toggle) {
        pressed.value = !pressed.value;
        emit('update:pressed', pressed.value);
    }
    emit('click', event);
}

</script>
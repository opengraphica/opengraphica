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
import { computed, onMounted, onUnmounted, ref, watch, type PropType, type WatchStopHandle } from 'vue';

const props = defineProps({
    danger: {
        type: Boolean,
        default: false,
    },
    icon: {
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
    round: {
        type: Boolean,
        default: false,
    },
    slim: {
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
        type: [Boolean, String] as PropType<boolean | 'pressed' | 'active'>,
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
        props.icon ? 'og-button--icon' : undefined,
        props.outline ? 'og-button--outline' : undefined,
        props.primary ? 'og-button--primary' : undefined,
        props.round ? 'og-button--round' : undefined,
        props.slim ? 'og-button--slim' : undefined,
        props.small ? 'og-button--small' : undefined,
        props.solid ? 'og-button--solid' : undefined,
        pressed.value ? props.toggle === 'active' ? 'og-button--active' : 'og-button--pressed' : undefined,
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
    emit('click', event);
    if (props.toggle && !event.defaultPrevented) {
        pressed.value = !pressed.value;
        emit('update:pressed', pressed.value);
    }
}

</script>
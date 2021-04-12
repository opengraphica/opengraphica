<template>
    <div class="ogr-wait" :aria-hidden="!waiting">
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { notifyInjector } from '@/lib/notify';

export default defineComponent({
    name: 'AppWait',
    setup() {
        const $notify = notifyInjector('$notify');
        const waiting = ref<boolean>(false);

        let notifications: { [key: string]: any } = {};

        onMounted(() => {
            appEmitter.on('app.wait.startBlocking', startBlocking);
            appEmitter.on('app.wait.stopBlocking', stopBlocking);
        });

        onUnmounted(() => {
            appEmitter.off('app.wait.startBlocking', startBlocking);
            appEmitter.off('app.wait.stopBlocking', stopBlocking);
        });

        function startBlocking(event?: AppEmitterEvents['app.wait.startBlocking']) {
            if (event) {
                if (notifications[event.id]) {
                    notifications[event.id].close();
                    delete notifications[event.id];
                }
                notifications[event.id] = $notify({
                    title: event.label,
                    message: 'Please wait...',
                    duration: 0,
                    showClose: false
                });
                waiting.value = true;
            }
        }

        function stopBlocking(event?: AppEmitterEvents['app.wait.stopBlocking']) {
            if (event) {
                if (notifications[event.id]) {
                    notifications[event.id].close();
                    delete notifications[event.id];
                }
                if (Object.keys(notifications).length === 0) {
                    waiting.value = false;
                }
            }
        }

        return {
            waiting
        };
    }
});
</script>

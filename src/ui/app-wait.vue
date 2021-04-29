<template>
    <div class="ogr-wait" :aria-hidden="!waiting">
    </div>
</template>

<script lang="ts">
import { defineComponent, toRefs, onMounted, onUnmounted } from 'vue';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { notifyInjector } from '@/lib/notify';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'AppWait',
    setup() {
        const $notify = notifyInjector('$notify');
        const { waiting } = toRefs(editorStore.state);

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
                if (event.label) {
                    notifications[event.id] = $notify({
                        title: event.label,
                        message: 'Please wait...',
                        duration: 0,
                        showClose: false
                    });
                } else {
                    notifications[event.id] = {
                        close() {}
                    };
                }
                editorStore.set('waiting', true);
            }
        }

        function stopBlocking(event?: AppEmitterEvents['app.wait.stopBlocking']) {
            if (event) {
                if (notifications[event.id]) {
                    notifications[event.id].close();
                    delete notifications[event.id];
                }
                if (Object.keys(notifications).length === 0) {
                    editorStore.set('waiting', false);
                }
            }
        }

        return {
            waiting
        };
    }
});
</script>

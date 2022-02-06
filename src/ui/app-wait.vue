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
        const blockingNotificationMinDisplayTime = 400;

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
            console.log(event);
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
                    console.log(notifications[event.id]);
                    notifications[event.id].displayTime = window.performance.now();
                } else {
                    notifications[event.id] = {
                        close() {},
                        displayTime: window.performance.now()
                    };
                }
                editorStore.set('waiting', true);
            }
        }

        function stopBlocking(event?: AppEmitterEvents['app.wait.stopBlocking']) {
            if (event) {
                if (notifications[event.id]) {
                    const notification = notifications[event.id];
                    const displayTimePassed = window.performance.now() - notification.displayTime;
                    if (displayTimePassed >= blockingNotificationMinDisplayTime) {
                        notification.close();
                    } else {
                        setTimeout(() => {
                            notification.close();
                        }, blockingNotificationMinDisplayTime - displayTimePassed);
                    }
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

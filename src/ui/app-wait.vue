<template>
    <div class="ogr-wait" :aria-hidden="!waiting">
        <div class="ogr-wait__center">
            <div style="width: 100%; height: 5rem;" v-loading="true" element-loading-background="transparent"></div>
            <strong>Please Wait</strong>
            <p v-for="message in notifications" :key="message">
                {{ message }}
            </p>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, toRefs, onMounted, onUnmounted, ref } from 'vue';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { notifyInjector } from '@/lib/notify';
import editorStore from '@/store/editor';
import ElLoading from 'element-plus/lib/components/loading/index';

export default defineComponent({
    name: 'AppWait',
    directives: {
        loading: ElLoading.directive
    },
    setup() {
        const $notify = notifyInjector('$notify');
        const { waiting } = toRefs(editorStore.state);
        const blockingNotificationMinDisplayTime = 400;

        const notifications = ref<{ [key: string]: string }>({});

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
                if (notifications.value[event.id] != null) {
                    delete notifications.value[event.id];
                }
                notifications.value[event.id] = event.label || '';
                editorStore.set('waiting', true);
            }
        }

        function stopBlocking(event?: AppEmitterEvents['app.wait.stopBlocking']) {
            if (event) {
                if (notifications.value[event.id]) {
                    delete notifications.value[event.id];
                }
                if (Object.keys(notifications.value).length === 0) {
                    editorStore.set('waiting', false);
                }
            }
        }

        return {
            waiting,
            notifications
        };
    }
});
</script>

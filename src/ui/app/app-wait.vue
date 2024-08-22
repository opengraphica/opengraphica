<template>
    <div class="ogr-wait" :aria-hidden="!waiting" :class="{ 'is-immediate': isImmediate }">
        <div class="ogr-wait__center">
            <div style="width: 100%; height: 5rem;" v-loading="true" element-loading-background="transparent"></div>
            <strong v-t="'app.wait.pleaseWait'"></strong>
            <template v-for="(notification, notificationId) in notifications" :key="notification">
                <p v-if="notification.label" v-t="notification.label"></p>
                <button v-if="notification.cancelable" type="button" size="small" class="el-button" @click="onClickCancel(notificationId)" v-t="'app.wait.cancel'"></button>
            </template>
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
        const isImmediate = ref<boolean>(false);

        const notifications = ref<{ [key: string]: any }>({});

        onMounted(() => {
            appEmitter.on('app.wait.startBlocking', startBlocking);
            appEmitter.on('app.wait.cancelBlocking', cancelBlocking);
            appEmitter.on('app.wait.stopBlocking', stopBlocking);
        });

        onUnmounted(() => {
            appEmitter.off('app.wait.startBlocking', startBlocking);
            appEmitter.off('app.wait.cancelBlocking', cancelBlocking);
            appEmitter.off('app.wait.stopBlocking', stopBlocking);
        });

        function startBlocking(event?: AppEmitterEvents['app.wait.startBlocking']) {
            if (event) {
                if (notifications.value[event.id] != null) {
                    delete notifications.value[event.id];
                }
                notifications.value[event.id] = {
                    label: event.label || '',
                    cancelable: event.cancelable || false
                };
                editorStore.set('waiting', true);
                isImmediate.value = !!(event.immediate);
            }
        }

        function cancelBlocking(event?: AppEmitterEvents['app.wait.cancelBlocking']) {
            if (event) {
                appEmitter.emit('app.wait.stopBlocking', event);
            }
        }

        function stopBlocking(event?: AppEmitterEvents['app.wait.stopBlocking']) {
            if (event) {
                if (notifications.value[event.id] != null) {
                    delete notifications.value[event.id];
                }
                if (Object.keys(notifications.value).length === 0) {
                    editorStore.set('waiting', false);
                }
            }
        }

        function onClickCancel(id: string) {
            appEmitter.emit('app.wait.cancelBlocking', { id });
        }

        return {
            waiting,
            notifications,
            isImmediate,
            onClickCancel
        };
    }
});
</script>

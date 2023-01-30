
import { createApp, App } from 'vue';
import i18n from '@/i18n';
import '@/polyfill';
import OpenGraphicaApp from '@/ui/app.vue';
import appEmitter from '@/lib/emitter';
import '@/store/canvas';
import editorStore from '@/store/editor';
import '@/store/history';
import '@/store/preferences';
import '@/store/working-file';
import ElNotification from 'element-plus/lib/components/notification/index';
import { notifyPolyfill } from '@/lib/notify';
import '@/lib/keyboard';
import '@/workers';

export interface OpenGraphica extends App<Element> {
    on: typeof appEmitter.on,
    off: typeof appEmitter.off,
    emit: typeof appEmitter.emit,
    theme: (themes: { [themeName: string]: string }) => Promise<OpenGraphica>
}

const app: OpenGraphica = createApp(OpenGraphicaApp) as OpenGraphica;

// Setup Localization
app.use(i18n);

// Notification toasts
app.use(ElNotification);
app.provide('$notify', notifyPolyfill(app.config.globalProperties.$notify));
appEmitter.on('app.notify', (options) => {
    const instance = notifyPolyfill(app.config.globalProperties.$notify)(options);
    if (options?.onCreated) {
        options.onCreated(instance);
    }
})

// Expose events
app.on = appEmitter.on;
app.off = appEmitter.off;
app.emit = appEmitter.emit;

// Theme loader
app.theme = async (themes: { [themeName: string]: string }): Promise<OpenGraphica> => {
    await editorStore.dispatch('setThemes', themes);
    return app;
};

// Register global Vue component at runtime
const registeredComponentList: string[] = [];
appEmitter.on('app.component.register', (component) => {
    if (component.name && !registeredComponentList.includes(component.name)) {
        app.component(component);
        registeredComponentList.push(component.name);
    }
});

// Auto mount if dev server
if ((window as any).webpackHotUpdateOpenGraphica) {
    const mount = document.createElement('div');
    mount.id = 'opengraphica';
    document.body.append(mount);
    document.body.className = 'ogr-full-page';
    app.theme({
        light: './css/main-light.css'
    }).then(() => {
        app.mount('#opengraphica');
    });
    setTimeout(() => {
        (window as any).OpenGraphica = app;
    }, 50);
    document.title = 'OpenGraphica - Dev'
}

export default app;

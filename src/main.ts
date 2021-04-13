import { createApp, App } from 'vue';
import '@/polyfill';
import OpenGraphicaApp from '@/ui/app.vue';
import appEmitter from '@/lib/emitter';
import '@/store/canvas';
import editorStore from '@/store/editor';
import '@/store/history';
import '@/store/preferences';
import '@/store/working-file';
import ElNotification from 'element-plus/lib/el-notification';

export interface OpenGraphica extends App<Element> {
    on: typeof appEmitter.on,
    off: typeof appEmitter.off,
    emit: typeof appEmitter.emit,
    theme: (themes: { [themeName: string]: string }) => Promise<OpenGraphica>
}

const app: OpenGraphica = createApp(OpenGraphicaApp) as OpenGraphica;
app.use(ElNotification);

app.provide('$notify', app.config.globalProperties.$notify);

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
        light: './css/main-light.css',
        dark: './css/main-dark.css'
    }).then(() => {
        app.mount('#opengraphica');
    });
    setTimeout(() => {
        (window as any).OpenGraphica = app;
    }, 50);
    document.title = 'OpenGraphica - Dev'
}

export default app;

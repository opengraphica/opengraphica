
import { createApp, type App } from 'vue';
import '@/polyfill';
import OpenGraphicaApp from '@/ui/app/app.vue';
import appEmitter from '@/lib/emitter';
import { registerApp } from '@/composables/app-plugin';

import('@/lib/keyboard');

export interface OpenGraphica extends App<Element> {
    on: typeof appEmitter.on,
    off: typeof appEmitter.off,
    emit: typeof appEmitter.emit,
    theme: (themes: { [themeName: string]: string }) => Promise<OpenGraphica>
}

const app: OpenGraphica = createApp(OpenGraphicaApp) as OpenGraphica;
registerApp(app);

// Expose events
app.on = appEmitter.on;
app.off = appEmitter.off;
app.emit = appEmitter.emit;

// Theme loader
app.theme = async (themes: { [themeName: string]: string }): Promise<OpenGraphica> => {
    const editorStore = (await import('@/store/editor')).default;
    await editorStore.dispatch('setThemes', themes);
    return app;
};

// Expose store for debugging
Promise.all([
    import('@/store/canvas'),
    import('@/store/editor'),
    import('@/store/history'),
    import('@/store/preferences'),
    import('@/store/working-file'),
]).then((results) => {
    (app as any).store = {
        canvas: results[0].default,
        editor: results[1].default,
        history: results[2].default,
        preferences: results[3].default,
        workingFile: results[4].default,
    }
});

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
    app.mount('#opengraphica');
    app.theme({
        light: './css/main-light.css',
        dark: './css/main-dark.css',
    });
    setTimeout(() => {
        (window as any).OpenGraphica = app;
    }, 50);
    document.title = 'OpenGraphica - Dev'
}

export default app;

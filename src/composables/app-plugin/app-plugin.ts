import type { App, Plugin, AppConfig } from 'vue';

let registeredApp: App;

export function registerApp(app: App) {
    registeredApp = app;
}

export function usePlugin(plugin: Plugin) {
    if (registeredApp) {
        registeredApp.use(plugin);
    }
}

export function getAppConfig(): AppConfig {
    return registeredApp?.config ?? {
        globalProperties: {}
    };
}

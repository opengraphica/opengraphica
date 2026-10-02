import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.opengraphica.app',
    appName: 'OpenGraphica',
    webDir: 'www',

    server: {
        androidScheme: 'https'
    },

    android: {
        adjustMarginsForEdgeToEdge: 'force',
    },

    plugins: {
        CapacitorShareTarget: {
            appGroupId: "group.com.opengraphica.app",
        },
        CapacitorUpdater: {
            autoUpdate: 'off',
        },
        SystemBars: {
            insetsHandling: 'css',
            style: 'DEFAULT',
            hidden: false,
            animation: 'NONE',
        },
    },
};

export default config;

declare global {
    var __BUILD_GIT_COMMIT_ID__: string;

    interface NavigatorUAData {
        brands: string[];
        mobile: boolean;
        platform: string;
    }

    interface Navigator {
        deviceMemory?: number;
        userAgentData?: NavigatorUAData;
    }

    interface CapacitorGlobal {
        isNativePlatform: () => boolean;
    }

    var Capacitor: CapacitorGlobal | undefined;

    interface ElectronGlobal {
        version: string;
        quit: () => void;
    }

    var Electron: ElectronGlobal | undefined;
}

export {};

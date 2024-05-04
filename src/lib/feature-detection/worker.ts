
let isSupported: boolean | null = null;

export async function isWorkerSupported(): Promise<boolean> {
    if (isSupported != null) return Promise.resolve(isSupported);
    if (window.Worker) {
        isSupported = true;
    } else {
        isSupported = false;
    }
    return isSupported;
}

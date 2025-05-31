declare var __BUILD_GIT_COMMIT_ID__: string;

declare global {
    interface Window {
        debugImage: (image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null) => void;
    }
}
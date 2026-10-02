import { v4 as uuidv4 } from 'uuid';

export async function shareImage() {
    if (window.Capacitor?.isNativePlatform) {
        const { exportAsImage } = await import('./export');
        const { Share } = await import('@capacitor/share');
        const { Directory, Filesystem } = await import('@capacitor/filesystem');
        const { default: writeBlob } = await import('capacitor-blob-writer');
        if (!await Filesystem.checkPermissions()) {
            await Filesystem.requestPermissions();
        }
        const { blob } = await exportAsImage({
            fileType: 'png',
            layerSelection: 'all',
            toBlob: true,
            maxFileSize: 10 * 1e+6, // Hard-coded 10MB for now, typical social media limit
        });
        if (!blob) return;
        const cachePath = 'share/' + uuidv4() + '.png';
        await writeBlob({
            path: cachePath,
            blob,
            directory: Directory.Cache,
            recursive: true,
        });
        const { uri } = await Filesystem.getUri({
            path: cachePath,
            directory: Directory.Cache,
        });
        Share.share({
            url: uri,
        });
    } else {
        if (!window.isSecureContext || !navigator.share) return;
        const { exportAsImage } = await import('./export');
        const { blob } = await exportAsImage({
            fileType: 'png',
            layerSelection: 'all',
            toBlob: true,
            maxFileSize: 10 * 1e+6, // Hard-coded 10MB for now, typical social media limit
        });
        if (!blob) return;
        await navigator.share({
            files: [new File([blob], 'share.png')],
        });
    }
}

export function getMimeTypeForExtension(extension: string) {
    switch (extension) {
        case 'ora': return 'image/openraster';
        case 'png': return 'image/png';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        case 'bmp': return 'image/bmp';
        case 'tif': case 'tiff': return 'image/tiff';
        case 'm3u8': return 'application/vnd.apple.mpegurl';
        case '3gp': return 'video/3gpp';
        case '3g2': return 'video/3gpp2';
        case 'mp4': return 'video/mp4';
        case 'ts': return 'video/mp2t';
        case 'mpeg': return 'video/mpeg';
        case 'ogg': return 'video/ogg';
        case 'mov': return 'video/quicktime';
        case 'webm': return 'video/webm';
        default: 'application/octet-binary';
    }
}

export function getExtensionForMimeType(mimeType: string) {
    switch (mimeType) {
        case 'image/openraster': return 'ora';
        case 'image/png': return 'png';
        case 'image/jpeg': return 'jpg';
        case 'image/webp': return 'webp';
        case 'image/gif': return 'gif';
        case 'image/bmp': return 'bmp';
        case 'image/tiff': return 'tiff';
        case 'application/vnd.apple.mpegurl': return 'm3u8';
        case 'video/3gpp': return '3gp';
        case 'video/3gpp2': return '3g2';
        case 'video/mp4': return 'mp4';
        case 'video/mp2t': return 'ts';
        case 'video/mpeg': return 'mpeg';
        case 'video/ogg': return 'ogg';
        case 'video/quicktime': return 'mov';
        case 'video/webm': return 'webm';
        default: return 'bin';
    }
}

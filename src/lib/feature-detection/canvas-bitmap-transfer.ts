
/**
 * Firefox corrupts canvas data extracted from bitmaprenderer context.
 * This checks if the browser properly supports image extraction.
 */
let isSupported: boolean | null = null;
export async function isCanvasBitmapTransferSupported() {
    if (isSupported != null) return isSupported;

    const width = 1;
    const height = 1;
    var imageBuffer = new Uint8Array([5, 255, 74, 201]);
    const imageData = new ImageData(new Uint8ClampedArray(imageBuffer), width, height);

    const bitmap = await createImageBitmap(imageData);
    const bitmapTransferCanvas = document.createElement('canvas');
    bitmapTransferCanvas.width = width;
    bitmapTransferCanvas.height = height;
    const bitmapTransferCtx = bitmapTransferCanvas.getContext('bitmaprenderer', { alpha: true, colorSpace: 'srgb' }) as ImageBitmapRenderingContext;
    if (!bitmapTransferCtx) return false;
    bitmapTransferCtx.transferFromImageBitmap(bitmap);

    // Extract the image data from the bitmap transfer canvas using toBlob
    const image = await new Promise<HTMLImageElement | undefined>((resolve) => {
        bitmapTransferCanvas.toBlob((blob) => {
            if (!blob) {
                resolve(undefined);
                return;
            }
            const img = new Image();
            img.onload = () => {
                resolve(img);
            };
            img.onerror = () => {
                resolve(undefined);
            }
            img.src = URL.createObjectURL(blob);
        });
    });

    if (!image) return false;

    // Create actual output
    const actualOutputCanvas = document.createElement('canvas');
    actualOutputCanvas.width = width;
    actualOutputCanvas.height = height;
    const actualOutputCtx = actualOutputCanvas.getContext('2d', { alpha: true, colorSpace: 'srgb' });
    if (!actualOutputCtx) return false;
    actualOutputCtx?.drawImage(image, 0, 0);
    const actualImageData = actualOutputCtx.getImageData(0, 0, 1, 1);

    isSupported = (
        imageData.data[0] === actualImageData.data[0]
        && imageData.data[1] === actualImageData.data[1]
        && imageData.data[2] === actualImageData.data[2]
        && imageData.data[3] === actualImageData.data[3]
    )
    return isSupported;
}
import type { RenderTarget, WebGLRenderer } from 'three';

declare global {
    interface Window {
        debugImage: (image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null) => void;
        debugRenderTarget: (renderTarget: RenderTarget, renderer: WebGLRenderer) => void;
    }
}

(window as any).debugImage = async function(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap) {
    import('file-saver').then(({ default: { saveAs } }) => {
        import('@/lib/image').then(async ({ createImageBlobFromCanvas, createImageBlobFromImageBitmap, createImageBlobFromImage }) => {
            let blob: Blob;
            if (image instanceof ImageBitmap) {
                blob = await createImageBlobFromImageBitmap(image);
            } else if (image instanceof HTMLCanvasElement) {
                blob = await createImageBlobFromCanvas(image);
            } else if (image instanceof HTMLImageElement) {
                blob = await createImageBlobFromImage(image);
            }
            saveAs(blob!, 'debug-image.png');
        });
    });
};
(window as any).debugRenderTarget = async function(renderTarget: RenderTarget, renderer: WebGLRenderer) {
    import('three/src/constants').then(async ({ HalfFloatType }) => {
        const buffer = new Uint8Array(renderTarget.width * renderTarget.height * 4);
        if (renderTarget.texture.type === HalfFloatType) {
            const halfFloatBuffer = new Uint16Array(renderTarget.width * renderTarget.height * 4);
            await renderer.readRenderTargetPixelsAsync(renderTarget as never, 0, 0, renderTarget.width, renderTarget.height, halfFloatBuffer);
            function convertHalfFloatToUint(value: number): number {
                const sign = (value & 0x8000) ? -1 : 1;
                const exponent = (value >> 10) & 0x1f;
                const fraction = value & 0x03ff;
                if (exponent === 0) {
                    value = sign * 2 ** -14 * (fraction / 1024);
                } else if (exponent === 31) {
                    value = fraction ? NaN : sign * Infinity;
                } else {
                    value = sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
                }
                return Math.round(Math.max(0, Math.min(1, value)) * 255);
            }
            for (let i = 0; i < halfFloatBuffer.length; i += 4) {
                buffer[i] = convertHalfFloatToUint(halfFloatBuffer[i]);
                buffer[i + 1] = convertHalfFloatToUint(halfFloatBuffer[i + 1]);
                buffer[i + 2] = convertHalfFloatToUint(halfFloatBuffer[i + 2]);
                buffer[i + 3] = convertHalfFloatToUint(halfFloatBuffer[i + 3]);
            }
        } else {
            await renderer.readRenderTargetPixelsAsync(renderTarget as never, 0, 0, renderTarget.width, renderTarget.height, buffer);
        }
        const bitmap = await createImageBitmap(
            new ImageData(new Uint8ClampedArray(buffer), renderTarget.width, renderTarget.height),
            { imageOrientation: 'flipY' },
        );
        window.debugImage(bitmap);
    });

};

export default {};
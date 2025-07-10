/**
 * Parts of this file were adapted from miniPaint
 * @copyright (c) ViliusL
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

export interface ImageDataEmptyBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface GetImageDataEmptyBoundsOptions {
    alphaTolerance?: number; // 0-1
    emptyColor?: number[]; // [0-1, 0-1, 0-1]
    emptyColorTolerance?: number; // 0-1
}

export interface CreateImageFromOptions {
    srcType?: 'objectUrl' | 'dataUrl';
}

// TODO - modify methods to pass in the color space.
// This was moved out of the working-file store so it's not imported in web worker thread.
export function getCanvasColorSpace(): 'srgb' | 'display-p3' {
    // if (store.state.colorSpace === 'Display P3') {
    //     return 'display-p3';
    // }
    return 'srgb';
}

export function getCanvasRenderingContext2DSettings(): CanvasRenderingContext2DSettings {
    return {
        alpha: true,
        colorSpace: getCanvasColorSpace()
    }
}

/**
 * Function used to identify bounds for trimming empty/white space.
 * @param imageData ImageData object that holds the image to check.
 * @param options Additional options.
 * @returns Object that contains information about the trimming bounds.
 *          Top - the index of the last transparent row from the top, before opaque image data
 *          Bottom - the index of the first transparent row after opaque image data from the top
 *          Left - the index of the last transparent column from the left, before opaque image data
 *          Right - the index of the first transparent row after opaque image data from the left
 */
export function getImageDataEmptyBounds(imageData: ImageData, options: GetImageDataEmptyBoundsOptions = {}): ImageDataEmptyBounds {
    const emptyColor: number[] | null = options.emptyColor || null;
    if (emptyColor) {
        for (const [i, channel] of emptyColor.entries()) {
            emptyColor[i] = Math.round(channel * 255);
        }
    }

    const emptyColorTolerance: number = (options.emptyColorTolerance == null) ? 0 : Math.round(options.emptyColorTolerance * 255);
    const alphaTolerance: number = (options.alphaTolerance == null) ? 0 : Math.round(options.alphaTolerance * 255);

    const bounds: ImageDataEmptyBounds = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    };

    const { data, width, height } = imageData;
    const widthX4 = width * 4;

    trimTop:
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const k = ((y * widthX4) + (x * 4));
            if (data[k + 3] <= alphaTolerance) {
                continue;
            }
            if (
                emptyColor != null &&
                Math.abs(data[k] - emptyColor[k]) <= emptyColorTolerance &&
                Math.abs(data[k + 1] - emptyColor[k + 1]) <= emptyColorTolerance &&
                Math.abs(data[k + 2] - emptyColor[k + 2]) <= emptyColorTolerance
            ) {
                continue;
            }
            bounds.top = y;
            break trimTop;
        }
    }

    trimBottom:
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const k = ((y * widthX4) + (x * 4));
            if (data[k + 3] <= alphaTolerance) {
                continue;
            }
            if (
                emptyColor != null &&
                Math.abs(data[k] - emptyColor[k]) <= emptyColorTolerance &&
                Math.abs(data[k + 1] - emptyColor[k + 1]) <= emptyColorTolerance &&
                Math.abs(data[k + 2] - emptyColor[k + 2]) <= emptyColorTolerance
            ) {
                continue;
            }
            bounds.bottom = y + 1;
            break trimBottom;
        }
    }

    trimLeft:
    for (let x = 0; x < width; x++) {
        for (let y = bounds.top; y < bounds.bottom; y++) {
            const k = ((y * widthX4) + (x * 4));
            if (data[k + 3] <= alphaTolerance) {
                continue;
            }
            if (
                emptyColor != null &&
                Math.abs(data[k] - emptyColor[k]) <= emptyColorTolerance &&
                Math.abs(data[k + 1] - emptyColor[k + 1]) <= emptyColorTolerance &&
                Math.abs(data[k + 2] - emptyColor[k + 2]) <= emptyColorTolerance
            ) {
                continue;
            }
            bounds.left = x;
            break trimLeft;
        }
    }

    trimRight:
    for (let x = width - 1; x >= 0; x--) {
        for (let y = bounds.top; y < bounds.bottom; y++) {
            const k = ((y * widthX4) + (x * 4));
            if (data[k + 3] <= alphaTolerance) {
                continue;
            }
            if (
                emptyColor != null &&
                Math.abs(data[k] - emptyColor[k]) <= emptyColorTolerance &&
                Math.abs(data[k + 1] - emptyColor[k + 1]) <= emptyColorTolerance &&
                Math.abs(data[k + 2] - emptyColor[k + 2]) <= emptyColorTolerance
            ) {
                continue;
            }
            bounds.right = x + 1;
            break trimRight;
        }
    }

    return bounds;
}

/**
 * Converts HTMLImageElement to ImageData.
 * @param image The HTMLImageElement to convert.
 * @returns The resulting ImageData.
 */
export function getImageDataFromImage(image: HTMLImageElement): ImageData {
    let workingCanvas = document.createElement('canvas');
    workingCanvas.width = image.width;
    workingCanvas.height = image.height;
    let ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) {
        (workingCanvas as any) = null;
        return new ImageData(image.width, image.height);
    }
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    (workingCanvas as any) = null;
    ctx = null;
    return imageData;
}

/**
 * Converts HTMLCanvasElement to ImageData.
 * @param image The HTMLCanvasElement to convert.
 * @returns The resulting ImageData.
 */
export function getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
    let ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) {
        return new ImageData(canvas.width, canvas.height);
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx = null;
    return imageData;
}

/**
 * Converts ImageBitmap to ImageData.
 * @param bitmap The bitmap to convert.
 * @returns The resulting ImageData.
 */
interface GetImageDataFromImageBitmapOptions {
    imageOrientation?: 'none' | 'flipY';
}
export function getImageDataFromImageBitmap(bitmap: ImageBitmap, options?: GetImageDataFromImageBitmapOptions): ImageData {
    return getImageDataFromCanvas(createCanvasFromImage(bitmap, options));
}

/**
 * Converts ImageData to HTMLImageElement.
 * @param imageData The image data to convert.
 * @returns The resulting image.
 */
export async function createImageFromImageData(imageData: ImageData): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) {
        return new Image(imageData.width, imageData.height);
    }
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return await createImageFromCanvas(canvas);
}

/**
 * Converts HTMLImageElement to Blob.
 * @param image The image to convert
 */
export async function createImageBlobFromImage(image: HTMLImageElement): Promise<Blob> {
    try {
        const response = await fetch(image.src);
        if (response.ok) {
            return await response.blob();
        }
    } catch (error) {}
    return new Blob();
}

/**
 * Converts ImageData to HTMLImageElement.
 * @param imageData The image data to convert.
 * @returns The resulting image.
 */
 export async function createImageBlobFromImageData(imageData: ImageData): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) {
        return new Blob();
    }
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return await createImageBlobFromCanvas(canvas);
}

/**
 * Creates an Blob containing a PNG image from the image currently drawn on the HTMLCanvasElement.
 * @param canvas The source HTMLCanvasElement that holds the image to extract.
 * @returns The new Blob.
 */
export async function createImageBlobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas blob not created when converting image from canvas.'));
            }
        }, 'image/png', 1);
    });
}

/**
 * Converts an image bitmap to a PNG image blob.
 * @param bitmap The image bitmap to convert
 * @returns The new blob.
 */
export async function createImageBlobFromImageBitmap(bitmap: ImageBitmap): Promise<Blob> {
    let canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    let ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) {
        return new Blob();
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await createImageBlobFromCanvas(canvas);
    (canvas as unknown) = null;
    ctx = null;
    return blob;
}

/**
 * Creates an HTMLImageElement from the image currently drawn on the HTMLCanvasElement. By default, the image points to an object URL.
 * @param canvas The source HTMLCanvasElement that holds the image to extract.
 * @param options Additional options.
 * @returns The new HTMLImageElement.
 */
export async function createImageFromCanvas(canvas: HTMLCanvasElement, options: CreateImageFromOptions = {}): Promise<HTMLImageElement> {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    resolve(await createImageFromBlob(blob, options));
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error('Canvas blob not created when converting image from canvas.'));
            }
        }, 'image/png', 1);
    });
}

/**
 * Creates an HTMLImageElement from the specified blob that holds image data.
 * @param blob The source blob that holds image data.
 * @param options Additional options.
 * @returns The new HTMLImageElement.
 */
export function createImageFromBlob(blob: Blob, options: CreateImageFromOptions = {}): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>(async (resolve, reject) => {
        let image = new Image();
        image.onload = () => {
            resolve(image);
            (image as any) = null;
        };
        image.onerror = (error) => {
            reject(error);
            (image as any) = null;
        };
        if (options.srcType === 'dataUrl') {
            image.src = await new Promise<string>((dataUrlResolve, dataUrlReject) => {
                const fileReader = new FileReader();
                fileReader.onload = (event) => {
                    dataUrlResolve(event.target?.result as string);
                };
                fileReader.onerror = (error) => {
                    dataUrlReject(error);
                }
                fileReader.readAsDataURL(blob);
            });
        } else {
            image.src = URL.createObjectURL(blob);
        }
    });
}

/**
 * Creates an HTMLImageElement with the given dimensions. By default, the image points to an object URL.
 * @param width The image width.
 * @param height The image height.
 * @returns The new HTMLImageElement.
 */
 export async function createEmptyImage(width: number, height: number): Promise<HTMLImageElement> {
    let canvas: HTMLCanvasElement | undefined = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // TODO - remove, for testing only
    // canvas.getContext('2d')!.fillStyle = '#ff00ff';
    // canvas.getContext('2d')!.fillRect(0, 0, width, height);

    const image = await createImageFromCanvas(canvas);
    canvas = undefined;
    return image;
}

/**
 * Creates an HTMLCanvasElement with the given dimensions.
 * @param width The image width.
 * @param height The image height.
 * @returns The new HTMLCanvasElement.
 */
export function createEmptyCanvas(width: number, height: number): HTMLCanvasElement {
    let canvas: HTMLCanvasElement | undefined = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/**
 * Creates an HTMLCanvasElement and 2D rendering context with the given dimensions.
 * @param width The image width.
 * @param height The image height.
 * @returns The new HTMLCanvasElement and context object.
 */
export function createEmptyCanvasWith2dContext(width: number, height: number): { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D | null } {
    let canvas: HTMLCanvasElement | undefined = document.createElement('canvas');
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (ctx) {
        ctx.imageSmoothingEnabled = false;
    }
    return { canvas, ctx };
}

/**
 * Creates an HTMLCanvasElement from the given HTMLImageElement.
 * @param image 
 */
interface CreateCanvasFromImageOptions {
    transfer?: boolean;
    imageOrientation?: 'none' | 'flipY';
    width?: number;
    height?: number;
}
export function createCanvasFromImage(image: HTMLImageElement | ImageBitmap, options?: CreateCanvasFromImageOptions): HTMLCanvasElement {
    let canvas = document.createElement('canvas');
    canvas.width = options?.width ?? image.width;
    canvas.height = options?.height ?? image.height;
    if (options?.transfer) {
        const ctx = canvas.getContext('bitmaprenderer', getCanvasRenderingContext2DSettings());
        if (!ctx) throw new Error('[src/lib/image.ts] Could not create canvas context.');
        ctx.transferFromImageBitmap(image as ImageBitmap);
    } else {
        const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) throw new Error('[src/lib/image.ts] Could not create canvas context.');
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (options?.imageOrientation === 'flipY') {
            ctx.translate(0, image.height / 2);
            ctx.scale(1, -1);
            ctx.translate(0, -image.height / 2);
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    return canvas;
}

export function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    let newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    const ctx = newCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) throw new Error('[src/lib/image.ts] Could not clone canvas.');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0);
    return newCanvas;
}
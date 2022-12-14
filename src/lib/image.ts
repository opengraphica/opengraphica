/**
 * Parts of this file were adapted from miniPaint
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

/**
 * Converts HTMLImageElement to ImageData.
 * @param image The HTMLImageElement to convert.
 * @returns The resulting ImageData.
 */
export function getImageDataFromImage(image: HTMLImageElement): ImageData {
    let workingCanvas = document.createElement('canvas');
    workingCanvas.width = image.width;
    workingCanvas.height = image.height;
    let ctx = workingCanvas.getContext('2d');
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
 * Function used to identify bounds for trimming empty/white space.
 * @param imageData ImageData object that holds the image to check.
 * @param options Additional options.
 * @returns Object that contains information about the trimming bounds.
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

    trimTop:
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const k = ((y * (width * 4)) + (x * 4));
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
            const k = ((y * (width * 4)) + (x * 4));
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
        for (let y = 0; y < height; y++) {
            const k = ((y * (width * 4)) + (x * 4));
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
        for (let y = height - 1; y >= 0; y--) {
            const k = ((y * (width * 4)) + (x * 4));
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

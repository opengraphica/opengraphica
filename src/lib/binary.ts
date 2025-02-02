
/**
 * Creates an ArrayBuffer from the specified Blob.
 * @param blob The source blob that holds image data.
 * @returns The new ArrayBuffer.
 */
export function createArrayBufferFromBlob(blob: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.addEventListener('load', () => {
            resolve(fileReader.result as ArrayBuffer);
        });
        fileReader.addEventListener('error', () => {
            reject(fileReader.error)
        });

        fileReader.readAsArrayBuffer(blob);
    });
}

/**
 * Converts a base64 data URI to a blob.
 * @returns a blob.
 */
export function createBlobFromDataUri(dataUri: string): Blob {
    const mimeDataSplit = dataUri.slice(0, 5).split(';base64,');
    const mime = mimeDataSplit[0];
    const binary = atob(mimeDataSplit[1] ?? '');
    const array = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
}
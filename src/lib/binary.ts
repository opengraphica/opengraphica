
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

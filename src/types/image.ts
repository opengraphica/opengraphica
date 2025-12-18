
export enum WasmImageFormat {
    RGBA8_SRGB = 0,
}

export interface WasmImageData {
    width: number;
    height: number;
    format: WasmImageFormat;
    buffer: Uint8Array;
}

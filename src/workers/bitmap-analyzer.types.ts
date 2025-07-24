export interface FindContrastLinesRequest {
    type: 'CONTRAST_LINES';
    uuid: string;
    bitmap: ImageBitmap;
}

export interface FindContrastLinesResponse {
    type: 'CONTRAST_LINES_RESULT';
    uuid: string;
    verticalLines: number[];
    horizontalLines: number[];
}

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum ChromaModifyMode {
    MULTIPLY = 0,
    SHIFT = 1
}

export interface ChromaCanvasFilterParams {
    chroma?: number;
    mode?: ChromaModifyMode;
}

export default class ChromaCanvasFilter implements CanvasFilter<ChromaCanvasFilterParams> {
    public name = 'chroma';
    public params: ChromaCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: ChromaModifyMode.MULTIPLY,
                options: [
                    { key: 'multiply', value: ChromaModifyMode.MULTIPLY },
                    { key: 'shift', value: ChromaModifyMode.SHIFT },
                ]
            },
            chroma: {
                type: 'percentage',
                default: 0,
                preview: 0.4,
                min: -1,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

}

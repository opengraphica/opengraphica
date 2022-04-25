import { ColorModel, WorkingFileTextLayerSpan, WorkingFileTextLayerSpanMeta } from '@/types';

export interface TextLayerRenderInfoWrap<T extends ColorModel> {
    characterOffsets: number[];
    spans: WorkingFileTextLayerSpan<T>[];
}

export interface TextLayerCacheItem<T extends ColorModel> {
    lastCalculatedLayerWidth?: number;
    lastCalculatedLayerHeight?: number;
    textBoundaryWidth?: number;
    textBoundaryHeight?: number;
    renderInfo?: {
        lines: Array<{
            align: 'start' | 'center' | 'end';
            firstWrapIndex: number;
            wraps: TextLayerRenderInfoWrap<T>[];
        }>;
        wrapSizes: Array<{
            size: number;
            offset: number;
            baseline: number;
        }>;
    }
}

export const textLayerCache = new WeakMap<object, TextLayerCacheItem<ColorModel>>();

export const textMetaDefaults = Object.freeze({
    family: 'Arial',
    size: 16,
    weight: 400,
    style: 'normal',
    obliqueAngle: 0,
    underline: null,
    underlineColor: null,
    underlineThickness: 1,
    overline: null,
    overlineColor: null,
    overlineThickness: 1,
    strikethrough: null,
    strikethroughColor: null,
    strikethroughThickness: 1,
    fillColor: { is: 'color', r: 0, g: 0, b: 0, a: 1, style: '#000000' },
    strokeColor: { is: 'color', r: 0, g: 0, b: 0, a: 1, style: '#000000' },
    strokeSize: 0,
    tracking: 0,
    leading: 0
});

export const fontLoadedStatusMap = new Map();
fontLoadedStatusMap.set('Arial', true);
fontLoadedStatusMap.set('Courier', true);
fontLoadedStatusMap.set('Impact', true);
fontLoadedStatusMap.set('Helvetica', true);
fontLoadedStatusMap.set('Monospace', true);
fontLoadedStatusMap.set('Tahoma', true);
fontLoadedStatusMap.set('Times New Roman', true);
fontLoadedStatusMap.set('Verdana', true);

import { CanvasRenderingContext2DEnhanced } from './canvas';
import { ColorModel } from './color';
import { VectorShape } from './vector';

export type WorkingFileLayerBlendingMode = 'color' | 'color-burn' | 'color-dodge' | 'copy' | 
    'darken' | 'darker' | 'destination-atop' | 'destination-in' | 'destination-out' | 'destination-over' | 
    'difference' | 'exclusion' | 'hard-light' | 'hue' | 'lighten' | 'lighter' | 'luminosity' | 
    'multiply' | 'overlay' | 'saturation' | 'screen' | 'soft-light' | 'source-atop' | 'source-in' | 
    'source-out' | 'source-over' | 'xor';
export type WorkingFileLayerType = 'group' | 'raster' | 'vector' | 'text';

export interface WorkingFileLayerFilter<T extends ColorModel> {
    name: string
}

export interface WorkingFileLayerRenderer<T extends ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<T>): void;
}

export interface WorkingFileLayer<T extends ColorModel> {
    bakedImage?: HTMLImageElement;
    blendingMode: WorkingFileLayerBlendingMode;
    filters: WorkingFileLayerFilter<T>[];
    groupId: number | null;
    height: number;
    id: number;
    name: string;
    opacity: 1;
    renderer: WorkingFileLayerRenderer<T>;
    transform: DOMMatrix;
    type: WorkingFileLayerType;
    visible: boolean;
    width: number;
    x: number;
    y: number;
}

export interface WorkingFileGroupLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'group';
    layers: WorkingFileLayer<T>[];
}

export interface WorkingFileRasterLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'raster';
    data: {
        sourceImage?: HTMLImageElement;
        draftImage?: HTMLCanvasElement;
    }
}

export interface WorkingFileVectorLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'vector';
    data: VectorShape<T>[];
}

export interface WorkingFileTextLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'text';
    data: {}; // TODO
}

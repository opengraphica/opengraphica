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
    name: string;
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
    transformOriginX: number; // Range 0-1 where 0 is the left and 1 is the right edge of the layer.
    transformOriginY: number; // Range 0-1 where 0 is the top and 1 is the bottom edge of the layer.
    type: WorkingFileLayerType;
    visible: boolean;
    width: number;
}

export interface WorkingFileGroupLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'group';
    layers: WorkingFileLayer<T>[];
}

export interface WorkingFileRasterLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'raster';
    data: {
        sourceImage?: HTMLImageElement;
        sourceImageIsObjectUrl?: boolean;
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

export type WorkingFileAnyLayer<T extends ColorModel> = WorkingFileGroupLayer<T> | WorkingFileRasterLayer<T> | WorkingFileVectorLayer<T> | WorkingFileTextLayer<T>;

export interface InsertGroupLayerOptions<T extends ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    type: 'group';
}
export interface InsertRasterLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    type: 'raster';
}
export interface InsertVectorLayerOptions<T extends ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    type: 'vector';
}
export interface InsertTextLayerOptions<T extends ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    type: 'text';
}
export type InsertAnyLayerOptions<T extends ColorModel> = InsertGroupLayerOptions<T> | InsertRasterLayerOptions<T> | InsertVectorLayerOptions<T> | InsertTextLayerOptions<T>;

export interface UpdateGroupLayerOptions<T extends ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    id: number;
}
export interface UpdateRasterLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    id: number;
}
export interface UpdateVectorLayerOptions<T extends ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    id: number;
}
export interface UpdateTextLayerOptions<T extends ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    id: number;
}
export type UpdateAnyLayerOptions<T extends ColorModel> = UpdateGroupLayerOptions<T> | UpdateRasterLayerOptions<T> | UpdateVectorLayerOptions<T> | UpdateTextLayerOptions<T>;

export interface NewFilePreset {
    name: string,
    width: number,
    height: number,
    measuringUnits: 'px' | 'cm' | 'mm' | 'in',
    resolutionX: number,
    resolutionY: number,
    resolutionUnits: 'px/in' | 'px/mm' | 'px/cm',
    colorProfile: string,
    scaleFactor: 1
}

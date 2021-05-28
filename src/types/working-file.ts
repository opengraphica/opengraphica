import { CanvasRenderingContext2DEnhanced } from './canvas';
import { ColorModel } from './color';
import { VectorShape } from './vector';

export type WorkingFileLayerBlendingMode = 'color' | 'color-burn' | 'color-dodge' | 'copy' | 
    'darken' | 'darker' | 'destination-atop' | 'destination-in' | 'destination-out' | 'destination-over' | 
    'difference' | 'exclusion' | 'hard-light' | 'hue' | 'lighten' | 'lighter' | 'luminosity' | 
    'multiply' | 'overlay' | 'saturation' | 'screen' | 'soft-light' | 'source-atop' | 'source-in' | 
    'source-out' | 'source-over' | 'xor';
export type WorkingFileLayerType = 'group' | 'raster' | 'rasterSequence' | 'vector' | 'text';

export interface WorkingFileLayerFilter<T extends ColorModel> {
    name: string;
}

export interface WorkingFileLayerRenderer<T extends ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<T>): void;
}

export interface WorkingFileTimelineKey {
    timing: number[]; // Cubic beizer, array of 4
    value: any;
}

export interface WorkingFileLayerTimelineFrame {
    layerId: number;
    start: number; // Milliseconds
    end: number | null; // Milliseconds
    keys: {
        [key: string]: WorkingFileTimelineKey;
    };
}

export type WorkingFileTimelineTrack = WorkingFileLayerTimelineFrame[];

export interface WorkingFileTimeline {
    [key: string]: WorkingFileTimelineTrack;
}

export interface WorkingFileLayer<T extends ColorModel> {
    bakedImage: HTMLImageElement | null;
    blendingMode: WorkingFileLayerBlendingMode;
    filters: WorkingFileLayerFilter<T>[];
    groupId: number | null;
    height: number;
    id: number;
    name: string;
    opacity: 1;
    renderer: WorkingFileLayerRenderer<T>;
    thumbnailImageSrc: string | null;
    transform: DOMMatrix;
    transformOriginX: number; // Range 0-1 where 0 is the left and 1 is the right edge of the layer.
    transformOriginY: number; // Range 0-1 where 0 is the top and 1 is the bottom edge of the layer.
    type: WorkingFileLayerType;
    visible: boolean;
    width: number;
}

export interface WorkingFileGroupLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'group';
    expanded: boolean;
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

export interface WorkingFileRasterSequenceLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'rasterSequence';
    data: {
        currentFrame?: WorkingFileRasterLayer<T>['data'];
        sequence: {
            start: number; // Milliseconds
            end: number; // Milliseconds
            frame: WorkingFileRasterLayer<T>['data'];
        }[];
    };
}

export interface WorkingFileVectorLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'vector';
    data: VectorShape<T>[];
}

export interface WorkingFileTextLayer<T extends ColorModel> extends WorkingFileLayer<T> {
    type: 'text';
    data: {}; // TODO
}

export type WorkingFileAnyLayer<T extends ColorModel> = WorkingFileGroupLayer<T> | WorkingFileRasterLayer<T> | WorkingFileRasterSequenceLayer<T> | WorkingFileVectorLayer<T> | WorkingFileTextLayer<T>;

export interface InsertGroupLayerOptions<T extends ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    type: 'group';
}
export interface InsertRasterLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    type: 'raster';
}
export interface InsertRasterSequenceLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterSequenceLayer<T>> {
    type: 'rasterSequence';
}
export interface InsertVectorLayerOptions<T extends ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    type: 'vector';
}
export interface InsertTextLayerOptions<T extends ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    type: 'text';
}
export type InsertAnyLayerOptions<T extends ColorModel> = InsertGroupLayerOptions<T> | InsertRasterLayerOptions<T> | InsertRasterSequenceLayerOptions<T> | InsertVectorLayerOptions<T> | InsertTextLayerOptions<T>;

export interface UpdateGroupLayerOptions<T extends ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    id: number;
}
export interface UpdateRasterLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    id: number;
}
export interface UpdateRasterSequenceLayerOptions<T extends ColorModel> extends Partial<WorkingFileRasterSequenceLayer<T>> {
    id: number;
}
export interface UpdateVectorLayerOptions<T extends ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    id: number;
}
export interface UpdateTextLayerOptions<T extends ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    id: number;
}
export type UpdateAnyLayerOptions<T extends ColorModel> = UpdateGroupLayerOptions<T> | UpdateRasterLayerOptions<T> | UpdateRasterSequenceLayerOptions<T> | UpdateVectorLayerOptions<T> | UpdateTextLayerOptions<T>;

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

import { ColorModel, ColorModelName } from './color';
import { VectorShape } from './vector';
import { MeasuringUnits, ResolutionUnits } from './metrics';
import { WorkingFileLayerBlendingMode, WorkingFileLayerFilter, WorkingFileLayerType } from './working-file';

export interface SerializedFileLayer<T extends ColorModel> {
    blendingMode: WorkingFileLayerBlendingMode;
    filters: WorkingFileLayerFilter<T>[];
    groupId: number | null;
    height: number;
    id: number;
    name: string;
    opacity: 1;
    transform: [number, number, number, number, number, number];
    type: WorkingFileLayerType;
    visible: boolean;
    width: number;
    x: number;
    y: number;
}

export interface SerializedFileGroupLayer<T extends ColorModel> extends SerializedFileLayer<T> {
    type: 'group';
    layers: SerializedFileLayer<T>[];
}

export interface SerializedFileRasterLayer<T extends ColorModel> extends SerializedFileLayer<T> {
    type: 'raster';
    data: {
        sourceImageSerialized?: string;
    }
}

export interface SerializedFileVectorLayer<T extends ColorModel> extends SerializedFileLayer<T> {
    type: 'vector';
    data: VectorShape<T>[];
}

export interface SerializedFileTextLayer<T extends ColorModel> extends SerializedFileLayer<T> {
    type: 'text';
    data: {}; // TODO
}

export interface SerializedFile<T extends ColorModel> {
    version: string;
    date: string;
    activeLayerId: number | null;
    colorModel: ColorModelName;
    colorSpace: string;
    drawOriginX: number;
    drawOriginY: number;
    height: number; // Always pixels
    layerIdCounter: number;
    measuringUnits: MeasuringUnits;
    resolutionUnits: ResolutionUnits;
    resolutionX: number;
    resolutionY: number;
    scaleFactor: number;
    width: number; // Always pixels
    layers: SerializedFileLayer<T>[];
}

import type { ColorModel, ColorModelName } from './color';
import type { TextDocument } from './text';
import type { VectorShape } from './vector';
import type { MeasuringUnits, ResolutionUnits } from './metrics';
import type {
    WorkingFileGradientLayer, WorkingFileLayerBlendingMode, WorkingFileLayerFilter, WorkingFileLayerType
} from './working-file';

export interface SerializedFileTimelineKey {
    timing: number[]; // Cubic beizer, array of 4
    value: any;
}

export interface SerializedFileLayerTimelineFrame {
    layerId: number;
    start: number;
    end: number | null;
    keys: {
        [key: string]: SerializedFileTimelineKey;
    };
}

export type SerializedFileTimelineTrack = SerializedFileLayerTimelineFrame[];

export interface SerializedFileTimeline {
    id: number;
    name: string;
    start: number;
    end: number;
    tracks: {
        [key: string]: SerializedFileTimelineTrack;
    }
}

export interface SerializedFileLayer<T extends ColorModel = ColorModel> {
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
}

export interface SerializedFileEmptyLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'empty';
}

export interface SerializedFileGradientLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'gradient';
    data: WorkingFileGradientLayer<T>['data'];
}

export interface SerializedFileGroupLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'group';
    expanded: boolean;
    layers: SerializedFileLayer<T>[];
}

export interface SerializedFileRasterLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'raster';
    data: {
        sourceImageSerialized?: string;
    }
}

export interface SerializedFileRasterSequenceLayerFrame<T extends ColorModel = ColorModel> {
    start: number; // Milliseconds
    end: number; // Milliseconds
    image: SerializedFileRasterLayer<T>['data'];
}

export interface SerializedFileRasterSequenceLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'rasterSequence';
    data: {
        sequence: SerializedFileRasterSequenceLayerFrame<T>[];
    };
}

export interface SerializedFileVectorLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'vector';
    data: {
        sourceSvgSerialized?: string;
    }
}

export interface SerializedFileTextLayer<T extends ColorModel = ColorModel> extends SerializedFileLayer<T> {
    type: 'text';
    data: TextDocument;
}

export interface SerializedFile<T extends ColorModel = ColorModel> {
    version: string;
    date: string;
    background: {
        visible: boolean;
        color: T;
    };
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
    selectedLayerIds: number[];
    width: number; // Always pixels
    layers: SerializedFileLayer<T>[];
}

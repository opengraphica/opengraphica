import { ColorModel } from './color';
import { VectorShape } from './vector';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import type { Camera, Scene, WebGLRenderer } from 'three';

export interface DrawWorkingFileLayerOptions {
    isEditorPreview?: boolean;
    selectedLayersOnly?: boolean;
    visible?: boolean;
    force2dRenderer?: boolean;
    selectionTest?: {
        point: DOMPoint;
        resultId?: number;
        resultPixelTest?: Uint8ClampedArray;
    };
}

export interface DrawWorkingFileOptions {
    isEditorPreview?: boolean;
    selectedLayersOnly?: boolean;
    initialTransform?: DOMMatrix;
    force2dRenderer?: boolean;
    selectionTest?: {
        point: DOMPoint;
        resultId?: number;
        resultPixelTest?: Uint8ClampedArray;
    };
}

export type WorkingFileLayerBlendingMode = 'color' | 'color-burn' | 'color-dodge' | 'copy' | 
    'darken' | 'destination-atop' | 'destination-in' | 'destination-out' | 'destination-over' | 
    'difference' | 'exclusion' | 'hard-light' | 'hue' | 'lighten' | 'lighter' | 'luminosity' | 
    'multiply' | 'overlay' | 'saturation' | 'screen' | 'soft-light' | 'source-atop' | 'source-in' | 
    'source-out' | 'source-over' | 'xor';
export type WorkingFileLayerType = 'empty' | 'group' | 'raster' | 'rasterSequence' | 'vector' | 'text';

export interface WorkingFileLayerFilter<T extends ColorModel = ColorModel> {
    name: string;
    disabled?: boolean;
    params: Record<string, unknown>;
}

export interface WorkingFileLayerRenderer<T extends ColorModel = ColorModel> {
    threejsScene: Scene | undefined;
    isAttached: boolean;
    order: number;
    attach(layer: WorkingFileLayer<ColorModel>): void;
    onAttach(layer: WorkingFileLayer<ColorModel>): void;
    detach(): void;
    onDetach(): void;
    reorder(order: number): void;
    onReorder(order: number): void;
    update(updates: Partial<WorkingFileLayer<ColorModel>>): void;
    onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>): void;
    draw(
        ctx: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext,
        layer: WorkingFileLayer<T>,
        options?: DrawWorkingFileLayerOptions
    ): void;
    onDraw(
        ctx: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext,
        layer: WorkingFileLayer<T>,
        options?: DrawWorkingFileLayerOptions
    ): void;
    renderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>): void;
    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>): void;
}
export declare var WorkingFileLayerRenderer: {
    new (layer: WorkingFileLayer<ColorModel>): void;
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
    id: number;
    name: string;
    start: number;
    end: number;
    tracks: {
        [key: string]: WorkingFileTimelineTrack; // Mapping of layer id to frame list
    }
}

export interface WorkingFileLayer<T extends ColorModel = ColorModel> {
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
    type: WorkingFileLayerType;
    visible: boolean;
    width: number;
}

export interface WorkingFileEmptyLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'empty';
}

export interface WorkingFileGroupLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'group';
    expanded: boolean;
    layers: WorkingFileAnyLayer<T>[];
}

export interface WorkingFileRasterLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'raster';
    data: {
        sourceImage?: HTMLImageElement;
        sourceImageIsObjectUrl?: boolean;
        draftImage?: HTMLCanvasElement;
    }
}

export interface WorkingFileRasterSequenceLayerFrame<T extends ColorModel = ColorModel> {
    start: number; // Milliseconds
    end: number; // Milliseconds
    image: WorkingFileRasterLayer<T>['data'];
    thumbnailImageSrc: string | null;
}

export interface WorkingFileRasterSequenceLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'rasterSequence';
    data: {
        currentFrame?: WorkingFileRasterLayer<T>['data'];
        sequence: WorkingFileRasterSequenceLayerFrame<T>[];
    };
}

export interface WorkingFileVectorLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'vector';
    data: VectorShape<T>[];
}

export interface WorkingFileTextLayerSpanMeta<T extends ColorModel = ColorModel> {
    family?: string;
    size?: number;
    weight?: number;
    style?: 'normal' | 'italic' | 'oblique';
    obliqueAngle?: number;
    underline?: null | 'solid' | 'wavy' | 'dashed';
    underlineColor?: null | T;
    underlineThickness?: number;
    overline?: null | 'solid' | 'wavy' | 'dashed';
    overlineColor?: null | T;
    overlineThickness?: number;
    strikethrough?: null | 'solid' | 'wavy' | 'dashed';
    strikethroughColor?: null | T;
    strikethroughThickness?: number;
    fillColor?: T;
    strokeColor?: T;
    strokeSize?: number;
    tracking?: number;
    leading?: number;
}

export interface WorkingFileTextLayerSpan<T extends ColorModel = ColorModel> {
    text: string;
    meta: WorkingFileTextLayerSpanMeta<T>;
}

export interface WorkingFileTextLayerLine<T extends ColorModel = ColorModel> {
    align: 'start' | 'center' | 'end';
    spans: WorkingFileTextLayerSpan<T>[];
}

export interface WorkingFileTextLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'text';
    data: {
        boundary: 'dynamic' | 'box';
        kerning: 'metrics' | 'none';
        baseDirection: 'ltr' | 'rtl' | 'ttb' | 'btt';
        wrapDirection: 'ltr' | 'rtl' | 'ttb' | 'btt';
        wrapAt: 'word' | 'wordThenLetter';
        lines: WorkingFileTextLayerLine<T>[];
    }
}

export type WorkingFileAnyLayer<T extends ColorModel = ColorModel> = WorkingFileEmptyLayer<T> | WorkingFileGroupLayer<T> | WorkingFileRasterLayer<T> | WorkingFileRasterSequenceLayer<T> | WorkingFileVectorLayer<T> | WorkingFileTextLayer<T>;

export interface InsertEmptyLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileEmptyLayer<T>> {
    type: 'empty';
}
export interface InsertGroupLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    type: 'group';
}
export interface InsertRasterLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    type: 'raster';
}
export interface InsertRasterSequenceLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileRasterSequenceLayer<T>> {
    type: 'rasterSequence';
}
export interface InsertVectorLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    type: 'vector';
}
export interface InsertTextLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    type: 'text';
}
export type InsertAnyLayerOptions<T extends ColorModel = ColorModel> = InsertEmptyLayerOptions<T> | InsertGroupLayerOptions<T> | InsertRasterLayerOptions<T> | InsertRasterSequenceLayerOptions<T> | InsertVectorLayerOptions<T> | InsertTextLayerOptions<T>;

export interface UpdateEmptyLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileEmptyLayer<T>> {
    id: number;
}
export interface UpdateGroupLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileGroupLayer<T>> {
    id: number;
}
export interface UpdateRasterLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileRasterLayer<T>> {
    id: number;
}
export interface UpdateRasterSequenceLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileRasterSequenceLayer<T>> {
    id: number;
}
export interface UpdateVectorLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileVectorLayer<T>> {
    id: number;
}
export interface UpdateTextLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileTextLayer<T>> {
    id: number;
}
export type UpdateAnyLayerOptions<T extends ColorModel = ColorModel> = UpdateEmptyLayerOptions<T> | UpdateGroupLayerOptions<T> | UpdateRasterLayerOptions<T> | UpdateRasterSequenceLayerOptions<T> | UpdateVectorLayerOptions<T> | UpdateTextLayerOptions<T>;

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

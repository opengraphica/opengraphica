import type { ColorModel, ColorModelName } from './color';
import type { TextDocument } from './text';
import type { VectorShape } from './vector';
import type { MeasuringUnits, ResolutionUnits } from './metrics';
import type { Camera, Scene, WebGLRenderer } from 'three';

export interface DrawWorkingFileLayerOptions {
    isEditorPreview?: boolean;
    selectedLayersOnly?: boolean;
    visible?: boolean;
    force2dRenderer?: boolean;
    globalCompositeOperation?: CanvasRenderingContext2D['globalCompositeOperation'];
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
    disableViewportTransform?: boolean;
    selectionTest?: {
        point: DOMPoint;
        resultId?: number;
        resultPixelTest?: Uint8ClampedArray;
    };
}

export type WorkingFileLayerBlendingMode
    = 'normal' | 'dissolve' | 'colorErase' | 'erase' | 'merge' | 'split'
    | 'lightenOnly' | 'lumaLightenOnly' | 'screen' | 'dodge' | 'linearDodge' | 'addition'
    | 'darkenOnly' | 'lumaDarkenOnly' | 'multiply' | 'burn' | 'linearBurn'
    | 'overlay' | 'softLight' | 'hardLight' | 'vividLight' | 'pinLight' | 'linearLight' | 'hardMix'
    | 'difference' | 'exclusion' | 'subtract' | 'grainExtract' | 'grainMerge' | 'divide'
    | 'hue' | 'chroma' | 'color' | 'lightness' | 'luminance';

export type WorkingFileLayerType = 'empty' | 'gradient' | 'group' | 'raster' | 'rasterSequence' | 'vector' | 'text';

export interface WorkingFileLayerFilter<T extends ColorModel = ColorModel> {
    name: string;
    disabled?: boolean;
    params: Record<string, unknown>;
}

export interface WorkingFileLayerRenderer<T extends ColorModel = ColorModel> {
    threejsScene: Scene | undefined;
    renderMode: '2d' | 'webgl';
    isAttached: boolean;
    order: number;
    attach(layer: WorkingFileLayer<ColorModel>): void;
    onAttach(layer: WorkingFileLayer<ColorModel>): void;
    detach(): void;
    onDetach(): void;
    swapScene(scene: Scene): void;
    onSwapScene(scene: Scene): void;
    reorder(order: number): void;
    onReorder(order: number): void;
    update(updates: Partial<WorkingFileLayer<ColorModel>>): void;
    onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>): void;
    nextUpdate(): Promise<void>;
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

export interface WorkingFileLayerDraftChunk {
    x: number;
    y: number;
    data: HTMLCanvasElement;
    mode?: 'replace' | 'source-over';
}

export interface WorkingFileLayerDraft {
    uuid: string;
    lastUpdateTimestamp?: number;
    height: number; // The actual height drawn across on the canvas
    logicalHeight: number; // The pixel height of the preview data, stretched to `height`
    logicalWidth: number; // The pixel width of the preview data, stretched to `width`
    mode?: 'replace' | 'source-over'; // If 'replace', the original layer contents will not be drawn while the draft is in place.
    transform: DOMMatrix; // Should be an inverse transform to undo the global transform
    updateChunks: WorkingFileLayerDraftChunk[]; // List of canvas chunks to update a raster image preview
    width: number; // The actual width drawn across the canvas
}

export interface WorkingFileLayer<T extends ColorModel = ColorModel> {
    bakedImage: HTMLImageElement | null;
    blendingMode: WorkingFileLayerBlendingMode;
    drafts: WorkingFileLayerDraft[] | null;
    filters: WorkingFileLayerFilter<T>[];
    groupId: number | null;
    height: number;
    id: number;
    isBaking?: boolean;
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

export interface WorkingFileGradientColorStop<T extends ColorModel = ColorModel> {
    offset: number;
    color: T;
}
export type WorkingFileGradientColorSpace = 'oklab' | 'srgb' | 'linearSrgb';
export type WorkingFileGradientFillType = 'linear' | 'radial';
export type WorkingFileGradientSpreadMethod = 'pad' | 'repeat' | 'reflect' | 'truncate';

export interface WorkingFileGradientLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'gradient';
    data: {
        start: {
            x: number;
            y: number;
        };
        end: {
            x: number;
            y: number;
        };
        focus: {
            x: number;
            y: number;
        };
        stops: Array<WorkingFileGradientColorStop<T>>;
        blendColorSpace: WorkingFileGradientColorSpace;
        fillType: WorkingFileGradientFillType;
        spreadMethod: WorkingFileGradientSpreadMethod;
    }
}

export interface WorkingFileGroupLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'group';
    expanded: boolean;
    layers: WorkingFileAnyLayer<T>[];
}

export interface WorkingFileRasterLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'raster';
    data: {
        sourceUuid?: string;
        updateChunks?: WorkingFileLayerDraftChunk[];
        chunkUpdateId?: string; // This value changes every chunk update to trigger a re-render
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
    data: {
        sourceUuid?: string;
    }
}

export interface WorkingFileTextLayer<T extends ColorModel = ColorModel> extends WorkingFileLayer<T> {
    type: 'text';
    data: TextDocument;
}

export type WorkingFileAnyLayer<T extends ColorModel = ColorModel>
    = WorkingFileEmptyLayer<T> | WorkingFileGradientLayer<T> | WorkingFileGroupLayer<T> | WorkingFileRasterLayer<T>
    | WorkingFileRasterSequenceLayer<T> | WorkingFileVectorLayer<T> | WorkingFileTextLayer<T>;

export interface InsertEmptyLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileEmptyLayer<T>> {
    type: 'empty';
}
export interface InsertGradientLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileGradientLayer<T>> {
    type: 'gradient';
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
export type InsertAnyLayerOptions<T extends ColorModel = ColorModel>
    = InsertEmptyLayerOptions<T> | InsertGradientLayerOptions<T> | InsertGroupLayerOptions<T> | InsertRasterLayerOptions<T>
    | InsertRasterSequenceLayerOptions<T> | InsertVectorLayerOptions<T> | InsertTextLayerOptions<T>;

export interface UpdateEmptyLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileEmptyLayer<T>> {
    id: number;
}
export interface UpdateGradientLayerOptions<T extends ColorModel = ColorModel> extends Partial<WorkingFileGradientLayer<T>> {
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
export type UpdateAnyLayerOptions<T extends ColorModel = ColorModel>
    = UpdateEmptyLayerOptions<T> | UpdateGradientLayerOptions<T> | UpdateGroupLayerOptions<T> | UpdateRasterLayerOptions<T>
    | UpdateRasterSequenceLayerOptions<T> | UpdateVectorLayerOptions<T> | UpdateTextLayerOptions<T>;

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

export interface WorkingFile<T extends ColorModel = ColorModel> {
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
    layers: WorkingFileLayer<T>[];
}

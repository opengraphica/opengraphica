import { PerformantStore } from './performant-store';
import appEmitter from '@/lib/emitter';
import { deleteStoredImage } from '@/store/image';

import type {
    ColorModel, FileSystemFileHandle, MeasuringUnits, ResolutionUnits, ColorModelName,
    WorkingFileLayer, WorkingFileAnyLayer, WorkingFileGroupLayer, WorkingFileTimeline, WorkingFileLayerMask
} from '@/types';

interface WorkingFileState {
    activeTimelineId: number | null;
    background: {
        visible: boolean;
        color: ColorModel;
    };
    colorModel: ColorModelName;
    colorSpace: string;
    drawOriginX: number;
    drawOriginY: number;
    fileHandle: FileSystemFileHandle | null;
    fileName: string;
    height: number; // Always pixels
    layerIdCounter: number;
    layers: WorkingFileLayer<ColorModel>[];
    maskIdCounter: number;
    masks: Record<number, WorkingFileLayerMask>,
    measuringUnits: MeasuringUnits;
    resolutionUnits: ResolutionUnits;
    resolutionX: number;
    resolutionY: number;
    scaleFactor: number;
    selectedLayerIds: number[];
    timelineIdCounter: 0;
    timelines: WorkingFileTimeline[];
    width: number; // Always pixels
}

interface WorkingFileStore {
    dispatch: {};
    state: WorkingFileState;
}

const store = new PerformantStore<WorkingFileStore>({
    name: 'workingFileStore',
    state: {
        activeTimelineId: null,
        background: {
            visible: true,
            color: { is: 'color', r: 1, g: 1, b: 1, alpha: 1, style: '#ffffff' }
        },
        colorModel: 'rgba',
        colorSpace: 'sRGB',
        drawOriginX: 0,
        drawOriginY: 0,
        fileHandle: null,
        fileName: '',
        height: 892, // Always pixels
        layerIdCounter: 0,
        layers: [],
        maskIdCounter: 0,
        masks: {},
        measuringUnits: 'px',
        resolutionUnits: 'px/in',
        resolutionX: 300,
        resolutionY: 300,
        scaleFactor: 1,
        selectedLayerIds: [],
        timelineIdCounter: 0,
        timelines: [],
        width: 818 // Always pixels
    },
    nonReactive: ['fileHandle']
});

function calculateLayerOrder(parent?: WorkingFileLayer<ColorModel>[], order: number = 0): number {
    let isStart = false;
    if (!parent) {
        parent = store.get('layers');
        isStart = true;
    }
    for (const layer of parent) {
        appEmitter.emit('app.workingFile.layerReordered', { layer: layer as never, order });
        order++;
        if (layer.type === 'group') {
            order = calculateLayerOrder((layer as WorkingFileGroupLayer<ColorModel>).layers, order);
        }
    }
    if (isStart) {
        appEmitter.emit('app.workingFile.layerOrderCalculated');
    }
    return order;
}

function getCanvasColorSpace(): 'srgb' | 'display-p3' {
    if (store.state.colorSpace === 'Display P3') {
        return 'display-p3';
    }
    return 'srgb';
}

function getCanvasRenderingContext2DSettings(): CanvasRenderingContext2DSettings {
    return {
        alpha: true,
        colorSpace: getCanvasColorSpace()
    }
}

function getWebGLContextAttributes(): WebGLContextAttributes {
    return {};
}

function getLayerById<T extends WorkingFileAnyLayer<ColorModel>>(id: number, parent?: WorkingFileLayer<ColorModel>[]): T | null {
    if (parent == null) {
        parent = store.get('layers');
    }
    for (let layer of parent) {
        if (layer.id === id) {
            return layer as never;
        } else if (layer.type === 'group') {
            let foundLayer = getLayerById(id, (layer as WorkingFileGroupLayer<ColorModel>).layers);
            if (foundLayer) {
                return foundLayer as never;
            }
        }
    }
    return null;
}

function getLayerGlobalTransform(layerOrId: WorkingFileLayer<ColorModel> | number, options?: { excludeSelf?: boolean }): DOMMatrix {
    let layer: WorkingFileLayer<ColorModel> | null = null;
    if (typeof layerOrId === 'number') {
        layer = getLayerById(layerOrId);
    } else {
        layer = layerOrId;
    }
    let transform = new DOMMatrix();
    if (layer) {
        if (layer.groupId != null) {
            transform.multiplySelf(getLayerGlobalTransform(layer.groupId));
        }
        if (!options?.excludeSelf) {
            transform.multiplySelf(layer.transform);
        }
    }
    return transform;
}

/** Returns 4 points for each corner of the layer bounding box, transformed so they are relative to the document */
function getLayerBoundingPoints(layerOrId: WorkingFileLayer<ColorModel> | number): DOMPoint[] {
    let layer: WorkingFileLayer<ColorModel> | null = null;
    if (typeof layerOrId === 'number') {
        layer = getLayerById(layerOrId);
    } else {
        layer = layerOrId;
    }
    if (!layer) return [];
    if (layer.type === 'gradient') {
        const canvasWidth = store.get('width');
        const canvasHeight = store.get('height');
        return [
            new DOMPoint(0, 0),
            new DOMPoint(canvasWidth, 0),
            new DOMPoint(canvasWidth, canvasHeight),
            new DOMPoint(0, canvasHeight),
        ];
    }
    const globalTransform = getLayerGlobalTransform(layer);
    return [
        new DOMPoint(0, 0).matrixTransform(globalTransform),
        new DOMPoint(layer.width, 0).matrixTransform(globalTransform),
        new DOMPoint(layer.width, layer.height).matrixTransform(globalTransform),
        new DOMPoint(0, layer.height).matrixTransform(globalTransform),
    ];
}

function getGroupLayerById(id: number, parent?: WorkingFileLayer<ColorModel>[]): WorkingFileGroupLayer<ColorModel> | null {
    if (parent == null) {
        parent = store.get('layers');
    }
    const layer = getLayerById(id, parent);
    if (layer && layer.type === 'group') {
        return layer as WorkingFileGroupLayer<ColorModel>;
    }
    return null;
}

function getLayersByType<T extends WorkingFileLayer<ColorModel>>(type: string, parent?: WorkingFileLayer<ColorModel>[]): T[] {
    if (parent == null) {
        parent = store.get('layers');
    }
    let layers: WorkingFileLayer<ColorModel>[] = [];
    for (let layer of parent) {
        if (layer.type === type) {
            layers.push(layer);
        }
        if (layer.type === 'group') {
            const groupChildLayers = getLayersByType(type, (layer as WorkingFileGroupLayer<ColorModel>).layers);
            for (const childLayer of groupChildLayers) {
                layers.push(childLayer);
            }
        }
    }
    return layers as T[];
}

function getSelectedLayers<T = WorkingFileAnyLayer<ColorModel>>(providedSelectedLayerIds?: number[]): T[] {
    const selectedLayers: WorkingFileAnyLayer<ColorModel>[] = [];
    const selectedLayerIds = providedSelectedLayerIds ?? store.get('selectedLayerIds');
    if (selectedLayerIds.length > 0) {
        for (let id of selectedLayerIds) {
            const layer = getLayerById(id);
            if (layer) {
                selectedLayers.push(layer);
            }
        }
    }
    return selectedLayers as never;
}

function getTimelineById(id: number): WorkingFileTimeline | null {
    const timelines = store.get('timelines');
    for (let timeline of timelines) {
        if (timeline.id === id) {
            return timeline;
        }
    }
    return null;
}

function ensureUniqueLayerSiblingName(layerId: number | null | undefined, name: string): string {
    if (layerId != null) {
        let siblings: WorkingFileLayer<ColorModel>[] = [];
        const referenceLayer = getLayerById(layerId);
        if (referenceLayer?.groupId != null) {
            siblings = getGroupLayerById(referenceLayer.groupId)?.layers || [];
        } else {
            siblings = store.get('layers');
        }
        let largestNumber = -1;
        name = name.replace(/\s#[0-9]{1,}$/g, '');
        for (let sibling of siblings) {
            const siblingName = sibling.name.replace(/\s#[0-9]{1,}$/g, '');
            if (siblingName === name) {
                let numberPart = sibling.name.split('#').pop() + '';
                let number = 0;
                if (/^[0-9]{1,}$/g.test(numberPart)) {
                    number = parseInt(numberPart);
                }
                if (number > largestNumber) {
                    largestNumber = number;
                }
            }
        }
        if (largestNumber >= 0) {
            name = name + ' #' + (largestNumber + 1);
        }
    }
    return name;
}

function regenerateLayerThumbnail(layer: WorkingFileAnyLayer<ColorModel>) {
    let parent: WorkingFileAnyLayer<ColorModel> | null = layer;
    while (parent != null) {
        parent.thumbnailImageSrc = null;
        if (parent.groupId != null) {
            parent = getGroupLayerById(parent.groupId);
        } else {
            parent = null;
        }
    }
}

function isMaskIdUsed(maskId: number, parentLayers?: WorkingFileLayer<ColorModel>[]) {
    let layers: WorkingFileLayer<ColorModel>[] | undefined = parentLayers ?? store.get('layers');
    if (layers != null) {
        for (const layer of layers) {
            if (layer.type === 'group') {
                if (isMaskIdUsed(maskId, (layer as WorkingFileGroupLayer).layers)) {
                    return true;
                }
            }
            for (const filter of layer.filters) {
                if (filter.maskId === maskId) {
                    return true;
                }
            }
        }
    }
    return false;
}

function discardMaskIfUnused(maskId?: number) {
    if (maskId == null) return;
    if (!isMaskIdUsed(maskId)) {
        const masks = store.get('masks');
        const mask = masks[maskId];
        delete masks[maskId];
        if (
            Object.keys(masks).findIndex((value) => {
                const checkMaskId = parseInt(value);
                return masks[checkMaskId].sourceUuid === mask.sourceUuid;
            }) == -1
        ) {
            deleteStoredImage(mask.sourceUuid);
        }
        store.set('masks', masks);
    }
}

function discardAllUnusedMasks() {
    const maskIds = Object.keys(store.get('masks')).map(key => parseInt(key));
    for (const maskId of maskIds) {
        discardMaskIfUnused(maskId);
    }
}

function isGroupLayer(layer: WorkingFileAnyLayer): layer is WorkingFileGroupLayer {
    return layer.type === 'group' && !!layer.layers;
}

export default store;

export {
    WorkingFileStore,
    WorkingFileState,
    calculateLayerOrder,
    getCanvasColorSpace,
    getCanvasRenderingContext2DSettings,
    getWebGLContextAttributes,
    getLayerById,
    getLayerGlobalTransform,
    getLayerBoundingPoints,
    getLayersByType,
    getGroupLayerById,
    getSelectedLayers,
    getTimelineById,
    ensureUniqueLayerSiblingName,
    regenerateLayerThumbnail,
    discardMaskIfUnused,
    discardAllUnusedMasks,
    isGroupLayer,
};

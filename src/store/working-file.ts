import { PerformantStore } from './performant-store';
import { ColorModel, FileSystemFileHandle, MeasuringUnits, ResolutionUnits, ColorModelName, WorkingFileLayer, WorkingFileAnyLayer, WorkingFileGroupLayer, WorkingFileTimeline } from '@/types';

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
    if (!parent) {
        parent = store.get('layers');
    }
    for (const layer of parent) {
        layer.renderer.reorder(order);
        order++;
        if (layer.type === 'group') {
            order = calculateLayerOrder((layer as WorkingFileGroupLayer<ColorModel>).layers, order);
        }
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

function getLayerById(id: number, parent?: WorkingFileLayer<ColorModel>[]): WorkingFileAnyLayer<ColorModel> | null {
    if (parent == null) {
        parent = store.get('layers');
    }
    for (let layer of parent) {
        if (layer.id === id) {
            return layer as WorkingFileAnyLayer<ColorModel>;
        } else if (layer.type === 'group') {
            let foundLayer = getLayerById(id, (layer as WorkingFileGroupLayer<ColorModel>).layers);
            if (foundLayer) {
                return foundLayer;
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
            layers = layers.concat(getLayersByType(type, (layer as WorkingFileGroupLayer<ColorModel>).layers));
        }
    }
    return layers as T[];
}

function getSelectedLayers(): WorkingFileAnyLayer<ColorModel>[] {
    const selectedLayers: WorkingFileAnyLayer<ColorModel>[] = [];
    const selectedLayerIds = store.get('selectedLayerIds');
    if (selectedLayerIds.length > 0) {
        for (let id of selectedLayerIds) {
            const layer = getLayerById(id);
            if (layer) {
                selectedLayers.push(layer);
            }
        }
    }
    return selectedLayers;
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
    getLayersByType,
    getGroupLayerById,
    getSelectedLayers,
    getTimelineById,
    ensureUniqueLayerSiblingName,
    regenerateLayerThumbnail
};

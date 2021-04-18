import { PerformantStore } from './performant-store';
import { RGBAColor, MeasuringUnits, ResolutionUnits, ColorModelName, WorkingFileLayer } from '@/types';

interface WorkingFileState {
    activeLayerId: number | null,
    colorModel: ColorModelName;
    colorSpace: string;
    drawOriginX: number;
    drawOriginY: number;
    fileName: string;
    height: number; // Always pixels
    layerIdCounter: number;
    layers: WorkingFileLayer<RGBAColor>[];
    measuringUnits: MeasuringUnits;
    resolutionUnits: ResolutionUnits;
    resolutionX: number;
    resolutionY: number;
    scaleFactor: number;
    selectedLayerIds: string[];
    width: number; // Always pixels
}

interface WorkingFileStore {
    dispatch: {};
    state: WorkingFileState;
}

const store = new PerformantStore<WorkingFileStore>({
    state: {
        activeLayerId: null,
        colorModel: 'rgba',
        colorSpace: 'sRGB',
        drawOriginX: 0,
        drawOriginY: 0,
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
        width: 818 // Always pixels
    }
});

export default store;

export { WorkingFileStore, WorkingFileState };

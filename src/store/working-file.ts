import { PerformantStore } from './performant-store';
import { RGBAColor, CanvasRenderingContext2DEnhanced, ColorModelName, WorkingFileLayer, WorkingFileRasterLayer } from '@/types';

interface WorkingFileState {
    activeLayer: WorkingFileLayer<RGBAColor> | null,
    colorModel: ColorModelName;
    dpi: number;
    drawOriginX: number;
    drawOriginY: number;
    height: number;
    layers: WorkingFileLayer<RGBAColor>[];
    measuringUnits: 'px' | 'mm' | 'cm' | 'in';
    width: number;
}

interface WorkingFileStore {
    dispatch: {};
    state: WorkingFileState;
}

// let dummyCanvas: any = document.createElement('canvas');

const store = new PerformantStore<WorkingFileStore>({
    state: {
        activeLayer: null,
        colorModel: 'rgba',
        dpi: 300,
        drawOriginX: 0,
        drawOriginY: 0,
        height: 892,
        layers: [],
        measuringUnits: 'px',
        width: 818
    },
    readOnly: ['layers'],
    onDispatch(key: string, value: any, set) {
        
    }
});

export default store;

export { WorkingFileStore, WorkingFileState };

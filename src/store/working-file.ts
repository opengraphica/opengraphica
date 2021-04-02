import { PerformantStore } from './performant-store';
import { RGBAColor, CanvasRenderingContext2DEnhanced, ColorModelName, WorkingFileLayer, WorkingFileRasterLayer } from '@/types';

interface WorkingFileState {
    activeLayer: WorkingFileLayer<RGBAColor> | null,
    colorModel: ColorModelName;
    drawOriginX: number;
    drawOriginY: number;
    height: number;
    layers: WorkingFileLayer<RGBAColor>[];
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
        drawOriginX: 0,
        drawOriginY: 0,
        height: 892,
        layers: [],
        width: 818
    },
    readOnly: ['layers'],
    onDispatch(key: string, value: any, set) {
        
    }
});

export default store;

export { WorkingFileStore, WorkingFileState };

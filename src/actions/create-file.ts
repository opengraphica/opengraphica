import { nextTick } from 'vue';
import { BaseAction } from './base';
import workingFileStore, { calculateLayerOrder, WorkingFileState } from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import { discardActiveSelectionMask, discardAppliedSelectionMask, activeSelectionPath } from '@/canvas/store/selection-state';
import { WorkingFileLayer, ColorModel, WorkingFileGroupLayer } from '@/types';

export interface CreateFileOptions {
    fileName?: string;
    height: number;
    measuringUnits?: 'px' | 'mm' | 'cm' | 'in';
    resolutionUnits?: 'px/in' | 'px/mm' | 'px/cm';
    resolutionX?: number;
    resolutionY?: number;
    scaleFactor?: number;
    width: number;
}

export class CreateFileAction extends BaseAction {

    private createFileOptions!: Partial<WorkingFileState>;
    private previousState: { [key: string]: any } = {};

    constructor(createFileOptions: Partial<WorkingFileState>) {
        super('createNewFile', 'action.createNewFile');
        this.createFileOptions = createFileOptions;
	}
	public async do() {
        super.do();

        const changes: Partial<WorkingFileState> | any = {
            activeTimelineId: this.createFileOptions.activeTimelineId || null,
            background: this.createFileOptions.background || { visible: true, color: { is: 'color', r: 1, g: 1, b: 1, a: 1, style: '#ffffff' } },
            colorModel: this.createFileOptions.colorModel || 'rgba',
            drawOriginX: this.createFileOptions.drawOriginX || 0,
            drawOriginY: this.createFileOptions.drawOriginY || 0,
            fileHandle: null,
            fileName: this.createFileOptions.fileName || '',
            height: this.createFileOptions.height,
            layerIdCounter: this.createFileOptions.layerIdCounter || 0,
            layers: [],
            measuringUnits: this.createFileOptions.measuringUnits || 'px',
            resolutionUnits: this.createFileOptions.resolutionUnits || 'px/in',
            resolutionX: this.createFileOptions.resolutionX || 300,
            resolutionY: this.createFileOptions.resolutionY || 300,
            scaleFactor: this.createFileOptions.scaleFactor || 1,
            selectedLayerIds: this.createFileOptions.selectedLayerIds || [],
            timelineIdCounter: this.createFileOptions.timelineIdCounter || 0,
            timelines: this.createFileOptions.timelines || [],
            width: this.createFileOptions.width
        };

        this.previousState = {};
        for (let key in changes) {
            this.previousState[key] = workingFileStore.get(key as keyof WorkingFileState);
            workingFileStore.set(key as keyof WorkingFileState, changes[key]);
            if (key === 'layers') {
                this.detachLayerRenderers(this.previousState[key]);
            }
        }

        discardAppliedSelectionMask();
        discardActiveSelectionMask();
        activeSelectionPath.value = [];

        calculateLayerOrder();

        await nextTick();
        appEmitter.emit('app.canvas.resetTransform');
	}

	public async undo() {
        super.undo();

        for (let key in this.previousState) {
            workingFileStore.set(key as keyof WorkingFileState, this.previousState[key]);
            if (key === 'layers') {
                this.attachLayerRenderers(this.previousState[key]);
            }
        }
        this.previousState = {};

        discardAppliedSelectionMask();
        discardActiveSelectionMask();
        activeSelectionPath.value = [];

        calculateLayerOrder();

        await nextTick();
        appEmitter.emit('app.canvas.resetTransform');
	}

    private attachLayerRenderers(layers: WorkingFileLayer<ColorModel>[]) {
        for (const layer of layers) {
            if (layer.type === 'group') {
                this.attachLayerRenderers((layer as WorkingFileGroupLayer<ColorModel>).layers);
            }
            layer.renderer.attach(layer);
        }
    }

    private detachLayerRenderers(layers: WorkingFileLayer<ColorModel>[]) {
        for (const layer of layers) {
            if (layer.type === 'group') {
                this.detachLayerRenderers((layer as WorkingFileGroupLayer<ColorModel>).layers);
            }
            layer.renderer.detach();
        }
    }

}

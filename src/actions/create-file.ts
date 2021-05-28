import { nextTick } from 'vue';
import { BaseAction } from './base';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import appEmitter from '@/lib/emitter';

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
        super('createNewFile', 'New File');
        this.createFileOptions = createFileOptions;
	}
	public async do() {
        super.do();

        const changes: Partial<WorkingFileState> | any = {
            activeLayerId: this.createFileOptions.activeLayerId || null,
            activeTimelineId: this.createFileOptions.activeTimelineId || null,
            colorModel: this.createFileOptions.colorModel || 'rgba',
            drawOriginX: this.createFileOptions.drawOriginX || 0,
            drawOriginY: this.createFileOptions.drawOriginY || 0,
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
        }

        await nextTick();
        appEmitter.emit('app.canvas.resetTransform');
	}

	public async undo() {
        super.undo();

        for (let key in this.previousState) {
            workingFileStore.set(key as keyof WorkingFileState, this.previousState[key]);
        }
        this.previousState = {};

        await nextTick();
        appEmitter.emit('app.canvas.resetTransform');
	}

}

import { nextTick } from 'vue';
import { BaseAction } from './base';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import appEmitter from '@/lib/emitter';

export interface CreateNewFileOptions {
    height: number;
    measuringUnits?: 'px' | 'mm' | 'cm' | 'in';
    resolutionUnits?: 'px/in' | 'px/mm' | 'px/cm';
    resolutionX?: number;
    resolutionY?: number;
    scaleFactor?: number;
    width: number;
}

export class CreateNewFileAction extends BaseAction {

    private createFileOptions!: CreateNewFileOptions;
    private previousState: { [key: string]: any } = {};

    constructor(createFileOptions: CreateNewFileOptions) {
        super('create-new-file', 'New File');
        this.createFileOptions = createFileOptions;
	}
	public async do() {
        super.do();

        const changes: CreateNewFileOptions | any = {
            activeLayer: null,
            colorModel: 'rgba',
            drawOriginX: 0,
            drawOriginY: 0,
            height: this.createFileOptions.height,
            layers: [],
            measuringUnits: this.createFileOptions.measuringUnits || 'px',
            resolutionUnits: this.createFileOptions.resolutionUnits || 'px/in',
            resolutionX: this.createFileOptions.resolutionX || 300,
            resolutionY: this.createFileOptions.resolutionY || 300,
            scaleFactor: this.createFileOptions.scaleFactor || 1,
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

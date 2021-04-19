import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import appEmitter from '@/lib/emitter';

export class UpdateFileAction extends BaseAction {

    private updateFileOptions!: Partial<WorkingFileState>;
    private previousState: { [key: string]: any } = {};

    constructor(updateFileOptions: Partial<WorkingFileState>) {
        super('updateLayer', 'Update Layer');
        this.updateFileOptions = updateFileOptions;
	}
	public async do() {
        super.do();

        for (let prop in this.updateFileOptions) {
            this.previousState[prop] = workingFileStore.get(prop as keyof WorkingFileState);
            workingFileStore.set(prop as keyof WorkingFileState, (this.updateFileOptions as any)[prop]);
        }

        canvasStore.set('dirty', true);
        if (this.updateFileOptions.width || this.updateFileOptions.height) {
            appEmitter.emit('app.canvas.resetTransform');
        }
	}

	public async undo() {
        super.undo();

        for (let prop in this.previousState) {
            workingFileStore.set(prop as keyof WorkingFileState, (this.previousState as any)[prop]);
        }

        canvasStore.set('dirty', true);
        if (this.previousState.width || this.previousState.height) {
            appEmitter.emit('app.canvas.resetTransform');
        }
	}

    public free() {
        super.free();
        (this.updateFileOptions as any) = null;
        (this.previousState as any) = null;
    }

}

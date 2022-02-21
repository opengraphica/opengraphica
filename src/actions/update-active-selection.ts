
import { BaseAction } from './base';
import { activeSelectionPath, previewActiveSelectionMask, selectionCombineMode, SelectionPathPoint, SelectionCombineMode } from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';

export class UpdateActiveSelectionAction extends BaseAction {

    private newActiveSelectionPath: Array<SelectionPathPoint> = [];
    // private newSelectionCombineMode: SelectionCombineMode;
    private oldActiveSelectionPath: Array<SelectionPathPoint> = [];
    private oldSelectionCombineMode: SelectionCombineMode | null = null;

    constructor(newActiveSelectionPath: Array<SelectionPathPoint>, oldActiveSelectionPath?: Array<SelectionPathPoint>) {
        super('updateActiveSelection', 'Update Active Selection');
        this.newActiveSelectionPath = newActiveSelectionPath;
        if (oldActiveSelectionPath) {
            this.oldActiveSelectionPath = oldActiveSelectionPath;
        } else {
            this.oldActiveSelectionPath = [...activeSelectionPath.value];
        }
        // this.newSelectionCombineMode = newSelectionCombineMode;
        this.oldSelectionCombineMode = selectionCombineMode.value;
	}

	public async do() {
        super.do();

        // selectionCombineMode.value = this.newSelectionCombineMode;
        activeSelectionPath.value = this.newActiveSelectionPath;
        await previewActiveSelectionMask();
        canvasStore.set('viewDirty', true);
    }

    public async undo() {
        super.undo();

        if (this.oldSelectionCombineMode) {
            selectionCombineMode.value = this.oldSelectionCombineMode;
        }
        activeSelectionPath.value = this.oldActiveSelectionPath;
        await previewActiveSelectionMask();
        canvasStore.set('viewDirty', true);
    }

    public async free() {
        super.free();

        (this.newActiveSelectionPath as any) = null;
        (this.oldActiveSelectionPath as any) = null;
    }
}
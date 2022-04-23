import { BaseAction } from './base';
import { selectionCombineMode, SelectionCombineMode } from '@/canvas/store/selection-state';

export class UpdateSelectionCombineModeAction extends BaseAction {

    private newSelectionCombineMode: SelectionCombineMode;
    private oldSelectionCombineMode: SelectionCombineMode;

    constructor(newSelectionCombineMode: SelectionCombineMode, oldSelectionCombineMode?: SelectionCombineMode) {
        super('updateSelectionCombineMode', 'action.updateSelectionCombineMode');
        this.newSelectionCombineMode = newSelectionCombineMode;
        this.oldSelectionCombineMode = oldSelectionCombineMode || selectionCombineMode.value;
	}

	public async do() {
        super.do();

        selectionCombineMode.value = this.newSelectionCombineMode;
    }

    public async undo() {
        super.undo();

        selectionCombineMode.value = this.oldSelectionCombineMode;
    }

    public async free() {
        super.free();

        (this.newSelectionCombineMode as any) = null;
        (this.oldSelectionCombineMode as any) = null;
    }
}
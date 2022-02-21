
import { BaseAction } from './base';
import imageStore from './data/image-store';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    activeSelectionPath, previewActiveSelectionMask, selectionCombineMode, SelectionPathPoint, SelectionCombineMode
} from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';

export class ClearSelectionAction extends BaseAction {

    private oldActiveSelectionPath: Array<SelectionPathPoint> = [];

    private oldAppliedMaskOffset: DOMPoint = new DOMPoint();
    private oldAppliedMaskDatabaseId: string | null = null;
    private oldAppliedMaskDatabaseSizeEstimate: number = 0;
    private oldSelectionCombineMode: SelectionCombineMode | null = null;

    constructor() {
        super('clearSelection', 'ClearSelection');
	}

	public async do() {
        super.do();

        // Store old mask in database, if applicable.
        if (appliedSelectionMask.value && !this.oldAppliedMaskDatabaseId) {
            try {
                let oldMaskBlob: Blob | null = await fetch(appliedSelectionMask.value.src).then(result => result.blob());
                if (oldMaskBlob) {
                    this.oldAppliedMaskDatabaseId = await imageStore.add(oldMaskBlob);
                    this.oldAppliedMaskDatabaseSizeEstimate = oldMaskBlob.size;
                }
                oldMaskBlob = null;
            } catch (error) {
                throw new Error('Aborted - Error storing old selection mask.');
            }
            this.oldAppliedMaskOffset = new DOMPoint();
            this.oldAppliedMaskOffset.x = appliedSelectionMaskCanvasOffset.value.x;
            this.oldAppliedMaskOffset.y = appliedSelectionMaskCanvasOffset.value.y;
        }

        this.oldSelectionCombineMode = selectionCombineMode.value;
        this.oldActiveSelectionPath = [...activeSelectionPath.value];

        if (activeSelectionMask.value) {
            URL.revokeObjectURL(activeSelectionMask.value.src);
        }
        activeSelectionMask.value = null;
        activeSelectionMaskCanvasOffset.value.x = 0;
        activeSelectionMaskCanvasOffset.value.y = 0;

        if (appliedSelectionMask.value) {
            URL.revokeObjectURL(appliedSelectionMask.value.src);
        }
        appliedSelectionMask.value = null;
        appliedSelectionMaskCanvasOffset.value.x = 0;
        appliedSelectionMaskCanvasOffset.value.y = 0;

        activeSelectionPath.value = [];

        this.freeEstimates.database = this.oldAppliedMaskDatabaseSizeEstimate;

        canvasStore.set('viewDirty', true);
	}

	public async undo() {
        super.undo();

        // Restore old mask blob
        let oldMaskImage: InstanceType<typeof Image> | null = null;
        let oldMaskBlob: Blob | null = null;
		if (this.oldAppliedMaskDatabaseId != null) {
			try {
				oldMaskBlob = await imageStore.get(this.oldAppliedMaskDatabaseId) as Blob;
			} catch (error) {
				throw new Error('Aborted - Failed to retrieve image from store');
			}
		}
        if (oldMaskBlob) {
            oldMaskImage = await new Promise<InstanceType<typeof Image>>((resolve, reject) => {
                try {
                    let image = new Image();
                    image.onload = () => {
                        resolve(image);
                        (image as any) = null;
                    };
                    image.onerror = (error) => {
                        reject(error);
                        (image as any) = null;
                    };
                    if (oldMaskBlob) {
                        image.src = URL.createObjectURL(oldMaskBlob);
                    } else {
                        reject(new Error('Aborted - Couldn\'t create image from non-existing blob.'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }
        if (appliedSelectionMask.value) {
            URL.revokeObjectURL(appliedSelectionMask.value.src);
        }
        appliedSelectionMask.value = oldMaskImage;
        appliedSelectionMaskCanvasOffset.value.x = this.oldAppliedMaskOffset.x;
        appliedSelectionMaskCanvasOffset.value.y = this.oldAppliedMaskOffset.y;

        if (this.oldSelectionCombineMode) {
            selectionCombineMode.value = this.oldSelectionCombineMode;
        }
        activeSelectionPath.value = [...this.oldActiveSelectionPath];

        await previewActiveSelectionMask();

        canvasStore.set('viewDirty', true);
	}

    public free() {
        super.free();

        if (this.oldAppliedMaskDatabaseId) {
            imageStore.delete(this.oldAppliedMaskDatabaseId);
        }

        (this.oldActiveSelectionPath as any) = null;
        (this.oldAppliedMaskOffset as any) = null;
        this.oldAppliedMaskDatabaseId = null;
        this.oldAppliedMaskDatabaseSizeEstimate = 0;
    }

}

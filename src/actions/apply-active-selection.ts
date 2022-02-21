
import { BaseAction } from './base';
import imageStore from './data/image-store';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    selectionMaskDrawMargin, activeSelectionPath, createActiveSelectionMask, getActiveSelectionBounds,
    previewActiveSelectionMask, selectionCombineMode, SelectionPathPoint, SelectionCombineMode
} from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';

export class ApplyActiveSelectionAction extends BaseAction {

    private doNotClearActiveSelection: boolean = false;

    private activeSelectionPath: Array<SelectionPathPoint> = [];
    private drawMargin: number = 0;
    private newMaskOffset: DOMPoint = new DOMPoint();
    private newMaskDatabaseId: string | null = null;
    private newMaskDatabaseSizeEstimate: number = 0;

    private oldMaskOffset: DOMPoint = new DOMPoint();
    private oldMaskDatabaseId: string | null = null;
    private oldMaskDatabaseSizeEstimate: number = 0;
    private oldSelectionCombineMode: SelectionCombineMode | null = null;

    constructor(activeSelectionPathOverride: Array<SelectionPathPoint> = activeSelectionPath.value, options: { doNotClearActiveSelection?: boolean } = {}) {
        super('applyActiveSelection', 'Apply Active Selection');
        this.activeSelectionPath = activeSelectionPathOverride;
        this.drawMargin = selectionMaskDrawMargin.value;
        this.doNotClearActiveSelection = options.doNotClearActiveSelection || false;
	}

	public async do() {
        super.do();

        // Store old mask in database, if applicable.
        if (appliedSelectionMask.value && !this.oldMaskDatabaseId) {
            try {
                let oldMaskBlob: Blob | null = await fetch(appliedSelectionMask.value.src).then(result => result.blob());
                if (oldMaskBlob) {
                    this.oldMaskDatabaseId = await imageStore.add(oldMaskBlob);
                    this.oldMaskDatabaseSizeEstimate = oldMaskBlob.size;
                }
                oldMaskBlob = null;
            } catch (error) {
                throw new Error('Aborted - Error storing old selection mask.');
            }
            this.oldMaskOffset = new DOMPoint();
            this.oldMaskOffset.x = appliedSelectionMaskCanvasOffset.value.x;
            this.oldMaskOffset.y = appliedSelectionMaskCanvasOffset.value.y;
        }

        this.oldSelectionCombineMode = selectionCombineMode.value;

        // Build a new image for the new mask, either from database or canvas supplied initially.
        let newMaskImage: InstanceType<typeof Image> | null = null;
        let newMaskBlob: Blob | null = null;
        if (this.newMaskDatabaseId != null) {
            try {
                newMaskBlob = await imageStore.get(this.newMaskDatabaseId) as Blob;
            } catch (error) {
				throw new Error('Aborted - problem retrieving cached image from database');
			}
        } else if (this.activeSelectionPath.length > 0) {
            // Draw selection mask on canvas.
            const activeSelectionBounds = getActiveSelectionBounds(this.activeSelectionPath);
            let newMaskCanvas: HTMLCanvasElement | null = await createActiveSelectionMask(activeSelectionBounds, this.activeSelectionPath);
            this.newMaskOffset.x = activeSelectionBounds.left - this.drawMargin;
            this.newMaskOffset.y = activeSelectionBounds.top - this.drawMargin;

            // Create PNG blob from canvas image.
            newMaskBlob = await new Promise<Blob>((resolve, reject) => {
                try {
                    newMaskCanvas?.toBlob(async (blob) => {
                        if (blob) {
                            try {
                                this.newMaskDatabaseId = await imageStore.add(blob);
                                this.oldMaskDatabaseSizeEstimate = blob.size;
                                newMaskCanvas = null;
                                resolve(blob);
                            } catch (error) {
                                reject(new Error('Aborted - Could not store new mask blob in databse.'));
                            }
                        } else {
                            reject(new Error('Aborted - Canvas blob not created when drawing new selection shape.'));
                        }
                    }, 'image/png', 1);
                } catch (error) {
                    reject(error);
                }
            });
        }

        // Create HTMLImageElement from PNG blob.
        if (newMaskBlob) {
            newMaskImage = await new Promise<InstanceType<typeof Image>>((resolve, reject) => {
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
                    if (newMaskBlob) {
                        image.src = URL.createObjectURL(newMaskBlob);
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
        appliedSelectionMask.value = newMaskImage;
        appliedSelectionMaskCanvasOffset.value.x = this.newMaskOffset.x;
        appliedSelectionMaskCanvasOffset.value.y = this.newMaskOffset.y;
        activeSelectionMask.value = null;
        activeSelectionMaskCanvasOffset.value.x = 0;
        activeSelectionMaskCanvasOffset.value.y = 0;

        if (!this.doNotClearActiveSelection) {
            activeSelectionPath.value = [];
        } else {
            this.doNotClearActiveSelection = false;
        }

        this.freeEstimates.database = this.newMaskDatabaseSizeEstimate + this.oldMaskDatabaseSizeEstimate;

        canvasStore.set('viewDirty', true);
	}

	public async undo() {
        super.undo();

        // Restore old mask blob
        let oldMaskImage: InstanceType<typeof Image> | null = null;
        let oldMaskBlob: Blob | null = null;
		if (this.oldMaskDatabaseId != null) {
			try {
				oldMaskBlob = await imageStore.get(this.oldMaskDatabaseId) as Blob;
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
        appliedSelectionMaskCanvasOffset.value.x = this.oldMaskOffset.x;
        appliedSelectionMaskCanvasOffset.value.y = this.oldMaskOffset.y;

        if (this.oldSelectionCombineMode) {
            selectionCombineMode.value = this.oldSelectionCombineMode;
        }
        activeSelectionPath.value = [...this.activeSelectionPath];

        await previewActiveSelectionMask();

        canvasStore.set('viewDirty', true);
	}

    public free() {
        super.free();

        if (this.newMaskDatabaseId) {
            imageStore.delete(this.newMaskDatabaseId);
        }
        if (this.oldMaskDatabaseId) {
            imageStore.delete(this.oldMaskDatabaseId);
        }

        (this.newMaskOffset as any) = null;
        this.newMaskDatabaseId = null;
        this.newMaskDatabaseSizeEstimate = 0;
        (this.oldMaskOffset as any) = null;
        this.oldMaskDatabaseId = null;
        this.oldMaskDatabaseSizeEstimate = 0;
    }

}

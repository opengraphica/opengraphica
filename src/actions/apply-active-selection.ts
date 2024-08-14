
import { BaseAction } from './base';
import imageDatabase from '@/store/data/image-history-database';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    selectionMaskDrawMargin, activeSelectionPath, createActiveSelectionMask, getActiveSelectionBounds,
    previewActiveSelectionMask, selectionCombineMode, SelectionPathPoint, SelectionCombineMode
} from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { createImageFromBlob } from '@/lib/image';

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
        super('applyActiveSelection', 'action.applyActiveSelection');
        this.activeSelectionPath = activeSelectionPathOverride;
        this.drawMargin = selectionMaskDrawMargin.value;
        this.doNotClearActiveSelection = options.doNotClearActiveSelection || false;
	}

	public async do() {
        super.do();

        try {
            // Store old mask in database, if applicable.
            if (appliedSelectionMask.value && !this.oldMaskDatabaseId) {
                try {
                    let oldMaskBlob: Blob | null = await fetch(appliedSelectionMask.value.src).then(result => result.blob());
                    if (oldMaskBlob) {
                        this.oldMaskDatabaseId = await imageDatabase.add(oldMaskBlob);
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
                    newMaskBlob = await imageDatabase.get(this.newMaskDatabaseId) as Blob;
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
                        if (!newMaskCanvas) throw new Error('Aborted - Image mask canvas not created.');
                        newMaskCanvas?.toBlob(async (blob) => {
                            if (blob) {
                                try {
                                    this.newMaskDatabaseId = await imageDatabase.add(blob);
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
                newMaskImage = await createImageFromBlob(newMaskBlob);
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
        } catch (error) {
            console.error('[src/actions/apply-active-selection.ts]', error);
        }

        canvasStore.set('viewDirty', true);
	}

	public async undo() {
        super.undo();

        // Restore old mask blob
        let oldMaskImage: InstanceType<typeof Image> | null = null;
        let oldMaskBlob: Blob | null = null;
		if (this.oldMaskDatabaseId != null) {
			try {
				oldMaskBlob = await imageDatabase.get(this.oldMaskDatabaseId) as Blob;
			} catch (error) {
				throw new Error('Aborted - Failed to retrieve image from store');
			}
		}
        if (oldMaskBlob) {
            oldMaskImage = await createImageFromBlob(oldMaskBlob);
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
        if (activeSelectionPath.value.length > 0) {
            if (editorStore.get('activeToolGroup') !== 'selection') {
                editorStore.dispatch('setActiveTool', { group: 'selection' });
            }
        }

        await previewActiveSelectionMask();

        canvasStore.set('viewDirty', true);
	}

    public free() {
        super.free();

        if (this.newMaskDatabaseId) {
            imageDatabase.delete(this.newMaskDatabaseId);
        }
        if (this.oldMaskDatabaseId) {
            imageDatabase.delete(this.oldMaskDatabaseId);
        }

        (this.newMaskOffset as any) = null;
        this.newMaskDatabaseId = null;
        this.newMaskDatabaseSizeEstimate = 0;
        (this.oldMaskOffset as any) = null;
        this.oldMaskDatabaseId = null;
        this.oldMaskDatabaseSizeEstimate = 0;
    }

}

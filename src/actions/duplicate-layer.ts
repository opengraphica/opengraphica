

import cloneDeep from 'lodash/cloneDeep';

import { BaseAction } from './base';
import { InsertLayerAction } from './insert-layer';

import { getLayerById, ensureUniqueLayerSiblingName } from '@/store/working-file';

import type {
    WorkingFileAnyLayer
} from '@/types';

export class DuplicateLayerAction extends BaseAction {

    private duplicateLayerId: number;
    private insertLayerActions: InsertLayerAction<WorkingFileAnyLayer>[] | undefined;

    constructor(duplicateLayerId: number) {
        super('deleteLayers', 'action.duplicateLayer');
        this.duplicateLayerId = duplicateLayerId;
	}

	public async do() {
        super.do();

        this.insertLayerActions = [];

        const referenceLayer = getLayerById(this.duplicateLayerId);
        if (!referenceLayer) {
            throw new Error('[src/actions/duplicate-layer.ts] The referenced layer to clone does not exist.');
        }

        await this.createInsertLayerActions(referenceLayer, 'above', this.duplicateLayerId);
	}

	public async undo() {
        super.undo();

        if (this.insertLayerActions) {
            for (const action of this.insertLayerActions) {
                await action.undo();
                action.free();
            }
            this.insertLayerActions = undefined;
        }
	}

    public free() {
        super.free();

        if (this.insertLayerActions) {
            for (const action of this.insertLayerActions) {
                action.free();
            }
            this.insertLayerActions = undefined;
        }
    }

    private async createInsertLayerActions(referenceLayer: WorkingFileAnyLayer, insertPosition: 'bottom' | 'above', insertAroundId: number) {
        const layerShallowCopy = { ...referenceLayer };

        let childLayers: WorkingFileAnyLayer[] | undefined;
        if (referenceLayer.type === 'group') {
            childLayers = referenceLayer.layers;
        }
        delete (layerShallowCopy as any).id;
        delete (layerShallowCopy as any).groupId;
        delete (layerShallowCopy as any).layers;

        const layerClone = cloneDeep(layerShallowCopy);
        layerClone.name = ensureUniqueLayerSiblingName(referenceLayer.id, layerClone.name);
        if (insertPosition === 'bottom') {
            layerClone.groupId = insertAroundId;
        } else {
            layerClone.groupId = referenceLayer.groupId;
        }
        const insertLayerAction = new InsertLayerAction(
            layerClone, insertPosition, insertAroundId
        );
        await insertLayerAction.do();
        this.insertLayerActions!.unshift(insertLayerAction);

        if (childLayers) {
            for (const childLayer of childLayers) {
                await this.createInsertLayerActions(
                    childLayer,
                    'bottom',
                    insertLayerAction.insertedLayerId
                );
            }
        }
    }

}

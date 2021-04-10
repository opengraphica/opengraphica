import canvasStore from '@/store/canvas';
import { BaseAction } from './base';

export class BundleAction extends BaseAction {

    private actions!: BaseAction[];

	/**
	 * Groups multiple actions together in the undo/redo history, runs them all at once.
	 */
	constructor(id: string, description: string, actions: BaseAction[]) {
		super(id, description);
		this.actions = actions;
	}

	async do() {
		super.do();
		let error = null;
		let i = 0;
        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;
		for (i = 0; i < this.actions.length; i++) {
			try {
				await this.actions[i].do();
				this.freeEstimates.memory += this.actions[i].freeEstimates.memory;
				this.freeEstimates.database += this.actions[i].freeEstimates.database;
			} catch (e) {
				error = e;
				break;
			}
		}
		// One of the actions aborted, undo all previous actions.
		if (error) {
			for (i--; i >= 0; i--) {
				await this.actions[i].undo();
			}
			throw error;
		}
        canvasStore.set('dirty', true);
	}

	async undo() {
		super.undo();
		this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;
		for (let i = this.actions.length - 1; i >= 0; i--) {
			await this.actions[i].undo();
			this.freeEstimates.memory += this.actions[i].freeEstimates.memory;
			this.freeEstimates.database += this.actions[i].freeEstimates.database;
		}
		canvasStore.set('dirty', true);
	}

	free() {
		if (this.actions) {
			for (let action of this.actions) {
				action.free();
			}
			(this.actions as BaseAction[] | null) = null;
		}
	}
}
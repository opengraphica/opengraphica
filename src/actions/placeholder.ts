import { BaseAction } from './base';

export class PlaceholderAction extends BaseAction {

    constructor() {
        super('placeholder', 'action.placeholder');
	}
	public async do() {
        super.do();
	}

	public async undo() {
        super.undo();
	}

    public free() {
        super.free();
    }

}

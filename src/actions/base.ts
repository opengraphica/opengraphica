
export class BaseAction {
    readonly id!: string;
    readonly description!: string;
    public done: boolean = false;
    public thumbnail: string | undefined;
    public freeEstimates: { memory: number, database: number } = {
        memory: 0, // Estimate of how much memory will be freed when the free() method is called (in bytes)
        database: 0 // Estimate of how much database space will be freed when the free() method is called (in bytes)
    };

    public get isDone(): boolean {
        return this.done;
    }
    public get memoryEstimate(): number {
        return this.freeEstimates.memory;
    }
    public get databaseEstimate(): number {
        return this.freeEstimates.database;
    }

    constructor(actionId: string, actionDescription: string) {
		this.id = actionId;
		this.description = actionDescription;
	}
	public async do() {
		this.done = true;
	}
	public async undo() {
		this.done = false;
	}
	public free() {
		// Override if need to run tasks to free memory when action is discarded from history
	}
    
}

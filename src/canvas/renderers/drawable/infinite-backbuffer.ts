
export default class InfiniteBackbuffer {

    private isWorker: boolean;
    private gridSize: number;
    private canvasGrid: Map<number, Map<number, CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D>> = new Map();
    private globalAlpha: number = 1;

    constructor(gridSize: number = 256) {
        this.isWorker = (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope);
        this.gridSize = gridSize;
    }

    public clear() {
        for (const [mapIndex, innerMap] of this.canvasGrid.entries()) {
            for (const innerMapIndex of innerMap.keys()) {
                innerMap.delete(innerMapIndex);
            }
            this.canvasGrid.delete(mapIndex);
        }
    }

    public setGlobalAlpha(globalAlpha: number) {
        this.globalAlpha = globalAlpha;
    }

    public drawCanvas(canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number) {
        let sxi = Math.floor(x / this.gridSize);
        let syi = Math.floor(y / this.gridSize);
        const exi = Math.floor((x + canvas.width) / this.gridSize);
        const eyi = Math.floor((y + canvas.height) / this.gridSize);
        let cellX: number = 0;
        let cellY: number = 0;
        for (let xi = sxi; xi <= exi; xi++) {
            for (let yi = syi; yi <= eyi; yi++) {
                const ctx = this.getCanvasCtxAtCell(xi, yi);
                if (!ctx) continue;
                ctx.globalAlpha = this.globalAlpha;
                cellX = xi * this.gridSize;
                cellY = yi * this.gridSize;
                ctx.drawImage(canvas, -cellX + x, -cellY + y);
                ctx.globalAlpha = 1;
            }
        }
    }

    public drawToCtx(sx: number, sy: number, sw: number, sh: number, dCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, dx: number, dy: number) {
        let sxi = Math.floor(sx / this.gridSize);
        let syi = Math.floor(sy / this.gridSize);
        const exi = Math.floor((sx + sw) / this.gridSize);
        const eyi = Math.floor((sy + sh) / this.gridSize);
        let cellX: number, cellY: number, srcX: number, srcY: number, srcW: number, srcH: number, destX: number, destY: number, previousGlobalAlpha: number;
        for (let xi = sxi; xi <= exi; xi++) {
            for (let yi = syi; yi <= eyi; yi++) {
                const sCtx = this.getCanvasCtxAtCell(xi, yi);
                if (!sCtx) continue;
                cellX = xi * this.gridSize;
                cellY = yi * this.gridSize;

                srcX = Math.max(sx - cellX, 0);
                srcY = Math.max(sy - cellY, 0);
                srcW = Math.min(this.gridSize - srcX, sx + sw - cellX);
                srcH = Math.min(this.gridSize - srcY, sy + sh - cellY);

                destX = dx + (cellX + srcX - sx);
                destY = dy + (cellY + srcY - sy);

                previousGlobalAlpha = dCtx.globalAlpha;
                dCtx.globalAlpha = this.globalAlpha;
                dCtx.drawImage(sCtx.canvas, srcX, srcY, srcW, srcH, destX, destY, srcW, srcH);
                dCtx.globalAlpha = previousGlobalAlpha;
            }
        }
    }

    private getCanvasCtxAtCell(xi: number, yi: number): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
        let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
        if (!this.canvasGrid.has(xi)) {
            this.canvasGrid.set(xi, new Map());
        }
        if (!this.canvasGrid.get(xi)?.has(yi)) {
            let canvas: HTMLCanvasElement | OffscreenCanvas;
            if (this.isWorker) {
                canvas = new OffscreenCanvas(this.gridSize, this.gridSize);
            } else {
                canvas = document.createElement('canvas');
                canvas.width = this.gridSize;
                canvas.height = this.gridSize;
            }
            ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
            if (ctx) {
                this.canvasGrid.get(xi)?.set(yi, ctx);
            }
        }
        if (!ctx) {
            ctx = this.canvasGrid.get(xi)?.get(yi) ?? null;
        }
        return ctx;
    }

}

const ctx: Worker = self as any;

ctx.addEventListener('message', event => {
    if (event.data.file) {
        ctx.postMessage({
            objectUrl: URL.createObjectURL(event.data.file)
        })
    }
});

export default class WebpackWorker extends Worker {
    constructor() {
        super('');
    }
} 

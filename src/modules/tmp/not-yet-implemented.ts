import appEmitter from '@/lib/emitter';

export async function notYetImplemented() {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
    });
    appEmitter.emit('app.notify', {
        type: 'error',
        title: 'Not Yet Implemented',
        message: 'This feature is not yet implemented, future development task.'
    });
}

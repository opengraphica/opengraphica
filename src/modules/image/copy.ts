

// For firefox, experiment with 
// dom.events.asyncClipboard.clipboardItem
// dom.events.testing.asyncClipboard

export async function copyAllLayers() {
    const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
    await exportAsImage({
        fileType: 'png',
        toClipboard: true
    });
}

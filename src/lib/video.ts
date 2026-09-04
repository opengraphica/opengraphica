
export async function createVideoFromBlob(blob: Blob) {
    let videoObjectUrl = URL.createObjectURL(blob);
    let video = document.createElement('video');
    await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', function() {
            resolve();
            video.currentTime = 0;
        });
        video.addEventListener('error', function(error) {
            reject(error.toString());
        });
        video.src = videoObjectUrl;
    });
    return video;
}

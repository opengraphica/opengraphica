import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { getStoredVideo } from '@/store/video';
import canvasStore from '@/store/canvas';

interface VideoContext {
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    sourceUuid: string,
    video: HTMLVideoElement,
    callbackHandle: number | undefined,
}

function handleVideoFrameCallback(this: VideoContext, now?: DOMHighResTimeStamp, metadata?: VideoFrameCallbackMetadata) {
    this.callbackHandle = undefined;
    if (!canvasStore.state.playingAnimation) this.video.pause();
    const videoWidth = metadata?.width ?? this.video.width;
    const videoHeight = metadata?.height ?? this.video.height;
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
        this.canvas.width = videoWidth || 1;
        this.canvas.height = videoHeight || 1;
    }
    if (videoWidth === 0 || videoHeight === 0) {
        this.video.play();
    }
    this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    createImageBitmap(this.canvas)
        .then(sendBitmap.bind(this))
        .catch(() => {});
    this.callbackHandle = this.video.requestVideoFrameCallback(handleVideoFrameCallback.bind(this));
}

function sendBitmap(this: VideoContext, bitmap: ImageBitmap) {
    messageBus.emit('frontend.replyFrontendVideoFrame', {
        sourceUuid: this.sourceUuid,
        bitmap,
    })
}

export class VideoPlayer {
    videoContexts = new Map<string, VideoContext>;

    constructor() {
        this.requestFrontendVideoFrame = this.requestFrontendVideoFrame.bind(this);
        messageBus.on('backend.requestFrontendVideoFrame', this.requestFrontendVideoFrame);
    }

    requestFrontendVideoFrame(sourceUuid?: string) {
        if (!sourceUuid) return;
        try {
            const video = getStoredVideo(sourceUuid);
            if (!video) throw new Error();
            let videoContext = this.videoContexts.get(sourceUuid);
            if (!videoContext) {
                const canvas = document.createElement('canvas');
                canvas.width = video.width || 1;
                canvas.height = video.height || 1;
                const context = canvas.getContext('2d');
                if (!context) throw new Error();
                videoContext = {
                    canvas,
                    context,
                    sourceUuid,
                    video,
                    callbackHandle: undefined,
                }
                this.videoContexts.set(sourceUuid, videoContext);
            }
            if (videoContext.callbackHandle) {
                videoContext.video.cancelVideoFrameCallback(videoContext.callbackHandle);
            }
            handleVideoFrameCallback.call(videoContext);
        } catch (error) {
            messageBus.emit('frontend.replyFrontendVideoFrame', {
                sourceUuid,
                bitmap: undefined,
            });
        }
    }
    
    dispose() {
        messageBus.off('backend.requestFrontendVideoFrame', this.requestFrontendVideoFrame);
        for (const videoContext of this.videoContexts.values()) {
            if (videoContext.callbackHandle) {
                videoContext.video.cancelVideoFrameCallback(videoContext.callbackHandle);
            }
        }
        this.videoContexts.clear();
    }
}
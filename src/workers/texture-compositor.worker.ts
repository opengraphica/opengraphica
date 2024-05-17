import { NearestFilter, sRGBEncoding } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { Scene } from 'three/src/scenes/Scene';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import {
    createRasterTextureCompositorShaderMaterial,
    updateRasterTextureCompositorShaderMaterial,
    createPrepareGpuTextureShaderMaterial,
    updatePrepareGpuTextureShaderMaterial
} from '@/canvas/renderers/webgl/shaders';

import type { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import type { PrepareThreejsTextureRequest, TextureCompositeResult, TextureCompositeRequest, TerminateRequest } from './texture-compositor.types';

const instructionQueue: Array<TextureCompositeRequest | PrepareThreejsTextureRequest> = [];
let isWorkingQueue: boolean = false;

let threejsCanvas: OffscreenCanvas | undefined = undefined;
let threejsRenderer: WebGLRenderer | undefined = undefined;
let threejsScene: Scene | undefined = undefined;
let threejsCamera: OrthographicCamera | undefined = undefined;
let threejsRasterTextureCompositorShaderMaterial: ShaderMaterial | undefined = undefined;
let threejsPrepareGpuTextureShaderMaterial: ShaderMaterial | undefined = undefined;

self.onmessage = ({ data }: { data: TextureCompositeRequest | PrepareThreejsTextureRequest | TerminateRequest }) => {
    if (data.type === 'NEW_TEXTURE_COMPOSITE') {
        instructionQueue.push(data);
    } else if (data.type === 'NEW_PREPARE_THREEJS_TEXTURE') { 
        instructionQueue.push(data);
    } else if (data.type === 'TERMINATE') {
        threejsRenderer?.dispose();
        threejsRasterTextureCompositorShaderMaterial?.dispose();
        self.close();
    }
    workQueue();
};

async function workQueue() {
    if (!isWorkingQueue) {
        const queueItem = instructionQueue.shift();
        if (queueItem) {
            isWorkingQueue = true;
            if (queueItem.type === 'NEW_TEXTURE_COMPOSITE') {
                await workNewTextureComposite(queueItem);
            } else if (queueItem.type === 'NEW_PREPARE_THREEJS_TEXTURE') {
                await workNewPrepareThreejsTexture(queueItem);
            }
            isWorkingQueue = false;
            setTimeout(() => {
                workQueue();
            }, 0);
        }
    }
}

async function workNewTextureComposite(queueItem: TextureCompositeRequest) {
    const { queueId, baseBitmap, overlayBitmap, overlayOffsetX, overlayOffsetY, blendMode } = queueItem;
    try {
        if (!threejsCanvas) {
            threejsCanvas = new OffscreenCanvas(overlayBitmap.width, overlayBitmap.height);
        }
        threejsCanvas.width = overlayBitmap.width;
        threejsCanvas.height = overlayBitmap.height;

        if (!threejsRenderer) {
            threejsRenderer = new WebGLRenderer({
                alpha: true,
                canvas: threejsCanvas,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
            threejsRenderer.setClearColor(0x000000, 0);
            threejsRenderer.outputEncoding = sRGBEncoding;
        }
        threejsRenderer.setSize(overlayBitmap.width, overlayBitmap.height, false);

        if (!threejsScene) {
            threejsScene = new Scene();
        }

        if (!threejsCamera) {
            threejsCamera = new OrthographicCamera(0, overlayBitmap.width, 0, overlayBitmap.height, 0.1, 10000);
            threejsCamera.position.z = 1;
        } else {
            threejsCamera.right = overlayBitmap.width;
            threejsCamera.bottom = overlayBitmap.height;
        }
        threejsCamera.updateProjectionMatrix();

        const overlayCroppedBaseCanvas = new OffscreenCanvas(overlayBitmap.width, overlayBitmap.height);
        const overlayCroppedBaseCtx = overlayCroppedBaseCanvas.getContext('2d');
        if (!overlayCroppedBaseCtx) return;
        overlayCroppedBaseCtx.save();
        overlayCroppedBaseCtx.scale(1, -1);
        overlayCroppedBaseCtx.translate(0, -overlayBitmap.height);
        overlayCroppedBaseCtx.drawImage(
            baseBitmap, overlayOffsetX, baseBitmap.height - overlayOffsetY - overlayBitmap.height, overlayBitmap.width, overlayBitmap.height,
            0, 0, overlayBitmap.width, overlayBitmap.height
        );
        overlayCroppedBaseCtx.restore();

        const baseImageTexture = new CanvasTexture(overlayCroppedBaseCanvas);
        baseImageTexture.generateMipmaps = false;
        baseImageTexture.encoding = sRGBEncoding;
        baseImageTexture.minFilter = NearestFilter;
        baseImageTexture.magFilter = NearestFilter;

        const overlayImageTexture = new CanvasTexture(overlayBitmap);
        overlayImageTexture.generateMipmaps = false;
        overlayImageTexture.encoding = sRGBEncoding;
        overlayImageTexture.minFilter = NearestFilter;
        overlayImageTexture.magFilter = NearestFilter;

        if (!threejsRasterTextureCompositorShaderMaterial) {
            threejsRasterTextureCompositorShaderMaterial = createRasterTextureCompositorShaderMaterial(baseImageTexture, overlayImageTexture, 0, 0, blendMode);
            threejsRasterTextureCompositorShaderMaterial.needsUpdate = true;
        } else {
            updateRasterTextureCompositorShaderMaterial(threejsRasterTextureCompositorShaderMaterial, baseImageTexture, overlayImageTexture, 0, 0, blendMode);
        }

        const imageGeometry = new ImagePlaneGeometry(overlayBitmap.width, overlayBitmap.height);

        const imagePlane = new Mesh(imageGeometry, threejsRasterTextureCompositorShaderMaterial);

        threejsScene.add(imagePlane);
        threejsRenderer.render(threejsScene, threejsCamera);
        threejsScene.clear();

        baseImageTexture.dispose();
        overlayImageTexture.dispose();
        imageGeometry.dispose();

        const compositeBitmap = await createImageBitmap(threejsCanvas);

        self.postMessage({
            type: 'TEXTURE_COMPOSITE_RESULT',
            queueId,
            bitmap: compositeBitmap,
        } as TextureCompositeResult)
    } catch (error) {
        self.postMessage({
            type: 'TEXTURE_COMPOSITE_RESULT',
            queueId,
            bitmap: null,
        } as TextureCompositeResult)
    }
}


async function workNewPrepareThreejsTexture(queueItem: PrepareThreejsTextureRequest) {
    const { queueId, bitmap } = queueItem;
    try {
        if (!threejsCanvas) {
            threejsCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        }
        threejsCanvas.width = bitmap.width;
        threejsCanvas.height = bitmap.height;

        if (!threejsRenderer) {
            threejsRenderer = new WebGLRenderer({
                alpha: true,
                canvas: threejsCanvas,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
            threejsRenderer.setClearColor(0x000000, 0);
            threejsRenderer.outputEncoding = sRGBEncoding;
        }
        threejsRenderer.setSize(bitmap.width, bitmap.height, false);

        if (!threejsScene) {
            threejsScene = new Scene();
        }

        if (!threejsCamera) {
            threejsCamera = new OrthographicCamera(0, bitmap.width, 0, bitmap.height, 0.1, 10000);
            threejsCamera.position.z = 1;
        } else {
            threejsCamera.right = bitmap.width;
            threejsCamera.bottom = bitmap.height;
        }
        threejsCamera.updateProjectionMatrix();

        let imageTexture = new CanvasTexture(bitmap);
        imageTexture.generateMipmaps = false;
        imageTexture.encoding = sRGBEncoding;
        imageTexture.minFilter = NearestFilter;
        imageTexture.magFilter = NearestFilter;

        if (!threejsPrepareGpuTextureShaderMaterial) {
            threejsPrepareGpuTextureShaderMaterial = createPrepareGpuTextureShaderMaterial(imageTexture);
            threejsPrepareGpuTextureShaderMaterial.needsUpdate = true;
        } else {
            updatePrepareGpuTextureShaderMaterial(threejsPrepareGpuTextureShaderMaterial, imageTexture);
        }
    
        const imageGeometry = new ImagePlaneGeometry(bitmap.width, bitmap.height);
    
        const imagePlane = new Mesh(imageGeometry, threejsPrepareGpuTextureShaderMaterial);
    
        threejsScene.add(imagePlane);
        threejsRenderer.render(threejsScene, threejsCamera);
        threejsScene.clear();
    
        imageTexture.dispose();
        imageGeometry.dispose();
    
        const compositeBitmap = await createImageBitmap(threejsCanvas as unknown as ImageBitmapSource, 0, 0, threejsCanvas.width, threejsCanvas.height, {
            imageOrientation: 'flipY',
        });

        self.postMessage({
            type: 'TEXTURE_COMPOSITE_RESULT',
            queueId,
            bitmap: compositeBitmap,
        } as TextureCompositeResult)
    } catch (error) {
        self.postMessage({
            type: 'TEXTURE_COMPOSITE_RESULT',
            queueId,
            bitmap: null,
        } as TextureCompositeResult)
    }
}

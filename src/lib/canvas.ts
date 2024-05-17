import { ColorModel, DrawWorkingFileOptions, DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileGroupLayer } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';
import { isOffscreenCanvasSupported } from '@/lib/feature-detection/offscreen-canvas';
import { createCompositeTexture2d, prepareThreejsTexture } from '@/workers/texture-compositor.interface';

import type {
    Camera, Scene, WebGLRenderer, TextureEncoding, OrthographicCamera, Mesh, Texture,
    MeshBasicMaterial, CanvasTexture, TextureFilter, WebGLRenderTarget, ShaderMaterial,
} from 'three';
import type { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import type { EffectComposer } from '@/canvas/renderers/webgl/three/postprocessing/EffectComposer';
import type { ClassType } from '@/types';

const imageSmoothingZoomRatio = preferencesStore.get('imageSmoothingZoomRatio');

/**
 * List of custom cursor images
 */
const cursorImages: { [key: string]: { data: string, image: HTMLImageElement | null, offsetX: number, offsetY: number } } = {
    grabbing: {
        data: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrows-move" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10zM.146 8.354a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L1.707 7.5H5.5a.5.5 0 0 1 0 1H1.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2zM10 8a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L14.293 8.5H10.5A.5.5 0 0 1 10 8z"/></svg>`,
        image: null,
        offsetX: -8,
        offsetY: -8
    }
};
(() => {
    for (const cursorName in cursorImages) {
        const imageInfo = cursorImages[cursorName];
        const image = new Image();
        const svg = new Blob([imageInfo.data], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svg);
        image.src = url;
        imageInfo.image = image;
    }
})();

/**
 * Draws everything in the working document to the specified canvas.
 */
export function drawWorkingFileToCanvas2d(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, options: DrawWorkingFileOptions = {}) {
    options.force2dRenderer = true;

    let now = performance.now();

    // Clear the canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (options.initialTransform) {
        ctx.transform(options.initialTransform.a, options.initialTransform.b, options.initialTransform.c, options.initialTransform.d, options.initialTransform.e, options.initialTransform.f);
    }

    // Set canvas transform based on the current pan/zoom/rotation of the view
    const transform = canvasStore.get('transform');
    const decomposedTransform = canvasStore.get('decomposedTransform');
    const useCssViewport: boolean = canvasStore.get('useCssViewport');
    // canvasStore.set('isDisplayingNonRasterLayer', false);

    if (!useCssViewport && !options.selectionTest && !options.disableViewportTransform) {
        ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
    }
    
    ctx.imageSmoothingEnabled = decomposedTransform.scaleX / window.devicePixelRatio < imageSmoothingZoomRatio;

    (window as any).averageTimeStart = ((performance.now() - now) * 0.1) + (((window as any).averageTimeStart || 0) * 0.9);
    now = performance.now();

    // Draw the image background and frame
    const background = workingFileStore.get('background');
    const imageWidth = workingFileStore.get('width');
    const imageHeight = workingFileStore.get('height');
    ctx.beginPath();
    const canvasBorderSize = 2 / decomposedTransform.scaleX;
    const canvasTopLeft = { x: 0, y: 0 };
    const canvasBottomRight = { x: imageWidth, y: imageHeight };
    ctx.rect(canvasTopLeft.x, canvasTopLeft.y, canvasBottomRight.x - canvasTopLeft.x, canvasBottomRight.y - canvasTopLeft.y);
    ctx.lineWidth = canvasBorderSize;
    ctx.fillStyle = background.visible ? background.color.style : 'transparent';
    ctx.fill();

    // Selection test
    if (options.selectionTest) {
        const imgData = ctx.getImageData(options.selectionTest.point.x, options.selectionTest.point.y, 1, 1);
        options.selectionTest.resultPixelTest = imgData.data.slice(0, 4);
    }

    (window as any).averageTimeCanvas = ((performance.now() - now) * 0.1) + (((window as any).averageTimeCanvas || 0) * 0.9);
    now = performance.now();

    // Clip the canvas
    if (!useCssViewport) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, imageWidth, imageHeight);
        ctx.clip();
    }

    (window as any).averageTimeClip = ((performance.now() - now) * 0.1) + (((window as any).averageTimeClip || 0) * 0.9);
    now = performance.now();

    // Draw layers
    const layers = workingFileStore.get('layers');
    for (const layer of layers) {
        if (options.force2dRenderer) {
            new layerRenderers['2d'][layer.type]().draw(ctx, layer, options);
        } else {
            layer.renderer.draw(ctx, layer, options);
        }
    }

    (window as any).averageTimeLayers = ((performance.now() - now) * 0.1) + (((window as any).averageTimeLayers || 0) * 0.9);
    now = performance.now();

    // If last layer was raster, draw the buffer.
    const isBufferInUse = canvasStore.get('isBufferInUse');
    if (isBufferInUse) {
        canvasStore.set('isBufferInUse', false);
        // ctx.putImageData(canvasStore.get('bufferCtx').getImageData(0, 0, imageWidth, imageHeight), 0, 0);
        ctx.drawImage(canvasStore.get('bufferCanvas'), 0, 0);
    }

    // Unclip the canvas
    if (!useCssViewport) {
        ctx.restore();
    }

    (window as any).averageTimeRestore = ((performance.now() - now) * 0.1) + (((window as any).averageTimeRestore || 0) * 0.9);
    now = performance.now();

    (window as any).averageTime = ((performance.now() - now) * 0.1) + (((window as any).averageTime || 0) * 0.9)
}


/**
 * Draws everything in the working document to the threejs renderer.
 */
export function drawWorkingFileToCanvasWebgl(composer: EffectComposer | undefined, renderer: WebGLRenderer, scene: Scene, camera: Camera, options: DrawWorkingFileOptions = {}) {
    try {
        const layers = workingFileStore.get('layers');
        for (const layer of layers) {
            if (layer.type === 'group') {
                layer.renderer.renderGroup(renderer, camera, layer as WorkingFileGroupLayer<ColorModel>);
            }
        }
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    } catch (error) {
        console.error('[src/lib/canvas.ts] Error drawing webgl canvas. ', error);
        throw error;
    }
}

/**
 * Shared threejs rendering objects used in the functions below.
 */
const drawImageWebglCache = {
    threejsCanvas: undefined as HTMLCanvasElement | undefined,
    threejsRenderer: undefined as WebGLRenderer | undefined,
    threejsScene: undefined as Scene | undefined,
    threejsCamera: undefined as OrthographicCamera | undefined,
    threejsRasterTextureCompositorShaderMaterial: undefined as ShaderMaterial | undefined,
    threejsPrepareGpuTextureShaderMaterial: undefined as ShaderMaterial | undefined,
    NearestFilter: undefined as TextureFilter | undefined,
    sRGBEncoding: undefined as TextureEncoding | undefined,
    Mesh: undefined as ClassType<Mesh> | undefined,
    ImagePlaneGeometry: undefined as ClassType<ImagePlaneGeometry> | undefined,
    MeshBasicMaterial: undefined as ClassType<MeshBasicMaterial> | undefined,
    CanvasTexture: undefined as ClassType<CanvasTexture> | undefined,
};

/**
 * Sets up the webgl renderer to work at the specified resolution.
 * @param width 
 * @param height 
 */
async function setupThreejsRenderer(width: number, height: number) {
    let {
        threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera,
        Mesh, ImagePlaneGeometry, MeshBasicMaterial, CanvasTexture,
        threejsRasterTextureCompositorShaderMaterial, threejsPrepareGpuTextureShaderMaterial,
    } = drawImageWebglCache;

    if (!NearestFilter || !sRGBEncoding) {
        ({ NearestFilter, sRGBEncoding } = await import('three/src/constants'));
        drawImageWebglCache.NearestFilter = NearestFilter;
        drawImageWebglCache.sRGBEncoding = sRGBEncoding;
    }
    if (!Mesh) {
        ({ Mesh } = await import('three/src/objects/Mesh'));
        drawImageWebglCache.Mesh = Mesh;
    }
    if (!ImagePlaneGeometry) {
        ({ ImagePlaneGeometry } = await import('@/canvas/renderers/webgl/geometries/image-plane-geometry'));
        drawImageWebglCache.ImagePlaneGeometry = ImagePlaneGeometry;
    }
    if (!MeshBasicMaterial) {
        ({ MeshBasicMaterial } = await import('three/src/materials/MeshBasicMaterial'));
        drawImageWebglCache.MeshBasicMaterial = MeshBasicMaterial;
    }
    if (!CanvasTexture) {
        ({ CanvasTexture } = await import('three/src/textures/CanvasTexture'));
        drawImageWebglCache.CanvasTexture = CanvasTexture;
    }
    let WebGLRenderer!: ClassType<WebGLRenderer>;
    if (!threejsRenderer) {
        ({ WebGLRenderer } = await import('three/src/renderers/WebGLRenderer'));
    }
    let Scene!: ClassType<Scene>;
    if (!threejsScene) {
        ({ Scene } = await import('three/src/scenes/Scene'));
    }
    let OrthographicCamera!: ClassType<OrthographicCamera>;
    if (!threejsCamera) {
        ({ OrthographicCamera } = await import('three/src/cameras/OrthographicCamera'));
    }

    if (!threejsCanvas) {
        threejsCanvas = document.createElement('canvas');
        drawImageWebglCache.threejsCanvas = threejsCanvas;
    }
    threejsCanvas.width = width;
    threejsCanvas.height = height;

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
        drawImageWebglCache.threejsRenderer = threejsRenderer;
    }
    threejsRenderer.setSize(width, height, false);

    if (!threejsScene) {
        threejsScene = new Scene();
        drawImageWebglCache.threejsScene = threejsScene;
    }

    if (!threejsCamera) {
        threejsCamera = new OrthographicCamera(0, width, 0, height, 0.1, 10000);
        threejsCamera.position.z = 1;
        drawImageWebglCache.threejsCamera = threejsCamera;
    } else {
        threejsCamera.right = width;
        threejsCamera.bottom = height;
    }
    threejsCamera.updateProjectionMatrix();

    return {
        threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera,
        Mesh, ImagePlaneGeometry, MeshBasicMaterial, CanvasTexture,
        threejsRasterTextureCompositorShaderMaterial, threejsPrepareGpuTextureShaderMaterial,
    };
}

/**
 * Clears the webgl renderer cached objects. This will probably never be used by the application.
 */
export function cleanDrawImageWebglCache() {
    let {
        threejsRenderer,
    } = drawImageWebglCache;

    threejsRenderer?.dispose();

    drawImageWebglCache.threejsCanvas = undefined;
    drawImageWebglCache.threejsRenderer = undefined;
    drawImageWebglCache.threejsScene = undefined;
    drawImageWebglCache.threejsRasterTextureCompositorShaderMaterial = undefined;
    drawImageWebglCache.threejsPrepareGpuTextureShaderMaterial = undefined;
    drawImageWebglCache.sRGBEncoding = undefined;
    drawImageWebglCache.threejsCamera = undefined;
    drawImageWebglCache.Mesh = undefined;
    drawImageWebglCache.ImagePlaneGeometry = undefined;
    drawImageWebglCache.MeshBasicMaterial = undefined;
    drawImageWebglCache.CanvasTexture = undefined;
}

/**
 * Draws an image to a canvas using WebGL, which allows for alpha blending in linear RGB color space.
 */
export async function drawImageToCanvas2d(targetCanvas: HTMLCanvasElement, sourceImage: HTMLCanvasElement, x: number, y: number, blendMode: string = 'source-over') {
    const targetImageCtx = targetCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!targetImageCtx) return;

    try {
        if (await isOffscreenCanvasSupported()) {
            const compositeBitmap = await createCompositeTexture2d(
                targetCanvas,
                sourceImage,
                x,
                y,
                blendMode,
            );
            targetImageCtx.imageSmoothingEnabled = false;
            targetImageCtx.clearRect(x, y, sourceImage.width, sourceImage.height);
            targetImageCtx.drawImage(compositeBitmap, x, y);
            return;
        }
    } catch (error) {
        console.error(error);
        // Continue to main thread flow below...
    }

    const sourceCroppedTargetCanvas = document.createElement('canvas');
    sourceCroppedTargetCanvas.width = sourceImage.width;
    sourceCroppedTargetCanvas.height = sourceImage.height;
    const sourceCroppedTargetCtx = sourceCroppedTargetCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!sourceCroppedTargetCtx) return;
    sourceCroppedTargetCtx.drawImage(targetCanvas, -x, -y);

    let {
        threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera,
        Mesh, ImagePlaneGeometry, CanvasTexture, threejsRasterTextureCompositorShaderMaterial,
    } = await setupThreejsRenderer(sourceImage.width, sourceImage.height);

    const targetImageTexture = new CanvasTexture(sourceCroppedTargetCanvas);
    targetImageTexture.generateMipmaps = false;
    targetImageTexture.encoding = sRGBEncoding;
    targetImageTexture.minFilter = NearestFilter;
    targetImageTexture.magFilter = NearestFilter;

    const sourceImageTexture = new CanvasTexture(sourceImage);
    sourceImageTexture.generateMipmaps = false;
    sourceImageTexture.encoding = sRGBEncoding;
    sourceImageTexture.minFilter = NearestFilter;
    sourceImageTexture.magFilter = NearestFilter;

    if (!threejsRasterTextureCompositorShaderMaterial) {
        const { createRasterTextureCompositorShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        threejsRasterTextureCompositorShaderMaterial = createRasterTextureCompositorShaderMaterial(targetImageTexture, sourceImageTexture, 0, 0, blendMode);
        threejsRasterTextureCompositorShaderMaterial.needsUpdate = true;
        drawImageWebglCache.threejsRasterTextureCompositorShaderMaterial = threejsRasterTextureCompositorShaderMaterial;
    } else {
        const { updateRasterTextureCompositorShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        updateRasterTextureCompositorShaderMaterial(threejsRasterTextureCompositorShaderMaterial, targetImageTexture, sourceImageTexture, 0, 0, blendMode);
    }

    const imageGeometry = new ImagePlaneGeometry(sourceImage.width, sourceImage.height);

    const imagePlane = new Mesh(imageGeometry, threejsRasterTextureCompositorShaderMaterial);

    threejsScene.add(imagePlane);
    threejsRenderer.render(threejsScene, threejsCamera);
    threejsScene.clear();

    targetImageTexture.dispose();
    sourceImageTexture.dispose();
    imageGeometry.dispose();

    targetImageCtx.imageSmoothingEnabled = false;
    targetImageCtx.clearRect(x, y, sourceImage.width, sourceImage.height);
    targetImageCtx.drawImage(threejsCanvas, x, y);
}

/**
 * Takes the image on a canvas and modifies it so the fully transparent pixels match the colors
 * of the visible pixels they sit nearby. This avoids mip-map artifacts.
 * @param image HTML canvas to take image from.
 */
export async function createThreejsTextureFromImage(image: HTMLCanvasElement | ImageBitmap): Promise<Texture> {

    try {
        if (await isOffscreenCanvasSupported()) {
            const compositeBitmap = await prepareThreejsTexture(image);
            let CanvasTexture = drawImageWebglCache.CanvasTexture;
            if (!CanvasTexture) {
                ({ CanvasTexture } = await import('three/src/textures/CanvasTexture'));
                drawImageWebglCache.CanvasTexture = CanvasTexture;
            }
            return new CanvasTexture(compositeBitmap);
        }
    } catch (error) {
        console.error(error);
        // Continue to main thread flow below...
    }

    let {
        threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera,
        Mesh, ImagePlaneGeometry, CanvasTexture, threejsPrepareGpuTextureShaderMaterial,
    } = await setupThreejsRenderer(image.width, image.height);

    let imageTexture = new CanvasTexture(image);
    imageTexture.generateMipmaps = false;
    imageTexture.encoding = sRGBEncoding;
    imageTexture.minFilter = NearestFilter;
    imageTexture.magFilter = NearestFilter;

    if (!threejsPrepareGpuTextureShaderMaterial) {
        const { createPrepareGpuTextureShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        threejsPrepareGpuTextureShaderMaterial = createPrepareGpuTextureShaderMaterial(imageTexture);
        threejsPrepareGpuTextureShaderMaterial.needsUpdate = true;
        drawImageWebglCache.threejsPrepareGpuTextureShaderMaterial = threejsPrepareGpuTextureShaderMaterial;
    } else {
        const { updatePrepareGpuTextureShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        updatePrepareGpuTextureShaderMaterial(threejsPrepareGpuTextureShaderMaterial, imageTexture);
    }

    const imageGeometry = new ImagePlaneGeometry(image.width, image.height);

    const imagePlane = new Mesh(imageGeometry, threejsPrepareGpuTextureShaderMaterial);

    threejsScene.add(imagePlane);
    threejsRenderer.render(threejsScene, threejsCamera);
    threejsScene.clear();

    imageTexture.dispose();
    imageGeometry.dispose();

    const preparedImage = document.createElement('canvas');
    preparedImage.width = image.width;
    preparedImage.height = image.height;
    const preparedImageCtx = preparedImage.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!preparedImageCtx) {
        console.error('[src/lib/canvas.ts] Unable to create canvas context for generating a prepared texture.');
        return imageTexture;
    }
    preparedImageCtx.globalCompositeOperation = 'copy';
    preparedImageCtx.drawImage(threejsCanvas, 0, 0);
    preparedImageCtx.globalCompositeOperation = 'source-over';

    return new CanvasTexture(preparedImage);
}

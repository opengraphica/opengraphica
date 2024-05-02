import { ColorModel, DrawWorkingFileOptions, DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileGroupLayer } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';

import type {
    Camera, Scene, WebGLRenderer, TextureEncoding, OrthographicCamera, Mesh,
    MeshBasicMaterial, CanvasTexture, TextureFilter, WebGLRenderTarget, ShaderMaterial,
} from 'three';
import type { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import type { RenderPass } from '@/canvas/renderers/webgl/three/postprocessing/RenderPass';
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
        console.error(error);
        throw error;
    }
}



/**
 * Draws an image to a canvas using WebGL, which allows for alpha blending in linear RGB color space.
 */
const drawImageToCanvas2dWebglCache = {
    threejsCanvas: undefined as HTMLCanvasElement | undefined,
    threejsRenderer: undefined as WebGLRenderer | undefined,
    threejsScene: undefined as Scene | undefined,
    threejsCamera: undefined as OrthographicCamera | undefined,
    threejsOverlayRenderTarget: undefined as WebGLRenderTarget | undefined,
    threejsRasterOverlayShaderMaterial: undefined as ShaderMaterial | undefined,
    NearestFilter: undefined as TextureFilter | undefined,
    sRGBEncoding: undefined as TextureEncoding | undefined,
    Mesh: undefined as ClassType<Mesh> | undefined,
    ImagePlaneGeometry: undefined as ClassType<ImagePlaneGeometry> | undefined,
    MeshBasicMaterial: undefined as ClassType<MeshBasicMaterial> | undefined,
    CanvasTexture: undefined as ClassType<CanvasTexture> | undefined,
};
export async function drawImageToCanvas2d(targetCanvas: HTMLCanvasElement, sourceImage: HTMLCanvasElement, x: number, y: number) {
    const targetImageCtx = targetCanvas.getContext('2d');
    if (!targetImageCtx) return;

    const sourceCroppedTargetCanvas = document.createElement('canvas');
    sourceCroppedTargetCanvas.width = sourceImage.width;
    sourceCroppedTargetCanvas.height = sourceImage.height;
    const sourceCroppedTargetCtx = sourceCroppedTargetCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!sourceCroppedTargetCtx) return;
    sourceCroppedTargetCtx.drawImage(targetCanvas, -x, -y);

    let {
        threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera, threejsOverlayRenderTarget,
        Mesh, ImagePlaneGeometry, MeshBasicMaterial, CanvasTexture, threejsRasterOverlayShaderMaterial,
    } = drawImageToCanvas2dWebglCache;

    if (!NearestFilter || !sRGBEncoding) {
        ({ NearestFilter, sRGBEncoding } = await import('three/src/constants'));
        drawImageToCanvas2dWebglCache.NearestFilter = NearestFilter;
        drawImageToCanvas2dWebglCache.sRGBEncoding = sRGBEncoding;
    }
    if (!Mesh) {
        ({ Mesh } = await import('three/src/objects/Mesh'));
        drawImageToCanvas2dWebglCache.Mesh = Mesh;
    }
    if (!ImagePlaneGeometry) {
        ({ ImagePlaneGeometry } = await import('@/canvas/renderers/webgl/geometries/image-plane-geometry'));
        drawImageToCanvas2dWebglCache.ImagePlaneGeometry = ImagePlaneGeometry;
    }
    if (!MeshBasicMaterial) {
        ({ MeshBasicMaterial } = await import('three/src/materials/MeshBasicMaterial'));
        drawImageToCanvas2dWebglCache.MeshBasicMaterial = MeshBasicMaterial;
    }
    if (!CanvasTexture) {
        ({ CanvasTexture } = await import('three/src/textures/CanvasTexture'));
        drawImageToCanvas2dWebglCache.CanvasTexture = CanvasTexture;
    }

    if (!threejsCanvas) {
        threejsCanvas = document.createElement('canvas');
        drawImageToCanvas2dWebglCache.threejsCanvas = threejsCanvas;
    }
    threejsCanvas.width = sourceImage.width;
    threejsCanvas.height = sourceImage.height;

    if (!threejsRenderer) {
        const { WebGLRenderer } = await import('three/src/renderers/WebGLRenderer');
        threejsRenderer = new WebGLRenderer({
            alpha: true,
            canvas: threejsCanvas,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
        });
        threejsRenderer.setClearColor(0x000000, 0);
        threejsRenderer.outputEncoding = sRGBEncoding;
        drawImageToCanvas2dWebglCache.threejsRenderer = threejsRenderer;
    }
    threejsRenderer.setSize(sourceImage.width, sourceImage.height, false);

    if (!threejsScene) {
        const { Scene } = await import('three/src/scenes/Scene');
        threejsScene = new Scene();
        drawImageToCanvas2dWebglCache.threejsScene = threejsScene;
    }

    if (!threejsCamera) {
        const { OrthographicCamera } = await import('three/src/cameras/OrthographicCamera');
        threejsCamera = new OrthographicCamera(0, sourceImage.width, 0, sourceImage.height, 0.1, 10000);
        threejsCamera.position.z = 1;
        drawImageToCanvas2dWebglCache.threejsCamera = threejsCamera;
    } else {
        threejsCamera.right = sourceImage.width;
        threejsCamera.bottom = sourceImage.height;
    }
    threejsCamera.updateProjectionMatrix();

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

    if (!threejsRasterOverlayShaderMaterial) {
        const { createRasterOverlayShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        threejsRasterOverlayShaderMaterial = createRasterOverlayShaderMaterial(targetImageTexture, sourceImageTexture, 0, 0);
        threejsRasterOverlayShaderMaterial.needsUpdate = true;
        drawImageToCanvas2dWebglCache.threejsRasterOverlayShaderMaterial = threejsRasterOverlayShaderMaterial;
    } else {
        const { updateRasterOverlayShaderMaterial } = await import('@/canvas/renderers/webgl/shaders');
        updateRasterOverlayShaderMaterial(threejsRasterOverlayShaderMaterial, targetImageTexture, sourceImageTexture, 0, 0);
    }

    const imageGeometry = new ImagePlaneGeometry(sourceImage.width, sourceImage.height);

    const imagePlane = new Mesh(imageGeometry, threejsRasterOverlayShaderMaterial);

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

export function cleanDrawImageToCanvas2dCache() {
    let {
        threejsRenderer, threejsOverlayRenderTarget
    } = drawImageToCanvas2dWebglCache;

    threejsOverlayRenderTarget?.dispose();
    threejsRenderer?.dispose();

    drawImageToCanvas2dWebglCache.threejsCanvas = undefined;
    drawImageToCanvas2dWebglCache.threejsRenderer = undefined;
    drawImageToCanvas2dWebglCache.threejsScene = undefined;
    drawImageToCanvas2dWebglCache.threejsOverlayRenderTarget = undefined;
    drawImageToCanvas2dWebglCache.threejsRasterOverlayShaderMaterial = undefined;
    drawImageToCanvas2dWebglCache.sRGBEncoding = undefined;
    drawImageToCanvas2dWebglCache.threejsCamera = undefined;
    drawImageToCanvas2dWebglCache.Mesh = undefined;
    drawImageToCanvas2dWebglCache.ImagePlaneGeometry = undefined;
    drawImageToCanvas2dWebglCache.MeshBasicMaterial = undefined;
    drawImageToCanvas2dWebglCache.CanvasTexture = undefined;
}












// const drawImageToCanvas2dWebglCache = {
//     threejsCanvas: undefined as HTMLCanvasElement | undefined,
//     threejsRenderer: undefined as WebGLRenderer | undefined,
//     threejsScene: undefined as Scene | undefined,
//     threejsCamera: undefined as OrthographicCamera | undefined,
//     threejsOverlayRenderTarget: undefined as WebGLRenderTarget | undefined,
//     NearestFilter: undefined as TextureFilter | undefined,
//     sRGBEncoding: undefined as TextureEncoding | undefined,
//     Mesh: undefined as ClassType<Mesh> | undefined,
//     ImagePlaneGeometry: undefined as ClassType<ImagePlaneGeometry> | undefined,
//     MeshBasicMaterial: undefined as ClassType<MeshBasicMaterial> | undefined,
//     CanvasTexture: undefined as ClassType<CanvasTexture> | undefined,
// };
// export async function drawImageToCanvas2d(targetCanvas: HTMLCanvasElement, sourceImage: HTMLCanvasElement, x: number, y: number) {
//     const targetImageCtx = targetCanvas.getContext('2d');
//     if (!targetImageCtx) return;

//     let {
//         threejsCanvas, threejsRenderer, threejsScene, NearestFilter, sRGBEncoding, threejsCamera, threejsOverlayRenderTarget,
//         Mesh, ImagePlaneGeometry, MeshBasicMaterial, CanvasTexture,
//     } = drawImageToCanvas2dWebglCache;

//     if (!NearestFilter || !sRGBEncoding) {
//         ({ NearestFilter, sRGBEncoding } = await import('three/src/constants'));
//         drawImageToCanvas2dWebglCache.NearestFilter = NearestFilter;
//         drawImageToCanvas2dWebglCache.sRGBEncoding = sRGBEncoding;
//     }
//     if (!Mesh) {
//         ({ Mesh } = await import('three/src/objects/Mesh'));
//         drawImageToCanvas2dWebglCache.Mesh = Mesh;
//     }
//     if (!ImagePlaneGeometry) {
//         ({ ImagePlaneGeometry } = await import('@/canvas/renderers/webgl/geometries/image-plane-geometry'));
//         drawImageToCanvas2dWebglCache.ImagePlaneGeometry = ImagePlaneGeometry;
//     }
//     if (!MeshBasicMaterial) {
//         ({ MeshBasicMaterial } = await import('three/src/materials/MeshBasicMaterial'));
//         drawImageToCanvas2dWebglCache.MeshBasicMaterial = MeshBasicMaterial;
//     }
//     if (!CanvasTexture) {
//         ({ CanvasTexture } = await import('three/src/textures/CanvasTexture'));
//         drawImageToCanvas2dWebglCache.CanvasTexture = CanvasTexture;
//     }

//     if (!threejsCanvas) {
//         threejsCanvas = document.createElement('canvas');
//         drawImageToCanvas2dWebglCache.threejsCanvas = threejsCanvas;
//     }
//     threejsCanvas.width = sourceImage.width;
//     threejsCanvas.height = sourceImage.height;

//     if (!threejsOverlayRenderTarget) {
//         const { WebGLRenderTarget } = await import('three/src/renderers/WebGLRenderTarget');
//         threejsOverlayRenderTarget = new WebGLRenderTarget(sourceImage.width, sourceImage.height, {
//             depthBuffer: false,
//             stencilBuffer: false,
//         });
//     }
//     threejsOverlayRenderTarget.setSize(sourceImage.width, sourceImage.height);

//     if (!threejsRenderer) {
//         const { WebGLRenderer } = await import('three/src/renderers/WebGLRenderer');
//         threejsRenderer = new WebGLRenderer({
//             alpha: true,
//             canvas: threejsCanvas,
//             premultipliedAlpha: false,
//             preserveDrawingBuffer: true,
//             powerPreference: 'high-performance',
//         });
//         threejsRenderer.setClearColor(0x000000, 0);
//         threejsRenderer.outputEncoding = sRGBEncoding;
//         drawImageToCanvas2dWebglCache.threejsRenderer = threejsRenderer;
//     }
//     threejsRenderer.setSize(sourceImage.width, sourceImage.height, false);

//     if (!threejsScene) {
//         const { Scene } = await import('three/src/scenes/Scene');
//         threejsScene = new Scene();
//         drawImageToCanvas2dWebglCache.threejsScene = threejsScene;
//     }

//     if (!threejsCamera) {
//         const { OrthographicCamera } = await import('three/src/cameras/OrthographicCamera');
//         threejsCamera = new OrthographicCamera(0, sourceImage.width, 0, sourceImage.height, 0.1, 10000);
//         threejsCamera.position.z = 1;
//         drawImageToCanvas2dWebglCache.threejsCamera = threejsCamera;
//     } else {
//         threejsCamera.right = sourceImage.width;
//         threejsCamera.bottom = sourceImage.height;
//     }
//     threejsCamera.updateProjectionMatrix();

//     const targetImageTexture = new CanvasTexture(targetCanvas);
//     targetImageTexture.generateMipmaps = false;
//     targetImageTexture.encoding = sRGBEncoding;
//     targetImageTexture.minFilter = NearestFilter;
//     targetImageTexture.magFilter = NearestFilter;

//     const { CustomBlending, OneFactor, SrcAlphaFactor, ZeroFactor } = await import('three/src/constants');

//     const targetImageMaterial = new MeshBasicMaterial({
//         transparent: true,
//         depthTest: false,
//         map: targetImageTexture,
//     });

//     const targetImageBgMaterial = new MeshBasicMaterial({
//         transparent: false,
//         depthTest: false,
//         map: targetImageTexture,
//     });

//     const targetImageGeometry = new ImagePlaneGeometry(targetCanvas.width, targetCanvas.height);

//     const targetImageBgPlane = new Mesh(targetImageGeometry, targetImageBgMaterial);
//     targetImageBgPlane.renderOrder = 1;
//     targetImageBgPlane.translateX(-x);
//     targetImageBgPlane.translateY(-y);

//     const targetImagePlane = new Mesh(targetImageGeometry, targetImageMaterial);
//     targetImagePlane.renderOrder = 3;
//     targetImagePlane.translateX(-x);
//     targetImagePlane.translateY(-y);

//     const sourceImageTexture = new CanvasTexture(sourceImage);
//     sourceImageTexture.generateMipmaps = false;
//     sourceImageTexture.encoding = sRGBEncoding;
//     sourceImageTexture.minFilter = NearestFilter;
//     sourceImageTexture.magFilter = NearestFilter;

//     const sourceImageMaterial = new MeshBasicMaterial({
//         transparent: true,
//         depthTest: false,
//         map: sourceImageTexture,
//     });

//     const sourceImageBgMaterial = new MeshBasicMaterial({
//         transparent: false,
//         alphaTest: 0.00001,
//         opacity: 1,
//         depthTest: false,
//         map: sourceImageTexture,
//     });

//     const sourceImageGeometry = new ImagePlaneGeometry(sourceImage.width, sourceImage.height);

//     const sourceImageBgPlane = new Mesh(sourceImageGeometry, sourceImageBgMaterial);
//     sourceImageBgPlane.renderOrder = 2;

//     const sourceImagePlane = new Mesh(sourceImageGeometry, sourceImageMaterial);
//     sourceImagePlane.renderOrder = 4;

//     threejsScene.add(targetImagePlane);
//     threejsScene.add(sourceImagePlane);
//     threejsRenderer.setRenderTarget(threejsOverlayRenderTarget);
//     threejsRenderer.render(threejsScene, threejsCamera);
//     threejsRenderer.setRenderTarget(null);
//     threejsScene.clear();

//     const combinedSourceTargetAlphaMaterial = new MeshBasicMaterial({
//         transparent: true,
//         map: threejsOverlayRenderTarget.texture,
//         blending: CustomBlending,
//         blendSrc: ZeroFactor,
//         blendDst: OneFactor,
//         blendSrcAlpha: OneFactor,
//         blendDstAlpha: ZeroFactor,
//     });
//     const combinedSourceTargetAlphaPlane = new Mesh(sourceImageGeometry, combinedSourceTargetAlphaMaterial);
//     combinedSourceTargetAlphaPlane.renderOrder = 4;
//     const combinedSourceTargetColorMaterial = new MeshBasicMaterial({
//         map: threejsOverlayRenderTarget.texture,
//         alphaTest: 1,
//     });
//     const combinedSourceTargetColorPlane = new Mesh(sourceImageGeometry, combinedSourceTargetColorMaterial);
//     combinedSourceTargetColorPlane.renderOrder = 5;

//     threejsScene.add(targetImageBgPlane);
//     threejsScene.add(sourceImageBgPlane);
//     threejsScene.add(combinedSourceTargetAlphaPlane);
//     threejsScene.add(combinedSourceTargetColorPlane);
//     threejsRenderer.render(threejsScene, threejsCamera);

//     targetImageTexture.dispose();
//     targetImageMaterial.dispose();
//     targetImageBgMaterial.dispose();
//     targetImageGeometry.dispose();
//     sourceImageTexture.dispose();
//     sourceImageMaterial.dispose();
//     sourceImageBgMaterial.dispose();
//     sourceImageGeometry.dispose();

//     threejsScene.clear();

//     targetImageCtx.imageSmoothingEnabled = false;
//     targetImageCtx.clearRect(x, y, sourceImage.width, sourceImage.height);
//     targetImageCtx.drawImage(threejsCanvas, x, y);
// }

// export function cleanDrawImageToCanvas2dCache() {
//     let {
//         threejsRenderer, threejsOverlayRenderTarget
//     } = drawImageToCanvas2dWebglCache;

//     threejsOverlayRenderTarget?.dispose();
//     threejsRenderer?.dispose();

//     drawImageToCanvas2dWebglCache.threejsCanvas = undefined;
//     drawImageToCanvas2dWebglCache.threejsRenderer = undefined;
//     drawImageToCanvas2dWebglCache.threejsScene = undefined;
//     drawImageToCanvas2dWebglCache.threejsOverlayRenderTarget = undefined;
//     drawImageToCanvas2dWebglCache.sRGBEncoding = undefined;
//     drawImageToCanvas2dWebglCache.threejsCamera = undefined;
//     drawImageToCanvas2dWebglCache.Mesh = undefined;
//     drawImageToCanvas2dWebglCache.ImagePlaneGeometry = undefined;
//     drawImageToCanvas2dWebglCache.MeshBasicMaterial = undefined;
//     drawImageToCanvas2dWebglCache.CanvasTexture = undefined;
// }
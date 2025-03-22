/**
 * This sets up the main image preview canvas to use threejs for rendering.
 * - Creates a threejs WebGL renderer, and attaches it to the provided canvas.
 * - Updates the threejs renderer when the viewport or image size changes.
 * - Manages a background plane mesh which changes the background color according to the working file state.
 * - Creates and manages a clipping boundary so objects outside the image bounds are not visible.
 * - Creates a selection mask plane mesh which displays the selection mask overlay texture.
 * 
 */

import { markRaw, ref, watch, watchEffect, type Ref } from 'vue';

import { drawWorkingFileToCanvasWebgl } from '@/lib/canvas';
import { colorToRgba, getColorModelName } from '@/lib/color';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    selectedLayersSelectionMaskPreview, selectedLayersSelectionMaskPreviewCanvasOffset,
} from '@/canvas/store/selection-state';

import type {
    Blending, BlendingDstFactor, BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshBasicMaterial,
    OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Side, Texture, ColorSpace,
    TextureLoader, WebGLRenderer, Wrapping,
} from 'three';
import type { EffectComposer } from '@/canvas/renderers/webgl/postprocessing/effect-composer';
import type { createLayerPasses as CreateLayerPasses, refreshLayerPasses as RefreshLayerPasses } from '@/canvas/renderers/webgl/postprocessing/create-layer-passes';
import type { RenderPass } from '@/canvas/renderers/webgl/postprocessing/render-pass';
import type { ShaderPass } from '@/canvas/renderers/webgl/postprocessing/shader-pass';
import type { GammaCorrectionShader as GammaCorrectionShaderType } from '@/canvas/renderers/webgl/shaders/gamma-correction-shader';
import type { ClassType } from '@/types';

interface ThreejsViewportOptions {
    canvas: Ref<HTMLCanvasElement | undefined>,
}

const selectionMaskPatternSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';

export function useThreejsViewport(options: ThreejsViewportOptions) {

    let ctx = ref<WebGLRenderingContext | WebGL2RenderingContext | null>(null);
    let renderCanvasCallback = () => {};

    let Matrix4: ClassType<Matrix4>;
    let threejsComposer: EffectComposer;
    let threejsRenderer: WebGLRenderer;
    let threejsScene: Scene;
    let threejsCamera: OrthographicCamera;

    // Unused, for compatibility with the output of the canvas 2d composable.
    const selectionMaskCanvas = ref<HTMLCanvasElement>();

    // Automatically change background color in three.js webgl renderer when the background layer updates.
    watchEffect(async () => {
        if (canvasStore.state.renderer === 'webgl') {
            const threejsRenderer = canvasStore.get('threejsRenderer');
            const threejsScene = canvasStore.get('threejsScene');
            if (threejsScene && threejsRenderer) {
                const threejsBackground = canvasStore.get('threejsBackground');
                if (threejsBackground) {
                    if (!workingFileStore.state.background.visible) {
                        // These imports intentionally run after the store access for the `watchEffect` to work correctly.
                        const { MeshBasicMaterial } = await import('three/src/materials/MeshBasicMaterial');
                        const { DoubleSide } = await import('three/src/constants');
                        threejsBackground.material = new MeshBasicMaterial({
                            color: 0xffffff,
                            opacity: 0,
                            transparent: true,
                            side: DoubleSide
                        });
                    } else {
                        const { r, g, b, alpha } = colorToRgba(
                            workingFileStore.state.background.color,
                            getColorModelName(workingFileStore.state.background.color)
                        );
                        // These imports intentionally run after the store access for the `watchEffect` to work correctly.
                        const { MeshBasicMaterial } = await import('three/src/materials/MeshBasicMaterial');
                        const { DoubleSide } = await import('three/src/constants');
                        const color = new (await import('three/src/math/Color')).Color().setRGB(r, g, b);
                        color.convertSRGBToLinear();
                        threejsBackground.material = new MeshBasicMaterial({
                            color,
                            opacity: alpha,
                            transparent: true,
                            side: DoubleSide
                        });
                    }
                }
                threejsScene.background = null;
            }
            canvasStore.set('dirty', true);
        }
    });

    // Toggle visibility of area outside the working file boundary
    watchEffect(async () => {
        const showAreaOutsideWorkingFile = canvasStore.state.showAreaOutsideWorkingFile;
        const threejsCanvasMargin = canvasStore.get('threejsCanvasMargin');
        if (threejsCanvasMargin) {
            threejsCanvasMargin.visible = !showAreaOutsideWorkingFile;
        }
    });

    // Update selection mask images in GPU memory
    watch([
        activeSelectionMask, activeSelectionMaskCanvasOffset,
        appliedSelectionMask, appliedSelectionMaskCanvasOffset,
        selectedLayersSelectionMaskPreview, selectedLayersSelectionMaskPreviewCanvasOffset,
    ], async (
        [newActiveSelectionMask, newActiveSelectionMaskCanvasOffset, newAppliedSelectionMask, newAppliedSelectionMaskCanvasOffset,
        newSelectedLayersSelectionMaskPreview, newSelectedLayersSelectionMaskPreviewCanvasOffset],
        [oldActiveSelectionMask, oldActiveSelectionMaskCanvasOffset, oldAppliedSelectionMask, oldAppliedSelectionMaskCanvasOffset,
        oldSelectedLayersSelectionMaskPreview, oldSelectedLayersSelectionMaskPreviewCanvasOffset]
    ) => {
        const { TextureLoader } = await import('three/src/loaders/TextureLoader');
        const { Texture } = await import('three/src/textures/Texture');
        const { SRGBColorSpace, ClampToEdgeWrapping, NearestFilter, LinearFilter } = await import('three/src/constants');

        const newSelectionMask = newActiveSelectionMask ?? newAppliedSelectionMask ?? newSelectedLayersSelectionMaskPreview;
        const oldSelectionMask = oldActiveSelectionMask ?? oldAppliedSelectionMask ?? oldSelectedLayersSelectionMaskPreview;
        const newCanvasOffset = newActiveSelectionMask ? newActiveSelectionMaskCanvasOffset : (newAppliedSelectionMask ? newAppliedSelectionMaskCanvasOffset : newSelectedLayersSelectionMaskPreviewCanvasOffset);

        // TODO - check if new mask is always re-assigned a reference, may want to use canvas instead of image for performance...

        const threejsCamera = canvasStore.get('threejsCamera');
        const threejsSelectionMask = canvasStore.get('threejsSelectionMask');
        if (!threejsCamera || !threejsSelectionMask) return;

        const oldSelectedMaskTexture = threejsSelectionMask.material.uniforms.selectedMaskMap.value;

        if (newSelectionMask) {
            const selectionMaskTexture = await new Promise<InstanceType<typeof Texture> | undefined>((resolve) => {
                const texture = new TextureLoader().load(
                    newSelectionMask.src,
                    () => { resolve(texture); },
                    undefined,
                    () => { resolve(undefined); }
                );
            });
            if (selectionMaskTexture) {
                selectionMaskTexture.magFilter = NearestFilter;
                selectionMaskTexture.minFilter = LinearFilter;
                selectionMaskTexture.wrapS = ClampToEdgeWrapping;
                selectionMaskTexture.wrapT = ClampToEdgeWrapping;
                selectionMaskTexture.colorSpace = SRGBColorSpace;
                threejsSelectionMask.material.uniforms.selectedMaskMap.value = selectionMaskTexture;
                threejsSelectionMask.material.uniforms.selectedMaskSize.value = [selectionMaskTexture.image.width, selectionMaskTexture.image.height];
                threejsSelectionMask.material.uniforms.selectedMaskOffset.value = [newCanvasOffset.x, newCanvasOffset.y];
            }
            threejsSelectionMask.visible = true;
        } else {
            threejsSelectionMask.material.uniforms.selectedMaskSize.value = [1, 1];
            threejsSelectionMask.visible = false;
        }
        threejsSelectionMask.material.uniforms.inverseProjectionMatrix.value = threejsCamera.projectionMatrixInverse.elements;
        threejsSelectionMask.material.needsUpdate = true;
        oldSelectedMaskTexture?.dispose();
        canvasStore.set('dirty', true);
    });

    // Update canvas size when viewport type changes to/from CSS
    watch(() => canvasStore.state.useCssViewport, () => {
        updateThreejsImageSize(
            workingFileStore.state.width,
            workingFileStore.state.height,
            canvasStore.state.viewWidth,
            canvasStore.state.viewHeight,
        );
    });

    // Update canvas on browser window or image resize
    watch(() => [
        workingFileStore.state.width,
        workingFileStore.state.height,
        canvasStore.state.viewWidth,
        canvasStore.state.viewHeight
    ], async ([imageWidth, imageHeight, viewWidth, viewHeight], [oldImageWidth, oldImageHeight]) => {
        updateThreejsImageSize(
            imageWidth,
            imageHeight,
            viewWidth,
            viewHeight,
        );

        // Update background size
        const threejsBackground = canvasStore.get('threejsBackground');
        if (threejsBackground) {
            const { PlaneGeometry } = await import('three/src/geometries/PlaneGeometry');
            threejsBackground.geometry?.dispose();
            threejsBackground.geometry = new PlaneGeometry(imageWidth, imageHeight);
            threejsBackground.position.x = imageWidth / 2;
            threejsBackground.position.y = imageHeight / 2;
        }

        if (imageWidth != oldImageWidth || imageHeight != oldImageHeight) {
            updateThreejsCanvasMargin(imageWidth, imageHeight);
        }
    });

    // Set up canvas for webgl rendering
    async function initializeRenderer() {
        let WebGLRenderer: ClassType<WebGLRenderer>;
        let Scene: ClassType<Scene>;
        let OrthographicCamera: ClassType<OrthographicCamera>;
        let PlaneGeometry: ClassType<PlaneGeometry>;
        let MeshBasicMaterial: ClassType<MeshBasicMaterial>;
        let ShaderMaterial: ClassType<ShaderMaterial>;
        let TextureLoader: ClassType<TextureLoader>;
        let Texture: ClassType<Texture>;
        let Mesh: ClassType<Mesh>;
        let DoubleSide: Side;
        let SRGBColorSpace: ColorSpace;
        let RepeatWrapping: Wrapping;
        let EffectComposer: ClassType<EffectComposer>;
        let createLayerPasses: typeof CreateLayerPasses;
        let RenderPass: ClassType<RenderPass>;
        let ShaderPass: ClassType<ShaderPass>;
        let GammaCorrectionShader: typeof GammaCorrectionShaderType;

        [
            { DoubleSide, SRGBColorSpace, RepeatWrapping },
            { WebGLRenderer },
            { Scene },
            { OrthographicCamera },
            { PlaneGeometry },
            { MeshBasicMaterial },
            { ShaderMaterial },
            { TextureLoader },
            { Texture },
            { Mesh },
            { Matrix4 },
            { EffectComposer },
            { createLayerPasses },
            { RenderPass },
            { ShaderPass },
            { GammaCorrectionShader },
        ] = await Promise.all([
            import('three/src/constants'),
            import('three/src/renderers/WebGLRenderer'),
            import('three/src/scenes/Scene'),
            import('three/src/cameras/OrthographicCamera'),
            import('three/src/geometries/PlaneGeometry'),
            import('three/src/materials/MeshBasicMaterial'),
            import('three/src/materials/ShaderMaterial'),
            import('three/src/loaders/TextureLoader'),
            import('three/src/textures/Texture'),
            import('three/src/objects/Mesh'),
            import('three/src/math/Matrix4'),
            import('@/canvas/renderers/webgl/postprocessing/effect-composer'),
            import('@/canvas/renderers/webgl/postprocessing/create-layer-passes'),
            import('@/canvas/renderers/webgl/postprocessing/render-pass'),
            import('@/canvas/renderers/webgl/postprocessing/shader-pass'),
            import('@/canvas/renderers/webgl/shaders/gamma-correction-shader'),
        ]);

        const { default: selectionMaskMaterialFragmentShader } = await import('@/canvas/renderers/webgl/shaders/selection-mask-material.frag');
        const { default: selectionMaskMaterialVertexShader } = await import('@/canvas/renderers/webgl/shaders/selection-mask-material.vert');
        const workingFileWidth = workingFileStore.state.width;
        const workingFileHeight = workingFileStore.state.height;

        threejsRenderer = new WebGLRenderer({
            alpha: true,
            canvas: options.canvas.value,
            premultipliedAlpha: false,
            powerPreference: 'high-performance'
        });
        threejsRenderer.outputColorSpace = SRGBColorSpace;
        threejsRenderer.setSize(1, 1);
        canvasStore.set('threejsRenderer', threejsRenderer);

        threejsScene = markRaw(new Scene());
        canvasStore.set('threejsScene', threejsScene);

        threejsCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
        threejsCamera.matrixAutoUpdate = false;
        canvasStore.set('threejsCamera', threejsCamera);

        const backgroundGeometry = new PlaneGeometry(workingFileWidth, workingFileHeight);
        const backgroundMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide });
        const threejsBackground = new Mesh(backgroundGeometry, backgroundMaterial);
        threejsBackground.position.x = workingFileWidth / 2;
        threejsBackground.position.y = workingFileHeight / 2;
        threejsBackground.renderOrder = -1;
        threejsScene.add(threejsBackground);
        canvasStore.set('threejsBackground', markRaw(threejsBackground));

        const selectionMaskUnselectedPatternTexture = await new Promise<InstanceType<typeof Texture> | undefined>((resolve) => {
            const texture = new TextureLoader().load(
                selectionMaskPatternSrc,
                () => { resolve(texture); },
                undefined,
                () => { resolve(undefined); }
            );
        });
        if (selectionMaskUnselectedPatternTexture) {
            selectionMaskUnselectedPatternTexture.wrapS = RepeatWrapping;
            selectionMaskUnselectedPatternTexture.wrapT = RepeatWrapping;
            selectionMaskUnselectedPatternTexture.colorSpace = SRGBColorSpace;
        }
        const selectionMaskGeometry = new PlaneGeometry(2, 2); //viewportWidth.value, viewportHeight.value);
        const selectionMaskMaterial = new ShaderMaterial({
            transparent: true,
            depthTest: false,
            vertexShader: selectionMaskMaterialVertexShader,
            fragmentShader: selectionMaskMaterialFragmentShader,
            side: DoubleSide,
            uniforms: {
                unselectedMaskMap: { value: selectionMaskUnselectedPatternTexture },
                selectedMaskMap: { value: undefined },
                selectedMaskSize: { value: [1, 1] },
                selectedMaskOffset: { value: [0, 0] },
                viewportWidth: { value: canvasStore.state.viewWidth },
                viewportHeight: { value: canvasStore.state.viewHeight },
                inverseProjectionMatrix: { value: threejsCamera.projectionMatrixInverse.elements },
            },
        });
        const threejsSelectionMask = new Mesh(selectionMaskGeometry, selectionMaskMaterial);
        threejsSelectionMask.renderOrder = 9999999999999;
        threejsSelectionMask.position.z = 0.2;
        threejsSelectionMask.frustumCulled = false;
        threejsSelectionMask.visible = false;
        threejsScene.add(threejsSelectionMask);
        canvasStore.set('threejsSelectionMask', markRaw(threejsSelectionMask) as never);

        await updateThreejsCanvasMargin(workingFileWidth, workingFileHeight);

        threejsComposer = new EffectComposer(threejsRenderer);
        createLayerPasses(threejsComposer, threejsCamera);
        canvasStore.set('threejsComposer', markRaw(threejsComposer));

        canvasStore.set('renderer', 'webgl');
        updateThreejsImageSize(
            workingFileStore.state.width, workingFileStore.state.height,
            canvasStore.state.viewWidth, canvasStore.state.viewHeight,
        );

        options.canvas.value?.addEventListener('webglcontextrestored', () => {
            for (const layer of workingFileStore.state.layers) {
                layer.renderer.onContextRestored(threejsRenderer);
            }
        });

        renderCanvas();
        ctx.value = threejsRenderer.context;
    }

    function renderCanvas() {
        if (!Matrix4 || !threejsCamera) return;
        let cameraTransform: DOMMatrix;
        if (canvasStore.get('useCssViewport')) {
            cameraTransform = new DOMMatrix().inverse().translate(0, 0, 1);
        } else {
            cameraTransform = canvasStore.get('transform').inverse().translate(0, 0, 1);
        }
        const matrix = new Matrix4();
        matrix.set(
            cameraTransform.m11, cameraTransform.m21, cameraTransform.m31, cameraTransform.m41,
            cameraTransform.m12, cameraTransform.m22, cameraTransform.m32, cameraTransform.m42,
            cameraTransform.m13, cameraTransform.m23, cameraTransform.m33, cameraTransform.m43,
            cameraTransform.m14, cameraTransform.m24, cameraTransform.m34, cameraTransform.m44
        );
        threejsCamera.matrix = matrix;
        threejsCamera.updateMatrixWorld(true);
        threejsCamera.updateProjectionMatrix();
        drawWorkingFileToCanvasWebgl(threejsComposer, threejsRenderer, threejsScene, threejsCamera, { isEditorPreview: true });
        renderCanvasCallback();
    }

    async function updateRendererForDirtyViewport() {}

    // Updates the canvas empty space geometry size (it hides objects outside canvas bounds)
    async function updateThreejsCanvasMargin(imageWidth: number, imageHeight: number) {
        let refreshLayerPasses: typeof RefreshLayerPasses;
        let BufferGeometry: ClassType<BufferGeometry>;
        let BufferAttribute: ClassType<BufferAttribute>;
        let MeshBasicMaterial: ClassType<MeshBasicMaterial>;
        let Mesh: ClassType<Mesh>;
        let CustomBlending: Blending;
        let ZeroFactor: BlendingDstFactor;
        let OneFactor: BlendingDstFactor;

        [
            { refreshLayerPasses },
            { BufferGeometry },
            { BufferAttribute },
            { MeshBasicMaterial },
            { Mesh },
            { CustomBlending, ZeroFactor, OneFactor },
        ] = await Promise.all([
            import('@/canvas/renderers/webgl/postprocessing/create-layer-passes'),
            import('three/src/core/BufferGeometry'),
            import('three/src/core/BufferAttribute'),
            import('three/src/materials/MeshBasicMaterial'),
            import('three/src/objects/Mesh'),
            import('three/src/constants'),
        ]);

        const threejsScene = canvasStore.get('threejsScene');
        if (!threejsScene) return;
        const existingThreejsCanvasMargin = canvasStore.get('threejsCanvasMargin');
        if (existingThreejsCanvasMargin) {
            threejsScene.remove(existingThreejsCanvasMargin);
            existingThreejsCanvasMargin.geometry.dispose();
        }
        const canvasMarginGeometry = new BufferGeometry();
        const marginSize = Math.max(imageWidth, imageHeight) * 10;
        const z = 0.5;
        const vertices = new Float32Array([
            -marginSize, -marginSize, z,
            0.0, imageHeight + marginSize, z,
            0.0, -marginSize, z,

            -marginSize, -marginSize, z,
            -marginSize, imageHeight + marginSize, z,
            0.0, imageHeight + marginSize, z,

            imageWidth, -marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, -marginSize, z,

            imageWidth, -marginSize, z,
            imageWidth, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,

            -marginSize, -marginSize, z,
            -marginSize, 0.0, z,
            imageWidth + marginSize, 0.0, z,

            -marginSize, -marginSize, z,
            imageWidth + marginSize, 0.0, z,
            imageWidth + marginSize, -marginSize, z,

            -marginSize, imageHeight, z,
            -marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,

            -marginSize, imageHeight, z,
            imageWidth + marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight, z,
        ]);
        canvasMarginGeometry.setAttribute('position', new BufferAttribute(vertices, 3));
        const canvasMarginMaterial = new MeshBasicMaterial({
            color: 0x000000,
            alphaTest: -1,
            opacity: 0,
            transparent: true,
            depthTest: false,
            blending: CustomBlending,
            blendDst: ZeroFactor,
            blendSrc: OneFactor
        });
        const threejsCanvasMargin = new Mesh(canvasMarginGeometry, canvasMarginMaterial);
        threejsScene.add(threejsCanvasMargin);
        threejsCanvasMargin.renderOrder = 9999;
        canvasStore.set('threejsCanvasMargin', markRaw(threejsCanvasMargin));

        refreshLayerPasses();
    }

    // Update for threejs scene when image size is adjusted.
    async function updateThreejsImageSize(imageWidth: number, imageHeight: number, canvasWidth: number, canvasHeight: number) {
        let width = canvasWidth;
        let height = canvasHeight;
        if (canvasStore.state.useCssViewport) {
            width = imageWidth;
            height = imageHeight;
        }
        const threejsRenderer = canvasStore.get('threejsRenderer');
        const threejsComposer = canvasStore.get('threejsComposer');
        const threejsCamera = canvasStore.get('threejsCamera');
        if (threejsRenderer) {
            threejsRenderer.setSize(width, height, true);
        }
        if (threejsComposer) {
            threejsComposer.setSize(width, height);
        }
        if (threejsCamera) {
            threejsCamera.left = 0;
            threejsCamera.right = width;
            threejsCamera.top = 0;
            threejsCamera.bottom = height;
            threejsCamera.updateProjectionMatrix();
        }
    }

    return {
        ctx,
        initializeRenderer,
        renderCanvas,
        updateRendererForDirtyViewport,

        // Unused, for compatibility with the output of the canvas 2d composable.
        selectionMaskCanvas,
    };
}

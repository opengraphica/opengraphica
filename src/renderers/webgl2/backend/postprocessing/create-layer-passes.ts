// import canvasStore from '@/store/canvas';
// import workingFileStore from '@/store/working-file';

// import { messageBus } from '@/renderers/webgl2/backend';

// import { Scene } from 'three/src/scenes/Scene';
// import { RenderPass } from './render-pass';
// import { ShaderPass } from './shader-pass';
// import { GammaCorrectionShader } from './gamma-correction-shader';

// import type { Camera } from 'three';
// import type { EffectComposer } from './effect-composer';
// import type { WorkingFileGroupLayer, WorkingFileLayer, WorkingFileLayerBlendingMode } from '@/types';

// const noRenderPassModes = new Set(['normal', 'erase']);

// export function createLayerPasses(composer: EffectComposer, camera: Camera) {
//     composer.disposeAllPasses();

//     let passScenes: Array<Scene> = [];

//     const background = canvasStore.get('threejsBackground');
//     if (background) {
//         const backgroundScene = new Scene();
//         backgroundScene.add(background);
//         passScenes.push(backgroundScene);
//     }

//     let currentScene = new Scene();
//     let currentSceneIsUsed = false;

//     const stack: Array<WorkingFileLayer> = [
//         { type: 'group', layers: workingFileStore.get('layers') } as WorkingFileGroupLayer,
//     ];
//     while (stack.length > 0) {
//         const layer = stack.pop()!;
//         if (layer.type === 'group') {
//             for (const childLayer of (layer as WorkingFileGroupLayer).layers) {
//                 stack.unshift(childLayer);
//             }    
//         }
//         if (layer.renderer) {
//             if (!noRenderPassModes.has(layer.blendingMode)) {
//                 if (currentSceneIsUsed) {
//                     passScenes.push(currentScene);
//                     currentScene = new Scene();
//                     currentSceneIsUsed = false;
//                 }
//             }
//             layer.renderer.swapScene(currentScene);
//             currentSceneIsUsed = true;
//         }
//     }
//     if (currentSceneIsUsed) {
//         passScenes.push(currentScene);
//         currentScene = new Scene();
//         currentSceneIsUsed = false;
//     }

//     const selectionMask = canvasStore.get('threejsSelectionMask');
//     if (selectionMask) {
//         passScenes[passScenes.length - 1].add(selectionMask);
//     }
//     const canvasMargin = canvasStore.get('threejsCanvasMargin');
//     if (canvasMargin) {
//         passScenes[passScenes.length - 1].add(canvasMargin);
//     }

//     let isFirstPass = true;
//     for (const scene of passScenes) {
//         const renderPass = new RenderPass(scene, camera);
//         renderPass.isFirstPass = isFirstPass;
//         if (isFirstPass) isFirstPass = false;
//         composer.addPass(renderPass);
//     }

//     composer.addPass(new ShaderPass(GammaCorrectionShader));
//     canvasStore.set('dirty', true);
// }

// let queueRefreshLayerPassesTimeoutHandle: number | undefined;

// export function queueRefreshLayerPasses() {
//     window.clearTimeout(queueRefreshLayerPassesTimeoutHandle);
//     queueRefreshLayerPassesTimeoutHandle = window.setTimeout(refreshLayerPasses, 0);
// }

// export function refreshLayerPasses() {
//     const composer = canvasStore.get('threejsComposer');
//     const camera = canvasStore.get('threejsCamera');
//     if (!composer || !camera) return;
//     createLayerPasses(composer, camera);
// }

// export function needsBufferTextureUpdate(blendingMode: WorkingFileLayerBlendingMode) {
//     return !noRenderPassModes.has(blendingMode);
// }

// appEmitter.on('app.workingFile.layerOrderCalculated', () => {
//     refreshLayerPasses();
// });

// appEmitter.on('editor.history.step', (event) => {
//     if (!event) return;
//     if (event.action.id === 'updateLayerBlendingMode') {
//         refreshLayerPasses();
//     }
// });

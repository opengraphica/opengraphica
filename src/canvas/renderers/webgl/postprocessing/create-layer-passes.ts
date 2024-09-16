import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import { Scene } from 'three/src/scenes/Scene';
import { RenderPass } from '@/canvas/renderers/webgl/postprocessing/render-pass';
import { ShaderPass } from '@/canvas/renderers/webgl/postprocessing/shader-pass';
import { GammaCorrectionShader } from '@/canvas/renderers/webgl/shaders/gamma-correction-shader';

import type { Camera } from 'three';
import type { EffectComposer } from './effect-composer';
import type { WorkingFileGroupLayer, WorkingFileLayer } from '@/types';

const noRenderPassModes = new Set(['normal', 'erase']);

export function createLayerPasses(composer: EffectComposer, camera: Camera) {
    composer.disposeAllPasses();

    let passScenes: Array<Scene> = [];

    const background = canvasStore.get('threejsBackground');
    if (background) {
        const backgroundScene = new Scene();
        backgroundScene.add(background);
        passScenes.push(backgroundScene);
    }

    let currentScene = new Scene();
    let currentSceneIsUsed = false;

    const stack: Array<WorkingFileLayer> = [
        { type: 'group', layers: workingFileStore.get('layers') } as WorkingFileGroupLayer,
    ];
    while (stack.length > 0) {
        const layer = stack.pop()!;
        if (layer.type === 'group') {
            for (const childLayer of (layer as WorkingFileGroupLayer).layers) {
                stack.unshift(childLayer);
            }    
        }
        if (layer.renderer) {
            if (!noRenderPassModes.has(layer.blendingMode)) {
                if (currentSceneIsUsed) {
                    passScenes.push(currentScene);
                    currentScene = new Scene();
                    currentSceneIsUsed = false;
                }
            }
            layer.renderer.swapScene(currentScene);
            currentSceneIsUsed = true;
        }
    }
    if (currentSceneIsUsed) {
        passScenes.push(currentScene);
        currentScene = new Scene();
        currentSceneIsUsed = false;
    }

    const selectionMask = canvasStore.get('threejsSelectionMask');
    if (selectionMask) {
        passScenes[passScenes.length - 1].add(selectionMask);
    }

    let isFirstPass = true;
    for (const scene of passScenes) {
        const renderPass = new RenderPass(scene, camera);
        renderPass.isFirstPass = isFirstPass;
        if (isFirstPass) isFirstPass = false;
        composer.addPass(renderPass);
    }

    composer.addPass(new ShaderPass(GammaCorrectionShader));
    canvasStore.set('dirty', true);
}

export function refreshLayerPasses() {
    const composer = canvasStore.get('threejsComposer');
    const camera = canvasStore.get('threejsCamera');
    if (!composer || !camera) return;
    createLayerPasses(composer, camera);
}

appEmitter.on('app.workingFile.layerOrderCalculated', () => {
    refreshLayerPasses();
});

appEmitter.on('editor.history.step', (event) => {
    if (!event) return;
    if (event.action.id === 'updateLayerBlendingMode') {
        refreshLayerPasses();
    }
});

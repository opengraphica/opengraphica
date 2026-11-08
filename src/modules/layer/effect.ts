import { watch } from 'vue';

import editorStore from "@/store/editor";

import { effectEmitter, isToolbarVisible as isEffectToolbarVisible } from '@/tools/store/effect-state';

interface EffectEditOptions {
    layerId: number;
    filterIndex: number;
    isFilterJustAdded?: boolean;
}

export async function editEffect(options: EffectEditOptions) {
    await editorStore.dispatch('setActiveTool', { group: 'effect', tool: 'effect' });
    if (isEffectToolbarVisible.value) {
        effectEmitter.emit('editFilter', { layerId: options.layerId, filterIndex: options.filterIndex });
    } else {
        watch(() => isEffectToolbarVisible.value, () => {
            effectEmitter.emit('editFilter', { layerId: options.layerId, filterIndex: options.filterIndex });
        }, { once: true });
    }
}

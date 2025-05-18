import { computed } from 'vue';

import defaultBrushDefinitions from '@/config/default-brushes.json';
import { PerformantStore } from '@/store/performant-store';

import type { BrushCategoryWithBrushes, BrushDefinition, WithRequiredProperty } from '@/types';

interface PermanentStorageState {
    customBrushes: BrushDefinition[];
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'brushLibraryStore',
    state: {
        customBrushes: [],
    },
    restore: ['customBrushes'],
});

const customBrushes = permanentStorage.getDeepWritableRef('customBrushes');

function createBrushDefaults(brushDefinition: Partial<BrushDefinition>) {
    brushDefinition.shape = brushDefinition.shape ?? 'M 1,0.5 A 0.5,0.5 0 0 1 0.5,1 0.5,0.5 0 0 1 0,0.5 0.5,0.5 0 0 1 0.5,0 0.5,0.5 0 0 1 1,0.5 Z';
    brushDefinition.spacing = brushDefinition.spacing ?? 0.05;
    brushDefinition.jitter = brushDefinition.jitter ?? 0;
    brushDefinition.angle = brushDefinition.angle ?? 0;
    brushDefinition.pressureTaperStart = brushDefinition.pressureTaperStart ?? 0;
    brushDefinition.pressureTaperEnd = brushDefinition.pressureTaperEnd ?? 0;
    brushDefinition.pressureMinSize = brushDefinition.pressureMinSize ?? 0;
    brushDefinition.pressureMinDensity = brushDefinition.pressureMinDensity ?? 1;
    brushDefinition.pressureMaxDensity = brushDefinition.pressureMaxDensity ?? 1;
    brushDefinition.colorBlendingFactor = brushDefinition.colorBlendingFactor ?? 0;
    brushDefinition.colorBlendingPersistence = brushDefinition.colorBlendingPersistence ?? 0;
    brushDefinition.alphaBlendingFactor = brushDefinition.alphaBlendingFactor ?? 1;
}

export const brushesByCategory = computed(() => {
    let encounteredIds = new Set<string>();
    let categories: Record<string, BrushDefinition[]> = {};
    let brushDefinition: WithRequiredProperty<Partial<BrushDefinition>, 'id' | 'categories'>;
    for (brushDefinition of customBrushes.value) {
        for (let categoryId of brushDefinition.categories) {
            if (!categories[categoryId]) categories[categoryId] = [];
            if (!encounteredIds.has(brushDefinition.id)) {
                encounteredIds.add(brushDefinition.id);
                categories[categoryId].push(brushDefinition as BrushDefinition);
            }
        }
    }
    for (brushDefinition of defaultBrushDefinitions.brushes) {
        createBrushDefaults(brushDefinition);
        for (let categoryId of brushDefinition.categories) {
            if (!categories[categoryId]) categories[categoryId] = [];
            if (!encounteredIds.has(brushDefinition.id)) {
                encounteredIds.add(brushDefinition.id);
                categories[categoryId].push(brushDefinition as BrushDefinition);
            }
        }
    }
    let sortedCategories: BrushCategoryWithBrushes[] = [];
    for (let category of defaultBrushDefinitions.categories) {
        sortedCategories.push({
            id: category.id,
            icon: category.icon,
            brushes: categories[category.id] ?? [],
        });
    }
    return sortedCategories;
});

export function addCustomBrush(brushDefinition: BrushDefinition) {
    const customBrushIndex = customBrushes.value.findIndex((customBrush) => customBrush.id === brushDefinition.id);
    if (customBrushIndex > -1) {
        customBrushes.value.splice(customBrushIndex, 1, brushDefinition);
    } else {
        customBrushes.value.push(brushDefinition);
    }
}

export function getBrushById(id: string): BrushDefinition | undefined {
    if (id === 'default') {
        const defaultBrush: Partial<BrushDefinition> = {
            id: 'default',
            categories: ['simple'],
        };
        createBrushDefaults(defaultBrush);
        return defaultBrush as BrushDefinition;
    }
    let brushDefinition: WithRequiredProperty<Partial<BrushDefinition>, 'id'>;
    for (brushDefinition of customBrushes.value) {
        if (brushDefinition.id === id) {
            createBrushDefaults(brushDefinition);
            return brushDefinition as BrushDefinition;
        }
    }
    for (brushDefinition of defaultBrushDefinitions.brushes) {
        if (brushDefinition.id === id) {
            createBrushDefaults(brushDefinition);
            return brushDefinition as BrushDefinition;
        }
    }
}

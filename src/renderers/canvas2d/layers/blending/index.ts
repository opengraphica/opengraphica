import { getLayerById } from '@/store/working-file';

import type { WorkingFileLayer, ColorModel } from '@/types';

export function getLayer2dCompositeOperation(layerOrId: WorkingFileLayer<ColorModel> | number): CanvasRenderingContext2D['globalCompositeOperation'] {
    let layer: WorkingFileLayer<ColorModel> | null = null;
    if (typeof layerOrId === 'number') {
        layer = getLayerById(layerOrId);
    } else {
        layer = layerOrId;
    }
    if (!layer) return 'source-over';
    switch (layer.blendingMode) {
        case 'normal':
            return 'source-over';
        case 'erase':
            return 'destination-out';
        case 'lightenOnly': case 'lumaLightenOnly':
            return 'lighten';
        case 'screen':
            return 'screen';
        case 'dodge':
            return 'color-dodge';
        case 'linearDodge': case 'addition':
            return 'lighter';
        case 'darkenOnly': case 'lumaDarkenOnly':
            return 'darken';
        case 'multiply':
            return 'multiply';
        case 'burn': case 'linearBurn':
            return 'color-burn';
        case 'overlay':
            return 'overlay';
        case 'softLight':
            return 'soft-light';
        case 'hardLight': case 'vividLight': case 'linearLight':
            return 'hard-light';
        case 'difference':
            return 'difference';
        case 'exclusion':
            return 'exclusion';
        case 'hue':
            return 'hue';
        case 'chroma':
            return 'saturation';
        case 'color':
            return 'color';
        case 'lightness': case 'luminance':
            return 'luminosity';
        default:
            return 'source-over';
    }
}

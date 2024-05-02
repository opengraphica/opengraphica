import { default as BrushStroke } from './brush-stroke';

import type { DrawableConstructor } from '@/types';

export default {
    brushStroke: BrushStroke,
} as unknown as Record<string, DrawableConstructor>;

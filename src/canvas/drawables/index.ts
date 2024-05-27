import type { DrawableConstructor } from '@/types';

export default {
    brushStroke: async () => (await import(/* webpackChunkName: 'canvas-drawable-brush-stroke' */ './brush-stroke')).default,
    text: async () => (await import(/* webpackChunkName: 'canvas-drawable-text' */ './text')).default,
} as unknown as Record<string, () => Promise<DrawableConstructor>>;

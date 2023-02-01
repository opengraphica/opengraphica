/**
 * This file is used by image-bake.worker.ts
 * It is not imported on the main thread.
 */

import { default as brightness } from './brightness/brightness';
import { default as colorBlindness } from './color-blindness/color-blindness';
import { default as colorCorrection } from './color-correction/color-correction';
import { default as contrast } from './contrast/contrast';
import { default as decreaseColorDepth } from './decrease-color-depth/decrease-color-depth';
import { default as grayscale } from './grayscale/grayscale';
import { default as hueRotate } from './hue-rotate/hue-rotate';
import { default as negative } from './negative/negative';
import { default as saturation } from './saturation/saturation';
import { default as sepia } from './sepia/sepia';

export default {
    brightness,
    colorBlindness,
    colorCorrection,
    contrast,
    decreaseColorDepth,
    grayscale,
    hueRotate,
    negative,
    saturation,
    sepia
};

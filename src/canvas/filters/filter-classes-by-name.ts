/**
 * This file is used by image-bake.worker.ts
 * It is not imported on the main thread.
 */

import { default as brightness } from './brightness/brightness';
import { default as chroma } from './chroma/chroma';
import { default as colorBlindness } from './color-blindness/color-blindness';
import { default as colorCorrection } from './color-correction/color-correction';
import { default as contrast } from './contrast/contrast';
import { default as gaussianBlur } from './gaussian-blur/gaussian-blur';
import { default as grayscale } from './grayscale/grayscale';
import { default as hue } from './hue/hue';
import { default as negative } from './negative/negative';
import { default as saturation } from './saturation/saturation';
import { default as sepia } from './sepia/sepia';

export default {
    brightness,
    chroma,
    colorBlindness,
    colorCorrection,
    contrast,
    gaussianBlur,
    grayscale,
    hue,
    negative,
    saturation,
    sepia
};

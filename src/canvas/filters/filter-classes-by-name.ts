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

import { default as instagram1997 } from './instagram1997/instagram1997';
import { default as instagramAden } from './instagram-aden/instagram-aden';
import { default as instagramClarendon } from './instagram-clarendon/instagram-clarendon';
import { default as instagramGingham } from './instagram-gingham/instagram-gingham';
import { default as instagramInkwell } from './instagram-inkwell/instagram-inkwell';

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
    sepia,

    instagram1997,
    instagramAden,
    instagramClarendon,
    instagramGingham,
    instagramInkwell,
};

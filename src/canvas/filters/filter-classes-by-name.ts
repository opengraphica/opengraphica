/**
 * This file is used by image-bake.worker.ts
 * It is not imported on the main thread.
 */

import { default as brightness } from './brightness/brightness';
import { default as chroma } from './chroma/chroma';
import { default as chromaKey } from './chroma-key/chroma-key';
import { default as colorBlindness } from './color-blindness/color-blindness';
import { default as colorCorrection } from './color-correction/color-correction';
import { default as contrast } from './contrast/contrast';
import { default as gaussianBlur } from './gaussian-blur/gaussian-blur';
import { default as gradientMap } from './gradient-map/gradient-map';
import { default as grayscale } from './grayscale/grayscale';
import { default as hue } from './hue/hue';
import { default as negative } from './negative/negative';
import { default as sepia } from './sepia/sepia';
import { default as whiteBalance } from './white-balance/white-balance';

import { default as instagram1997 } from './instagram1997/instagram1997';
import { default as instagramAden } from './instagram-aden/instagram-aden';
import { default as instagramClarendon } from './instagram-clarendon/instagram-clarendon';
import { default as instagramGingham } from './instagram-gingham/instagram-gingham';
import { default as instagramInkwell } from './instagram-inkwell/instagram-inkwell';
import { default as instagramLofi } from './instagram-lofi/instagram-lofi';
import { default as instagramToaster } from './instagram-toaster/instagram-toaster';
import { default as instagramValencia } from './instagram-valencia/instagram-valencia';
import { default as instagramXpro2 } from './instagram-xpro2/instagram-xpro2';

export default {
    brightness,
    chroma,
    chromaKey,
    colorBlindness,
    colorCorrection,
    contrast,
    gaussianBlur,
    gradientMap,
    grayscale,
    hue,
    negative,
    sepia,
    whiteBalance,

    instagram1997,
    instagramAden,
    instagramClarendon,
    instagramGingham,
    instagramInkwell,
    instagramLofi,
    instagramToaster,
    instagramValencia,
    instagramXpro2,
};

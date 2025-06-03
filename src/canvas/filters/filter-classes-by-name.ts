/**
 * This file is used by image-bake.worker.ts
 * It is not imported on the main thread.
 */

import { default as brightness } from './brightness';
import { default as chroma } from './chroma';
import { default as chromaKey } from './chroma-key';
import { default as colorBlindness } from './color-blindness';
import { default as colorCorrection } from './color-correction';
import { default as contrast } from './contrast';
import { default as gaussianBlur } from './gaussian-blur';
import { default as gradientMap } from './gradient-map';
import { default as grayscale } from './grayscale';
import { default as hue } from './hue';
import { default as negative } from './negative';
import { default as sepia } from './sepia';
import { default as whiteBalance } from './white-balance';

import { default as instagram1997 } from './instagram1997';
import { default as instagramAden } from './instagram-aden';
import { default as instagramClarendon } from './instagram-clarendon';
import { default as instagramGingham } from './instagram-gingham';
import { default as instagramInkwell } from './instagram-inkwell';
import { default as instagramLofi } from './instagram-lofi';
import { default as instagramToaster } from './instagram-toaster';
import { default as instagramValencia } from './instagram-valencia';
import { default as instagramXpro2 } from './instagram-xpro2';

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

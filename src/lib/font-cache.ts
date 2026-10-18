import { parse, type Font } from './opentype';

// TODO - remove this import from this file (1.8MB in web worker)
// Need to create a solution to load the default fonts when hosted on the "file:" protocol (Ubuntu Touch).
import googleWebfonts from '@/config/google-webfonts.json';

import type { FontFamilyFetchDefinition, FontFamilyFetchDefinitionVariant } from '@/types';

export interface CreateFontCacheOptions {
    fetchBaseUrl?: string;
}

export interface FontFamilyFontCache {
    subsets: string[];
    variants: {
        [key: string]: Font;
    };
}

export class FontCache {
    private fetchBaseUrl: string;
    private fontFamilyMap: Map<string, FontFamilyFontCache> = new Map();
    private fontFamilyLoadingPromiseMap: Map<string, Promise<void>> = new Map();
    private fontFetchDefinitions: Record<string, FontFamilyFetchDefinition> = {};
    
    constructor(options?: CreateFontCacheOptions) {
        this.fetchBaseUrl = options?.fetchBaseUrl ?? '';
    }

    public setFontFetchDefinitions(definitions: Record<string, FontFamilyFetchDefinition>) {
        this.fontFetchDefinitions = definitions;
    }

    public isFontFamilyLoaded(family: string): boolean {
        return this.fontFamilyMap.has(family);
    }

    public async waitForFontFamilyLoaded(family: string): Promise<boolean> {
        const fontLoadingPromise = this.fontFamilyLoadingPromiseMap.get(family);
        await fontLoadingPromise;
        return this.fontFamilyMap.has(family);
    }

    public getFontFamily(family: string): FontFamilyFontCache | null {
        return this.fontFamilyMap.get(family) ?? null;
    }

    public getFallbackFontFamilyThatSatisfiesSubset(subset: string): FontFamilyFontCache | null {
        for (const fontFamilyCache of this.fontFamilyMap.values()) {
            if (fontFamilyCache.subsets.includes(subset)) {
                return fontFamilyCache;
            }
        }
        return null;
    }

    public async loadFontFamily(family: string): Promise<FontFamilyFontCache> {
        if (this.fontFamilyMap.has(family)) {
            return this.fontFamilyMap.get(family)!;
        }
        if (this.fontFamilyLoadingPromiseMap.has(family)) {
            await this.fontFamilyLoadingPromiseMap.get(family);
            const cache = this.fontFamilyMap.get(family);
            if (cache) {
                return cache;
            }
        }
        let resolveLoadingPromise = () => {};
        const loadingPromise = new Promise<void>((resolve) => { resolveLoadingPromise = resolve; });
        this.fontFamilyLoadingPromiseMap.set(family, loadingPromise);
        try {
            const fontFamilyDefinition = await this.getFontFamilyDefinition(family);
            const fontFetchPromises: Promise<{ variant: string; font: Font }>[] = [];
            for (const variantName in fontFamilyDefinition.variants) {
                const fileUrl = fontFamilyDefinition.variants[variantName].file;
                const fontUrl = (fileUrl.startsWith('http') ? '' : this.fetchBaseUrl) + fileUrl;
                fontFetchPromises.push(new Promise((resolve, reject) => {
                    fetch(fontUrl).then((result) => {
                        result.arrayBuffer().then((fontArrayBuffer) => {
                            resolve({
                                variant: variantName,
                                font: parse(fontArrayBuffer, { lowMemory: true }),
                            });
                        }).catch((error) => {
                            reject(error);
                        });
                    }).catch((error) => {
                        reject(error);
                    });
                }));
            }
            const fontFetchResult = await Promise.allSettled(fontFetchPromises);
            const cache: FontFamilyFontCache = {
                subsets: fontFamilyDefinition.subsets,
                variants: {},
            };
            for (const fetchResult of fontFetchResult) {
                if (fetchResult.status === 'fulfilled') {
                    const { variant, font } = fetchResult.value;
                    cache.variants[variant] = font;
                }
            }
            this.fontFamilyMap.set(family, cache);
            return cache;
        } catch (error) {
            throw error;
        } finally {
            this.fontFamilyLoadingPromiseMap.delete(family);
            resolveLoadingPromise();
        }
    }

    private async getFontFamilyDefinition(family: string): Promise<FontFamilyFetchDefinition> {
        let definition = this.fontFetchDefinitions[family];
        if (definition && window.location.protocol === 'file:') {
            let isDefaultFont = false;
            for (let variantKey in definition.variants) {
                if (definition.variants[variantKey].file.startsWith('fonts/')) {
                    isDefaultFont = true;
                    break;
                }
            }
            if (isDefaultFont) {
                const googleDefinition = googleWebfonts.items.find((familyDef) => familyDef.family === family);
                if (googleDefinition) {
                    definition = {
                        family: googleDefinition.family,
                        subsets: googleDefinition.subsets,
                        variants: (googleDefinition.variants as string[]).reduce((accumulator, variantKey) => {
                            accumulator[variantKey] = {
                                name: '',
                                file: googleDefinition.files[variantKey],
                            }
                            return accumulator;
                        }, {} as { [key: string]: FontFamilyFetchDefinitionVariant }),
                    };
                }
            }
        }
        if (definition) {
            return definition;
        }
        throw new Error('Definition not found.');
    }
}

const isInWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
const fontCache = new FontCache({
    fetchBaseUrl: isInWorker ? '../../' : ''
});

export default fontCache;

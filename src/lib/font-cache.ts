import { parse, type Font } from 'opentype.js';
import defaultFontFamilies from '@/config/default-font-families.json';

import type { FontFamilyFetchDefinition } from '@/types';

export interface CreateFontCacheOptions {
    fetchBaseUrl?: string;
}

export interface FontFamilyFontCache {
    variants: {
        [key: string]: Font;
    };
}

export class FontCache {
    private fetchBaseUrl: string;
    private fontFamilyMap: Map<string, FontFamilyFontCache> = new Map();
    private fontFamilyLoadingPromiseMap: Map<string, Promise<void>> = new Map();
    
    constructor(options?: CreateFontCacheOptions) {
        this.fetchBaseUrl = options?.fetchBaseUrl ?? '';
    }

    public async isFontFamilyLoaded(family: string): Promise<boolean> {
        const fontLoadingPromise = this.fontFamilyLoadingPromiseMap.get(family);
        await fontLoadingPromise;
        return this.fontFamilyMap.has(family);
    }

    public getFontFamily(family: string): FontFamilyFontCache | null {
        return this.fontFamilyMap.get(family) ?? null;
    }

    public async loadFontFamily(family: string): Promise<FontFamilyFontCache> {
        if (this.fontFamilyMap.has(family)) {
            return this.fontFamilyMap.get(family)!;
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
        const definition = defaultFontFamilies.find((familyDef) => familyDef.family === family);
        if (definition) {
            return definition as unknown as FontFamilyFetchDefinition;
        }
        throw new Error('Definition not found.');
    }
}
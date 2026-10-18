import { computed, ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { updateStoredFontFamily } from '@/store/data/working-file-database';

import type { FontFamilyFetchDefinition } from '@/types';

export interface CreateStoredFont {
    family: string;
    subsets: string[];
    variants: {
        [key: string]: Blob;
    }
}

const fontUuidMap = ref<Map<string | undefined, FontFamilyFetchDefinition>>(new Map());
const fontUserUuidMap = new Map<string, Set<string>>();

export function generateFontVariantName(variant: string) {
    switch (variant) {
        case '100': return 'Thin';
        case '100italic': return 'Thin Italic';
        case '200': return 'Extra Light';
        case '200italic': return 'Extra Light Italic';
        case '300': return 'Light';
        case '300italic': return 'Light Italic';
        case '400': case 'regular': return 'Regular';
        case '400italic': case 'italic': return 'Italic';
        case '500': return 'Medium';
        case '500italic': return 'Medium Italic';
        case '600': return 'Semi Bold';
        case '600italic': return 'Semi Bold Italic';
        case '700': return 'Bold';
        case '700italic': return 'Bold Italic';
        case '800': return 'Extra Bold';
        case '800italic': return 'Extra Bold Italic';
        case '900': return 'Black';
        case '900italic': return 'Black Italic';
    }
    return '';
}

/**
 * Creates a stored font from the font file blobs for each variant.
 * @param storedFontBlobs - Object that contains multiple blob references.
 * @returns uuid that can be used to retrieve it later
 */
export async function createStoredFont(storedFontBlobs: CreateStoredFont) {
    let existingStoredFont: FontFamilyFetchDefinition | undefined;
    let existingStoredFontUuid: string | undefined;
    for (const [uuid, definition] of fontUuidMap.value) {
        if (definition.family === storedFontBlobs.family) {
            existingStoredFont = definition;
            existingStoredFontUuid = uuid;
            break;
        }
    }
    if (existingStoredFont && existingStoredFontUuid) {
        for (const variantKey in storedFontBlobs.variants) {
            if (existingStoredFont.variants[variantKey]) {
                URL.revokeObjectURL(existingStoredFont.variants[variantKey].file);
            }
            existingStoredFont.variants[variantKey] = {
                name: generateFontVariantName(variantKey),
                file: URL.createObjectURL(storedFontBlobs.variants[variantKey]),
            };
        }
        updateStoredFontFamily(existingStoredFont);
        return existingStoredFontUuid;
    } else {
        const storedFont: FontFamilyFetchDefinition = {
            family: storedFontBlobs.family,
            subsets: storedFontBlobs.subsets.slice(),
            variants: {},
        }
        for (const variantKey in storedFontBlobs.variants) {
            storedFont.variants[variantKey] = {
                name: generateFontVariantName(variantKey),
                file: URL.createObjectURL(storedFontBlobs.variants[variantKey]),
            };
        }
        const uuid = uuidv4();
        fontUuidMap.value.set(uuid, storedFont);
        updateStoredFontFamily(storedFont);
        return uuid;
    }
}

/**
 * Returns the font definition which includes fetch URLs.
 * @param uuid - ID of the database entry for the font
 * @returns The font definition, or null if somehow it doesn't exist
 */
export function getStoredFont(uuid?: string): FontFamilyFetchDefinition | null {
    return fontUuidMap.value.get(uuid) ?? null;
}

/**
 * Retrieves all stored font definitions mapped by font family name as the key
 */
export const allStoredFontsByFamily = computed(() => {
    const storedFontsByFamily: Record<string, FontFamilyFetchDefinition> = {};
    for (const definition of fontUuidMap.value.values()) {
        storedFontsByFamily[definition.family] = definition;
    }
    return storedFontsByFamily;
});

/**
 * Releases the stored font from memory, and from the database.
 * @param uuid - ID of the database entry for the font
 */
export async function deleteStoredFont(uuid?: string) {
    const storedFont = fontUuidMap.value.get(uuid);
    if (!storedFont) return;
    fontUuidMap.value.delete(uuid);
    for (const variantKey in storedFont.variants) {
        URL.revokeObjectURL(storedFont.variants[variantKey].file);
    }
}

/**
 * Releases all stored fonts from memory.
 */
export async function deleteAllStoredFonts() {
    for (const storedFont of fontUuidMap.value.values()) {
        for (const variantKey in storedFont.variants) {
            URL.revokeObjectURL(storedFont.variants[variantKey].file);
        }
    }
    fontUuidMap.value.clear();
}

/**
 * Adds to the user count of the stored font, preventing its deletion.
 * @param uuid - ID of the database entry for the font
 */
export function reserveStoredFont(fontUuid: string, userId: string) {
    let users = fontUserUuidMap.get(fontUuid) ?? new Set<string>();
    users.add(userId);
    fontUserUuidMap.set(fontUuid, users);
}

/**
 * Subtracts from the user count of the stored font, allowing its deletion.
 * @param uuid - ID of the database entry for the font
 */
export function unreserveStoredFont(fontUuid: string, userId: string) {
    let users = fontUserUuidMap.get(fontUuid) ?? new Set<string>();
    users.delete(userId);
    fontUserUuidMap.set(fontUuid, users);
    if (users.size === 0) {
        deleteStoredFont(fontUuid);
    }
}

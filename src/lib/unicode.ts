/**
 * Parts of this file are adapted from https://github.com/maxlath/unicode-scripts-finder
 * @license MIT https://github.com/maxlath/unicode-scripts-finder/blob/main/package.json
 */

import scriptRanges from './unicode/script-ranges';

const subsetLookupCache = new Map<number, string[]>();

const lettersPattern = /\p{Alphabetic}+/ug;

export function getScripts(text: string): string[] {
    const textLetters = (text.match(lettersPattern) ?? []).join('');

    const foundScripts = new Set<string>();
    for (let i = 0; i < textLetters.length; i++) {
        const charCode = textLetters.charCodeAt(i);
        const block = findBlock(charCode);
        if (block) {
            const { label } = block;
            foundScripts.add(label);
        }
    }

    return Array.from(foundScripts);
}

export function getSubsets(text: string, mergeWhenMultipleOptions: boolean = false): string[] {
    const foundSubsets = new Set<string>();
    let lookupsWithMultipleSubsets: Array<string[]> = [];
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        let lookupSubsets = subsetLookupCache.get(charCode);
        if (!lookupSubsets) {
            const block = findBlock(charCode);
            if (block) {
                const { subsets } = block;
                lookupSubsets = subsets;
                subsetLookupCache.set(charCode, subsets ?? []);
            }
        }
        if (!lookupSubsets || lookupSubsets.length === 0) continue;
        if (mergeWhenMultipleOptions) {
            if (lookupSubsets.length === 1) {
                foundSubsets.add(lookupSubsets[0]);
            } else if (!lookupsWithMultipleSubsets.includes(lookupSubsets)) {
                lookupsWithMultipleSubsets.push(lookupSubsets);
            }
        } else {
            for (const subset of lookupSubsets) {
                foundSubsets.add(subset);
            }
        }
    }
    for (const multipleSubset of lookupsWithMultipleSubsets) {
        let isAnySubsetExisting = false;
        for (const subset of multipleSubset) {
            if (foundSubsets.has(subset)) {
                isAnySubsetExisting = true;
                break;
            }
        }
        if (!isAnySubsetExisting) {
            foundSubsets.add(multipleSubset[0]);
        }
    }
    return Array.from(foundSubsets);
}

function findBlock(charCode: number) {
    return scriptRanges.find(({ ranges }) => {
        return ranges.find(range => {
            return charCode >= range[0] && charCode <= range[1];
        });
    });
}

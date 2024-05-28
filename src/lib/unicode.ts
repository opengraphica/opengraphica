/**
 * Parts of this file are adapted from https://github.com/maxlath/unicode-scripts-finder
 * @license MIT https://github.com/maxlath/unicode-scripts-finder/blob/main/package.json
 */

import scriptRanges from './unicode/script-ranges';

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

export function getSubsets(text: string): string[] {
    const textLetters = (text.match(lettersPattern) ?? []).join('');

    const foundSubsets = new Set<string>();
    for (let i = 0; i < textLetters.length; i++) {
        const charCode = textLetters.charCodeAt(i);
        const block = findBlock(charCode);
        if (block) {
            const { subsets } = block;
            for (const subset of subsets ?? []) {
                foundSubsets.add(subset);
            }
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

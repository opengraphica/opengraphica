import type { RGBAColor, TextDocumentSpanMeta } from '@/types';

// Default settings for styling text.
// WARNING: changing these values can lead to issues with backwards compatibility.
export const textMetaDefaults: TextDocumentSpanMeta<RGBAColor> = Object.freeze({
     direction: 'ltr',
     family: 'Roboto',
     size: 16,
     variant: 'regular',
     bold: false,
     oblique: false,
     obliqueAngle: 0,
     underline: null,
     underlineColor: null,
     underlineThickness: 1,
     overline: null,
     overlineColor: null,
     overlineThickness: 1,
     strikethrough: null,
     strikethroughColor: null,
     strikethroughThickness: 1,
     fillColor: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' } as RGBAColor,
     stroke1Color: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' } as RGBAColor,
     stroke1Size: 0,
     stroke1IsBehind: true,
     stroke2Color: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' } as RGBAColor,
     stroke2Size: 0,
     stroke2IsBehind: true,
     tracking: 0,
     leading: 0,
});

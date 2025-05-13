/**
 * This file is adapted from https://github.com/maxlath/unicode-scripts-finder
 * @copyright (c) 2020 maxlath
 * @license MIT https://github.com/maxlath/unicode-scripts-finder/blob/main/package.json
 */
// Source: https://en.wikipedia.org/wiki/List_of_Unicode_characters
export default [
    {
        label: 'Latin',
        subsets: ['latin', 'latin-ext'],
        ranges: [
            // Basic Latin
            [0x0020, 0x007f],
            // Latin-1 Supplement
            [0x00a0, 0x00ff],
            // Latin Extended-A
            [0x0100, 0x017f],
            // Latin Extended-B
            [0x0180, 0x024f],
        ],
    },
    {
        label: 'Symbols',
        subsets: ['symbols'],
        ranges: [
            // Enclosed Alphanumeric Supplement
            [0x1f100, 0x1f1ff],
            // Miscellaneous Symbols
            [0x2600, 0x26FF],
            // Alchemical Symbols
            [0x1F700, 0x1F70F],
            // Miscellaneous Technical
            [0x2300, 0x23FF],
            // Enclosed Alphanumerics
            [0x2460, 0x24FF],
            // Arrows
            [0x2190, 0x21FF],
            // Combining Diacritical Marks
            [0x0300, 0x036F],
            // Dingbats
            [0x2700, 0x27BF],
            // Miscellaneous Symbols and Pictographs
            [0x1F300, 0x1F5FF],
        ],
    },
    {
        label: 'Greek',
        subsets: ['greek', 'greek-ext'],
        ranges: [
            // Greek and Coptic
            [0x0370, 0x03ff],
            // Greek Extended
            [0x1f00, 0x1fff],
        ],
    },
    {
        label: 'Cyrillic',
        subsets: ['cyrillic', 'cyrillic-ext'],
        ranges: [
            // Cyrillic
            [0x0400, 0x04ff],
            // Cyrillic Supplement
            [0x0500, 0x052f],
            // Cyrillic Extended-A
            [0x2de0, 0x2dff],
            // Cyrillic Extended-B
            [0xa640, 0xa69f],
            // Cyrillic Extended-C
            [0x1c80, 0x1c8f],
        ],
    },
    {
        label: 'Armenian',
        subsets: ['armenian'],
        ranges: [[0x0530, 0x058f]],
    },
    {
        label: 'Georgian',
        subsets: ['georgian'],
        ranges: [
            // Georgian
            [0x10a0, 0x10ff],
            // Georgian Extended
            [0x1c90, 0x1cbf],
            // Georgian Supplement
            [0x2d00, 0x2d2f],
        ],
    },
    {
        label: 'Coptic',
        subsets: ['coptic'],
        ranges: [[0x2c80, 0x2cff]],
    },
    
    // Semitic languages
    // See https://en.wikipedia.org/wiki/List_of_Unicode_characters#Semitic_languages
    {
        label: 'Arabic',
        subsets: ['arabic'],
        ranges: [
            // Arabic
            [0x0600, 0x06ff],
            // Arabic Supplement
            [0x0750, 0x077f],
            // Arabic Extended-A
            [0x08a0, 0x08ff],
            // Arabic Presentation Forms-A
            [0xfb50, 0xfdff],
            // Arabic Presentation Forms-B
            [0xfe70, 0xfeff],
            // Rumi Numeral Symbols
            [0x10e60, 0x10e7f],
            // Indic Siyaq Numbers
            [0x1ec70, 0x1ecbf],
            // Ottoman Siyaq Numbers
            [0x1ed00, 0x1ed4f],
            // Arabic Mathematical Alphabetic Symbols
            [0x1ee00, 0x1eeff],
        ],
    },
    {
        label: 'Hebrew',
        subsets: ['hebrew'],
        ranges: [
            // Hebrew
            [0x0590, 0x05ff],
            // Alphabetic Presentation Forms
            [0xfb1d, 0xfb4f],
        ],
    },
    {
        label: 'Syriac',
        subsets: ['syriac'],
        ranges: [
            // Syriac
            [0x0700, 0x074f],
            // Syriac Supplement
            [0x0860, 0x086f],
        ],
    },
    {
        label: 'Samaritan',
        subsets: ['samaritan'],
        ranges: [[0x0800, 0x083f]],
    },
    {
        label: 'Mandaic',
        subsets: ['mandaic'],
        ranges: [[0x0840, 0x085f]],
    },
    
    {
        label: 'Thaana',
        subsets: ['thaana'],
        ranges: [[0x0780, 0x07bf]],
    },
    
    // Brahmic scripts
    // See https://en.wikipedia.org/wiki/Brahmic_scripts#Unicode
    {
        label: 'Ahom',
        subsets: ['ahom'],
        ranges: [[0x11700, 0x1173f]],
    },
    {
        label: 'Bali',
        subsets: ['balinese'],
        ranges: [[0x1b00, 0x1b7f]],
    },
    {
        label: 'Batk',
        subsets: ['batak'],
        ranges: [[0x1bc0, 0x1bff]],
    },
    {
        label: 'Tglg',
        subsets: ['tagalog'],
        ranges: [[0x1700, 0x171f]],
    },
    {
        label: 'Beng',
        subsets: ['bengali'],
        ranges: [[0x0980, 0x09ff]],
    },
    {
        label: 'Bhks',
        subsets: ['bhaiksuki'],
        ranges: [[0x11c00, 0x11c6f]],
    },
    {
        label: 'Buhd',
        subsets: ['buhid'],
        ranges: [[0x1740, 0x175f]],
    },
    {
        label: 'Mymr',
        subsets: ['kayah-li', 'chakma'],
        ranges: [
            [0x1000, 0x109f],
            [0xa9e0, 0xa9ff],
            [0xaa60, 0xaa7f],
        ],
    },
    {
        label: 'Cakm',
        subsets: ['chakma'],
        ranges: [[0x11100, 0x1114f]],
    },
    {
        label: 'Cham',
        subsets: ['cham'],
        ranges: [[0xaa00, 0xaa5f]],
    },
    {
        label: 'Deva',
        subsets: ['devanagari'],
        ranges: [
            [0x0900, 0x097f],
            [0xa8e0, 0xa8ff],
        ],
    },
    {
        label: 'Diak',
        subsets: [],
        ranges: [[0x11900, 0x1195f]],
    },
    {
        label: 'Dogr',
        subsets: ['dogra'],
        ranges: [[0x11800, 0x1184f]],
    },
    {
        label: 'Gran',
        subsets: ['grantha'],
        ranges: [[0x11300, 0x1137f]],
    },
    {
        label: 'Gujr',
        subsets: ['gujarati'],
        ranges: [[0x0a80, 0x0aff]],
    },
    {
        label: 'Gong',
        subsets: ['gunjala-gondi'],
        ranges: [[0x11d60, 0x11daf]],
    },
    {
        label: 'Guru',
        subsets: ['gurmukhi'],
        ranges: [[0x0a00, 0x0a7f]],
    },
    {
        label: 'Hano',
        subsets: ['hanunoo'],
        ranges: [[0x1720, 0x173f]],
    },
    {
        label: 'Java',
        subsets: ['javanese'],
        ranges: [[0xa980, 0xa9df]],
    },
    {
        label: 'Kthi',
        subsets: ['kaithi'],
        ranges: [[0x11080, 0x110cf]],
    },
    {
        label: 'Knda',
        subsets: ['kannada'],
        ranges: [[0x0c80, 0x0cff]],
    },
    {
        label: 'Khmr',
        subsets: ['khmer'],
        ranges: [
            [0x1780, 0x17ff],
            [0x19e0, 0x19ff],
        ],
    },
    {
        label: 'Khoj',
        subsets: ['khojki'],
        ranges: [[0x11200, 0x1124f]],
    },
    {
        label: 'Sind',
        subsets: ['khudawadi'],
        ranges: [[0x112b0, 0x112ff]],
    },
    {
        label: 'Laoo',
        subsets: ['lao'],
        ranges: [[0x0e80, 0x0eff]],
    },
    {
        label: 'Lepc',
        subsets: ['lepcha'],
        ranges: [[0x1c00, 0x1c4f]],
    },
    {
        label: 'Limb',
        subsets: ['limbu'],
        ranges: [[0x1900, 0x194f]],
    },
    {
        label: 'Bugi',
        subsets: ['buginese'],
        ranges: [[0x1a00, 0x1a1f]],
    },
    {
        label: 'Mahj',
        subsets: ['mahajani'],
        ranges: [[0x11150, 0x1117f]],
    },
    {
        label: 'Maka',
        subsets: ['makassarese'],
        ranges: [[0x11ee0, 0x11eff]],
    },
    {
        label: 'Mlym',
        subsets: ['malayalam'],
        ranges: [[0x0d00, 0x0d7f]],
    },
    {
        label: 'Marc',
        subsets: ['marchen'],
        ranges: [[0x11c70, 0x11cbf]],
    },
    {
        label: 'Mtei',
        subsets: ['meetei-mayek'],
        ranges: [
            [0xaae0, 0xaaff],
            [0xabc0, 0xabff],
        ],
    },
    {
        label: 'Modi',
        subsets: ['modi'],
        ranges: [[0x11600, 0x1165f]],
    },
    {
        label: 'Mult',
        subsets: ['multani'],
        ranges: [[0x11280, 0x112af]],
    },
    {
        label: 'Nand',
        subsets: ['nandinagari'],
        ranges: [[0x119a0, 0x119ff]],
    },
    {
        label: 'Talu',
        subsets: ['new-tai-lue'],
        ranges: [[0x1980, 0x19df]],
    },
    {
        label: 'Orya',
        subsets: ['oriya'],
        ranges: [[0x0b00, 0x0b7f]],
    },
    {
        label: 'Phag',
        subsets: ['phags-pa'],
        ranges: [[0xa840, 0xa87f]],
    },
    {
        label: 'Newa',
        subsets: ['newa'],
        ranges: [[0x11400, 0x1147f]],
    },
    {
        label: 'Rjng',
        subsets: ['rejang'],
        ranges: [[0xa930, 0xa95f]],
    },
    {
        label: 'Saur',
        subsets: ['saurashtra'],
        ranges: [[0xa880, 0xa8df]],
    },
    {
        label: 'Shrd',
        subsets: ['sharada'],
        ranges: [[0x11180, 0x111df]],
    },
    {
        label: 'Sidd',
        subsets: ['siddham'],
        ranges: [[0x11580, 0x115ff]],
    },
    {
        label: 'Sinh',
        subsets: ['sinhala'],
        ranges: [
            [0x0d80, 0x0dff],
            [0x111e0, 0x111ff],
        ],
    },
    {
        label: 'Sund',
        subsets: ['sundanese'],
        ranges: [
            [0x1b80, 0x1bbf],
            [0x1cc0, 0x1ccf],
        ],
    },
    {
        label: 'Sylo',
        subsets: ['syloti-nagri'],
        ranges: [[0xa800, 0xa82f]],
    },
    {
        label: 'Tagb',
        subsets: ['tagbanwa'],
        ranges: [[0x1760, 0x177f]],
    },
    {
        label: 'Tale',
        subsets: ['tai-le'],
        ranges: [[0x1950, 0x197f]],
    },
    {
        label: 'Lana',
        subsets: ['tai-tham'],
        ranges: [[0x1a20, 0x1aaf]],
    },
    {
        label: 'Tavt',
        subsets: ['tai-viet'],
        ranges: [[0xaa80, 0xaadf]],
    },
    {
        label: 'Takr',
        subsets: ['takri'],
        ranges: [[0x11680, 0x116cf]],
    },
    {
        label: 'Taml',
        subsets: ['tamil'],
        ranges: [
            [0x0b80, 0x0bff],
            [0x11fc0, 0x11fff],
        ],
    },
    {
        label: 'Telu',
        subsets: ['telugu'],
        ranges: [[0x0c00, 0x0c7f]],
    },
    {
        label: 'Thai',
        subsets: ['thai'],
        ranges: [[0x0e00, 0x0e7f]],
    },
    {
        label: 'Tibt',
        subsets: ['tibetan'],
        ranges: [[0x0f00, 0x0fff]],
    },
    {
        label: 'Tirh',
        subsets: ['tirhuta'],
        ranges: [[0x11480, 0x114df]],
    },
    
    // Other south and central Asian writing systems
    {
        label: 'Masaram Gondi',
        subsets: ['masaram-gondi'],
        ranges: [[0x11d00, 0x11d5f]],
    },
    {
        label: 'Mro',
        subsets: ['mro'],
        ranges: [[0x16a40, 0x16a6f]],
    },
    {
        label: 'Sora Sompeng',
        subsets: ['sora-sompeng'],
        ranges: [[0x110d0, 0x110ff]],
    },
    {
        label: 'Warang Citi',
        subsets: ['warang-citi'],
        ranges: [[0x118a0, 0x118ff]],
    },
    
    // African scripts
    {
        label: 'Ethiopic',
        subsets: ['ethiopic'],
        ranges: [
            // Ethiopic
            [0x1200, 0x137f],
            // Ethiopic Supplement
            [0x1380, 0x139f],
            // Ethiopic Extended
            [0x2d80, 0x2ddf],
            // Ethiopic Extended-A
            [0xab00, 0xab2f],
        ],
    },
    {
        label: 'Adlam',
        subsets: ['adlam'],
        ranges: [[0x1e900, 0x1e95f]],
    },
    {
        label: 'Bamum',
        subsets: ['bamum'],
        ranges: [
            // Bamum
            [0xa6a0, 0xa6ff],
            // Bamum Supplement
            [0x16800, 0x16a3f],
        ],
    },
    {
        label: 'Bassa Vah',
        subsets: ['bassa-vah'],
        ranges: [[0x16ad0, 0x16aff]],
    },
    {
        label: 'Medefaidrin',
        subsets: ['medefaidrin'],
        ranges: [[0x16e40, 0x16e9f]],
    },
    {
        label: 'Mende Kikakui',
        subsets: ['mende-kikakui'],
        ranges: [[0x1e800, 0x1e8df]],
    },
    {
        label: 'NKo',
        subsets: ['nko'],
        ranges: [[0x07c0, 0x07ff]],
    },
    {
        label: 'Osmanya',
        subsets: ['osmanya'],
        ranges: [[0x10480, 0x104af]],
    },
    {
        label: 'Ottoman Siyaq Numbers',
        subsets: ['ottoman-siyaq-numbers'],
        ranges: [[0x1ed00, 0x1ed4f]],
    },
    {
        label: 'Tifinagh',
        subsets: ['tifinagh'],
        ranges: [[0x2d30, 0x2d7f]],
    },
    {
        label: 'Vai',
        subsets: ['vai'],
        ranges: [[0xa500, 0xa63f]],
    },
    
    // American scripts
    {
        label: 'Cherokee',
        subsets: ['cherokee'],
        ranges: [
            // Cherokee
            [0x13a0, 0x13ff],
            // Cherokee Supplement
            [0xab70, 0xabbf],
        ],
    },
    {
        label: 'Deseret',
        subsets: ['deseret'],
        ranges: [[0x10400, 0x1044f]],
    },
    {
        label: 'Osage',
        subsets: ['osage'],
        ranges: [[0x104b0, 0x104ff]],
    },
    {
        label: 'Unified Canadian Aboriginal Syllabics',
        subsets: ['canadian-aboriginal'],
        ranges: [
            // Unified Canadian Aboriginal Syllabics
            [0x1400, 0x167f],
            // Unified Canadian Aboriginal Syllabics Extended
            [0x18b0, 0x18ff],
        ],
    },
    {
        label: 'Aboriginal Syllabics',
        subsets: ['canadian-aboriginal'],
        ranges: [[0x18b0, 0x18ff]],
    },
    
    {
        label: 'Mongolian',
        subsets: ['mongolian'],
        ranges: [
            // Mongolian
            [0x1800, 0x18af],
            // Mongolian Supplement
            [0x11660, 0x1167f],
        ],
    },
    
    // East Asian
    {
        label: 'Bopomofo',
        subsets: ['chinese-simplified', 'chinese-traditional'],
        ranges: [
            // Bopomofo
            [0x3100, 0x312f],
            // Bopomofo Extended
            [0x31a0, 0x31bf],
        ],
    },
    {
        label: 'CJK',
        subsets: ['chinese-simplified', 'chinese-traditional', 'japanese', 'korean'],
        ranges: [
            // CJK Unified Ideographs
            [0x4e00, 0x9fff],
            // CJK Unified Ideographs Extension A
            [0x3400, 0x4dbf],
            // CJK Unified Ideographs Extension B
            [0x20000, 0x2a6df],
            // CJK Unified Ideographs Extension C
            [0x2a700, 0x2b73f],
            // CJK Unified Ideographs Extension D
            [0x2b740, 0x2b81f],
            // CJK Unified Ideographs Extension E
            [0x2b820, 0x2ceaf],
            // CJK Unified Ideographs Extension F
            [0x2ceb0, 0x2ebef],
            // CJK Unified Ideographs Extension G
            [0x30000, 0x3134f],
            // CJK Compatibility Ideographs
            [0xf900, 0xfaff],
            // CJK Compatibility
            [0x3300, 0x33ff],
            // CJK Compatibility Forms
            [0xfe30, 0xfe4f],
            // CJK Compatibility Ideographs
            [0xf900, 0xfaff],
            // CJK Compatibility Ideographs Supplement
            [0x2f800, 0x2fa1f],
            // Enclosed CJK Letters and Months
            [0x3200, 0x32ff],
            // Kangxi Radicals
            [0x2f00, 0x2fdf],
            // Vertical Forms
            [0xfe10, 0xfe1f],
            // Yi Syllables
            [0xa000, 0xa48f],
            // Yi Radicals
            [0xa490, 0xa4cf],
            // Yijing Hexagram Symbols
            [0x4dc0, 0x4dff],
            // Halfwidth and Fullwidth Forms
            [0xff00, 0xffef],
            // Tai Xuan Jing Symbols
            [0x1d300, 0x1d35f],
            // Counting Rod Numerals
            [0x1d360, 0x1d37f],
            // Enclosed Ideographic Supplement
            [0x1f200, 0x1f2ff],
            // Ideographic Description Characters
            [0x2ff0, 0x2fff],
            // Ideographic Symbols and Punctuation
            [0x16fe0, 0x16fff],
            // Kanbun
            [0x3190, 0x319f],
            // Khitan small script
            [0x18b00, 0x18cff],
        ],
    },
    {
        label: 'Hangul',
        subsets: ['korean'],
        ranges: [
            // Hangul Syllables
            [0xac00, 0xd7a3],
            // Hangul Jamo
            [0x1100, 0x11ff],
            // Hangul Compatibility Jamo
            [0x3130, 0x318f],
            // Hangul Jamo Extended-A
            [0xa960, 0xa97f],
            // Hangul Jamo Extended-B
            [0xd7b0, 0xd7ff],
        ],
    },
    {
        label: 'Kana',
        subsets: ['japanese'],
        ranges: [
            // Hiragana
            [0x3040, 0x309f],
            // Katakana
            [0x30a0, 0x30ff],
            // Kana Extended-A
            [0x1b100, 0x1b12f],
            // Kana Supplement
            [0x1b000, 0x1b0ff],
            // Katakana Phonetic Extensions
            [0x31f0, 0x31ff],
            // Small Kana Extension
            [0x1b130, 0x1b16f],
        ],
    },
    {
        label: 'Lisu',
        subsets: ['lisu'],
        ranges: [
            // Lisu
            [0xa4d0, 0xa4ff],
            // Lisu Supplement
            [0x11fb0, 0x11fbf],
        ],
    },
    {
        label: 'Miao',
        subsets: ['miao'],
        ranges: [[0x16f00, 0x16f9f]],
    },
    {
        label: 'Nushu',
        subsets: ['nushu'],
        ranges: [[0x1b170, 0x1b2ff]],
    },
    {
        label: 'Nyiakeng Puachue Hmong',
        subsets: ['nyiakeng-puachue-hmong'],
        ranges: [[0x1e100, 0x1e14f]],
    },
    {
        label: 'Tangut',
        subsets: ['tangut'],
        ranges: [
            // Tangut
            [0x17000, 0x187ff],
            // Tangut Components
            [0x18800, 0x18aff],
            // Tangut Supplement
            [0x18d00, 0x18d8f],
        ],
    },
    {
        label: 'Wancho',
        subsets: ['wancho'],
        ranges: [[0x1e2c0, 0x1e2ff]],
    },
    
    // Southeast Asian
    {
        label: 'Hanifi Rohingya',
        subsets: ['hanifi-rohingya'],
        ranges: [[0x10d00, 0x10d3f]],
    },
    {
        label: 'Kayah Li',
        subsets: ['kayah-li'],
        ranges: [[0xa900, 0xa92f]],
    },
    {
        label: 'Pahawh Hmong',
        subsets: ['pahawh-hmong'],
        ranges: [[0x16b00, 0x16b8f]],
    },
    {
        label: 'Pau Cin Hau',
        subsets: ['pau-cin-hau'],
        ranges: [[0x11ac0, 0x11aff]],
    },
    {
        label: 'Meetei Mayek',
        subsets: ['meetei-mayek'],
        ranges: [[0xabc0, 0xabff]],
    },
    
    // Ancient and historic scripts
    {
        label: 'Aegean Numbers',
        subsets: ['cypro-minoan'],
        ranges: [[0x10100, 0x1013f]],
    },
    {
        label: 'Anatolian Hieroglyphs',
        ranges: [[0x14400, 0x1467f]],
    },
    {
        label: 'Ancient Greek Numbers',
        ranges: [[0x10140, 0x1018f]],
    },
    {
        label: 'Ancient Symbols',
        ranges: [[0x10190, 0x101cf]],
    },
    {
        label: 'Avestan',
        ranges: [[0x10b00, 0x10b3f]],
    },
    {
        label: 'Carian',
        ranges: [[0x102a0, 0x102df]],
    },
    {
        label: 'Caucasian Albanian',
        ranges: [[0x10530, 0x1056f]],
    },
    {
        label: 'Chorasmian',
        ranges: [[0x10fb0, 0x10fdf]],
    },
    {
        label: 'Cuneiform',
        ranges: [[0x12000, 0x123ff]],
    },
    {
        label: 'Cuneiform Numbers and Punctuation',
        ranges: [[0x12400, 0x1247f]],
    },
    {
        label: 'Cypriot Syllabary',
        ranges: [[0x10800, 0x1083f]],
    },
    {
        label: 'Early Dynastic Cuneiform',
        ranges: [[0x12480, 0x1254f]],
    },
    {
        label: 'Egyptian Hieroglyph Format Controls',
        ranges: [[0x13430, 0x1343f]],
    },
    {
        label: 'Egyptian Hieroglyphs',
        ranges: [[0x13000, 0x1342f]],
    },
    {
        label: 'Elbasan',
        ranges: [[0x10500, 0x1052f]],
    },
    {
        label: 'Elymaic',
        ranges: [[0x10fe0, 0x10fff]],
    },
    {
        label: 'Glagolitic',
        ranges: [[0x2c00, 0x2c5f]],
    },
    {
        label: 'Glagolitic Supplement',
        ranges: [[0x1e000, 0x1e02f]],
    },
    {
        label: 'Gothic',
        ranges: [[0x10330, 0x1034f]],
    },
    {
        label: 'Hatran',
        ranges: [[0x108e0, 0x108ff]],
    },
    {
        label: 'Imperial Aramaic',
        ranges: [[0x10840, 0x1085f]],
    },
    {
        label: 'Indic Siyaq Numbers',
        ranges: [[0x1ec70, 0x1ecbf]],
    },
    {
        label: 'Inscriptional Pahlavi',
        ranges: [[0x10b60, 0x10b7f]],
    },
    {
        label: 'Inscriptional Parthian',
        ranges: [[0x10b40, 0x10b5f]],
    },
    {
        label: 'Kharoshthi',
        ranges: [[0x10a00, 0x10a5f]],
    },
    {
        label: 'Linear A',
        ranges: [[0x10600, 0x1077f]],
    },
    {
        label: 'Linear B Ideograms',
        ranges: [[0x10080, 0x100ff]],
    },
    {
        label: 'Linear B Syllabary',
        ranges: [[0x10000, 0x1007f]],
    },
    {
        label: 'Lycian',
        ranges: [[0x10280, 0x1029f]],
    },
    {
        label: 'Lydian',
        ranges: [[0x10920, 0x1093f]],
    },
    {
        label: 'Manichaean',
        ranges: [[0x10ac0, 0x10aff]],
    },
    {
        label: 'Mayan Numerals',
        ranges: [[0x1d2e0, 0x1d2ff]],
    },
    {
        label: 'Meroitic Cursive',
        ranges: [[0x109a0, 0x109ff]],
    },
    {
        label: 'Meroitic Hieroglyphs',
        ranges: [[0x10980, 0x1099f]],
    },
    {
        label: 'Nabataean',
        ranges: [[0x10880, 0x108af]],
    },
    {
        label: 'Nandinagari',
        ranges: [[0x119a0, 0x119ff]],
    },
    {
        label: 'Ogham',
        ranges: [[0x1680, 0x169f]],
    },
    {
        label: 'Old Hungarian',
        ranges: [[0x10c80, 0x10cff]],
    },
    {
        label: 'Old Italic',
        ranges: [[0x10300, 0x1032f]],
    },
    {
        label: 'Old North Arabian',
        ranges: [[0x10a80, 0x10a9f]],
    },
    {
        label: 'Old Permic',
        ranges: [[0x10350, 0x1037f]],
    },
    {
        label: 'Old Persian',
        ranges: [[0x103a0, 0x103df]],
    },
    {
        label: 'Old Sogdian',
        ranges: [[0x10f00, 0x10f2f]],
    },
    {
        label: 'Old South Arabian',
        ranges: [[0x10a60, 0x10a7f]],
    },
    {
        label: 'Old Turkic',
        ranges: [[0x10c00, 0x10c4f]],
    },
    {
        label: 'Palmyrene',
        ranges: [[0x10860, 0x1087f]],
    },
    {
        label: 'Phaistos Disc',
        ranges: [[0x101d0, 0x101ff]],
    },
    {
        label: 'Phoenician',
        ranges: [[0x10900, 0x1091f]],
    },
    {
        label: 'Psalter Pahlavi',
        ranges: [[0x10b80, 0x10baf]],
    },
    {
        label: 'Runic',
        ranges: [[0x16a0, 0x16ff]],
    },
    {
        label: 'Sogdian',
        ranges: [[0x10f30, 0x10f6f]],
    },
    {
        label: 'Soyombo',
        ranges: [[0x11a50, 0x11aaf]],
    },
    {
        label: 'Ugaritic',
        ranges: [[0x10380, 0x1039f]],
    },
    {
        label: 'Yezidi',
        ranges: [[0x11900, 0x1195f]],
    },
    {
        label: 'Zanabazar Square',
        ranges: [[0x11a00, 0x11a4f]],
    },
    
    // Misc
    {
        label: 'Shavian',
        subsets: ['shavian'],
        ranges: [[0x10450, 0x1047f]],
    },
    {
        label: 'Braille Patterns',
        subsets: ['braille'],
        ranges: [[0x2800, 0x28ff]],
    },
    {
        label: 'Music',
        subsets: ['music'],
        ranges: [
            // Musical Symbols
            [0x1d100, 0x1d1ff],
            // Byzantine Musical Symbols
            [0x1d000, 0x1d0ff],
            // Ancient Greek Musical Notation
            [0x1d200, 0x1d24f],
        ],
    },
    {
        label: 'Shorthand',
        subsets: ['duployan'],
        ranges: [
            // Duployan shorthand
            [0x1bc00, 0x1bc9f],
            // Shorthand Format Controls
            [0x1bca0, 0x1bcaf],
        ],
    },
    {
        label: 'Sutton SignWriting',
        subsets: ['signwriting'],
        ranges: [[0x1d800, 0x1daaf]],
    },
    {
        label: 'Misc',
        ranges: [
            // Modifier Tone Letters
            [0xa700, 0xa71f],
            // Small Form Variants
            [0xfe50, 0xfe6f],
            // Alphabetic Presentation Forms
            [0xfb00, 0xfb4f],
        ],
    },
];

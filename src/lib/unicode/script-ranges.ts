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
    {
        label: 'Emoji',
        subsets: ['emoji'],
        ranges: [
            // E0.0   [1] (#️)       hash sign
            [0x0023, 0x0023],
            // E0.0   [1] (*️)       asterisk
            [0x002a, 0x002a],
            // E0.0  [10] (0️..9️)    digit zero..digit nine
            [0x0030, 0x0039],
            // E0.6   [1] (©️)       copyright
            [0x00a9, 0x00a9],
            // E0.6   [1] (®️)       registered
            [0x00ae, 0x00ae],
            // E0.6   [1] (‼️)       double exclamation mark
            [0x203c, 0x203c],
            // E0.6   [1] (⁉️)       exclamation question mark
            [0x2049, 0x2049],
            // E0.6   [1] (™️)       trade mark
            [0x2122, 0x2122],
            // E0.6   [1] (ℹ️)       information
            [0x2139, 0x2139],
            // E0.6   [6] (↔️..↙️)    left-right arrow..down-left arrow
            [0x2194, 0x2199],
            // E0.6   [2] (↩️..↪️)    right arrow curving left..left arrow curving right
            [0x21a9, 0x21aa],
            // E0.6   [2] (⌚..⌛)    watch..hourglass done
            [0x231a, 0x231b],
            // E1.0   [1] (⌨️)       keyboard
            [0x2328, 0x2328],
            // E1.0   [1] (⏏️)       eject button
            [0x23cf, 0x23cf],
            // E0.6   [4] (⏩..⏬)    fast-forward button..fast down button
            [0x23e9, 0x23ec],
            // E0.7   [2] (⏭️..⏮️)    next track button..last track button
            [0x23ed, 0x23ee],
            // E1.0   [1] (⏯️)       play or pause button
            [0x23ef, 0x23ef],
            // E0.6   [1] (⏰)       alarm clock
            [0x23f0, 0x23f0],
            // E1.0   [2] (⏱️..⏲️)    stopwatch..timer clock
            [0x23f1, 0x23f2],
            // E0.6   [1] (⏳)       hourglass not done
            [0x23f3, 0x23f3],
            // E0.7   [3] (⏸️..⏺️)    pause button..record button
            [0x23f8, 0x23fa],
            // E0.6   [1] (Ⓜ️)       circled M
            [0x24c2, 0x24c2],
            // E0.6   [2] (▪️..▫️)    black small square..white small square
            [0x25aa, 0x25ab],
            // E0.6   [1] (▶️)       play button
            [0x25b6, 0x25b6],
            // E0.6   [1] (◀️)       reverse button
            [0x25c0, 0x25c0],
            // E0.6   [4] (◻️..◾)    white medium square..black medium-small square
            [0x25fb, 0x25fe],
            // E0.6   [2] (☀️..☁️)    sun..cloud
            [0x2600, 0x2601],
            // E0.7   [2] (☂️..☃️)    umbrella..snowman
            [0x2602, 0x2603],
            // E1.0   [1] (☄️)       comet
            [0x2604, 0x2604],
            // E0.6   [1] (☎️)       telephone
            [0x260e, 0x260e],
            // E0.6   [1] (☑️)       check box with check
            [0x2611, 0x2611],
            // E0.6   [2] (☔..☕)    umbrella with rain drops..hot beverage
            [0x2614, 0x2615],
            // E1.0   [1] (☘️)       shamrock
            [0x2618, 0x2618],
            // E0.6   [1] (☝️)       index pointing up
            [0x261d, 0x261d],
            // E1.0   [1] (☠️)       skull and crossbones
            [0x2620, 0x2620],
            // E1.0   [2] (☢️..☣️)    radioactive..biohazard
            [0x2622, 0x2623],
            // E1.0   [1] (☦️)       orthodox cross
            [0x2626, 0x2626],
            // E0.7   [1] (☪️)       star and crescent
            [0x262a, 0x262a],
            // E1.0   [1] (☮️)       peace symbol
            [0x262e, 0x262e],
            // E0.7   [1] (☯️)       yin yang
            [0x262f, 0x262f],
            // E0.7   [2] (☸️..☹️)    wheel of dharma..frowning face
            [0x2638, 0x2639],
            // E0.6   [1] (☺️)       smiling face
            [0x263a, 0x263a],
            // E4.0   [1] (♀️)       female sign
            [0x2640, 0x2640],
            // E4.0   [1] (♂️)       male sign
            [0x2642, 0x2642],
            // E0.6  [12] (♈..♓)    Aries..Pisces
            [0x2648, 0x2653],
            // E11.0  [1] (♟️)       chess pawn
            [0x265f, 0x265f],
            // E0.6   [1] (♠️)       spade suit
            [0x2660, 0x2660],
            // E0.6   [1] (♣️)       club suit
            [0x2663, 0x2663],
            // E0.6   [2] (♥️..♦️)    heart suit..diamond suit
            [0x2665, 0x2666],
            // E0.6   [1] (♨️)       hot springs
            [0x2668, 0x2668],
            // E0.6   [1] (♻️)       recycling symbol
            [0x267b, 0x267b],
            // E11.0  [1] (♾️)       infinity
            [0x267e, 0x267e],
            // E0.6   [1] (♿)       wheelchair symbol
            [0x267f, 0x267f],
            // E1.0   [1] (⚒️)       hammer and pick
            [0x2692, 0x2692],
            // E0.6   [1] (⚓)       anchor
            [0x2693, 0x2693],
            // E1.0   [1] (⚔️)       crossed swords
            [0x2694, 0x2694],
            // E4.0   [1] (⚕️)       medical symbol
            [0x2695, 0x2695],
            // E1.0   [2] (⚖️..⚗️)    balance scale..alembic
            [0x2696, 0x2697],
            // E1.0   [1] (⚙️)       gear
            [0x2699, 0x2699],
            // E1.0   [2] (⚛️..⚜️)    atom symbol..fleur-de-lis
            [0x269b, 0x269c],
            // E0.6   [2] (⚠️..⚡)    warning..high voltage
            [0x26a0, 0x26a1],
            // E13.0  [1] (⚧️)       transgender symbol
            [0x26a7, 0x26a7],
            // E0.6   [2] (⚪..⚫)    white circle..black circle
            [0x26aa, 0x26ab],
            // E1.0   [2] (⚰️..⚱️)    coffin..funeral urn
            [0x26b0, 0x26b1],
            // E0.6   [2] (⚽..⚾)    soccer ball..baseball
            [0x26bd, 0x26be],
            // E0.6   [2] (⛄..⛅)    snowman without snow..sun behind cloud
            [0x26c4, 0x26c5],
            // E0.7   [1] (⛈️)       cloud with lightning and rain
            [0x26c8, 0x26c8],
            // E0.6   [1] (⛎)       Ophiuchus
            [0x26ce, 0x26ce],
            // E0.7   [1] (⛏️)       pick
            [0x26cf, 0x26cf],
            // E0.7   [1] (⛑️)       rescue worker’s helmet
            [0x26d1, 0x26d1],
            // E0.7   [1] (⛓️)       chains
            [0x26d3, 0x26d3],
            // E0.6   [1] (⛔)       no entry
            [0x26d4, 0x26d4],
            // E0.7   [1] (⛩️)       shinto shrine
            [0x26e9, 0x26e9],
            // E0.6   [1] (⛪)       church
            [0x26ea, 0x26ea],
            // E0.7   [2] (⛰️..⛱️)    mountain..umbrella on ground
            [0x26f0, 0x26f1],
            // E0.6   [2] (⛲..⛳)    fountain..flag in hole
            [0x26f2, 0x26f3],
            // E0.7   [1] (⛴️)       ferry
            [0x26f4, 0x26f4],
            // E0.6   [1] (⛵)       sailboat
            [0x26f5, 0x26f5],
            // E0.7   [3] (⛷️..⛹️)    skier..person bouncing ball
            [0x26f7, 0x26f9],
            // E0.6   [1] (⛺)       tent
            [0x26fa, 0x26fa],
            // E0.6   [1] (⛽)       fuel pump
            [0x26fd, 0x26fd],
            // E0.6   [1] (✂️)       scissors
            [0x2702, 0x2702],
            // E0.6   [1] (✅)       check mark button
            [0x2705, 0x2705],
            // E0.6   [5] (✈️..✌️)    airplane..victory hand
            [0x2708, 0x270c],
            // E0.7   [1] (✍️)       writing hand
            [0x270d, 0x270d],
            // E0.6   [1] (✏️)       pencil
            [0x270f, 0x270f],
            // E0.6   [1] (✒️)       black nib
            [0x2712, 0x2712],
            // E0.6   [1] (✔️)       check mark
            [0x2714, 0x2714],
            // E0.6   [1] (✖️)       multiply
            [0x2716, 0x2716],
            // E0.7   [1] (✝️)       latin cross
            [0x271d, 0x271d],
            // E0.7   [1] (✡️)       star of David
            [0x2721, 0x2721],
            // E0.6   [1] (✨)       sparkles
            [0x2728, 0x2728],
            // E0.6   [2] (✳️..✴️)    eight-spoked asterisk..eight-pointed star
            [0x2733, 0x2734],
            // E0.6   [1] (❄️)       snowflake
            [0x2744, 0x2744],
            // E0.6   [1] (❇️)       sparkle
            [0x2747, 0x2747],
            // E0.6   [1] (❌)       cross mark
            [0x274c, 0x274c],
            // E0.6   [1] (❎)       cross mark button
            [0x274e, 0x274e],
            // E0.6   [3] (❓..❕)    red question mark..white exclamation mark
            [0x2753, 0x2755],
            // E0.6   [1] (❗)       red exclamation mark
            [0x2757, 0x2757],
            // E1.0   [1] (❣️)       heart exclamation
            [0x2763, 0x2763],
            // E0.6   [1] (❤️)       red heart
            [0x2764, 0x2764],
            // E0.6   [3] (➕..➗)    plus..divide
            [0x2795, 0x2797],
            // E0.6   [1] (➡️)       right arrow
            [0x27a1, 0x27a1],
            // E0.6   [1] (➰)       curly loop
            [0x27b0, 0x27b0],
            // E1.0   [1] (➿)       double curly loop
            [0x27bf, 0x27bf],
            // E0.6   [2] (⤴️..⤵️)    right arrow curving up..right arrow curving down
            [0x2934, 0x2935],
            // E0.6   [3] (⬅️..⬇️)    left arrow..down arrow
            [0x2b05, 0x2b07],
            // E0.6   [2] (⬛..⬜)    black large square..white large square
            [0x2b1b, 0x2b1c],
            // E0.6   [1] (⭐)       star
            [0x2b50, 0x2b50],
            // E0.6   [1] (⭕)       hollow red circle
            [0x2b55, 0x2b55],
            // E0.6   [1] (〰️)       wavy dash
            [0x3030, 0x3030],
            // E0.6   [1] (〽️)       part alternation mark
            [0x303d, 0x303d],
            // E0.6   [1] (㊗️)       Japanese “congratulations” button
            [0x3297, 0x3297],
            // E0.6   [1] (㊙️)       Japanese “secret” button
            [0x3299, 0x3299],
            // E0.6   [1] (🀄)       mahjong red dragon
            [0x1f004, 0x1f004],
            // E0.6   [1] (🃏)       joker
            [0x1f0cf, 0x1f0cf],
            // E0.6   [2] (🅰️..🅱️)    A button (blood type)..B button (blood type)
            [0x1f170, 0x1f171],
            // E0.6   [2] (🅾️..🅿️)    O button (blood type)..P button
            [0x1f17e, 0x1f17f],
            // E0.6   [1] (🆎)       AB button (blood type)
            [0x1f18e, 0x1f18e],
            // E0.6  [10] (🆑..🆚)    CL button..VS button
            [0x1f191, 0x1f19a],
            // E0.0  [26] (🇦..🇿)    regional indicator symbol letter a..regional indicator symbol letter z
            [0x1f1e6, 0x1f1ff],
            // E0.6   [2] (🈁..🈂️)    Japanese “here” button..Japanese “service charge” button
            [0x1f201, 0x1f202],
            // E0.6   [1] (🈚)       Japanese “free of charge” button
            [0x1f21a, 0x1f21a],
            // E0.6   [1] (🈯)       Japanese “reserved” button
            [0x1f22f, 0x1f22f],
            // E0.6   [9] (🈲..🈺)    Japanese “prohibited” button..Japanese “open for business” button
            [0x1f232, 0x1f23a],
            // E0.6   [2] (🉐..🉑)    Japanese “bargain” button..Japanese “acceptable” button
            [0x1f250, 0x1f251],
            // E0.6  [13] (🌀..🌌)    cyclone..milky way
            [0x1f300, 0x1f30c],
            // E0.7   [2] (🌍..🌎)    globe showing Europe-Africa..globe showing Americas
            [0x1f30d, 0x1f30e],
            // E0.6   [1] (🌏)       globe showing Asia-Australia
            [0x1f30f, 0x1f30f],
            // E1.0   [1] (🌐)       globe with meridians
            [0x1f310, 0x1f310],
            // E0.6   [1] (🌑)       new moon
            [0x1f311, 0x1f311],
            // E1.0   [1] (🌒)       waxing crescent moon
            [0x1f312, 0x1f312],
            // E0.6   [3] (🌓..🌕)    first quarter moon..full moon
            [0x1f313, 0x1f315],
            // E1.0   [3] (🌖..🌘)    waning gibbous moon..waning crescent moon
            [0x1f316, 0x1f318],
            // E0.6   [1] (🌙)       crescent moon
            [0x1f319, 0x1f319],
            // E1.0   [1] (🌚)       new moon face
            [0x1f31a, 0x1f31a],
            // E0.6   [1] (🌛)       first quarter moon face
            [0x1f31b, 0x1f31b],
            // E0.7   [1] (🌜)       last quarter moon face
            [0x1f31c, 0x1f31c],
            // E1.0   [2] (🌝..🌞)    full moon face..sun with face
            [0x1f31d, 0x1f31e],
            // E0.6   [2] (🌟..🌠)    glowing star..shooting star
            [0x1f31f, 0x1f320],
            // E0.7   [1] (🌡️)       thermometer
            [0x1f321, 0x1f321],
            // E0.7   [9] (🌤️..🌬️)    sun behind small cloud..wind face
            [0x1f324, 0x1f32c],
            // E1.0   [3] (🌭..🌯)    hot dog..burrito
            [0x1f32d, 0x1f32f],
            // E0.6   [2] (🌰..🌱)    chestnut..seedling
            [0x1f330, 0x1f331],
            // E1.0   [2] (🌲..🌳)    evergreen tree..deciduous tree
            [0x1f332, 0x1f333],
            // E0.6   [2] (🌴..🌵)    palm tree..cactus
            [0x1f334, 0x1f335],
            // E0.7   [1] (🌶️)       hot pepper
            [0x1f336, 0x1f336],
            // E0.6  [20] (🌷..🍊)    tulip..tangerine
            [0x1f337, 0x1f34a],
            // E1.0   [1] (🍋)       lemon
            [0x1f34b, 0x1f34b],
            // E0.6   [4] (🍌..🍏)    banana..green apple
            [0x1f34c, 0x1f34f],
            // E1.0   [1] (🍐)       pear
            [0x1f350, 0x1f350],
            // E0.6  [43] (🍑..🍻)    peach..clinking beer mugs
            [0x1f351, 0x1f37b],
            // E1.0   [1] (🍼)       baby bottle
            [0x1f37c, 0x1f37c],
            // E0.7   [1] (🍽️)       fork and knife with plate
            [0x1f37d, 0x1f37d],
            // E1.0   [2] (🍾..🍿)    bottle with popping cork..popcorn
            [0x1f37e, 0x1f37f],
            // E0.6  [20] (🎀..🎓)    ribbon..graduation cap
            [0x1f380, 0x1f393],
            // E0.7   [2] (🎖️..🎗️)    military medal..reminder ribbon
            [0x1f396, 0x1f397],
            // E0.7   [3] (🎙️..🎛️)    studio microphone..control knobs
            [0x1f399, 0x1f39b],
            // E0.7   [2] (🎞️..🎟️)    film frames..admission tickets
            [0x1f39e, 0x1f39f],
            // E0.6  [37] (🎠..🏄)    carousel horse..person surfing
            [0x1f3a0, 0x1f3c4],
            // E1.0   [1] (🏅)       sports medal
            [0x1f3c5, 0x1f3c5],
            // E0.6   [1] (🏆)       trophy
            [0x1f3c6, 0x1f3c6],
            // E1.0   [1] (🏇)       horse racing
            [0x1f3c7, 0x1f3c7],
            // E0.6   [1] (🏈)       american football
            [0x1f3c8, 0x1f3c8],
            // E1.0   [1] (🏉)       rugby football
            [0x1f3c9, 0x1f3c9],
            // E0.6   [1] (🏊)       person swimming
            [0x1f3ca, 0x1f3ca],
            // E0.7   [4] (🏋️..🏎️)    person lifting weights..racing car
            [0x1f3cb, 0x1f3ce],
            // E1.0   [5] (🏏..🏓)    cricket game..ping pong
            [0x1f3cf, 0x1f3d3],
            // E0.7  [12] (🏔️..🏟️)    snow-capped mountain..stadium
            [0x1f3d4, 0x1f3df],
            // E0.6   [4] (🏠..🏣)    house..Japanese post office
            [0x1f3e0, 0x1f3e3],
            // E1.0   [1] (🏤)       post office
            [0x1f3e4, 0x1f3e4],
            // E0.6  [12] (🏥..🏰)    hospital..castle
            [0x1f3e5, 0x1f3f0],
            // E0.7   [1] (🏳️)       white flag
            [0x1f3f3, 0x1f3f3],
            // E1.0   [1] (🏴)       black flag
            [0x1f3f4, 0x1f3f4],
            // E0.7   [1] (🏵️)       rosette
            [0x1f3f5, 0x1f3f5],
            // E0.7   [1] (🏷️)       label
            [0x1f3f7, 0x1f3f7],
            // E1.0  [16] (🏸..🐇)    badminton..rabbit
            [0x1f3f8, 0x1f407],
            // E0.7   [1] (🐈)       cat
            [0x1f408, 0x1f408],
            // E1.0   [3] (🐉..🐋)    dragon..whale
            [0x1f409, 0x1f40b],
            // E0.6   [3] (🐌..🐎)    snail..horse
            [0x1f40c, 0x1f40e],
            // E1.0   [2] (🐏..🐐)    ram..goat
            [0x1f40f, 0x1f410],
            // E0.6   [2] (🐑..🐒)    ewe..monkey
            [0x1f411, 0x1f412],
            // E1.0   [1] (🐓)       rooster
            [0x1f413, 0x1f413],
            // E0.6   [1] (🐔)       chicken
            [0x1f414, 0x1f414],
            // E0.7   [1] (🐕)       dog
            [0x1f415, 0x1f415],
            // E1.0   [1] (🐖)       pig
            [0x1f416, 0x1f416],
            // E0.6  [19] (🐗..🐩)    boar..poodle
            [0x1f417, 0x1f429],
            // E1.0   [1] (🐪)       camel
            [0x1f42a, 0x1f42a],
            // E0.6  [20] (🐫..🐾)    two-hump camel..paw prints
            [0x1f42b, 0x1f43e],
            // E0.7   [1] (🐿️)       chipmunk
            [0x1f43f, 0x1f43f],
            // E0.6   [1] (👀)       eyes
            [0x1f440, 0x1f440],
            // E0.7   [1] (👁️)       eye
            [0x1f441, 0x1f441],
            // E0.6  [35] (👂..👤)    ear..bust in silhouette
            [0x1f442, 0x1f464],
            // E1.0   [1] (👥)       busts in silhouette
            [0x1f465, 0x1f465],
            // E0.6   [6] (👦..👫)    boy..woman and man holding hands
            [0x1f466, 0x1f46b],
            // E1.0   [2] (👬..👭)    men holding hands..women holding hands
            [0x1f46c, 0x1f46d],
            // E0.6  [63] (👮..💬)    police officer..speech balloon
            [0x1f46e, 0x1f4ac],
            // E1.0   [1] (💭)       thought balloon
            [0x1f4ad, 0x1f4ad],
            // E0.6   [8] (💮..💵)    white flower..dollar banknote
            [0x1f4ae, 0x1f4b5],
            // E1.0   [2] (💶..💷)    euro banknote..pound banknote
            [0x1f4b6, 0x1f4b7],
            // E0.6  [52] (💸..📫)    money with wings..closed mailbox with raised flag
            [0x1f4b8, 0x1f4eb],
            // E0.7   [2] (📬..📭)    open mailbox with raised flag..open mailbox with lowered flag
            [0x1f4ec, 0x1f4ed],
            // E0.6   [1] (📮)       postbox
            [0x1f4ee, 0x1f4ee],
            // E1.0   [1] (📯)       postal horn
            [0x1f4ef, 0x1f4ef],
            // E0.6   [5] (📰..📴)    newspaper..mobile phone off
            [0x1f4f0, 0x1f4f4],
            // E1.0   [1] (📵)       no mobile phones
            [0x1f4f5, 0x1f4f5],
            // E0.6   [2] (📶..📷)    antenna bars..camera
            [0x1f4f6, 0x1f4f7],
            // E1.0   [1] (📸)       camera with flash
            [0x1f4f8, 0x1f4f8],
            // E0.6   [4] (📹..📼)    video camera..videocassette
            [0x1f4f9, 0x1f4fc],
            // E0.7   [1] (📽️)       film projector
            [0x1f4fd, 0x1f4fd],
            // E1.0   [4] (📿..🔂)    prayer beads..repeat single button
            [0x1f4ff, 0x1f502],
            // E0.6   [1] (🔃)       clockwise vertical arrows
            [0x1f503, 0x1f503],
            // E1.0   [4] (🔄..🔇)    counterclockwise arrows button..muted speaker
            [0x1f504, 0x1f507],
            // E0.7   [1] (🔈)       speaker low volume
            [0x1f508, 0x1f508],
            // E1.0   [1] (🔉)       speaker medium volume
            [0x1f509, 0x1f509],
            // E0.6  [11] (🔊..🔔)    speaker high volume..bell
            [0x1f50a, 0x1f514],
            // E1.0   [1] (🔕)       bell with slash
            [0x1f515, 0x1f515],
            // E0.6  [22] (🔖..🔫)    bookmark..water pistol
            [0x1f516, 0x1f52b],
            // E1.0   [2] (🔬..🔭)    microscope..telescope
            [0x1f52c, 0x1f52d],
            // E0.6  [16] (🔮..🔽)    crystal ball..downwards button
            [0x1f52e, 0x1f53d],
            // E0.7   [2] (🕉️..🕊️)    om..dove
            [0x1f549, 0x1f54a],
            // E1.0   [4] (🕋..🕎)    kaaba..menorah
            [0x1f54b, 0x1f54e],
            // E0.6  [12] (🕐..🕛)    one o’clock..twelve o’clock
            [0x1f550, 0x1f55b],
            // E0.7  [12] (🕜..🕧)    one-thirty..twelve-thirty
            [0x1f55c, 0x1f567],
            // E0.7   [2] (🕯️..🕰️)    candle..mantelpiece clock
            [0x1f56f, 0x1f570],
            // E0.7   [7] (🕳️..🕹️)    hole..joystick
            [0x1f573, 0x1f579],
            // E3.0   [1] (🕺)       man dancing
            [0x1f57a, 0x1f57a],
            // E0.7   [1] (🖇️)       linked paperclips
            [0x1f587, 0x1f587],
            // E0.7   [4] (🖊️..🖍️)    pen..crayon
            [0x1f58a, 0x1f58d],
            // E0.7   [1] (🖐️)       hand with fingers splayed
            [0x1f590, 0x1f590],
            // E1.0   [2] (🖕..🖖)    middle finger..vulcan salute
            [0x1f595, 0x1f596],
            // E3.0   [1] (🖤)       black heart
            [0x1f5a4, 0x1f5a4],
            // E0.7   [1] (🖥️)       desktop computer
            [0x1f5a5, 0x1f5a5],
            // E0.7   [1] (🖨️)       printer
            [0x1f5a8, 0x1f5a8],
            // E0.7   [2] (🖱️..🖲️)    computer mouse..trackball
            [0x1f5b1, 0x1f5b2],
            // E0.7   [1] (🖼️)       framed picture
            [0x1f5bc, 0x1f5bc],
            // E0.7   [3] (🗂️..🗄️)    card index dividers..file cabinet
            [0x1f5c2, 0x1f5c4],
            // E0.7   [3] (🗑️..🗓️)    wastebasket..spiral calendar
            [0x1f5d1, 0x1f5d3],
            // E0.7   [3] (🗜️..🗞️)    clamp..rolled-up newspaper
            [0x1f5dc, 0x1f5de],
            // E0.7   [1] (🗡️)       dagger
            [0x1f5e1, 0x1f5e1],
            // E0.7   [1] (🗣️)       speaking head
            [0x1f5e3, 0x1f5e3],
            // E2.0   [1] (🗨️)       left speech bubble
            [0x1f5e8, 0x1f5e8],
            // E0.7   [1] (🗯️)       right anger bubble
            [0x1f5ef, 0x1f5ef],
            // E0.7   [1] (🗳️)       ballot box with ballot
            [0x1f5f3, 0x1f5f3],
            // E0.7   [1] (🗺️)       world map
            [0x1f5fa, 0x1f5fa],
            // E0.6   [5] (🗻..🗿)    mount fuji..moai
            [0x1f5fb, 0x1f5ff],
            // E1.0   [1] (😀)       grinning face
            [0x1f600, 0x1f600],
            // E0.6   [6] (😁..😆)    beaming face with smiling eyes..grinning squinting face
            [0x1f601, 0x1f606],
            // E1.0   [2] (😇..😈)    smiling face with halo..smiling face with horns
            [0x1f607, 0x1f608],
            // E0.6   [5] (😉..😍)    winking face..smiling face with heart-eyes
            [0x1f609, 0x1f60d],
            // E1.0   [1] (😎)       smiling face with sunglasses
            [0x1f60e, 0x1f60e],
            // E0.6   [1] (😏)       smirking face
            [0x1f60f, 0x1f60f],
            // E0.7   [1] (😐)       neutral face
            [0x1f610, 0x1f610],
            // E1.0   [1] (😑)       expressionless face
            [0x1f611, 0x1f611],
            // E0.6   [3] (😒..😔)    unamused face..pensive face
            [0x1f612, 0x1f614],
            // E1.0   [1] (😕)       confused face
            [0x1f615, 0x1f615],
            // E0.6   [1] (😖)       confounded face
            [0x1f616, 0x1f616],
            // E1.0   [1] (😗)       kissing face
            [0x1f617, 0x1f617],
            // E0.6   [1] (😘)       face blowing a kiss
            [0x1f618, 0x1f618],
            // E1.0   [1] (😙)       kissing face with smiling eyes
            [0x1f619, 0x1f619],
            // E0.6   [1] (😚)       kissing face with closed eyes
            [0x1f61a, 0x1f61a],
            // E1.0   [1] (😛)       face with tongue
            [0x1f61b, 0x1f61b],
            // E0.6   [3] (😜..😞)    winking face with tongue..disappointed face
            [0x1f61c, 0x1f61e],
            // E1.0   [1] (😟)       worried face
            [0x1f61f, 0x1f61f],
            // E0.6   [6] (😠..😥)    angry face..sad but relieved face
            [0x1f620, 0x1f625],
            // E1.0   [2] (😦..😧)    frowning face with open mouth..anguished face
            [0x1f626, 0x1f627],
            // E0.6   [4] (😨..😫)    fearful face..tired face
            [0x1f628, 0x1f62b],
            // E1.0   [1] (😬)       grimacing face
            [0x1f62c, 0x1f62c],
            // E0.6   [1] (😭)       loudly crying face
            [0x1f62d, 0x1f62d],
            // E1.0   [2] (😮..😯)    face with open mouth..hushed face
            [0x1f62e, 0x1f62f],
            // E0.6   [4] (😰..😳)    anxious face with sweat..flushed face
            [0x1f630, 0x1f633],
            // E1.0   [1] (😴)       sleeping face
            [0x1f634, 0x1f634],
            // E0.6   [1] (😵)       face with crossed-out eyes
            [0x1f635, 0x1f635],
            // E1.0   [1] (😶)       face without mouth
            [0x1f636, 0x1f636],
            // E0.6  [10] (😷..🙀)    face with medical mask..weary cat
            [0x1f637, 0x1f640],
            // E1.0   [4] (🙁..🙄)    slightly frowning face..face with rolling eyes
            [0x1f641, 0x1f644],
            // E0.6  [11] (🙅..🙏)    person gesturing NO..folded hands
            [0x1f645, 0x1f64f],
            // E0.6   [1] (🚀)       rocket
            [0x1f680, 0x1f680],
            // E1.0   [2] (🚁..🚂)    helicopter..locomotive
            [0x1f681, 0x1f682],
            // E0.6   [3] (🚃..🚅)    railway car..bullet train
            [0x1f683, 0x1f685],
            // E1.0   [1] (🚆)       train
            [0x1f686, 0x1f686],
            // E0.6   [1] (🚇)       metro
            [0x1f687, 0x1f687],
            // E1.0   [1] (🚈)       light rail
            [0x1f688, 0x1f688],
            // E0.6   [1] (🚉)       station
            [0x1f689, 0x1f689],
            // E1.0   [2] (🚊..🚋)    tram..tram car
            [0x1f68a, 0x1f68b],
            // E0.6   [1] (🚌)       bus
            [0x1f68c, 0x1f68c],
            // E0.7   [1] (🚍)       oncoming bus
            [0x1f68d, 0x1f68d],
            // E1.0   [1] (🚎)       trolleybus
            [0x1f68e, 0x1f68e],
            // E0.6   [1] (🚏)       bus stop
            [0x1f68f, 0x1f68f],
            // E1.0   [1] (🚐)       minibus
            [0x1f690, 0x1f690],
            // E0.6   [3] (🚑..🚓)    ambulance..police car
            [0x1f691, 0x1f693],
            // E0.7   [1] (🚔)       oncoming police car
            [0x1f694, 0x1f694],
            // E0.6   [1] (🚕)       taxi
            [0x1f695, 0x1f695],
            // E1.0   [1] (🚖)       oncoming taxi
            [0x1f696, 0x1f696],
            // E0.6   [1] (🚗)       automobile
            [0x1f697, 0x1f697],
            // E0.7   [1] (🚘)       oncoming automobile
            [0x1f698, 0x1f698],
            // E0.6   [2] (🚙..🚚)    sport utility vehicle..delivery truck
            [0x1f699, 0x1f69a],
            // E1.0   [7] (🚛..🚡)    articulated lorry..aerial tramway
            [0x1f69b, 0x1f6a1],
            // E0.6   [1] (🚢)       ship
            [0x1f6a2, 0x1f6a2],
            // E1.0   [1] (🚣)       person rowing boat
            [0x1f6a3, 0x1f6a3],
            // E0.6   [2] (🚤..🚥)    speedboat..horizontal traffic light
            [0x1f6a4, 0x1f6a5],
            // E1.0   [1] (🚦)       vertical traffic light
            [0x1f6a6, 0x1f6a6],
            // E0.6   [7] (🚧..🚭)    construction..no smoking
            [0x1f6a7, 0x1f6ad],
            // E1.0   [4] (🚮..🚱)    litter in bin sign..non-potable water
            [0x1f6ae, 0x1f6b1],
            // E0.6   [1] (🚲)       bicycle
            [0x1f6b2, 0x1f6b2],
            // E1.0   [3] (🚳..🚵)    no bicycles..person mountain biking
            [0x1f6b3, 0x1f6b5],
            // E0.6   [1] (🚶)       person walking
            [0x1f6b6, 0x1f6b6],
            // E1.0   [2] (🚷..🚸)    no pedestrians..children crossing
            [0x1f6b7, 0x1f6b8],
            // E0.6   [6] (🚹..🚾)    men’s room..water closet
            [0x1f6b9, 0x1f6be],
            // E1.0   [1] (🚿)       shower
            [0x1f6bf, 0x1f6bf],
            // E0.6   [1] (🛀)       person taking bath
            [0x1f6c0, 0x1f6c0],
            // E1.0   [5] (🛁..🛅)    bathtub..left luggage
            [0x1f6c1, 0x1f6c5],
            // E0.7   [1] (🛋️)       couch and lamp
            [0x1f6cb, 0x1f6cb],
            // E1.0   [1] (🛌)       person in bed
            [0x1f6cc, 0x1f6cc],
            // E0.7   [3] (🛍️..🛏️)    shopping bags..bed
            [0x1f6cd, 0x1f6cf],
            // E1.0   [1] (🛐)       place of worship
            [0x1f6d0, 0x1f6d0],
            // E3.0   [2] (🛑..🛒)    stop sign..shopping cart
            [0x1f6d1, 0x1f6d2],
            // E12.0  [1] (🛕)       hindu temple
            [0x1f6d5, 0x1f6d5],
            // E13.0  [2] (🛖..🛗)    hut..elevator
            [0x1f6d6, 0x1f6d7],
            // E17.0  [1] (🛘)       landslide
            [0x1f6d8, 0x1f6d8],
            // E18.0  [1] (🛙)       lighthouse
            [0x1f6d9, 0x1f6d9],
            // E15.0  [1] (🛜)       wireless
            [0x1f6dc, 0x1f6dc],
            // E14.0  [3] (🛝..🛟)    playground slide..ring buoy
            [0x1f6dd, 0x1f6df],
            // E0.7   [6] (🛠️..🛥️)    hammer and wrench..motor boat
            [0x1f6e0, 0x1f6e5],
            // E0.7   [1] (🛩️)       small airplane
            [0x1f6e9, 0x1f6e9],
            // E1.0   [2] (🛫..🛬)    airplane departure..airplane arrival
            [0x1f6eb, 0x1f6ec],
            // E0.7   [1] (🛰️)       satellite
            [0x1f6f0, 0x1f6f0],
            // E0.7   [1] (🛳️)       passenger ship
            [0x1f6f3, 0x1f6f3],
            // E3.0   [3] (🛴..🛶)    kick scooter..canoe
            [0x1f6f4, 0x1f6f6],
            // E5.0   [2] (🛷..🛸)    sled..flying saucer
            [0x1f6f7, 0x1f6f8],
            // E11.0  [1] (🛹)       skateboard
            [0x1f6f9, 0x1f6f9],
            // E12.0  [1] (🛺)       auto rickshaw
            [0x1f6fa, 0x1f6fa],
            // E13.0  [2] (🛻..🛼)    pickup truck..roller skate
            [0x1f6fb, 0x1f6fc],
            // E12.0 [12] (🟠..🟫)    orange circle..brown square
            [0x1f7e0, 0x1f7eb],
            // E14.0  [1] (🟰)       heavy equals sign
            [0x1f7f0, 0x1f7f0],
            // E13.0  [1] (🤌)       pinched fingers
            [0x1f90c, 0x1f90c],
            // E12.0  [3] (🤍..🤏)    white heart..pinching hand
            [0x1f90d, 0x1f90f],
            // E1.0   [9] (🤐..🤘)    zipper-mouth face..sign of the horns
            [0x1f910, 0x1f918],
            // E3.0   [6] (🤙..🤞)    call me hand..crossed fingers
            [0x1f919, 0x1f91e],
            // E5.0   [1] (🤟)       love-you gesture
            [0x1f91f, 0x1f91f],
            // E3.0   [8] (🤠..🤧)    cowboy hat face..sneezing face
            [0x1f920, 0x1f927],
            // E5.0   [8] (🤨..🤯)    face with raised eyebrow..exploding head
            [0x1f928, 0x1f92f],
            // E3.0   [1] (🤰)       pregnant woman
            [0x1f930, 0x1f930],
            // E5.0   [2] (🤱..🤲)    breast-feeding..palms up together
            [0x1f931, 0x1f932],
            // E3.0   [8] (🤳..🤺)    selfie..person fencing
            [0x1f933, 0x1f93a],
            // E3.0   [3] (🤼..🤾)    people wrestling..person playing handball
            [0x1f93c, 0x1f93e],
            // E12.0  [1] (🤿)       diving mask
            [0x1f93f, 0x1f93f],
            // E3.0   [6] (🥀..🥅)    wilted flower..goal net
            [0x1f940, 0x1f945],
            // E3.0   [5] (🥇..🥋)    1st place medal..martial arts uniform
            [0x1f947, 0x1f94b],
            // E5.0   [1] (🥌)       curling stone
            [0x1f94c, 0x1f94c],
            // E11.0  [3] (🥍..🥏)    lacrosse..flying disc
            [0x1f94d, 0x1f94f],
            // E3.0  [15] (🥐..🥞)    croissant..pancakes
            [0x1f950, 0x1f95e],
            // E5.0  [13] (🥟..🥫)    dumpling..canned food
            [0x1f95f, 0x1f96b],
            // E11.0  [5] (🥬..🥰)    leafy green..smiling face with hearts
            [0x1f96c, 0x1f970],
            // E12.0  [1] (🥱)       yawning face
            [0x1f971, 0x1f971],
            // E13.0  [1] (🥲)       smiling face with tear
            [0x1f972, 0x1f972],
            // E11.0  [4] (🥳..🥶)    partying face..cold face
            [0x1f973, 0x1f976],
            // E13.0  [2] (🥷..🥸)    ninja..disguised face
            [0x1f977, 0x1f978],
            // E14.0  [1] (🥹)       face holding back tears
            [0x1f979, 0x1f979],
            // E11.0  [1] (🥺)       pleading face
            [0x1f97a, 0x1f97a],
            // E12.0  [1] (🥻)       sari
            [0x1f97b, 0x1f97b],
            // E11.0  [4] (🥼..🥿)    lab coat..flat shoe
            [0x1f97c, 0x1f97f],
            // E1.0   [5] (🦀..🦄)    crab..unicorn
            [0x1f980, 0x1f984],
            // E3.0  [13] (🦅..🦑)    eagle..squid
            [0x1f985, 0x1f991],
            // E5.0   [6] (🦒..🦗)    giraffe..cricket
            [0x1f992, 0x1f997],
            // E11.0 [11] (🦘..🦢)    kangaroo..swan
            [0x1f998, 0x1f9a2],
            // E13.0  [2] (🦣..🦤)    mammoth..dodo
            [0x1f9a3, 0x1f9a4],
            // E12.0  [6] (🦥..🦪)    sloth..oyster
            [0x1f9a5, 0x1f9aa],
            // E13.0  [3] (🦫..🦭)    beaver..seal
            [0x1f9ab, 0x1f9ad],
            // E12.0  [2] (🦮..🦯)    guide dog..white cane
            [0x1f9ae, 0x1f9af],
            // E11.0 [10] (🦰..🦹)    red hair..supervillain
            [0x1f9b0, 0x1f9b9],
            // E12.0  [6] (🦺..🦿)    safety vest..mechanical leg
            [0x1f9ba, 0x1f9bf],
            // E1.0   [1] (🧀)       cheese wedge
            [0x1f9c0, 0x1f9c0],
            // E11.0  [2] (🧁..🧂)    cupcake..salt
            [0x1f9c1, 0x1f9c2],
            // E12.0  [8] (🧃..🧊)    beverage box..ice
            [0x1f9c3, 0x1f9ca],
            // E13.0  [1] (🧋)       bubble tea
            [0x1f9cb, 0x1f9cb],
            // E14.0  [1] (🧌)       troll
            [0x1f9cc, 0x1f9cc],
            // E12.0  [3] (🧍..🧏)    person standing..deaf person
            [0x1f9cd, 0x1f9cf],
            // E5.0  [23] (🧐..🧦)    face with monocle..socks
            [0x1f9d0, 0x1f9e6],
            // E11.0 [25] (🧧..🧿)    red envelope..nazar amulet
            [0x1f9e7, 0x1f9ff],
            // E12.0  [4] (🩰..🩳)    ballet shoes..shorts
            [0x1fa70, 0x1fa73],
            // E13.0  [1] (🩴)       thong sandal
            [0x1fa74, 0x1fa74],
            // E15.0  [3] (🩵..🩷)    light blue heart..pink heart
            [0x1fa75, 0x1fa77],
            // E12.0  [3] (🩸..🩺)    drop of blood..stethoscope
            [0x1fa78, 0x1fa7a],
            // E14.0  [2] (🩻..🩼)    x-ray..crutch
            [0x1fa7b, 0x1fa7c],
            // E12.0  [3] (🪀..🪂)    yo-yo..parachute
            [0x1fa80, 0x1fa82],
            // E13.0  [4] (🪃..🪆)    boomerang..nesting dolls
            [0x1fa83, 0x1fa86],
            // E15.0  [2] (🪇..🪈)    maracas..flute
            [0x1fa87, 0x1fa88],
            // E16.0  [1] (🪉)       harp
            [0x1fa89, 0x1fa89],
            // E17.0  [1] (🪊)       trombone
            [0x1fa8a, 0x1fa8a],
            // E18.0  [3] (🪋..🪍)    meteor..net with handle
            [0x1fa8b, 0x1fa8d],
            // E17.0  [1] (🪎)       treasure chest
            [0x1fa8e, 0x1fa8e],
            // E16.0  [1] (🪏)       shovel
            [0x1fa8f, 0x1fa8f],
            // E12.0  [6] (🪐..🪕)    ringed planet..banjo
            [0x1fa90, 0x1fa95],
            // E13.0 [19] (🪖..🪨)    military helmet..rock
            [0x1fa96, 0x1faa8],
            // E14.0  [4] (🪩..🪬)    mirror ball..hamsa
            [0x1faa9, 0x1faac],
            // E15.0  [3] (🪭..🪯)    folding hand fan..khanda
            [0x1faad, 0x1faaf],
            // E13.0  [7] (🪰..🪶)    fly..feather
            [0x1fab0, 0x1fab6],
            // E14.0  [4] (🪷..🪺)    lotus..nest with eggs
            [0x1fab7, 0x1faba],
            // E15.0  [3] (🪻..🪽)    hyacinth..wing
            [0x1fabb, 0x1fabd],
            // E16.0  [1] (🪾)       leafless tree
            [0x1fabe, 0x1fabe],
            // E15.0  [1] (🪿)       goose
            [0x1fabf, 0x1fabf],
            // E13.0  [3] (🫀..🫂)    anatomical heart..people hugging
            [0x1fac0, 0x1fac2],
            // E14.0  [3] (🫃..🫅)    pregnant man..person with crown
            [0x1fac3, 0x1fac5],
            // E16.0  [1] (🫆)       fingerprint
            [0x1fac6, 0x1fac6],
            // E17.0  [1] (🫈)       hairy creature
            [0x1fac8, 0x1fac8],
            // E18.0  [1] (🫌)       monarch butterfly
            [0x1facc, 0x1facc],
            // E17.0  [1] (🫍)       orca
            [0x1facd, 0x1facd],
            // E15.0  [2] (🫎..🫏)    moose..donkey
            [0x1face, 0x1facf],
            // E13.0  [7] (🫐..🫖)    blueberries..teapot
            [0x1fad0, 0x1fad6],
            // E14.0  [3] (🫗..🫙)    pouring liquid..jar
            [0x1fad7, 0x1fad9],
            // E15.0  [2] (🫚..🫛)    ginger root..pea pod
            [0x1fada, 0x1fadb],
            // E16.0  [1] (🫜)       root vegetable
            [0x1fadc, 0x1fadc],
            // E18.0  [1] (🫝)       pickle
            [0x1fadd, 0x1fadd],
            // E16.0  [1] (🫟)       splatter
            [0x1fadf, 0x1fadf],
            // E14.0  [8] (🫠..🫧)    melting face..bubbles
            [0x1fae0, 0x1fae7],
            // E15.0  [1] (🫨)       shaking face
            [0x1fae8, 0x1fae8],
            // E16.0  [1] (🫩)       face with bags under eyes
            [0x1fae9, 0x1fae9],
            // E17.0  [1] (🫪)       distorted face
            [0x1faea, 0x1faea],
            // E18.0  [1] (🫫)       cracking face
            [0x1faeb, 0x1faeb],
            // E17.0  [1] (🫯)       fight cloud
            [0x1faef, 0x1faef],
            // E14.0  [7] (🫰..🫶)    hand with index finger and thumb crossed..heart hands
            [0x1faf0, 0x1faf6],
            // E15.0  [2] (🫷..🫸)    leftwards pushing hand..rightwards pushing hand
            [0x1faf7, 0x1faf8],
            // E18.0  [2] (🫹..🫺)    leftwards thumb sign..rightwards thumb sign
            [0x1faf9, 0x1fafa],
        ],
    },
    {
        label: 'Emoji Presentation',
        ranges: [
            // E0.6   [2] (⌚..⌛)    watch..hourglass done
            [0x231a, 0x231b],
            // E0.6   [4] (⏩..⏬)    fast-forward button..fast down button
            [0x23e9, 0x23ec],
            // E0.6   [1] (⏰)       alarm clock
            [0x23f0, 0x23f0],
            // E0.6   [1] (⏳)       hourglass not done
            [0x23f3, 0x23f3],
            // E0.6   [2] (◽..◾)    white medium-small square..black medium-small square
            [0x25fd, 0x25fe],
            // E0.6   [2] (☔..☕)    umbrella with rain drops..hot beverage
            [0x2614, 0x2615],
            // E0.6  [12] (♈..♓)    Aries..Pisces
            [0x2648, 0x2653],
            // E0.6   [1] (♿)       wheelchair symbol
            [0x267f, 0x267f],
            // E0.6   [1] (⚓)       anchor
            [0x2693, 0x2693],
            // E0.6   [1] (⚡)       high voltage
            [0x26a1, 0x26a1],
            // E0.6   [2] (⚪..⚫)    white circle..black circle
            [0x26aa, 0x26ab],
            // E0.6   [2] (⚽..⚾)    soccer ball..baseball
            [0x26bd, 0x26be],
            // E0.6   [2] (⛄..⛅)    snowman without snow..sun behind cloud
            [0x26c4, 0x26c5],
            // E0.6   [1] (⛎)       Ophiuchus
            [0x26ce, 0x26ce],
            // E0.6   [1] (⛔)       no entry
            [0x26d4, 0x26d4],
            // E0.6   [1] (⛪)       church
            [0x26ea, 0x26ea],
            // E0.6   [2] (⛲..⛳)    fountain..flag in hole
            [0x26f2, 0x26f3],
            // E0.6   [1] (⛵)       sailboat
            [0x26f5, 0x26f5],
            // E0.6   [1] (⛺)       tent
            [0x26fa, 0x26fa],
            // E0.6   [1] (⛽)       fuel pump
            [0x26fd, 0x26fd],
            // E0.6   [1] (✅)       check mark button
            [0x2705, 0x2705],
            // E0.6   [2] (✊..✋)    raised fist..raised hand
            [0x270a, 0x270b],
            // E0.6   [1] (✨)       sparkles
            [0x2728, 0x2728],
            // E0.6   [1] (❌)       cross mark
            [0x274c, 0x274c],
            // E0.6   [1] (❎)       cross mark button
            [0x274e, 0x274e],
            // E0.6   [3] (❓..❕)    red question mark..white exclamation mark
            [0x2753, 0x2755],
            // E0.6   [1] (❗)       red exclamation mark
            [0x2757, 0x2757],
            // E0.6   [3] (➕..➗)    plus..divide
            [0x2795, 0x2797],
            // E0.6   [1] (➰)       curly loop
            [0x27b0, 0x27b0],
            // E1.0   [1] (➿)       double curly loop
            [0x27bf, 0x27bf],
            // E0.6   [2] (⬛..⬜)    black large square..white large square
            [0x2b1b, 0x2b1c],
            // E0.6   [1] (⭐)       star
            [0x2b50, 0x2b50],
            // E0.6   [1] (⭕)       hollow red circle
            [0x2b55, 0x2b55],
            // E0.6   [1] (🀄)       mahjong red dragon
            [0x1f004, 0x1f004],
            // E0.6   [1] (🃏)       joker
            [0x1f0cf, 0x1f0cf],
            // E0.6   [1] (🆎)       AB button (blood type)
            [0x1f18e, 0x1f18e],
            // E0.6  [10] (🆑..🆚)    CL button..VS button
            [0x1f191, 0x1f19a],
            // E0.0  [26] (🇦..🇿)    regional indicator symbol letter a..regional indicator symbol letter z
            [0x1f1e6, 0x1f1ff],
            // E0.6   [1] (🈁)       Japanese “here” button
            [0x1f201, 0x1f201],
            // E0.6   [1] (🈚)       Japanese “free of charge” button
            [0x1f21a, 0x1f21a],
            // E0.6   [1] (🈯)       Japanese “reserved” button
            [0x1f22f, 0x1f22f],
            // E0.6   [5] (🈲..🈶)    Japanese “prohibited” button..Japanese “not free of charge” button
            [0x1f232, 0x1f236],
            // E0.6   [3] (🈸..🈺)    Japanese “application” button..Japanese “open for business” button
            [0x1f238, 0x1f23a],
            // E0.6   [2] (🉐..🉑)    Japanese “bargain” button..Japanese “acceptable” button
            [0x1f250, 0x1f251],
            // E0.6  [13] (🌀..🌌)    cyclone..milky way
            [0x1f300, 0x1f30c],
            // E0.7   [2] (🌍..🌎)    globe showing Europe-Africa..globe showing Americas
            [0x1f30d, 0x1f30e],
            // E0.6   [1] (🌏)       globe showing Asia-Australia
            [0x1f30f, 0x1f30f],
            // E1.0   [1] (🌐)       globe with meridians
            [0x1f310, 0x1f310],
            // E0.6   [1] (🌑)       new moon
            [0x1f311, 0x1f311],
            // E1.0   [1] (🌒)       waxing crescent moon
            [0x1f312, 0x1f312],
            // E0.6   [3] (🌓..🌕)    first quarter moon..full moon
            [0x1f313, 0x1f315],
            // E1.0   [3] (🌖..🌘)    waning gibbous moon..waning crescent moon
            [0x1f316, 0x1f318],
            // E0.6   [1] (🌙)       crescent moon
            [0x1f319, 0x1f319],
            // E1.0   [1] (🌚)       new moon face
            [0x1f31a, 0x1f31a],
            // E0.6   [1] (🌛)       first quarter moon face
            [0x1f31b, 0x1f31b],
            // E0.7   [1] (🌜)       last quarter moon face
            [0x1f31c, 0x1f31c],
            // E1.0   [2] (🌝..🌞)    full moon face..sun with face
            [0x1f31d, 0x1f31e],
            // E0.6   [2] (🌟..🌠)    glowing star..shooting star
            [0x1f31f, 0x1f320],
            // E1.0   [3] (🌭..🌯)    hot dog..burrito
            [0x1f32d, 0x1f32f],
            // E0.6   [2] (🌰..🌱)    chestnut..seedling
            [0x1f330, 0x1f331],
            // E1.0   [2] (🌲..🌳)    evergreen tree..deciduous tree
            [0x1f332, 0x1f333],
            // E0.6   [2] (🌴..🌵)    palm tree..cactus
            [0x1f334, 0x1f335],
            // E0.6  [20] (🌷..🍊)    tulip..tangerine
            [0x1f337, 0x1f34a],
            // E1.0   [1] (🍋)       lemon
            [0x1f34b, 0x1f34b],
            // E0.6   [4] (🍌..🍏)    banana..green apple
            [0x1f34c, 0x1f34f],
            // E1.0   [1] (🍐)       pear
            [0x1f350, 0x1f350],
            // E0.6  [43] (🍑..🍻)    peach..clinking beer mugs
            [0x1f351, 0x1f37b],
            // E1.0   [1] (🍼)       baby bottle
            [0x1f37c, 0x1f37c],
            // E1.0   [2] (🍾..🍿)    bottle with popping cork..popcorn
            [0x1f37e, 0x1f37f],
            // E0.6  [20] (🎀..🎓)    ribbon..graduation cap
            [0x1f380, 0x1f393],
            // E0.6  [37] (🎠..🏄)    carousel horse..person surfing
            [0x1f3a0, 0x1f3c4],
            // E1.0   [1] (🏅)       sports medal
            [0x1f3c5, 0x1f3c5],
            // E0.6   [1] (🏆)       trophy
            [0x1f3c6, 0x1f3c6],
            // E1.0   [1] (🏇)       horse racing
            [0x1f3c7, 0x1f3c7],
            // E0.6   [1] (🏈)       american football
            [0x1f3c8, 0x1f3c8],
            // E1.0   [1] (🏉)       rugby football
            [0x1f3c9, 0x1f3c9],
            // E0.6   [1] (🏊)       person swimming
            [0x1f3ca, 0x1f3ca],
            // E1.0   [5] (🏏..🏓)    cricket game..ping pong
            [0x1f3cf, 0x1f3d3],
            // E0.6   [4] (🏠..🏣)    house..Japanese post office
            [0x1f3e0, 0x1f3e3],
            // E1.0   [1] (🏤)       post office
            [0x1f3e4, 0x1f3e4],
            // E0.6  [12] (🏥..🏰)    hospital..castle
            [0x1f3e5, 0x1f3f0],
            // E1.0   [1] (🏴)       black flag
            [0x1f3f4, 0x1f3f4],
            // E1.0  [16] (🏸..🐇)    badminton..rabbit
            [0x1f3f8, 0x1f407],
            // E0.7   [1] (🐈)       cat
            [0x1f408, 0x1f408],
            // E1.0   [3] (🐉..🐋)    dragon..whale
            [0x1f409, 0x1f40b],
            // E0.6   [3] (🐌..🐎)    snail..horse
            [0x1f40c, 0x1f40e],
            // E1.0   [2] (🐏..🐐)    ram..goat
            [0x1f40f, 0x1f410],
            // E0.6   [2] (🐑..🐒)    ewe..monkey
            [0x1f411, 0x1f412],
            // E1.0   [1] (🐓)       rooster
            [0x1f413, 0x1f413],
            // E0.6   [1] (🐔)       chicken
            [0x1f414, 0x1f414],
            // E0.7   [1] (🐕)       dog
            [0x1f415, 0x1f415],
            // E1.0   [1] (🐖)       pig
            [0x1f416, 0x1f416],
            // E0.6  [19] (🐗..🐩)    boar..poodle
            [0x1f417, 0x1f429],
            // E1.0   [1] (🐪)       camel
            [0x1f42a, 0x1f42a],
            // E0.6  [20] (🐫..🐾)    two-hump camel..paw prints
            [0x1f42b, 0x1f43e],
            // E0.6   [1] (👀)       eyes
            [0x1f440, 0x1f440],
            // E0.6  [35] (👂..👤)    ear..bust in silhouette
            [0x1f442, 0x1f464],
            // E1.0   [1] (👥)       busts in silhouette
            [0x1f465, 0x1f465],
            // E0.6   [6] (👦..👫)    boy..woman and man holding hands
            [0x1f466, 0x1f46b],
            // E1.0   [2] (👬..👭)    men holding hands..women holding hands
            [0x1f46c, 0x1f46d],
            // E0.6  [63] (👮..💬)    police officer..speech balloon
            [0x1f46e, 0x1f4ac],
            // E1.0   [1] (💭)       thought balloon
            [0x1f4ad, 0x1f4ad],
            // E0.6   [8] (💮..💵)    white flower..dollar banknote
            [0x1f4ae, 0x1f4b5],
            // E1.0   [2] (💶..💷)    euro banknote..pound banknote
            [0x1f4b6, 0x1f4b7],
            // E0.6  [52] (💸..📫)    money with wings..closed mailbox with raised flag
            [0x1f4b8, 0x1f4eb],
            // E0.7   [2] (📬..📭)    open mailbox with raised flag..open mailbox with lowered flag
            [0x1f4ec, 0x1f4ed],
            // E0.6   [1] (📮)       postbox
            [0x1f4ee, 0x1f4ee],
            // E1.0   [1] (📯)       postal horn
            [0x1f4ef, 0x1f4ef],
            // E0.6   [5] (📰..📴)    newspaper..mobile phone off
            [0x1f4f0, 0x1f4f4],
            // E1.0   [1] (📵)       no mobile phones
            [0x1f4f5, 0x1f4f5],
            // E0.6   [2] (📶..📷)    antenna bars..camera
            [0x1f4f6, 0x1f4f7],
            // E1.0   [1] (📸)       camera with flash
            [0x1f4f8, 0x1f4f8],
            // E0.6   [4] (📹..📼)    video camera..videocassette
            [0x1f4f9, 0x1f4fc],
            // E1.0   [4] (📿..🔂)    prayer beads..repeat single button
            [0x1f4ff, 0x1f502],
            // E0.6   [1] (🔃)       clockwise vertical arrows
            [0x1f503, 0x1f503],
            // E1.0   [4] (🔄..🔇)    counterclockwise arrows button..muted speaker
            [0x1f504, 0x1f507],
            // E0.7   [1] (🔈)       speaker low volume
            [0x1f508, 0x1f508],
            // E1.0   [1] (🔉)       speaker medium volume
            [0x1f509, 0x1f509],
            // E0.6  [11] (🔊..🔔)    speaker high volume..bell
            [0x1f50a, 0x1f514],
            // E1.0   [1] (🔕)       bell with slash
            [0x1f515, 0x1f515],
            // E0.6  [22] (🔖..🔫)    bookmark..water pistol
            [0x1f516, 0x1f52b],
            // E1.0   [2] (🔬..🔭)    microscope..telescope
            [0x1f52c, 0x1f52d],
            // E0.6  [16] (🔮..🔽)    crystal ball..downwards button
            [0x1f52e, 0x1f53d],
            // E1.0   [4] (🕋..🕎)    kaaba..menorah
            [0x1f54b, 0x1f54e],
            // E0.6  [12] (🕐..🕛)    one o’clock..twelve o’clock
            [0x1f550, 0x1f55b],
            // E0.7  [12] (🕜..🕧)    one-thirty..twelve-thirty
            [0x1f55c, 0x1f567],
            // E3.0   [1] (🕺)       man dancing
            [0x1f57a, 0x1f57a],
            // E1.0   [2] (🖕..🖖)    middle finger..vulcan salute
            [0x1f595, 0x1f596],
            // E3.0   [1] (🖤)       black heart
            [0x1f5a4, 0x1f5a4],
            // E0.6   [5] (🗻..🗿)    mount fuji..moai
            [0x1f5fb, 0x1f5ff],
            // E1.0   [1] (😀)       grinning face
            [0x1f600, 0x1f600],
            // E0.6   [6] (😁..😆)    beaming face with smiling eyes..grinning squinting face
            [0x1f601, 0x1f606],
            // E1.0   [2] (😇..😈)    smiling face with halo..smiling face with horns
            [0x1f607, 0x1f608],
            // E0.6   [5] (😉..😍)    winking face..smiling face with heart-eyes
            [0x1f609, 0x1f60d],
            // E1.0   [1] (😎)       smiling face with sunglasses
            [0x1f60e, 0x1f60e],
            // E0.6   [1] (😏)       smirking face
            [0x1f60f, 0x1f60f],
            // E0.7   [1] (😐)       neutral face
            [0x1f610, 0x1f610],
            // E1.0   [1] (😑)       expressionless face
            [0x1f611, 0x1f611],
            // E0.6   [3] (😒..😔)    unamused face..pensive face
            [0x1f612, 0x1f614],
            // E1.0   [1] (😕)       confused face
            [0x1f615, 0x1f615],
            // E0.6   [1] (😖)       confounded face
            [0x1f616, 0x1f616],
            // E1.0   [1] (😗)       kissing face
            [0x1f617, 0x1f617],
            // E0.6   [1] (😘)       face blowing a kiss
            [0x1f618, 0x1f618],
            // E1.0   [1] (😙)       kissing face with smiling eyes
            [0x1f619, 0x1f619],
            // E0.6   [1] (😚)       kissing face with closed eyes
            [0x1f61a, 0x1f61a],
            // E1.0   [1] (😛)       face with tongue
            [0x1f61b, 0x1f61b],
            // E0.6   [3] (😜..😞)    winking face with tongue..disappointed face
            [0x1f61c, 0x1f61e],
            // E1.0   [1] (😟)       worried face
            [0x1f61f, 0x1f61f],
            // E0.6   [6] (😠..😥)    angry face..sad but relieved face
            [0x1f620, 0x1f625],
            // E1.0   [2] (😦..😧)    frowning face with open mouth..anguished face
            [0x1f626, 0x1f627],
            // E0.6   [4] (😨..😫)    fearful face..tired face
            [0x1f628, 0x1f62b],
            // E1.0   [1] (😬)       grimacing face
            [0x1f62c, 0x1f62c],
            // E0.6   [1] (😭)       loudly crying face
            [0x1f62d, 0x1f62d],
            // E1.0   [2] (😮..😯)    face with open mouth..hushed face
            [0x1f62e, 0x1f62f],
            // E0.6   [4] (😰..😳)    anxious face with sweat..flushed face
            [0x1f630, 0x1f633],
            // E1.0   [1] (😴)       sleeping face
            [0x1f634, 0x1f634],
            // E0.6   [1] (😵)       face with crossed-out eyes
            [0x1f635, 0x1f635],
            // E1.0   [1] (😶)       face without mouth
            [0x1f636, 0x1f636],
            // E0.6  [10] (😷..🙀)    face with medical mask..weary cat
            [0x1f637, 0x1f640],
            // E1.0   [4] (🙁..🙄)    slightly frowning face..face with rolling eyes
            [0x1f641, 0x1f644],
            // E0.6  [11] (🙅..🙏)    person gesturing NO..folded hands
            [0x1f645, 0x1f64f],
            // E0.6   [1] (🚀)       rocket
            [0x1f680, 0x1f680],
            // E1.0   [2] (🚁..🚂)    helicopter..locomotive
            [0x1f681, 0x1f682],
            // E0.6   [3] (🚃..🚅)    railway car..bullet train
            [0x1f683, 0x1f685],
            // E1.0   [1] (🚆)       train
            [0x1f686, 0x1f686],
            // E0.6   [1] (🚇)       metro
            [0x1f687, 0x1f687],
            // E1.0   [1] (🚈)       light rail
            [0x1f688, 0x1f688],
            // E0.6   [1] (🚉)       station
            [0x1f689, 0x1f689],
            // E1.0   [2] (🚊..🚋)    tram..tram car
            [0x1f68a, 0x1f68b],
            // E0.6   [1] (🚌)       bus
            [0x1f68c, 0x1f68c],
            // E0.7   [1] (🚍)       oncoming bus
            [0x1f68d, 0x1f68d],
            // E1.0   [1] (🚎)       trolleybus
            [0x1f68e, 0x1f68e],
            // E0.6   [1] (🚏)       bus stop
            [0x1f68f, 0x1f68f],
            // E1.0   [1] (🚐)       minibus
            [0x1f690, 0x1f690],
            // E0.6   [3] (🚑..🚓)    ambulance..police car
            [0x1f691, 0x1f693],
            // E0.7   [1] (🚔)       oncoming police car
            [0x1f694, 0x1f694],
            // E0.6   [1] (🚕)       taxi
            [0x1f695, 0x1f695],
            // E1.0   [1] (🚖)       oncoming taxi
            [0x1f696, 0x1f696],
            // E0.6   [1] (🚗)       automobile
            [0x1f697, 0x1f697],
            // E0.7   [1] (🚘)       oncoming automobile
            [0x1f698, 0x1f698],
            // E0.6   [2] (🚙..🚚)    sport utility vehicle..delivery truck
            [0x1f699, 0x1f69a],
            // E1.0   [7] (🚛..🚡)    articulated lorry..aerial tramway
            [0x1f69b, 0x1f6a1],
            // E0.6   [1] (🚢)       ship
            [0x1f6a2, 0x1f6a2],
            // E1.0   [1] (🚣)       person rowing boat
            [0x1f6a3, 0x1f6a3],
            // E0.6   [2] (🚤..🚥)    speedboat..horizontal traffic light
            [0x1f6a4, 0x1f6a5],
            // E1.0   [1] (🚦)       vertical traffic light
            [0x1f6a6, 0x1f6a6],
            // E0.6   [7] (🚧..🚭)    construction..no smoking
            [0x1f6a7, 0x1f6ad],
            // E1.0   [4] (🚮..🚱)    litter in bin sign..non-potable water
            [0x1f6ae, 0x1f6b1],
            // E0.6   [1] (🚲)       bicycle
            [0x1f6b2, 0x1f6b2],
            // E1.0   [3] (🚳..🚵)    no bicycles..person mountain biking
            [0x1f6b3, 0x1f6b5],
            // E0.6   [1] (🚶)       person walking
            [0x1f6b6, 0x1f6b6],
            // E1.0   [2] (🚷..🚸)    no pedestrians..children crossing
            [0x1f6b7, 0x1f6b8],
            // E0.6   [6] (🚹..🚾)    men’s room..water closet
            [0x1f6b9, 0x1f6be],
            // E1.0   [1] (🚿)       shower
            [0x1f6bf, 0x1f6bf],
            // E0.6   [1] (🛀)       person taking bath
            [0x1f6c0, 0x1f6c0],
            // E1.0   [5] (🛁..🛅)    bathtub..left luggage
            [0x1f6c1, 0x1f6c5],
            // E1.0   [1] (🛌)       person in bed
            [0x1f6cc, 0x1f6cc],
            // E1.0   [1] (🛐)       place of worship
            [0x1f6d0, 0x1f6d0],
            // E3.0   [2] (🛑..🛒)    stop sign..shopping cart
            [0x1f6d1, 0x1f6d2],
            // E12.0  [1] (🛕)       hindu temple
            [0x1f6d5, 0x1f6d5],
            // E13.0  [2] (🛖..🛗)    hut..elevator
            [0x1f6d6, 0x1f6d7],
            // E17.0  [1] (🛘)       landslide
            [0x1f6d8, 0x1f6d8],
            // E18.0  [1] (🛙)       lighthouse
            [0x1f6d9, 0x1f6d9],
            // E15.0  [1] (🛜)       wireless
            [0x1f6dc, 0x1f6dc],
            // E14.0  [3] (🛝..🛟)    playground slide..ring buoy
            [0x1f6dd, 0x1f6df],
            // E1.0   [2] (🛫..🛬)    airplane departure..airplane arrival
            [0x1f6eb, 0x1f6ec],
            // E3.0   [3] (🛴..🛶)    kick scooter..canoe
            [0x1f6f4, 0x1f6f6],
            // E5.0   [2] (🛷..🛸)    sled..flying saucer
            [0x1f6f7, 0x1f6f8],
            // E11.0  [1] (🛹)       skateboard
            [0x1f6f9, 0x1f6f9],
            // E12.0  [1] (🛺)       auto rickshaw
            [0x1f6fa, 0x1f6fa],
            // E13.0  [2] (🛻..🛼)    pickup truck..roller skate
            [0x1f6fb, 0x1f6fc],
            // E12.0 [12] (🟠..🟫)    orange circle..brown square
            [0x1f7e0, 0x1f7eb],
            // E14.0  [1] (🟰)       heavy equals sign
            [0x1f7f0, 0x1f7f0],
            // E13.0  [1] (🤌)       pinched fingers
            [0x1f90c, 0x1f90c],
            // E12.0  [3] (🤍..🤏)    white heart..pinching hand
            [0x1f90d, 0x1f90f],
            // E1.0   [9] (🤐..🤘)    zipper-mouth face..sign of the horns
            [0x1f910, 0x1f918],
            // E3.0   [6] (🤙..🤞)    call me hand..crossed fingers
            [0x1f919, 0x1f91e],
            // E5.0   [1] (🤟)       love-you gesture
            [0x1f91f, 0x1f91f],
            // E3.0   [8] (🤠..🤧)    cowboy hat face..sneezing face
            [0x1f920, 0x1f927],
            // E5.0   [8] (🤨..🤯)    face with raised eyebrow..exploding head
            [0x1f928, 0x1f92f],
            // E3.0   [1] (🤰)       pregnant woman
            [0x1f930, 0x1f930],
            // E5.0   [2] (🤱..🤲)    breast-feeding..palms up together
            [0x1f931, 0x1f932],
            // E3.0   [8] (🤳..🤺)    selfie..person fencing
            [0x1f933, 0x1f93a],
            // E3.0   [3] (🤼..🤾)    people wrestling..person playing handball
            [0x1f93c, 0x1f93e],
            // E12.0  [1] (🤿)       diving mask
            [0x1f93f, 0x1f93f],
            // E3.0   [6] (🥀..🥅)    wilted flower..goal net
            [0x1f940, 0x1f945],
            // E3.0   [5] (🥇..🥋)    1st place medal..martial arts uniform
            [0x1f947, 0x1f94b],
            // E5.0   [1] (🥌)       curling stone
            [0x1f94c, 0x1f94c],
            // E11.0  [3] (🥍..🥏)    lacrosse..flying disc
            [0x1f94d, 0x1f94f],
            // E3.0  [15] (🥐..🥞)    croissant..pancakes
            [0x1f950, 0x1f95e],
            // E5.0  [13] (🥟..🥫)    dumpling..canned food
            [0x1f95f, 0x1f96b],
            // E11.0  [5] (🥬..🥰)    leafy green..smiling face with hearts
            [0x1f96c, 0x1f970],
            // E12.0  [1] (🥱)       yawning face
            [0x1f971, 0x1f971],
            // E13.0  [1] (🥲)       smiling face with tear
            [0x1f972, 0x1f972],
            // E11.0  [4] (🥳..🥶)    partying face..cold face
            [0x1f973, 0x1f976],
            // E13.0  [2] (🥷..🥸)    ninja..disguised face
            [0x1f977, 0x1f978],
            // E14.0  [1] (🥹)       face holding back tears
            [0x1f979, 0x1f979],
            // E11.0  [1] (🥺)       pleading face
            [0x1f97a, 0x1f97a],
            // E12.0  [1] (🥻)       sari
            [0x1f97b, 0x1f97b],
            // E11.0  [4] (🥼..🥿)    lab coat..flat shoe
            [0x1f97c, 0x1f97f],
            // E1.0   [5] (🦀..🦄)    crab..unicorn
            [0x1f980, 0x1f984],
            // E3.0  [13] (🦅..🦑)    eagle..squid
            [0x1f985, 0x1f991],
            // E5.0   [6] (🦒..🦗)    giraffe..cricket
            [0x1f992, 0x1f997],
            // E11.0 [11] (🦘..🦢)    kangaroo..swan
            [0x1f998, 0x1f9a2],
            // E13.0  [2] (🦣..🦤)    mammoth..dodo
            [0x1f9a3, 0x1f9a4],
            // E12.0  [6] (🦥..🦪)    sloth..oyster
            [0x1f9a5, 0x1f9aa],
            // E13.0  [3] (🦫..🦭)    beaver..seal
            [0x1f9ab, 0x1f9ad],
            // E12.0  [2] (🦮..🦯)    guide dog..white cane
            [0x1f9ae, 0x1f9af],
            // E11.0 [10] (🦰..🦹)    red hair..supervillain
            [0x1f9b0, 0x1f9b9],
            // E12.0  [6] (🦺..🦿)    safety vest..mechanical leg
            [0x1f9ba, 0x1f9bf],
            // E1.0   [1] (🧀)       cheese wedge
            [0x1f9c0, 0x1f9c0],
            // E11.0  [2] (🧁..🧂)    cupcake..salt
            [0x1f9c1, 0x1f9c2],
            // E12.0  [8] (🧃..🧊)    beverage box..ice
            [0x1f9c3, 0x1f9ca],
            // E13.0  [1] (🧋)       bubble tea
            [0x1f9cb, 0x1f9cb],
            // E14.0  [1] (🧌)       troll
            [0x1f9cc, 0x1f9cc],
            // E12.0  [3] (🧍..🧏)    person standing..deaf person
            [0x1f9cd, 0x1f9cf],
            // E5.0  [23] (🧐..🧦)    face with monocle..socks
            [0x1f9d0, 0x1f9e6],
            // E11.0 [25] (🧧..🧿)    red envelope..nazar amulet
            [0x1f9e7, 0x1f9ff],
            // E12.0  [4] (🩰..🩳)    ballet shoes..shorts
            [0x1fa70, 0x1fa73],
            // E13.0  [1] (🩴)       thong sandal
            [0x1fa74, 0x1fa74],
            // E15.0  [3] (🩵..🩷)    light blue heart..pink heart
            [0x1fa75, 0x1fa77],
            // E12.0  [3] (🩸..🩺)    drop of blood..stethoscope
            [0x1fa78, 0x1fa7a],
            // E14.0  [2] (🩻..🩼)    x-ray..crutch
            [0x1fa7b, 0x1fa7c],
            // E12.0  [3] (🪀..🪂)    yo-yo..parachute
            [0x1fa80, 0x1fa82],
            // E13.0  [4] (🪃..🪆)    boomerang..nesting dolls
            [0x1fa83, 0x1fa86],
            // E15.0  [2] (🪇..🪈)    maracas..flute
            [0x1fa87, 0x1fa88],
            // E16.0  [1] (🪉)       harp
            [0x1fa89, 0x1fa89],
            // E17.0  [1] (🪊)       trombone
            [0x1fa8a, 0x1fa8a],
            // E18.0  [3] (🪋..🪍)    meteor..net with handle
            [0x1fa8b, 0x1fa8d],
            // E17.0  [1] (🪎)       treasure chest
            [0x1fa8e, 0x1fa8e],
            // E16.0  [1] (🪏)       shovel
            [0x1fa8f, 0x1fa8f],
            // E12.0  [6] (🪐..🪕)    ringed planet..banjo
            [0x1fa90, 0x1fa95],
            // E13.0 [19] (🪖..🪨)    military helmet..rock
            [0x1fa96, 0x1faa8],
            // E14.0  [4] (🪩..🪬)    mirror ball..hamsa
            [0x1faa9, 0x1faac],
            // E15.0  [3] (🪭..🪯)    folding hand fan..khanda
            [0x1faad, 0x1faaf],
            // E13.0  [7] (🪰..🪶)    fly..feather
            [0x1fab0, 0x1fab6],
            // E14.0  [4] (🪷..🪺)    lotus..nest with eggs
            [0x1fab7, 0x1faba],
            // E15.0  [3] (🪻..🪽)    hyacinth..wing
            [0x1fabb, 0x1fabd],
            // E16.0  [1] (🪾)       leafless tree
            [0x1fabe, 0x1fabe],
            // E15.0  [1] (🪿)       goose
            [0x1fabf, 0x1fabf],
            // E13.0  [3] (🫀..🫂)    anatomical heart..people hugging
            [0x1fac0, 0x1fac2],
            // E14.0  [3] (🫃..🫅)    pregnant man..person with crown
            [0x1fac3, 0x1fac5],
            // E16.0  [1] (🫆)       fingerprint
            [0x1fac6, 0x1fac6],
            // E17.0  [1] (🫈)       hairy creature
            [0x1fac8, 0x1fac8],
            // E18.0  [1] (🫌)       monarch butterfly
            [0x1facc, 0x1facc],
            // E17.0  [1] (🫍)       orca
            [0x1facd, 0x1facd],
            // E15.0  [2] (🫎..🫏)    moose..donkey
            [0x1face, 0x1facf],
            // E13.0  [7] (🫐..🫖)    blueberries..teapot
            [0x1fad0, 0x1fad6],
            // E14.0  [3] (🫗..🫙)    pouring liquid..jar
            [0x1fad7, 0x1fad9],
            // E15.0  [2] (🫚..🫛)    ginger root..pea pod
            [0x1fada, 0x1fadb],
            // E16.0  [1] (🫜)       root vegetable
            [0x1fadc, 0x1fadc],
            // E18.0  [1] (🫝)       pickle
            [0x1fadd, 0x1fadd],
            // E16.0  [1] (🫟)       splatter
            [0x1fadf, 0x1fadf],
            // E14.0  [8] (🫠..🫧)    melting face..bubbles
            [0x1fae0, 0x1fae7],
            // E15.0  [1] (🫨)       shaking face
            [0x1fae8, 0x1fae8],
            // E16.0  [1] (🫩)       face with bags under eyes
            [0x1fae9, 0x1fae9],
            // E17.0  [1] (🫪)       distorted face
            [0x1faea, 0x1faea],
            // E18.0  [1] (🫫)       cracking face
            [0x1faeb, 0x1faeb],
            // E17.0  [1] (🫯)       fight cloud
            [0x1faef, 0x1faef],
            // E14.0  [7] (🫰..🫶)    hand with index finger and thumb crossed..heart hands
            [0x1faf0, 0x1faf6],
            // E15.0  [2] (🫷..🫸)    leftwards pushing hand..rightwards pushing hand
            [0x1faf7, 0x1faf8],
            // E18.0  [2] (🫹..🫺)    leftwards thumb sign..rightwards thumb sign
            [0x1faf9, 0x1fafa],
        ],
    },
    {
        label: 'Emoji Modifier Base',
        ranges: [
            // E0.6   [1] (☝️)       index pointing up
            [0x261d, 0x261d],
            // E0.7   [1] (⛹️)       person bouncing ball
            [0x26f9, 0x26f9],
            // E0.6   [3] (✊..✌️)    raised fist..victory hand
            [0x270a, 0x270c],
            // E0.7   [1] (✍️)       writing hand
            [0x270d, 0x270d],
            // E0.6   [1] (🎅)       Santa Claus
            [0x1f385, 0x1f385],
            // E0.6   [3] (🏂..🏄)    snowboarder..person surfing
            [0x1f3c2, 0x1f3c4],
            // E1.0   [1] (🏇)       horse racing
            [0x1f3c7, 0x1f3c7],
            // E0.6   [1] (🏊)       person swimming
            [0x1f3ca, 0x1f3ca],
            // E0.7   [2] (🏋️..🏌️)    person lifting weights..person golfing
            [0x1f3cb, 0x1f3cc],
            // E0.6   [2] (👂..👃)    ear..nose
            [0x1f442, 0x1f443],
            // E0.6  [11] (👆..👐)    backhand index pointing up..open hands
            [0x1f446, 0x1f450],
            // E0.6   [6] (👦..👫)    boy..woman and man holding hands
            [0x1f466, 0x1f46b],
            // E1.0   [2] (👬..👭)    men holding hands..women holding hands
            [0x1f46c, 0x1f46d],
            // E0.6  [11] (👮..👸)    police officer..princess
            [0x1f46e, 0x1f478],
            // E0.6   [1] (👼)       baby angel
            [0x1f47c, 0x1f47c],
            // E0.6   [3] (💁..💃)    person tipping hand..woman dancing
            [0x1f481, 0x1f483],
            // E0.6   [3] (💅..💇)    nail polish..person getting haircut
            [0x1f485, 0x1f487],
            // E0.6   [1] (💏)       kiss
            [0x1f48f, 0x1f48f],
            // E0.6   [1] (💑)       couple with heart
            [0x1f491, 0x1f491],
            // E0.6   [1] (💪)       flexed biceps
            [0x1f4aa, 0x1f4aa],
            // E0.7   [2] (🕴️..🕵️)    person in suit levitating..detective
            [0x1f574, 0x1f575],
            // E3.0   [1] (🕺)       man dancing
            [0x1f57a, 0x1f57a],
            // E0.7   [1] (🖐️)       hand with fingers splayed
            [0x1f590, 0x1f590],
            // E1.0   [2] (🖕..🖖)    middle finger..vulcan salute
            [0x1f595, 0x1f596],
            // E0.6   [3] (🙅..🙇)    person gesturing NO..person bowing
            [0x1f645, 0x1f647],
            // E0.6   [5] (🙋..🙏)    person raising hand..folded hands
            [0x1f64b, 0x1f64f],
            // E1.0   [1] (🚣)       person rowing boat
            [0x1f6a3, 0x1f6a3],
            // E1.0   [2] (🚴..🚵)    person biking..person mountain biking
            [0x1f6b4, 0x1f6b5],
            // E0.6   [1] (🚶)       person walking
            [0x1f6b6, 0x1f6b6],
            // E0.6   [1] (🛀)       person taking bath
            [0x1f6c0, 0x1f6c0],
            // E1.0   [1] (🛌)       person in bed
            [0x1f6cc, 0x1f6cc],
            // E13.0  [1] (🤌)       pinched fingers
            [0x1f90c, 0x1f90c],
            // E12.0  [1] (🤏)       pinching hand
            [0x1f90f, 0x1f90f],
            // E1.0   [1] (🤘)       sign of the horns
            [0x1f918, 0x1f918],
            // E3.0   [6] (🤙..🤞)    call me hand..crossed fingers
            [0x1f919, 0x1f91e],
            // E5.0   [1] (🤟)       love-you gesture
            [0x1f91f, 0x1f91f],
            // E3.0   [1] (🤦)       person facepalming
            [0x1f926, 0x1f926],
            // E3.0   [1] (🤰)       pregnant woman
            [0x1f930, 0x1f930],
            // E5.0   [2] (🤱..🤲)    breast-feeding..palms up together
            [0x1f931, 0x1f932],
            // E3.0   [7] (🤳..🤹)    selfie..person juggling
            [0x1f933, 0x1f939],
            // E3.0   [3] (🤼..🤾)    people wrestling..person playing handball
            [0x1f93c, 0x1f93e],
            // E13.0  [1] (🥷)       ninja
            [0x1f977, 0x1f977],
            // E11.0  [2] (🦵..🦶)    leg..foot
            [0x1f9b5, 0x1f9b6],
            // E11.0  [2] (🦸..🦹)    superhero..supervillain
            [0x1f9b8, 0x1f9b9],
            // E12.0  [1] (🦻)       ear with hearing aid
            [0x1f9bb, 0x1f9bb],
            // E12.0  [3] (🧍..🧏)    person standing..deaf person
            [0x1f9cd, 0x1f9cf],
            // E5.0  [13] (🧑..🧝)    person..elf
            [0x1f9d1, 0x1f9dd],
            // E14.0  [3] (🫃..🫅)    pregnant man..person with crown
            [0x1fac3, 0x1fac5],
            // E14.0  [7] (🫰..🫶)    hand with index finger and thumb crossed..heart hands
            [0x1faf0, 0x1faf6],
            // E15.0  [2] (🫷..🫸)    leftwards pushing hand..rightwards pushing hand
            [0x1faf7, 0x1faf8],
            // E18.0  [2] (🫹..🫺)    leftwards thumb sign..rightwards thumb sign
            [0x1faf9, 0x1fafa],
        ],
    },
    {
        label: 'Emoji Component',
        subsets: ['emoji-component'],
        ranges: [
            // E0.0   [1] (#️)       hash sign
            [0x0023, 0x0023],
            // E0.0   [1] (*️)       asterisk
            [0x002a, 0x002a],
            // E0.0  [10] (0️..9️)    digit zero..digit nine
            [0x0030, 0x0039],
            // E0.0   [1] (‍)        zero width joiner
            [0x200d, 0x200d],
            // E0.0   [1] (⃣)       combining enclosing keycap
            [0x20e3, 0x20e3],
            // E0.0   [1] ()        VARIATION SELECTOR-16
            [0xfe0f, 0xfe0f],
            // E0.0  [26] (🇦..🇿)    regional indicator symbol letter a..regional indicator symbol letter z
            [0x1f1e6, 0x1f1ff],
            // E1.0   [5] (🏻..🏿)    light skin tone..dark skin tone
            [0x1f3fb, 0x1f3ff],
            // E11.0  [4] (🦰..🦳)    red hair..white hair
            [0x1f9b0, 0x1f9b3],
            // E0.0  [96] (󠀠..󠁿)      tag space..cancel tag
            [0xe0020, 0xe007f],
        ],
    },
    {
        label: 'Extended Pictographic',
        ranges: [
            // E0.6   [1] (©️)       copyright
            [0x00a9, 0x00a9],
            // E0.6   [1] (®️)       registered
            [0x00ae, 0x00ae],
            // E0.6   [1] (‼️)       double exclamation mark
            [0x203c, 0x203c],
            // E0.6   [1] (⁉️)       exclamation question mark
            [0x2049, 0x2049],
            // E0.6   [1] (™️)       trade mark
            [0x2122, 0x2122],
            // E0.6   [1] (ℹ️)       information
            [0x2139, 0x2139],
            // E0.6   [6] (↔️..↙️)    left-right arrow..down-left arrow
            [0x2194, 0x2199],
            // E0.6   [2] (↩️..↪️)    right arrow curving left..left arrow curving right
            [0x21a9, 0x21aa],
            // E0.6   [2] (⌚..⌛)    watch..hourglass done
            [0x231a, 0x231b],
            // E1.0   [1] (⌨️)       keyboard
            [0x2328, 0x2328],
            // E1.0   [1] (⏏️)       eject button
            [0x23cf, 0x23cf],
            // E0.6   [4] (⏩..⏬)    fast-forward button..fast down button
            [0x23e9, 0x23ec],
            // E0.7   [2] (⏭️..⏮️)    next track button..last track button
            [0x23ed, 0x23ee],
            // E1.0   [1] (⏯️)       play or pause button
            [0x23ef, 0x23ef],
            // E0.6   [1] (⏰)       alarm clock
            [0x23f0, 0x23f0],
            // E1.0   [2] (⏱️..⏲️)    stopwatch..timer clock
            [0x23f1, 0x23f2],
            // E0.6   [1] (⏳)       hourglass not done
            [0x23f3, 0x23f3],
            // E0.7   [3] (⏸️..⏺️)    pause button..record button
            [0x23f8, 0x23fa],
            // E0.6   [1] (Ⓜ️)       circled M
            [0x24c2, 0x24c2],
            // E0.6   [2] (▪️..▫️)    black small square..white small square
            [0x25aa, 0x25ab],
            // E0.6   [1] (▶️)       play button
            [0x25b6, 0x25b6],
            // E0.6   [1] (◀️)       reverse button
            [0x25c0, 0x25c0],
            // E0.6   [4] (◻️..◾)    white medium square..black medium-small square
            [0x25fb, 0x25fe],
            // E0.6   [2] (☀️..☁️)    sun..cloud
            [0x2600, 0x2601],
            // E0.7   [2] (☂️..☃️)    umbrella..snowman
            [0x2602, 0x2603],
            // E1.0   [1] (☄️)       comet
            [0x2604, 0x2604],
            // E0.6   [1] (☎️)       telephone
            [0x260e, 0x260e],
            // E0.6   [1] (☑️)       check box with check
            [0x2611, 0x2611],
            // E0.6   [2] (☔..☕)    umbrella with rain drops..hot beverage
            [0x2614, 0x2615],
            // E1.0   [1] (☘️)       shamrock
            [0x2618, 0x2618],
            // E0.6   [1] (☝️)       index pointing up
            [0x261d, 0x261d],
            // E1.0   [1] (☠️)       skull and crossbones
            [0x2620, 0x2620],
            // E1.0   [2] (☢️..☣️)    radioactive..biohazard
            [0x2622, 0x2623],
            // E1.0   [1] (☦️)       orthodox cross
            [0x2626, 0x2626],
            // E0.7   [1] (☪️)       star and crescent
            [0x262a, 0x262a],
            // E1.0   [1] (☮️)       peace symbol
            [0x262e, 0x262e],
            // E0.7   [1] (☯️)       yin yang
            [0x262f, 0x262f],
            // E0.7   [2] (☸️..☹️)    wheel of dharma..frowning face
            [0x2638, 0x2639],
            // E0.6   [1] (☺️)       smiling face
            [0x263a, 0x263a],
            // E4.0   [1] (♀️)       female sign
            [0x2640, 0x2640],
            // E4.0   [1] (♂️)       male sign
            [0x2642, 0x2642],
            // E0.6  [12] (♈..♓)    Aries..Pisces
            [0x2648, 0x2653],
            // E11.0  [1] (♟️)       chess pawn
            [0x265f, 0x265f],
            // E0.6   [1] (♠️)       spade suit
            [0x2660, 0x2660],
            // E0.6   [1] (♣️)       club suit
            [0x2663, 0x2663],
            // E0.6   [2] (♥️..♦️)    heart suit..diamond suit
            [0x2665, 0x2666],
            // E0.6   [1] (♨️)       hot springs
            [0x2668, 0x2668],
            // E0.6   [1] (♻️)       recycling symbol
            [0x267b, 0x267b],
            // E11.0  [1] (♾️)       infinity
            [0x267e, 0x267e],
            // E0.6   [1] (♿)       wheelchair symbol
            [0x267f, 0x267f],
            // E1.0   [1] (⚒️)       hammer and pick
            [0x2692, 0x2692],
            // E0.6   [1] (⚓)       anchor
            [0x2693, 0x2693],
            // E1.0   [1] (⚔️)       crossed swords
            [0x2694, 0x2694],
            // E4.0   [1] (⚕️)       medical symbol
            [0x2695, 0x2695],
            // E1.0   [2] (⚖️..⚗️)    balance scale..alembic
            [0x2696, 0x2697],
            // E1.0   [1] (⚙️)       gear
            [0x2699, 0x2699],
            // E1.0   [2] (⚛️..⚜️)    atom symbol..fleur-de-lis
            [0x269b, 0x269c],
            // E0.6   [2] (⚠️..⚡)    warning..high voltage
            [0x26a0, 0x26a1],
            // E13.0  [1] (⚧️)       transgender symbol
            [0x26a7, 0x26a7],
            // E0.6   [2] (⚪..⚫)    white circle..black circle
            [0x26aa, 0x26ab],
            // E1.0   [2] (⚰️..⚱️)    coffin..funeral urn
            [0x26b0, 0x26b1],
            // E0.6   [2] (⚽..⚾)    soccer ball..baseball
            [0x26bd, 0x26be],
            // E0.6   [2] (⛄..⛅)    snowman without snow..sun behind cloud
            [0x26c4, 0x26c5],
            // E0.7   [1] (⛈️)       cloud with lightning and rain
            [0x26c8, 0x26c8],
            // E0.6   [1] (⛎)       Ophiuchus
            [0x26ce, 0x26ce],
            // E0.7   [1] (⛏️)       pick
            [0x26cf, 0x26cf],
            // E0.7   [1] (⛑️)       rescue worker’s helmet
            [0x26d1, 0x26d1],
            // E0.7   [1] (⛓️)       chains
            [0x26d3, 0x26d3],
            // E0.6   [1] (⛔)       no entry
            [0x26d4, 0x26d4],
            // E0.7   [1] (⛩️)       shinto shrine
            [0x26e9, 0x26e9],
            // E0.6   [1] (⛪)       church
            [0x26ea, 0x26ea],
            // E0.7   [2] (⛰️..⛱️)    mountain..umbrella on ground
            [0x26f0, 0x26f1],
            // E0.6   [2] (⛲..⛳)    fountain..flag in hole
            [0x26f2, 0x26f3],
            // E0.7   [1] (⛴️)       ferry
            [0x26f4, 0x26f4],
            // E0.6   [1] (⛵)       sailboat
            [0x26f5, 0x26f5],
            // E0.7   [3] (⛷️..⛹️)    skier..person bouncing ball
            [0x26f7, 0x26f9],
            // E0.6   [1] (⛺)       tent
            [0x26fa, 0x26fa],
            // E0.6   [1] (⛽)       fuel pump
            [0x26fd, 0x26fd],
            // E0.6   [1] (✂️)       scissors
            [0x2702, 0x2702],
            // E0.6   [1] (✅)       check mark button
            [0x2705, 0x2705],
            // E0.6   [5] (✈️..✌️)    airplane..victory hand
            [0x2708, 0x270c],
            // E0.7   [1] (✍️)       writing hand
            [0x270d, 0x270d],
            // E0.6   [1] (✏️)       pencil
            [0x270f, 0x270f],
            // E0.6   [1] (✒️)       black nib
            [0x2712, 0x2712],
            // E0.6   [1] (✔️)       check mark
            [0x2714, 0x2714],
            // E0.6   [1] (✖️)       multiply
            [0x2716, 0x2716],
            // E0.7   [1] (✝️)       latin cross
            [0x271d, 0x271d],
            // E0.7   [1] (✡️)       star of David
            [0x2721, 0x2721],
            // E0.6   [1] (✨)       sparkles
            [0x2728, 0x2728],
            // E0.6   [2] (✳️..✴️)    eight-spoked asterisk..eight-pointed star
            [0x2733, 0x2734],
            // E0.6   [1] (❄️)       snowflake
            [0x2744, 0x2744],
            // E0.6   [1] (❇️)       sparkle
            [0x2747, 0x2747],
            // E0.6   [1] (❌)       cross mark
            [0x274c, 0x274c],
            // E0.6   [1] (❎)       cross mark button
            [0x274e, 0x274e],
            // E0.6   [3] (❓..❕)    red question mark..white exclamation mark
            [0x2753, 0x2755],
            // E0.6   [1] (❗)       red exclamation mark
            [0x2757, 0x2757],
            // E1.0   [1] (❣️)       heart exclamation
            [0x2763, 0x2763],
            // E0.6   [1] (❤️)       red heart
            [0x2764, 0x2764],
            // E0.6   [3] (➕..➗)    plus..divide
            [0x2795, 0x2797],
            // E0.6   [1] (➡️)       right arrow
            [0x27a1, 0x27a1],
            // E0.6   [1] (➰)       curly loop
            [0x27b0, 0x27b0],
            // E1.0   [1] (➿)       double curly loop
            [0x27bf, 0x27bf],
            // E0.6   [2] (⤴️..⤵️)    right arrow curving up..right arrow curving down
            [0x2934, 0x2935],
            // E0.6   [3] (⬅️..⬇️)    left arrow..down arrow
            [0x2b05, 0x2b07],
            // E0.6   [2] (⬛..⬜)    black large square..white large square
            [0x2b1b, 0x2b1c],
            // E0.6   [1] (⭐)       star
            [0x2b50, 0x2b50],
            // E0.6   [1] (⭕)       hollow red circle
            [0x2b55, 0x2b55],
            // E0.6   [1] (〰️)       wavy dash
            [0x3030, 0x3030],
            // E0.6   [1] (〽️)       part alternation mark
            [0x303d, 0x303d],
            // E0.6   [1] (㊗️)       Japanese “congratulations” button
            [0x3297, 0x3297],
            // E0.6   [1] (㊙️)       Japanese “secret” button
            [0x3299, 0x3299],
            // E0.6   [1] (🀄)       mahjong red dragon
            [0x1f004, 0x1f004],
            // E0.0   [4] (🀬..🀯)    <reserved-1F02C>..<reserved-1F02F>
            [0x1f02c, 0x1f02f],
            // E0.0  [12] (🂔..🂟)    <reserved-1F094>..<reserved-1F09F>
            [0x1f094, 0x1f09f],
            // E0.0   [2] (🂯..🂰)    <reserved-1F0AF>..<reserved-1F0B0>
            [0x1f0af, 0x1f0b0],
            // E0.0   [1] (🃀)       <reserved-1F0C0>
            [0x1f0c0, 0x1f0c0],
            // E0.6   [1] (🃏)       joker
            [0x1f0cf, 0x1f0cf],
            // E0.0   [1] (🃐)       <reserved-1F0D0>
            [0x1f0d0, 0x1f0d0],
            // E0.0  [10] (🃶..🃿)    <reserved-1F0F6>..<reserved-1F0FF>
            [0x1f0f6, 0x1f0ff],
            // E0.6   [2] (🅰️..🅱️)    A button (blood type)..B button (blood type)
            [0x1f170, 0x1f171],
            // E0.6   [2] (🅾️..🅿️)    O button (blood type)..P button
            [0x1f17e, 0x1f17f],
            // E0.6   [1] (🆎)       AB button (blood type)
            [0x1f18e, 0x1f18e],
            // E0.6  [10] (🆑..🆚)    CL button..VS button
            [0x1f191, 0x1f19a],
            // E0.0  [55] (🆯..🇥)    <reserved-1F1AF>..<reserved-1F1E5>
            [0x1f1af, 0x1f1e5],
            // E0.6   [2] (🈁..🈂️)    Japanese “here” button..Japanese “service charge” button
            [0x1f201, 0x1f202],
            // E0.0  [13] (🈃..🈏)    <reserved-1F203>..<reserved-1F20F>
            [0x1f203, 0x1f20f],
            // E0.6   [1] (🈚)       Japanese “free of charge” button
            [0x1f21a, 0x1f21a],
            // E0.6   [1] (🈯)       Japanese “reserved” button
            [0x1f22f, 0x1f22f],
            // E0.6   [9] (🈲..🈺)    Japanese “prohibited” button..Japanese “open for business” button
            [0x1f232, 0x1f23a],
            // E0.0   [4] (🈼..🈿)    <reserved-1F23C>..<reserved-1F23F>
            [0x1f23c, 0x1f23f],
            // E0.0   [7] (🉉..🉏)    <reserved-1F249>..<reserved-1F24F>
            [0x1f249, 0x1f24f],
            // E0.6   [2] (🉐..🉑)    Japanese “bargain” button..Japanese “acceptable” button
            [0x1f250, 0x1f251],
            // E0.0  [14] (🉒..🉟)    <reserved-1F252>..<reserved-1F25F>
            [0x1f252, 0x1f25f],
            // E0.0 [154] (🉦..🋿)    <reserved-1F266>..<reserved-1F2FF>
            [0x1f266, 0x1f2ff],
            // E0.6  [13] (🌀..🌌)    cyclone..milky way
            [0x1f300, 0x1f30c],
            // E0.7   [2] (🌍..🌎)    globe showing Europe-Africa..globe showing Americas
            [0x1f30d, 0x1f30e],
            // E0.6   [1] (🌏)       globe showing Asia-Australia
            [0x1f30f, 0x1f30f],
            // E1.0   [1] (🌐)       globe with meridians
            [0x1f310, 0x1f310],
            // E0.6   [1] (🌑)       new moon
            [0x1f311, 0x1f311],
            // E1.0   [1] (🌒)       waxing crescent moon
            [0x1f312, 0x1f312],
            // E0.6   [3] (🌓..🌕)    first quarter moon..full moon
            [0x1f313, 0x1f315],
            // E1.0   [3] (🌖..🌘)    waning gibbous moon..waning crescent moon
            [0x1f316, 0x1f318],
            // E0.6   [1] (🌙)       crescent moon
            [0x1f319, 0x1f319],
            // E1.0   [1] (🌚)       new moon face
            [0x1f31a, 0x1f31a],
            // E0.6   [1] (🌛)       first quarter moon face
            [0x1f31b, 0x1f31b],
            // E0.7   [1] (🌜)       last quarter moon face
            [0x1f31c, 0x1f31c],
            // E1.0   [2] (🌝..🌞)    full moon face..sun with face
            [0x1f31d, 0x1f31e],
            // E0.6   [2] (🌟..🌠)    glowing star..shooting star
            [0x1f31f, 0x1f320],
            // E0.7   [1] (🌡️)       thermometer
            [0x1f321, 0x1f321],
            // E0.7   [9] (🌤️..🌬️)    sun behind small cloud..wind face
            [0x1f324, 0x1f32c],
            // E1.0   [3] (🌭..🌯)    hot dog..burrito
            [0x1f32d, 0x1f32f],
            // E0.6   [2] (🌰..🌱)    chestnut..seedling
            [0x1f330, 0x1f331],
            // E1.0   [2] (🌲..🌳)    evergreen tree..deciduous tree
            [0x1f332, 0x1f333],
            // E0.6   [2] (🌴..🌵)    palm tree..cactus
            [0x1f334, 0x1f335],
            // E0.7   [1] (🌶️)       hot pepper
            [0x1f336, 0x1f336],
            // E0.6  [20] (🌷..🍊)    tulip..tangerine
            [0x1f337, 0x1f34a],
            // E1.0   [1] (🍋)       lemon
            [0x1f34b, 0x1f34b],
            // E0.6   [4] (🍌..🍏)    banana..green apple
            [0x1f34c, 0x1f34f],
            // E1.0   [1] (🍐)       pear
            [0x1f350, 0x1f350],
            // E0.6  [43] (🍑..🍻)    peach..clinking beer mugs
            [0x1f351, 0x1f37b],
            // E1.0   [1] (🍼)       baby bottle
            [0x1f37c, 0x1f37c],
            // E0.7   [1] (🍽️)       fork and knife with plate
            [0x1f37d, 0x1f37d],
            // E1.0   [2] (🍾..🍿)    bottle with popping cork..popcorn
            [0x1f37e, 0x1f37f],
            // E0.6  [20] (🎀..🎓)    ribbon..graduation cap
            [0x1f380, 0x1f393],
            // E0.7   [2] (🎖️..🎗️)    military medal..reminder ribbon
            [0x1f396, 0x1f397],
            // E0.7   [3] (🎙️..🎛️)    studio microphone..control knobs
            [0x1f399, 0x1f39b],
            // E0.7   [2] (🎞️..🎟️)    film frames..admission tickets
            [0x1f39e, 0x1f39f],
            // E0.6  [37] (🎠..🏄)    carousel horse..person surfing
            [0x1f3a0, 0x1f3c4],
            // E1.0   [1] (🏅)       sports medal
            [0x1f3c5, 0x1f3c5],
            // E0.6   [1] (🏆)       trophy
            [0x1f3c6, 0x1f3c6],
            // E1.0   [1] (🏇)       horse racing
            [0x1f3c7, 0x1f3c7],
            // E0.6   [1] (🏈)       american football
            [0x1f3c8, 0x1f3c8],
            // E1.0   [1] (🏉)       rugby football
            [0x1f3c9, 0x1f3c9],
            // E0.6   [1] (🏊)       person swimming
            [0x1f3ca, 0x1f3ca],
            // E0.7   [4] (🏋️..🏎️)    person lifting weights..racing car
            [0x1f3cb, 0x1f3ce],
            // E1.0   [5] (🏏..🏓)    cricket game..ping pong
            [0x1f3cf, 0x1f3d3],
            // E0.7  [12] (🏔️..🏟️)    snow-capped mountain..stadium
            [0x1f3d4, 0x1f3df],
            // E0.6   [4] (🏠..🏣)    house..Japanese post office
            [0x1f3e0, 0x1f3e3],
            // E1.0   [1] (🏤)       post office
            [0x1f3e4, 0x1f3e4],
            // E0.6  [12] (🏥..🏰)    hospital..castle
            [0x1f3e5, 0x1f3f0],
            // E0.7   [1] (🏳️)       white flag
            [0x1f3f3, 0x1f3f3],
            // E1.0   [1] (🏴)       black flag
            [0x1f3f4, 0x1f3f4],
            // E0.7   [1] (🏵️)       rosette
            [0x1f3f5, 0x1f3f5],
            // E0.7   [1] (🏷️)       label
            [0x1f3f7, 0x1f3f7],
            // E1.0   [3] (🏸..🏺)    badminton..amphora
            [0x1f3f8, 0x1f3fa],
            // E1.0   [8] (🐀..🐇)    rat..rabbit
            [0x1f400, 0x1f407],
            // E0.7   [1] (🐈)       cat
            [0x1f408, 0x1f408],
            // E1.0   [3] (🐉..🐋)    dragon..whale
            [0x1f409, 0x1f40b],
            // E0.6   [3] (🐌..🐎)    snail..horse
            [0x1f40c, 0x1f40e],
            // E1.0   [2] (🐏..🐐)    ram..goat
            [0x1f40f, 0x1f410],
            // E0.6   [2] (🐑..🐒)    ewe..monkey
            [0x1f411, 0x1f412],
            // E1.0   [1] (🐓)       rooster
            [0x1f413, 0x1f413],
            // E0.6   [1] (🐔)       chicken
            [0x1f414, 0x1f414],
            // E0.7   [1] (🐕)       dog
            [0x1f415, 0x1f415],
            // E1.0   [1] (🐖)       pig
            [0x1f416, 0x1f416],
            // E0.6  [19] (🐗..🐩)    boar..poodle
            [0x1f417, 0x1f429],
            // E1.0   [1] (🐪)       camel
            [0x1f42a, 0x1f42a],
            // E0.6  [20] (🐫..🐾)    two-hump camel..paw prints
            [0x1f42b, 0x1f43e],
            // E0.7   [1] (🐿️)       chipmunk
            [0x1f43f, 0x1f43f],
            // E0.6   [1] (👀)       eyes
            [0x1f440, 0x1f440],
            // E0.7   [1] (👁️)       eye
            [0x1f441, 0x1f441],
            // E0.6  [35] (👂..👤)    ear..bust in silhouette
            [0x1f442, 0x1f464],
            // E1.0   [1] (👥)       busts in silhouette
            [0x1f465, 0x1f465],
            // E0.6   [6] (👦..👫)    boy..woman and man holding hands
            [0x1f466, 0x1f46b],
            // E1.0   [2] (👬..👭)    men holding hands..women holding hands
            [0x1f46c, 0x1f46d],
            // E0.6  [63] (👮..💬)    police officer..speech balloon
            [0x1f46e, 0x1f4ac],
            // E1.0   [1] (💭)       thought balloon
            [0x1f4ad, 0x1f4ad],
            // E0.6   [8] (💮..💵)    white flower..dollar banknote
            [0x1f4ae, 0x1f4b5],
            // E1.0   [2] (💶..💷)    euro banknote..pound banknote
            [0x1f4b6, 0x1f4b7],
            // E0.6  [52] (💸..📫)    money with wings..closed mailbox with raised flag
            [0x1f4b8, 0x1f4eb],
            // E0.7   [2] (📬..📭)    open mailbox with raised flag..open mailbox with lowered flag
            [0x1f4ec, 0x1f4ed],
            // E0.6   [1] (📮)       postbox
            [0x1f4ee, 0x1f4ee],
            // E1.0   [1] (📯)       postal horn
            [0x1f4ef, 0x1f4ef],
            // E0.6   [5] (📰..📴)    newspaper..mobile phone off
            [0x1f4f0, 0x1f4f4],
            // E1.0   [1] (📵)       no mobile phones
            [0x1f4f5, 0x1f4f5],
            // E0.6   [2] (📶..📷)    antenna bars..camera
            [0x1f4f6, 0x1f4f7],
            // E1.0   [1] (📸)       camera with flash
            [0x1f4f8, 0x1f4f8],
            // E0.6   [4] (📹..📼)    video camera..videocassette
            [0x1f4f9, 0x1f4fc],
            // E0.7   [1] (📽️)       film projector
            [0x1f4fd, 0x1f4fd],
            // E1.0   [4] (📿..🔂)    prayer beads..repeat single button
            [0x1f4ff, 0x1f502],
            // E0.6   [1] (🔃)       clockwise vertical arrows
            [0x1f503, 0x1f503],
            // E1.0   [4] (🔄..🔇)    counterclockwise arrows button..muted speaker
            [0x1f504, 0x1f507],
            // E0.7   [1] (🔈)       speaker low volume
            [0x1f508, 0x1f508],
            // E1.0   [1] (🔉)       speaker medium volume
            [0x1f509, 0x1f509],
            // E0.6  [11] (🔊..🔔)    speaker high volume..bell
            [0x1f50a, 0x1f514],
            // E1.0   [1] (🔕)       bell with slash
            [0x1f515, 0x1f515],
            // E0.6  [22] (🔖..🔫)    bookmark..water pistol
            [0x1f516, 0x1f52b],
            // E1.0   [2] (🔬..🔭)    microscope..telescope
            [0x1f52c, 0x1f52d],
            // E0.6  [16] (🔮..🔽)    crystal ball..downwards button
            [0x1f52e, 0x1f53d],
            // E0.7   [2] (🕉️..🕊️)    om..dove
            [0x1f549, 0x1f54a],
            // E1.0   [4] (🕋..🕎)    kaaba..menorah
            [0x1f54b, 0x1f54e],
            // E0.6  [12] (🕐..🕛)    one o’clock..twelve o’clock
            [0x1f550, 0x1f55b],
            // E0.7  [12] (🕜..🕧)    one-thirty..twelve-thirty
            [0x1f55c, 0x1f567],
            // E0.7   [2] (🕯️..🕰️)    candle..mantelpiece clock
            [0x1f56f, 0x1f570],
            // E0.7   [7] (🕳️..🕹️)    hole..joystick
            [0x1f573, 0x1f579],
            // E3.0   [1] (🕺)       man dancing
            [0x1f57a, 0x1f57a],
            // E0.7   [1] (🖇️)       linked paperclips
            [0x1f587, 0x1f587],
            // E0.7   [4] (🖊️..🖍️)    pen..crayon
            [0x1f58a, 0x1f58d],
            // E0.7   [1] (🖐️)       hand with fingers splayed
            [0x1f590, 0x1f590],
            // E1.0   [2] (🖕..🖖)    middle finger..vulcan salute
            [0x1f595, 0x1f596],
            // E3.0   [1] (🖤)       black heart
            [0x1f5a4, 0x1f5a4],
            // E0.7   [1] (🖥️)       desktop computer
            [0x1f5a5, 0x1f5a5],
            // E0.7   [1] (🖨️)       printer
            [0x1f5a8, 0x1f5a8],
            // E0.7   [2] (🖱️..🖲️)    computer mouse..trackball
            [0x1f5b1, 0x1f5b2],
            // E0.7   [1] (🖼️)       framed picture
            [0x1f5bc, 0x1f5bc],
            // E0.7   [3] (🗂️..🗄️)    card index dividers..file cabinet
            [0x1f5c2, 0x1f5c4],
            // E0.7   [3] (🗑️..🗓️)    wastebasket..spiral calendar
            [0x1f5d1, 0x1f5d3],
            // E0.7   [3] (🗜️..🗞️)    clamp..rolled-up newspaper
            [0x1f5dc, 0x1f5de],
            // E0.7   [1] (🗡️)       dagger
            [0x1f5e1, 0x1f5e1],
            // E0.7   [1] (🗣️)       speaking head
            [0x1f5e3, 0x1f5e3],
            // E2.0   [1] (🗨️)       left speech bubble
            [0x1f5e8, 0x1f5e8],
            // E0.7   [1] (🗯️)       right anger bubble
            [0x1f5ef, 0x1f5ef],
            // E0.7   [1] (🗳️)       ballot box with ballot
            [0x1f5f3, 0x1f5f3],
            // E0.7   [1] (🗺️)       world map
            [0x1f5fa, 0x1f5fa],
            // E0.6   [5] (🗻..🗿)    mount fuji..moai
            [0x1f5fb, 0x1f5ff],
            // E1.0   [1] (😀)       grinning face
            [0x1f600, 0x1f600],
            // E0.6   [6] (😁..😆)    beaming face with smiling eyes..grinning squinting face
            [0x1f601, 0x1f606],
            // E1.0   [2] (😇..😈)    smiling face with halo..smiling face with horns
            [0x1f607, 0x1f608],
            // E0.6   [5] (😉..😍)    winking face..smiling face with heart-eyes
            [0x1f609, 0x1f60d],
            // E1.0   [1] (😎)       smiling face with sunglasses
            [0x1f60e, 0x1f60e],
            // E0.6   [1] (😏)       smirking face
            [0x1f60f, 0x1f60f],
            // E0.7   [1] (😐)       neutral face
            [0x1f610, 0x1f610],
            // E1.0   [1] (😑)       expressionless face
            [0x1f611, 0x1f611],
            // E0.6   [3] (😒..😔)    unamused face..pensive face
            [0x1f612, 0x1f614],
            // E1.0   [1] (😕)       confused face
            [0x1f615, 0x1f615],
            // E0.6   [1] (😖)       confounded face
            [0x1f616, 0x1f616],
            // E1.0   [1] (😗)       kissing face
            [0x1f617, 0x1f617],
            // E0.6   [1] (😘)       face blowing a kiss
            [0x1f618, 0x1f618],
            // E1.0   [1] (😙)       kissing face with smiling eyes
            [0x1f619, 0x1f619],
            // E0.6   [1] (😚)       kissing face with closed eyes
            [0x1f61a, 0x1f61a],
            // E1.0   [1] (😛)       face with tongue
            [0x1f61b, 0x1f61b],
            // E0.6   [3] (😜..😞)    winking face with tongue..disappointed face
            [0x1f61c, 0x1f61e],
            // E1.0   [1] (😟)       worried face
            [0x1f61f, 0x1f61f],
            // E0.6   [6] (😠..😥)    angry face..sad but relieved face
            [0x1f620, 0x1f625],
            // E1.0   [2] (😦..😧)    frowning face with open mouth..anguished face
            [0x1f626, 0x1f627],
            // E0.6   [4] (😨..😫)    fearful face..tired face
            [0x1f628, 0x1f62b],
            // E1.0   [1] (😬)       grimacing face
            [0x1f62c, 0x1f62c],
            // E0.6   [1] (😭)       loudly crying face
            [0x1f62d, 0x1f62d],
            // E1.0   [2] (😮..😯)    face with open mouth..hushed face
            [0x1f62e, 0x1f62f],
            // E0.6   [4] (😰..😳)    anxious face with sweat..flushed face
            [0x1f630, 0x1f633],
            // E1.0   [1] (😴)       sleeping face
            [0x1f634, 0x1f634],
            // E0.6   [1] (😵)       face with crossed-out eyes
            [0x1f635, 0x1f635],
            // E1.0   [1] (😶)       face without mouth
            [0x1f636, 0x1f636],
            // E0.6  [10] (😷..🙀)    face with medical mask..weary cat
            [0x1f637, 0x1f640],
            // E1.0   [4] (🙁..🙄)    slightly frowning face..face with rolling eyes
            [0x1f641, 0x1f644],
            // E0.6  [11] (🙅..🙏)    person gesturing NO..folded hands
            [0x1f645, 0x1f64f],
            // E0.6   [1] (🚀)       rocket
            [0x1f680, 0x1f680],
            // E1.0   [2] (🚁..🚂)    helicopter..locomotive
            [0x1f681, 0x1f682],
            // E0.6   [3] (🚃..🚅)    railway car..bullet train
            [0x1f683, 0x1f685],
            // E1.0   [1] (🚆)       train
            [0x1f686, 0x1f686],
            // E0.6   [1] (🚇)       metro
            [0x1f687, 0x1f687],
            // E1.0   [1] (🚈)       light rail
            [0x1f688, 0x1f688],
            // E0.6   [1] (🚉)       station
            [0x1f689, 0x1f689],
            // E1.0   [2] (🚊..🚋)    tram..tram car
            [0x1f68a, 0x1f68b],
            // E0.6   [1] (🚌)       bus
            [0x1f68c, 0x1f68c],
            // E0.7   [1] (🚍)       oncoming bus
            [0x1f68d, 0x1f68d],
            // E1.0   [1] (🚎)       trolleybus
            [0x1f68e, 0x1f68e],
            // E0.6   [1] (🚏)       bus stop
            [0x1f68f, 0x1f68f],
            // E1.0   [1] (🚐)       minibus
            [0x1f690, 0x1f690],
            // E0.6   [3] (🚑..🚓)    ambulance..police car
            [0x1f691, 0x1f693],
            // E0.7   [1] (🚔)       oncoming police car
            [0x1f694, 0x1f694],
            // E0.6   [1] (🚕)       taxi
            [0x1f695, 0x1f695],
            // E1.0   [1] (🚖)       oncoming taxi
            [0x1f696, 0x1f696],
            // E0.6   [1] (🚗)       automobile
            [0x1f697, 0x1f697],
            // E0.7   [1] (🚘)       oncoming automobile
            [0x1f698, 0x1f698],
            // E0.6   [2] (🚙..🚚)    sport utility vehicle..delivery truck
            [0x1f699, 0x1f69a],
            // E1.0   [7] (🚛..🚡)    articulated lorry..aerial tramway
            [0x1f69b, 0x1f6a1],
            // E0.6   [1] (🚢)       ship
            [0x1f6a2, 0x1f6a2],
            // E1.0   [1] (🚣)       person rowing boat
            [0x1f6a3, 0x1f6a3],
            // E0.6   [2] (🚤..🚥)    speedboat..horizontal traffic light
            [0x1f6a4, 0x1f6a5],
            // E1.0   [1] (🚦)       vertical traffic light
            [0x1f6a6, 0x1f6a6],
            // E0.6   [7] (🚧..🚭)    construction..no smoking
            [0x1f6a7, 0x1f6ad],
            // E1.0   [4] (🚮..🚱)    litter in bin sign..non-potable water
            [0x1f6ae, 0x1f6b1],
            // E0.6   [1] (🚲)       bicycle
            [0x1f6b2, 0x1f6b2],
            // E1.0   [3] (🚳..🚵)    no bicycles..person mountain biking
            [0x1f6b3, 0x1f6b5],
            // E0.6   [1] (🚶)       person walking
            [0x1f6b6, 0x1f6b6],
            // E1.0   [2] (🚷..🚸)    no pedestrians..children crossing
            [0x1f6b7, 0x1f6b8],
            // E0.6   [6] (🚹..🚾)    men’s room..water closet
            [0x1f6b9, 0x1f6be],
            // E1.0   [1] (🚿)       shower
            [0x1f6bf, 0x1f6bf],
            // E0.6   [1] (🛀)       person taking bath
            [0x1f6c0, 0x1f6c0],
            // E1.0   [5] (🛁..🛅)    bathtub..left luggage
            [0x1f6c1, 0x1f6c5],
            // E0.7   [1] (🛋️)       couch and lamp
            [0x1f6cb, 0x1f6cb],
            // E1.0   [1] (🛌)       person in bed
            [0x1f6cc, 0x1f6cc],
            // E0.7   [3] (🛍️..🛏️)    shopping bags..bed
            [0x1f6cd, 0x1f6cf],
            // E1.0   [1] (🛐)       place of worship
            [0x1f6d0, 0x1f6d0],
            // E3.0   [2] (🛑..🛒)    stop sign..shopping cart
            [0x1f6d1, 0x1f6d2],
            // E12.0  [1] (🛕)       hindu temple
            [0x1f6d5, 0x1f6d5],
            // E13.0  [2] (🛖..🛗)    hut..elevator
            [0x1f6d6, 0x1f6d7],
            // E17.0  [1] (🛘)       landslide
            [0x1f6d8, 0x1f6d8],
            // E18.0  [1] (🛙)       lighthouse
            [0x1f6d9, 0x1f6d9],
            // E0.0   [2] (🛚..🛛)    <reserved-1F6DA>..<reserved-1F6DB>
            [0x1f6da, 0x1f6db],
            // E15.0  [1] (🛜)       wireless
            [0x1f6dc, 0x1f6dc],
            // E14.0  [3] (🛝..🛟)    playground slide..ring buoy
            [0x1f6dd, 0x1f6df],
            // E0.7   [6] (🛠️..🛥️)    hammer and wrench..motor boat
            [0x1f6e0, 0x1f6e5],
            // E0.7   [1] (🛩️)       small airplane
            [0x1f6e9, 0x1f6e9],
            // E1.0   [2] (🛫..🛬)    airplane departure..airplane arrival
            [0x1f6eb, 0x1f6ec],
            // E0.0   [3] (🛭..🛯)    <reserved-1F6ED>..<reserved-1F6EF>
            [0x1f6ed, 0x1f6ef],
            // E0.7   [1] (🛰️)       satellite
            [0x1f6f0, 0x1f6f0],
            // E0.7   [1] (🛳️)       passenger ship
            [0x1f6f3, 0x1f6f3],
            // E3.0   [3] (🛴..🛶)    kick scooter..canoe
            [0x1f6f4, 0x1f6f6],
            // E5.0   [2] (🛷..🛸)    sled..flying saucer
            [0x1f6f7, 0x1f6f8],
            // E11.0  [1] (🛹)       skateboard
            [0x1f6f9, 0x1f6f9],
            // E12.0  [1] (🛺)       auto rickshaw
            [0x1f6fa, 0x1f6fa],
            // E13.0  [2] (🛻..🛼)    pickup truck..roller skate
            [0x1f6fb, 0x1f6fc],
            // E0.0   [3] (🛽..🛿)    <reserved-1F6FD>..<reserved-1F6FF>
            [0x1f6fd, 0x1f6ff],
            // E0.0   [4] (🟜..🟟)    <reserved-1F7DC>..<reserved-1F7DF>
            [0x1f7dc, 0x1f7df],
            // E12.0 [12] (🟠..🟫)    orange circle..brown square
            [0x1f7e0, 0x1f7eb],
            // E0.0   [4] (🟬..🟯)    <reserved-1F7EC>..<reserved-1F7EF>
            [0x1f7ec, 0x1f7ef],
            // E14.0  [1] (🟰)       heavy equals sign
            [0x1f7f0, 0x1f7f0],
            // E0.0   [4] (🠌..🠏)    <reserved-1F80C>..<reserved-1F80F>
            [0x1f80c, 0x1f80f],
            // E0.0   [8] (🡈..🡏)    <reserved-1F848>..<reserved-1F84F>
            [0x1f848, 0x1f84f],
            // E0.0   [6] (🡚..🡟)    <reserved-1F85A>..<reserved-1F85F>
            [0x1f85a, 0x1f85f],
            // E0.0   [8] (🢈..🢏)    <reserved-1F888>..<reserved-1F88F>
            [0x1f888, 0x1f88f],
            // E0.0   [2] (🢮..🢯)    <reserved-1F8AE>..<reserved-1F8AF>
            [0x1f8ae, 0x1f8af],
            // E0.0   [4] (🢼..🢿)    <reserved-1F8BC>..<reserved-1F8BF>
            [0x1f8bc, 0x1f8bf],
            // E0.0  [14] (🣂..🣏)    <reserved-1F8C2>..<reserved-1F8CF>
            [0x1f8c2, 0x1f8cf],
            // E0.0  [39] (🣙..🣿)    <reserved-1F8D9>..<reserved-1F8FF>
            [0x1f8d9, 0x1f8ff],
            // E13.0  [1] (🤌)       pinched fingers
            [0x1f90c, 0x1f90c],
            // E12.0  [3] (🤍..🤏)    white heart..pinching hand
            [0x1f90d, 0x1f90f],
            // E1.0   [9] (🤐..🤘)    zipper-mouth face..sign of the horns
            [0x1f910, 0x1f918],
            // E3.0   [6] (🤙..🤞)    call me hand..crossed fingers
            [0x1f919, 0x1f91e],
            // E5.0   [1] (🤟)       love-you gesture
            [0x1f91f, 0x1f91f],
            // E3.0   [8] (🤠..🤧)    cowboy hat face..sneezing face
            [0x1f920, 0x1f927],
            // E5.0   [8] (🤨..🤯)    face with raised eyebrow..exploding head
            [0x1f928, 0x1f92f],
            // E3.0   [1] (🤰)       pregnant woman
            [0x1f930, 0x1f930],
            // E5.0   [2] (🤱..🤲)    breast-feeding..palms up together
            [0x1f931, 0x1f932],
            // E3.0   [8] (🤳..🤺)    selfie..person fencing
            [0x1f933, 0x1f93a],
            // E3.0   [3] (🤼..🤾)    people wrestling..person playing handball
            [0x1f93c, 0x1f93e],
            // E12.0  [1] (🤿)       diving mask
            [0x1f93f, 0x1f93f],
            // E3.0   [6] (🥀..🥅)    wilted flower..goal net
            [0x1f940, 0x1f945],
            // E3.0   [5] (🥇..🥋)    1st place medal..martial arts uniform
            [0x1f947, 0x1f94b],
            // E5.0   [1] (🥌)       curling stone
            [0x1f94c, 0x1f94c],
            // E11.0  [3] (🥍..🥏)    lacrosse..flying disc
            [0x1f94d, 0x1f94f],
            // E3.0  [15] (🥐..🥞)    croissant..pancakes
            [0x1f950, 0x1f95e],
            // E5.0  [13] (🥟..🥫)    dumpling..canned food
            [0x1f95f, 0x1f96b],
            // E11.0  [5] (🥬..🥰)    leafy green..smiling face with hearts
            [0x1f96c, 0x1f970],
            // E12.0  [1] (🥱)       yawning face
            [0x1f971, 0x1f971],
            // E13.0  [1] (🥲)       smiling face with tear
            [0x1f972, 0x1f972],
            // E11.0  [4] (🥳..🥶)    partying face..cold face
            [0x1f973, 0x1f976],
            // E13.0  [2] (🥷..🥸)    ninja..disguised face
            [0x1f977, 0x1f978],
            // E14.0  [1] (🥹)       face holding back tears
            [0x1f979, 0x1f979],
            // E11.0  [1] (🥺)       pleading face
            [0x1f97a, 0x1f97a],
            // E12.0  [1] (🥻)       sari
            [0x1f97b, 0x1f97b],
            // E11.0  [4] (🥼..🥿)    lab coat..flat shoe
            [0x1f97c, 0x1f97f],
            // E1.0   [5] (🦀..🦄)    crab..unicorn
            [0x1f980, 0x1f984],
            // E3.0  [13] (🦅..🦑)    eagle..squid
            [0x1f985, 0x1f991],
            // E5.0   [6] (🦒..🦗)    giraffe..cricket
            [0x1f992, 0x1f997],
            // E11.0 [11] (🦘..🦢)    kangaroo..swan
            [0x1f998, 0x1f9a2],
            // E13.0  [2] (🦣..🦤)    mammoth..dodo
            [0x1f9a3, 0x1f9a4],
            // E12.0  [6] (🦥..🦪)    sloth..oyster
            [0x1f9a5, 0x1f9aa],
            // E13.0  [3] (🦫..🦭)    beaver..seal
            [0x1f9ab, 0x1f9ad],
            // E12.0  [2] (🦮..🦯)    guide dog..white cane
            [0x1f9ae, 0x1f9af],
            // E11.0 [10] (🦰..🦹)    red hair..supervillain
            [0x1f9b0, 0x1f9b9],
            // E12.0  [6] (🦺..🦿)    safety vest..mechanical leg
            [0x1f9ba, 0x1f9bf],
            // E1.0   [1] (🧀)       cheese wedge
            [0x1f9c0, 0x1f9c0],
            // E11.0  [2] (🧁..🧂)    cupcake..salt
            [0x1f9c1, 0x1f9c2],
            // E12.0  [8] (🧃..🧊)    beverage box..ice
            [0x1f9c3, 0x1f9ca],
            // E13.0  [1] (🧋)       bubble tea
            [0x1f9cb, 0x1f9cb],
            // E14.0  [1] (🧌)       troll
            [0x1f9cc, 0x1f9cc],
            // E12.0  [3] (🧍..🧏)    person standing..deaf person
            [0x1f9cd, 0x1f9cf],
            // E5.0  [23] (🧐..🧦)    face with monocle..socks
            [0x1f9d0, 0x1f9e6],
            // E11.0 [25] (🧧..🧿)    red envelope..nazar amulet
            [0x1f9e7, 0x1f9ff],
            // E0.0   [8] (🩘..🩟)    <reserved-1FA58>..<reserved-1FA5F>
            [0x1fa58, 0x1fa5f],
            // E0.0   [2] (🩮..🩯)    <reserved-1FA6E>..<reserved-1FA6F>
            [0x1fa6e, 0x1fa6f],
            // E12.0  [4] (🩰..🩳)    ballet shoes..shorts
            [0x1fa70, 0x1fa73],
            // E13.0  [1] (🩴)       thong sandal
            [0x1fa74, 0x1fa74],
            // E15.0  [3] (🩵..🩷)    light blue heart..pink heart
            [0x1fa75, 0x1fa77],
            // E12.0  [3] (🩸..🩺)    drop of blood..stethoscope
            [0x1fa78, 0x1fa7a],
            // E14.0  [2] (🩻..🩼)    x-ray..crutch
            [0x1fa7b, 0x1fa7c],
            // E0.0   [3] (🩽..🩿)    <reserved-1FA7D>..<reserved-1FA7F>
            [0x1fa7d, 0x1fa7f],
            // E12.0  [3] (🪀..🪂)    yo-yo..parachute
            [0x1fa80, 0x1fa82],
            // E13.0  [4] (🪃..🪆)    boomerang..nesting dolls
            [0x1fa83, 0x1fa86],
            // E15.0  [2] (🪇..🪈)    maracas..flute
            [0x1fa87, 0x1fa88],
            // E16.0  [1] (🪉)       harp
            [0x1fa89, 0x1fa89],
            // E17.0  [1] (🪊)       trombone
            [0x1fa8a, 0x1fa8a],
            // E18.0  [3] (🪋..🪍)    meteor..net with handle
            [0x1fa8b, 0x1fa8d],
            // E17.0  [1] (🪎)       treasure chest
            [0x1fa8e, 0x1fa8e],
            // E16.0  [1] (🪏)       shovel
            [0x1fa8f, 0x1fa8f],
            // E12.0  [6] (🪐..🪕)    ringed planet..banjo
            [0x1fa90, 0x1fa95],
            // E13.0 [19] (🪖..🪨)    military helmet..rock
            [0x1fa96, 0x1faa8],
            // E14.0  [4] (🪩..🪬)    mirror ball..hamsa
            [0x1faa9, 0x1faac],
            // E15.0  [3] (🪭..🪯)    folding hand fan..khanda
            [0x1faad, 0x1faaf],
            // E13.0  [7] (🪰..🪶)    fly..feather
            [0x1fab0, 0x1fab6],
            // E14.0  [4] (🪷..🪺)    lotus..nest with eggs
            [0x1fab7, 0x1faba],
            // E15.0  [3] (🪻..🪽)    hyacinth..wing
            [0x1fabb, 0x1fabd],
            // E16.0  [1] (🪾)       leafless tree
            [0x1fabe, 0x1fabe],
            // E15.0  [1] (🪿)       goose
            [0x1fabf, 0x1fabf],
            // E13.0  [3] (🫀..🫂)    anatomical heart..people hugging
            [0x1fac0, 0x1fac2],
            // E14.0  [3] (🫃..🫅)    pregnant man..person with crown
            [0x1fac3, 0x1fac5],
            // E16.0  [1] (🫆)       fingerprint
            [0x1fac6, 0x1fac6],
            // E0.0   [1] (🫇)       <reserved-1FAC7>
            [0x1fac7, 0x1fac7],
            // E17.0  [1] (🫈)       hairy creature
            [0x1fac8, 0x1fac8],
            // E0.0   [3] (🫉..🫋)    <reserved-1FAC9>..<reserved-1FACB>
            [0x1fac9, 0x1facb],
            // E18.0  [1] (🫌)       monarch butterfly
            [0x1facc, 0x1facc],
            // E17.0  [1] (🫍)       orca
            [0x1facd, 0x1facd],
            // E15.0  [2] (🫎..🫏)    moose..donkey
            [0x1face, 0x1facf],
            // E13.0  [7] (🫐..🫖)    blueberries..teapot
            [0x1fad0, 0x1fad6],
            // E14.0  [3] (🫗..🫙)    pouring liquid..jar
            [0x1fad7, 0x1fad9],
            // E15.0  [2] (🫚..🫛)    ginger root..pea pod
            [0x1fada, 0x1fadb],
            // E16.0  [1] (🫜)       root vegetable
            [0x1fadc, 0x1fadc],
            // E18.0  [1] (🫝)       pickle
            [0x1fadd, 0x1fadd],
            // E0.0   [1] (🫞)       <reserved-1FADE>
            [0x1fade, 0x1fade],
            // E16.0  [1] (🫟)       splatter
            [0x1fadf, 0x1fadf],
            // E14.0  [8] (🫠..🫧)    melting face..bubbles
            [0x1fae0, 0x1fae7],
            // E15.0  [1] (🫨)       shaking face
            [0x1fae8, 0x1fae8],
            // E16.0  [1] (🫩)       face with bags under eyes
            [0x1fae9, 0x1fae9],
            // E17.0  [1] (🫪)       distorted face
            [0x1faea, 0x1faea],
            // E18.0  [1] (🫫)       cracking face
            [0x1faeb, 0x1faeb],
            // E0.0   [3] (🫬..🫮)    <reserved-1FAEC>..<reserved-1FAEE>
            [0x1faec, 0x1faee],
            // E17.0  [1] (🫯)       fight cloud
            [0x1faef, 0x1faef],
            // E14.0  [7] (🫰..🫶)    hand with index finger and thumb crossed..heart hands
            [0x1faf0, 0x1faf6],
            // E15.0  [2] (🫷..🫸)    leftwards pushing hand..rightwards pushing hand
            [0x1faf7, 0x1faf8],
            // E18.0  [2] (🫹..🫺)    leftwards thumb sign..rightwards thumb sign
            [0x1faf9, 0x1fafa],
            // E0.0   [5] (🫻..🫿)    <reserved-1FAFB>..<reserved-1FAFF>
            [0x1fafb, 0x1faff],
            // E0.0[1022] (🰀..🿽)    <reserved-1FC00>..<reserved-1FFFD>
            [0x1fc00, 0x1fffd],
        ]
    }
];

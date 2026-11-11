import { t } from '@/i18n';
import { registerTool } from './validation';
import type { FontFamilyFetchDefinition, GoogleFontFamilyDefinition } from '@/types'

async function addFontFamily(fontFamily?: string) {
    const { default: defaultFontFamilies } = await import('@/config/default-font-families.json');
    const { default: googleWebfonts } = await import('@/config/google-webfonts.json');
    const { generateFontVariantName } = await import('@/store/font');
    const { default: workingFileStore, addRemoteFont } = await import('@/store/working-file');
    if (fontFamily && !defaultFontFamilies.find((family) => family.family === fontFamily) && !workingFileStore.state.remoteFonts[fontFamily]) {
        const googleFontDefinition = googleWebfonts.items.find((item) => item.family === fontFamily) as GoogleFontFamilyDefinition;
        if (googleFontDefinition) {
            const fontDefinition: FontFamilyFetchDefinition = {
                family: googleFontDefinition.family,
                subsets: googleFontDefinition.subsets,
                variants: {},
            };
            for (const variantKey in googleFontDefinition.files) {
                fontDefinition.variants[variantKey] = {
                    name: generateFontVariantName(variantKey),
                    file: googleFontDefinition.files[variantKey],
                };
            }
            addRemoteFont(fontDefinition);
        }
    }
}

registerTool({
    name: 'get-available-font-list',
    description: t('mcp.getAvailableFontList.description'),
    annotations: {
        readOnlyHint: true,
    },
    async execute() {
        const googleWebfonts = await import('@/config/google-webfonts.json');
        return {
            structuredContent: {
                fontFamilies: googleWebfonts.items.map((item) => item.family),
            }
        }
    }
});

registerTool({
    name: 'insert-text-layer',
    description: t('mcp.insertTextLayer.description'),
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: t('mcp.insertTextLayer.property.text') },
            name: { type: 'string', description: t('mcp.insertTextLayer.property.name') },
            transform: { type: 'array', description: t('mcp.insertTextLayer.property.transform'), items: { type: 'number' } },
            fontFamily: { type: 'string', description: t('mcp.insertTextLayer.property.fontFamily') },
            fontSize: { type: 'number', description: t('mcp.insertTextLayer.property.fontSize'), default: 16 },
            fill: { type: 'string', description: t('mcp.insertTextLayer.property.fill'), default: '#000000' },
        },
        required: ['text'],
    },
    async execute({ text, name, transform, fontFamily, fontSize, fill }) {
        if (transform && transform.length !== 6) {
            throw new Error(t('mcp.common.error.2dTransformLength'));
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { default: workingFileStore, ensureUniqueLayerSiblingName, getLayerById } = await import('@/store/working-file');
        const { hexToColor } = await import('@/lib/color');
        const { textMetaDefaults } = await import('@/lib/text-common');
        const { InsertLayerAction } = await import('@/actions/insert-layer');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        let createdLayerWidth = 1;
        let createdLayerHeight = 1;
        try {
            await addFontFamily(fontFamily);

            const meta = {
                family: fontFamily ?? textMetaDefaults['family'],
                fontSize: fontSize ?? textMetaDefaults['size'],
                fillColor: fill ? hexToColor(fill, 'rgba') : textMetaDefaults['fillColor'],
            };

            const insertLayerAction = new InsertLayerAction({
                type: 'text',
                name: name ?? ensureUniqueLayerSiblingName(
                    workingFileStore.state.layers[0]?.id, t('toolbar.text.newTextLayerName')
                ),
                transform: transform ? new DOMMatrix(transform) : new DOMMatrix(),
                data: {
                    boundary: 'dynamic',
                    lineAlignment: 'start',
                    lineDirection: 'ltr',
                    wrapDirection: 'ttb',
                    wrapAt: 'wordThenLetter',
                    lines: text.split('\n').map((textLine) => {
                        return {
                            spans: [
                                {
                                    text: textLine,
                                    meta,
                                },
                            ],
                        };
                    }),
                },
            });

            await historyStore.dispatch('runAction', {
                action: insertLayerAction,
                reserveToken: historyReserveToken,
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            const layer = getLayerById(insertLayerAction.insertedLayerId);
            createdLayerWidth = layer?.width ?? 0;
            createdLayerHeight = layer?.height ?? 0;
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
            throw error;
        }
        return {
            structuredContent: {
                createdLayerWidth,
                createdLayerHeight,
            },
        };
    }
});

import { t } from '@/i18n';
import { registerTool } from './validation';

registerTool({
    name: 'crop-working-file',
    description: t('mcp.cropWorkingFile.description'),
    inputSchema: {
        type: 'object',
        properties: {
            left: { type: 'number', description: t('mcp.cropWorkingFile.property.left') },
            top: { type: 'number', description: t('mcp.cropWorkingFile.property.top') },
            width: { type: 'number', description: t('mcp.cropWorkingFile.property.width') },
            height: { type: 'number', description: t('mcp.cropWorkingFile.property.height') },
        },
        required: ['left', 'top', 'width', 'height'],
    },
    async execute({ left, top, width, height }) {
        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { CropResizeAction } = await import('@/actions/crop-resize');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            historyStore.dispatch('runAction', {
                action: new CropResizeAction(
                    'crop',
                    Math.max(1, width),
                    Math.max(1, height),
                    left,
                    top,
                ),
                reserveToken: historyReserveToken,
            });
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
            throw error;
        }
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.cropWorkingFile.response.success'),
                }
            ],
        };
    }
});

registerTool({
    name: 'resample-working-file',
    description: t('mcp.resampleWorkingFile.description'),
    inputSchema: {
        type: 'object',
        properties: {
            width: { type: 'number', description: t('mcp.resampleWorkingFile.property.width') },
            height: { type: 'number', description: t('mcp.resampleWorkingFile.property.height') },
        },
        required: ['width'],
    },
    async execute({ width }) {
        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { default: workingFileStore } = await import('@/store/working-file');
        const { CropResizeAction } = await import('@/actions/crop-resize');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            const newWidth = Math.max(1, width);
            const newHeight = newWidth * (workingFileStore.state.height / workingFileStore.state.width);
            historyStore.dispatch('runAction', {
                action: new CropResizeAction(
                    'resample',
                    newWidth,
                    newHeight,
                    0,
                    0,
                    newWidth / workingFileStore.state.width,
                    newHeight / workingFileStore.state.height,
                ),
                reserveToken: historyReserveToken,
            });
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
            throw error;
        }
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.resampleWorkingFile.response.success'),
                }
            ],
        };
    }
});

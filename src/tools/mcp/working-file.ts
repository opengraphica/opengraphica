import { t } from '@/i18n';
import { registerTool } from './validation';
import type { BaseAction } from '@/actions/base';
import type { WorkingFileLayer, WorkingFileGroupLayer } from '@/types';

registerTool({
    name: 'get-editor-guide',
    description: t('mcp.getEditorGuide.description'),
    annotations: {
        readOnlyHint: true,
    },
    execute() {
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.getEditorGuide.summary'),
                },
            ],
        };
    }
});

registerTool({
    name: 'get-working-file-dimensions',
    description: t('mcp.getWorkingFileDimensions.description'),
    annotations: {
        readOnlyHint: true,
    },
    async execute() {
        const { default: workingFileStore } = await import('@/store/working-file');
        return {
            structuredContent: {
                width: workingFileStore.state.width,
                height: workingFileStore.state.height,
            }
        }
    }
})

registerTool({
    name: 'get-layer-list',
    description: t('mcp.getLayerList.description'),
    annotations: {
        readOnlyHint: true,
    },
    async execute() {
        const { default: workingFileStore } = await import('@/store/working-file');
        function getLayers(storeLayers: WorkingFileLayer[]) {
            const layers: Partial<WorkingFileLayer & { selected: boolean }>[] = [];
            for (const storedLayer of storeLayers) {
                const { a, b, c, d, e, f } = storedLayer.transform;
                const layer: Partial<WorkingFileLayer & { selected: boolean }> = {
                    id: storedLayer.id,
                    name: storedLayer.name,
                    type: storedLayer.type,
                    width: storedLayer.width,
                    height: storedLayer.height,
                    transform: { a, b, c, d, e, f } as never,
                    selected: workingFileStore.state.selectedLayerIds.includes(storedLayer.id),
                };
                if (storedLayer.type === 'group') {
                    (layer as any).layers = getLayers((storedLayer as WorkingFileGroupLayer).layers);
                }
                layers.push(layer);
            }
            return layers;
        }
        return {
            structuredContent: {
                layers: getLayers(workingFileStore.state.layers),
            }
        }
    }
});

registerTool({
    name: 'get-raster-layer-image',
    description: t('mcp.getRasterLayerImage.description'),
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'number', description: t('mcp.getRasterLayerImage.property.id') },
        },
        required: ['id'],
    },
    annotations: {
        readOnlyHint: true,
    },
    async execute({ id }) {
        const { getStoredImageCanvas } = await import('@/store/image');
        const { getLayerById } = await import('@/store/working-file');
        const layer = await getLayerById(id);
        if (layer?.type !== 'raster') throw new Error(t('mcp.common.error.layerNotFound'));
        const canvas = await getStoredImageCanvas(layer.data.sourceUuid);
        if (!canvas) throw new Error(t('mcp.common.error.layerNotFound'));
        return {
            content: [
                {
                    type: 'image',
                    data: canvas.toDataURL('image/png'),
                    mimeType: 'image/png',
                }
            ]
        };
    }
});

registerTool({
    name: 'get-vector-layer-svg',
    description: t('mcp.getVectorLayerSvg.description'),
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'number', description: t('mcp.getVectorLayerSvg.property.id') },
        },
        required: ['id'],
    },
    annotations: {
        readOnlyHint: true,
    },
    async execute({ id }) {
        const { getStoredSvgDocument } = await import('@/store/svg');
        const { getLayerById } = await import('@/store/working-file');
        const layer = await getLayerById(id);
        if (layer?.type !== 'vector') throw new Error(t('mcp.common.error.layerNotFound'));
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(
            layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid)
        ).replace(/xmlns=""/g, '');
        return {
            content: [
                {
                    type: 'text',
                    text: svgString,
                }
            ]
        };
    }
});

registerTool({
    name: 'select-layers',
    description: t('mcp.selectLayers.description'),
    inputSchema: {
        type: 'object',
        properties: {
            ids: { type: 'array', description: t('mcp.selectLayers.property.ids'), items: { type: 'number' } },
        },
        required: ['ids'],
    },
    async execute({ ids }) {
        if (ids.length === 0) {
            throw new Error(t('mcp.selectLayers.error.noIds'))
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { SelectLayersAction } = await import('@/actions/select-layers');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            historyStore.dispatch('runAction', {
                action: new SelectLayersAction(ids),
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
                    text: t('mcp.selectLayers.response.success'),
                }
            ],
        };
    }
});

registerTool({
    name: 'insert-raster-layer',
    description: t('mcp.insertRasterLayer.description'),
    inputSchema: {
        type: 'object',
        properties: {
            imageDataUri: { type: 'string', description: t('mcp.insertRasterLayer.property.image') },
            name: { type: 'string', description: t('mcp.insertRasterLayer.property.name') },
            transform: { type: 'array', description: t('mcp.insertRasterLayer.property.transform'), items: { type: 'number' } },
        },
        required: ['imageDataUri'],
    },
    async execute({ imageDataUri, name, transform }) {
        if (transform && transform.length !== 6) {
            throw new Error(t('mcp.common.error.2dTransformLength'));
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { createStoredImage } = await import('@/store/image');
        const { createCanvasFromImage } = await import('@/lib/image');
        const { InsertLayerAction } = await import('@/actions/insert-layer');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            const image: HTMLImageElement = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => {
                    resolve(image);
                };
                image.onerror = () => {
                    reject()
                };
                image.src = imageDataUri;
            });
            const sourceUuid = await createStoredImage(
                await createCanvasFromImage(image)
            );
            await historyStore.dispatch('runAction', {
                action: new InsertLayerAction({
                    type: 'raster',
                    name: name ?? '',
                    transform: transform ? new DOMMatrix(transform) : new DOMMatrix(),
                    width: image.width,
                    height: image.height,
                    data: {
                        sourceUuid,
                    },
                }),
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
                    text: t('mcp.insertRasterLayer.response.success'),
                }
            ],
        };
    }
})

registerTool({
    name: 'set-layer-transform',
    description: t('mcp.setLayerTransform.description'),
    inputSchema: {
        type: 'object',
        properties: {
            transform: { type: 'array', description: t('mcp.setLayerTransform.property.transform'), items: { type: 'number' } },
        },
        required: ['transform'],
    },
    async execute({ transform }) {
        if (transform.length !== 6) {
            throw new Error(t('mcp.common.error.2dTransformLength'));
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { default: workingFileStore } = await import('@/store/working-file');
        const { BundleAction } = await import('@/actions/bundle');
        const { UpdateLayerAction } = await import('@/actions/update-layer');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            const actions: BaseAction[] = [];
            for (const layerId of workingFileStore.state.selectedLayerIds) {
                actions.push(
                    new UpdateLayerAction({
                        id: layerId,
                        transform: new DOMMatrix(transform),
                    })
                );
            }
            if (actions.length > 0) {
                historyStore.dispatch('runAction', {
                    action: new BundleAction('freeTransform', 'action.freeTransform', actions),
                    reserveToken: historyReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: historyReserveToken });
            }
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
            throw error;
        }
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.setLayerTransform.response.success'),
                }
            ],
        };
    }
});

registerTool({
    name: 'reorder-layers', 
    description: t('mcp.reorderLayers.description'),
    inputSchema: {
        type: 'object',
        properties: {
            insertLayerIds: { type: 'array', description: t('mcp.reorderLayers.property.insertLayerIds'), items: { type: 'number' } },
            referenceLayerId: { type: 'number', description: t('mcp.reorderLayers.property.referenceLayerId'), items: { type: 'number' } },
            insertPosition: { type: 'string', description: t('mcp.reorderLayers.property.insertPosition'), enum: ['above', 'below'] },
        },
        required: ['insertLayerIds', 'referenceLayerId', 'insertPosition'],
    },
    async execute({ insertLayerIds, referenceLayerId, insertPosition }) {
        if (insertLayerIds.length === 0) {
            throw new Error(t('mcp.reorderLayers.error.noInsertIds'));
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { ReorderLayersAction } = await import('@/actions/reorder-layers');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            historyStore.dispatch('runAction', {
                action: new ReorderLayersAction(insertLayerIds, referenceLayerId, insertPosition),
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
                    text: t('mcp.reorderLayers.response.success'),
                }
            ],
        };
    }
});

registerTool({
    name: 'delete-layers',
    description: t('mcp.deleteLayers.description'),
    inputSchema: {
        type: 'object',
        properties: {
            layerIds: { type: 'array', description: t('mcp.deleteLayers.property.layerIds'), items: { type: 'number' } },
        },
        required: ['layerIds'],
    },
    async execute({ layerIds }) {
        if (layerIds.length === 0) {
            throw new Error(t('mcp.deleteLayers.error.noIds'));
        }

        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { DeleteLayersAction } = await import('@/actions/delete-layers');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            historyStore.dispatch('runAction', {
                action: new DeleteLayersAction(layerIds),
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
                    text: t('mcp.deleteLayers.response.success'),
                }
            ],
        };
    }
});
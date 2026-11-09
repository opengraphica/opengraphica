import { t } from '@/i18n';
import type { BaseAction } from '@/actions/base';
import type { WorkingFileVectorLayer } from '@/types';

const svgColorHexRegex = /^#[0-9a-f]{6}$/i;
const svgTransformMatrixRegex = /^matrix\s*\(\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:\s*,\s*|\s+)[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:\s*,\s*|\s+)[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:\s*,\s*|\s+)[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:\s*,\s*|\s+)[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:\s*,\s*|\s+)[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\s*\)$/;

async function createShape(createShapeCallback: (svgDocument: Document) => Element) {
    const { default: editorStore } = await import('@/store/editor');
    const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
    const { default: workingFileStore, getSelectedLayers, ensureUniqueLayerSiblingName } = await import('@/store/working-file');
    const { createStoredSvg, getStoredSvgDocument } = await import('@/store/svg');
    const { generateSvgElementIds } = await import('@/lib/svg');
    const { BundleAction } = await import('@/actions/bundle');
    const { InsertLayerAction } = await import('@/actions/insert-layer');
    const { UpdateLayerAction } = await import('@/actions/update-layer');

    const historyReserveToken = createHistoryReserveToken();
    await historyReserveQueueFree();
    await historyStore.dispatch('reserve', { token: historyReserveToken });

    try {
        let createdShapeId: string = '';
        const serializer = new XMLSerializer();
        const actions: BaseAction[] = [];
        const vectorLayers = getSelectedLayers<WorkingFileVectorLayer>().filter((layer) => layer.type === 'vector');
        if (vectorLayers.length === 0) {
            const { width, height } = workingFileStore.state;
            let newSvgString = `<svg width="${Math.round(width)}" height="${Math.round(height)}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>`;
            let svgDocument = new DOMParser().parseFromString(newSvgString, 'image/svg+xml');
            const shape = createShapeCallback(svgDocument);
            generateSvgElementIds(svgDocument);
            createdShapeId = shape.getAttribute('data-ogr-id') ?? '';
            newSvgString = serializer.serializeToString(svgDocument).replace(/xmlns=""/g, '');
            actions.push(
                new InsertLayerAction({
                    type: 'vector',
                    name: ensureUniqueLayerSiblingName(
                        workingFileStore.state.layers[0]?.id, t('toolbar.drawShape.newVectorLayerName')
                    ),
                    width,
                    height,
                    data: {
                        sourceUuid: await createStoredSvg((() => {
                            const image = new Image();
                            image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                            return image;
                        })()),
                        sourceDocument: editorStore.state.activeTool === 'shape' ? svgDocument : undefined,
                    }
                })
            )
        } else {
            for (const layer of vectorLayers) {
                let svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
                const shape = createShapeCallback(svgDocument);
                generateSvgElementIds(svgDocument);
                createdShapeId = shape.getAttribute('data-ogr-id') ?? '';
                const svgString = serializer.serializeToString(svgDocument).replace(/xmlns=""/g, '');
                actions.push(
                    new UpdateLayerAction({
                        id: layer.id,
                        data: {
                            sourceUuid: await createStoredSvg((() => {
                                const image = new Image();
                                image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                                return image;
                            })()),
                            sourceDocument: editorStore.state.activeTool === 'shape' ? svgDocument : undefined,
                        }
                    })
                );
            }
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('createShape', 'action.createShape', actions),
            reserveToken: historyReserveToken,
        });
        return {
            createdShapeId,
        };
    } catch (error) {
        await historyStore.dispatch('unreserve', { token: historyReserveToken });
        throw error;
    }
}

document.modelContext?.registerTool({
    name: 'create-rectangle-shape',
    description: t('mcp.createRectangleShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            x: { type: 'number', description: t('mcp.createRectangleShape.properties.x') },
            y: { type: 'number', description: t('mcp.createRectangleShape.properties.y') },
            rx: { type: 'number', description: t('mcp.createRectangleShape.properties.rx') },
            ry: { type: 'number', description: t('mcp.createRectangleShape.properties.ry') },
            width: { type: 'number', description: t('mcp.createRectangleShape.properties.width') },
            height: { type: 'number', description: t('mcp.createRectangleShape.properties.height') },
            fill: { type: 'string', description: t('mcp.createRectangleShape.properties.fill') },
            fillOpacity: { type: 'number', description: t('mcp.createRectangleShape.properties.fillOpacity'), default: 1 },
            stroke: { type: 'string', description: t('mcp.createRectangleShape.properties.stroke') },
            strokeOpacity: { type: 'number', description: t('mcp.createRectangleShape.properties.strokeOpacity'), default: 1 },
            strokeWidth: { type: 'number', description: t('mcp.createRectangleShape.properties.strokeWidth') },
            transform: { type: 'string', description: t('mcp.createRectangleShape.properties.transform') },
        },
        required: ['x', 'y', 'width', 'height'],
    },
    async execute({ x, y, rx, ry, width, height, fill, fillOpacity, stroke, strokeOpacity, strokeWidth, transform }) {
        if (fill && !svgColorHexRegex.test(fill)) {
            throw new Error(t('mcp.createRectangleShape.errors.fill'));
        }
        if (stroke && !svgColorHexRegex.test(stroke)) {
            throw new Error(t('mcp.createRectangleShape.errors.stroke'));
        }
        if (transform && !svgTransformMatrixRegex.test(transform)) {
            throw new Error(t('mcp.createRectangleShape.errors.transform'));
        }
        return await createShape((svgDocument) => {
            const rect = svgDocument.createElement('rect');
            rect.setAttribute('x', `${x}`);
            rect.setAttribute('y', `${y}`);
            rect.setAttribute('width', `${width}`);
            rect.setAttribute('height', `${height}`);
            if (rx != null) rect.setAttribute('rx', `${rx}`);
            if (ry != null) rect.setAttribute('ry', `${ry}`);
            if (fill != null) rect.setAttribute('fill', fill);
            if (fillOpacity != null) rect.setAttribute('fill-opacity', `${fillOpacity}`);
            if (stroke != null) rect.setAttribute('stroke', stroke);
            if (strokeOpacity != null) rect.setAttribute('stroke-opacity', `${strokeOpacity}`);
            if (strokeWidth != null) rect.setAttribute('stroke-width', `${strokeWidth}`);
            if (transform != null) rect.setAttribute('transform', transform);
            svgDocument.documentElement.appendChild(rect);
            return rect;
        });
    }
});

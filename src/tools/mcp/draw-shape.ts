import { t } from '@/i18n';
import { registerTool } from './validation';
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
    const { TrimLayerEmptySpaceAction } = await import('@/actions/trim-layer-empty-space');

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
            );
            actions.push(new TrimLayerEmptySpaceAction(-1));
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
                actions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('createShape', 'action.createShape', actions),
            reserveToken: historyReserveToken,
        });
        return {
            structuredContent: {
                createdShapeId,
            },
        };
    } catch (error) {
        await historyStore.dispatch('unreserve', { token: historyReserveToken });
        throw error;
    }
}

const shapeCommonInputSchemaProperties = {
    fill: { type: 'string', description: t('mcp.createShapeCommon.property.fill') },
    fillOpacity: { type: 'number', description: t('mcp.createShapeCommon.property.fillOpacity'), default: 1 },
    stroke: { type: 'string', description: t('mcp.createShapeCommon.property.stroke') },
    strokeLinecap: { type: 'string', enum: ['butt', 'round', 'square'], description: t('mcp.createShapeCommon.property.strokeLinecap') },
    strokeLinejoin: { type: 'string', enum: ['arcs', 'bevel', 'miter', 'miter-clip', 'round'], description: t('mcp.createShapeCommon.property.strokeLinejoin') },
    strokeOpacity: { type: 'number', description: t('mcp.createShapeCommon.property.strokeOpacity'), default: 1 },
    strokeWidth: { type: 'number', description: t('mcp.createShapeCommon.property.strokeWidth') },
    transform: { type: 'string', description: t('mcp.createShapeCommon.property.transform') },
} as const;

function validateShapeCommonAttributes({ fill, stroke, transform }: Record<string, string | undefined>) {
    if (fill && !svgColorHexRegex.test(fill)) {
        throw new Error(t('mcp.createShapeCommon.error.fill'));
    }
    if (stroke && !svgColorHexRegex.test(stroke)) {
        throw new Error(t('mcp.createShapeCommon.error.stroke'));
    }
    if (transform && !svgTransformMatrixRegex.test(transform)) {
        throw new Error(t('mcp.createShapeCommon.error.transform'));
    }
}

function setShapeCommonAttributes(
    shape: Element,
    { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }: {
        fill?: string; fillOpacity?: number; stroke?: string; strokeLinecap?: string;
        strokeLinejoin?: string; strokeOpacity?: number; strokeWidth?: number; transform?: string;
    }
) {
    if (fill != null) {
        shape.setAttribute('fill', fill);
    } else {
        shape.setAttribute('fill', 'none');
    }
    if (fillOpacity != null) shape.setAttribute('fill-opacity', `${fillOpacity}`);
    if (stroke != null) shape.setAttribute('stroke', stroke);
    if (strokeLinecap != null) shape.setAttribute('stroke-linecap', strokeLinecap);
    if (strokeLinejoin != null) shape.setAttribute('stroke-linejoin', strokeLinejoin);
    if (strokeOpacity != null) shape.setAttribute('stroke-opacity', `${strokeOpacity}`);
    if (strokeWidth != null) shape.setAttribute('stroke-width', `${strokeWidth}`);
    if (transform != null) shape.setAttribute('transform', transform);
}

registerTool({
    name: 'create-rectangle-shape',
    description: t('mcp.createRectangleShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            x: { type: 'number', description: t('mcp.createRectangleShape.property.x') },
            y: { type: 'number', description: t('mcp.createRectangleShape.property.y') },
            rx: { type: 'number', description: t('mcp.createRectangleShape.property.rx') },
            ry: { type: 'number', description: t('mcp.createRectangleShape.property.ry') },
            width: { type: 'number', description: t('mcp.createRectangleShape.property.width') },
            height: { type: 'number', description: t('mcp.createRectangleShape.property.height') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['x', 'y', 'width', 'height'],
    },
    async execute({ x, y, rx, ry, width, height, fill, fillOpacity, stroke, strokeOpacity, strokeLinecap, strokeLinejoin, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const rect = svgDocument.createElement('rect');
            rect.setAttribute('x', `${x}`);
            rect.setAttribute('y', `${y}`);
            rect.setAttribute('width', `${width}`);
            rect.setAttribute('height', `${height}`);
            if (rx != null) rect.setAttribute('rx', `${rx}`);
            if (ry != null) rect.setAttribute('ry', `${ry}`);
            setShapeCommonAttributes(rect, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(rect);
            return rect;
        });
    }
});

registerTool({
    name: 'create-circle-shape',
    description: t('mcp.createCircleShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            cx: { type: 'number', description: t('mcp.createCircleShape.property.cx') },
            cy: { type: 'number', description: t('mcp.createCircleShape.property.cy') },
            r: { type: 'number', description: t('mcp.createCircleShape.property.r') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['cx', 'cy', 'r'],
    },
    async execute({ cx, cy, r, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const circle = svgDocument.createElement('circle');
            circle.setAttribute('cx', `${cx}`);
            circle.setAttribute('cy', `${cy}`);
            circle.setAttribute('r', `${r}`);
            setShapeCommonAttributes(circle, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(circle);
            return circle;
        });
    }
});

registerTool({
    name: 'create-ellipse-shape',
    description: t('mcp.createEllipseShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            cx: { type: 'number', description: t('mcp.createEllipseShape.property.cx') },
            cy: { type: 'number', description: t('mcp.createEllipseShape.property.cy') },
            rx: { type: 'number', description: t('mcp.createEllipseShape.property.rx') },
            ry: { type: 'number', description: t('mcp.createEllipseShape.property.ry') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['cx', 'cy', 'rx', 'ry'],
    },
    async execute({ cx, cy, rx, ry, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const ellipse = svgDocument.createElement('ellipse');
            ellipse.setAttribute('cx', `${cx}`);
            ellipse.setAttribute('cy', `${cy}`);
            ellipse.setAttribute('rx', `${rx}`);
            ellipse.setAttribute('ry', `${ry}`);
            setShapeCommonAttributes(ellipse, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(ellipse);
            return ellipse;
        });
    }
});

registerTool({
    name: 'create-line-shape',
    description: t('mcp.createLineShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            x1: { type: 'number', description: t('mcp.createLineShape.property.x1') },
            y1: { type: 'number', description: t('mcp.createLineShape.property.y1') },
            x2: { type: 'number', description: t('mcp.createLineShape.property.x2') },
            y2: { type: 'number', description: t('mcp.createLineShape.property.y2') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['x1', 'y1', 'x2', 'y2'],
    },
    async execute({ x1, y1, x2, y2, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const line = svgDocument.createElement('line');
            line.setAttribute('x1', `${x1}`);
            line.setAttribute('y1', `${y1}`);
            line.setAttribute('x2', `${x2}`);
            line.setAttribute('y2', `${y2}`);
            setShapeCommonAttributes(line, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(line);
            return line;
        });
    }
});

registerTool({
    name: 'create-polyline-shape',
    description: t('mcp.createPolylineShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            points: { type: 'string', description: t('mcp.createPolylineShape.property.points') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['points'],
    },
    async execute({ points, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const polyline = svgDocument.createElement('polyline');
            polyline.setAttribute('points', points);
            setShapeCommonAttributes(polyline, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(polyline);
            return polyline;
        });
    }
});

registerTool({
    name: 'create-polygon-shape',
    description: t('mcp.createPolygonShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            points: { type: 'string', description: t('mcp.createPolygonShape.property.points') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['points'],
    },
    async execute({ points, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const polygon = svgDocument.createElement('polygon');
            polygon.setAttribute('points', points);
            setShapeCommonAttributes(polygon, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(polygon);
            return polygon;
        });
    }
});

registerTool({
    name: 'create-path-shape',
    description: t('mcp.createPathShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            d: { type: 'string', description: t('mcp.createPathShape.property.d') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['d'],
    },
    async execute({ d, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform }) {
        validateShapeCommonAttributes({ fill, stroke, transform });
        return await createShape((svgDocument) => {
            const path = svgDocument.createElement('path');
            path.setAttribute('d', d);
            setShapeCommonAttributes(path, { fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin, strokeOpacity, strokeWidth, transform });
            svgDocument.documentElement.appendChild(path);
            return path;
        });
    }
});

registerTool({
    name: 'get-shape-list',
    description: t('mcp.getShapeList.description'),
    annotations: {
        readOnlyHint: true,
    },
    async execute() {
        const { camelCaseToKebabCase } = await import('@/lib/string');
        const { getDefaultParseNodeGlobalOptions, parseFloatWithUnits } = await import('@/lib/svg');
        const { getStoredSvgDocument } = await import('@/store/svg');
        const { selectedShapes } = await import('@/tools/store/draw-shape-state');
        const { getSelectedLayers } = await import('@/store/working-file');

        const stringAttributes = ['fill', 'stroke', 'strokeLinecap', 'strokeLinejoin', 'transform'];
        const numberAttributes = ['x', 'y', 'cx', 'cy', 'rx', 'ry', 'r', 'width', 'height', 'fillOpacity', 'strokeOpacity', 'strokeWidth'];

        const layerDefinitions: Array<{ layerId: number, shapes: Array<{ shapeId: string, tagName: string, attributes: Record<string, string | number>, selected: boolean }> }> = [];
        const selectedVectorLayers = getSelectedLayers<WorkingFileVectorLayer>().filter((layer) => layer.type === 'vector');
        for (const layer of selectedVectorLayers) {
            const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
            const { defaultDPI, defaultUnit } = getDefaultParseNodeGlobalOptions({
                defaultDPI: 90,
                defaultUnit: 'px',
            });
            layerDefinitions.push({
                layerId: layer.id,
                shapes: Array.from(
                    svgDocument.querySelectorAll('rect,polygon,polyline,circle,ellipse,line,path')
                ).map((element) => {
                    const shapeId = element.getAttribute('data-ogr-id') ?? '';
                    return {
                        shapeId,
                        tagName: element.tagName.toLowerCase(),
                        attributes: {
                            ...stringAttributes.reduce((accumulator, attributeName) => {
                                const value = element.getAttribute(camelCaseToKebabCase(attributeName));
                                if (value != null && value !== 'none') {
                                    accumulator[attributeName] = value;
                                }
                                return accumulator;
                            }, {}),
                            ...numberAttributes.reduce((accumulator, attributeName) => {
                                const value = element.getAttribute(camelCaseToKebabCase(attributeName));
                                if (value != null) {
                                    accumulator[attributeName] = parseFloatWithUnits(value, defaultUnit, defaultDPI);
                                }
                                return accumulator;
                            }, {}),
                        },
                        selected: !!selectedShapes.value.find(([layerId, otherShapeId]) => layerId === layer.id && shapeId === otherShapeId),
                    };
                })
            })
        }
        return {
            structuredContent: {
                shapesByLayer: layerDefinitions,
            },
        };
    }
});

registerTool({
    name: 'set-shape-attributes',
    description: t('mcp.setShapeAttributes.description'),
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', description: t('mcp.setShapeAttributes.property.id') },
            x: { type: 'number', description: t('mcp.createRectangleShape.property.x') },
            y: { type: 'number', description: t('mcp.createRectangleShape.property.y') },
            x1: { type: 'number', description: t('mcp.createLineShape.property.x1') },
            y1: { type: 'number', description: t('mcp.createLineShape.property.y1') },
            x2: { type: 'number', description: t('mcp.createLineShape.property.x2') },
            y2: { type: 'number', description: t('mcp.createLineShape.property.y2') },
            cx: { type: 'number', description: t('mcp.setShapeAttributes.property.cx') },
            cy: { type: 'number', description: t('mcp.setShapeAttributes.property.cy') },
            r: { type: 'number', description: t('mcp.createCircleShape.property.r') },
            rx: { type: 'number', description: t('mcp.setShapeAttributes.property.rx') },
            ry: { type: 'number', description: t('mcp.setShapeAttributes.property.ry') },
            width: { type: 'number', description: t('mcp.createRectangleShape.property.width') },
            height: { type: 'number', description: t('mcp.createRectangleShape.property.height') },
            points: { type: 'string', description: t('mcp.setShapeAttributes.property.points') },
            d: { type: 'string', description: t('mcp.createPathShape.property.d') },
            ...shapeCommonInputSchemaProperties,
        },
        required: ['id'],
    },
    async execute(properties) {
        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { getSelectedLayers } = await import('@/store/working-file');
        const { BundleAction } = await import('@/actions/bundle');
        const { TrimLayerEmptySpaceAction } = await import('@/actions/trim-layer-empty-space');
        const { UpdateVectorLayerAttributesAction } = await import('@/actions/update-vector-layer-attributes');

        const { fill, stroke, transform } = properties;
        validateShapeCommonAttributes({ fill, stroke, transform });

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            const vectorLayers = getSelectedLayers<WorkingFileVectorLayer>().filter((layer) => layer.type === 'vector');
            const actions: BaseAction[] = [];
            for (const layer of vectorLayers) {
                const attributes = Object.keys(properties).reduce((accumulator, attributeName) => {
                    const value = properties[attributeName];
                    if (attributeName !== 'id' && value != null) {
                        accumulator[attributeName] = `${value}`;
                    }
                    return accumulator;
                }, {} as Record<string, string>);
                actions.push(
                    new UpdateVectorLayerAttributesAction(layer.id, properties.id, attributes)
                );
                actions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
            if (actions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateVectorLayerAttributes', 'action.updateVectorLayerAttributes', actions),
                    reserveToken: historyReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: historyReserveToken });
            }
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
        }
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.common.response.updateSuccess'),
                }
            ],
        };
    }
});

registerTool({
    name: 'delete-shape',
    description: t('mcp.deleteShape.description'),
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', description: t('mcp.deleteShape.property.id') },
        },
        required: ['id'],
    },
    async execute({ id }) {
        const { default: editorStore } = await import('@/store/editor');
        const { default: historyStore, createHistoryReserveToken, historyReserveQueueFree } = await import('@/store/history');
        const { getSelectedLayers } = await import('@/store/working-file');
        const { createStoredSvg, getStoredSvgDocument } = await import('@/store/svg');
        const { generateSvgElementIds } = await import('@/lib/svg');
        const { BundleAction } = await import('@/actions/bundle');
        const { UpdateLayerAction } = await import('@/actions/update-layer');
        const { TrimLayerEmptySpaceAction } = await import('@/actions/trim-layer-empty-space');

        const historyReserveToken = createHistoryReserveToken();
        await historyReserveQueueFree();
        await historyStore.dispatch('reserve', { token: historyReserveToken });

        try {
            const serializer = new XMLSerializer();
            const actions: BaseAction[] = [];
            const vectorLayers = getSelectedLayers<WorkingFileVectorLayer>().filter((layer) => layer.type === 'vector');
            for (const layer of vectorLayers) {
                let svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
                svgDocument.querySelector(`[data-ogr-id="${id}"]`)?.remove();
                generateSvgElementIds(svgDocument);
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
                actions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
            if (actions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('deleteVectorLayerShape', 'action.deleteVectorLayerShape', actions),
                    reserveToken: historyReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: historyReserveToken });
            }
        } catch (error) {
            await historyStore.dispatch('unreserve', { token: historyReserveToken });
        }
        return {
            content: [
                {
                    type: 'text',
                    text: t('mcp.common.response.deleteSuccess'),
                }
            ],
        };
    }
});
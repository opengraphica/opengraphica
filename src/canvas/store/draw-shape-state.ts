import { computed, ref, watch } from 'vue';

import { PerformantStore } from '@/store/performant-store';

import {
    parseRectNodeAttributes, parsePolygonNodeAttributes, parsePolylineNodeAttributes,
    parseCircleNodeAttributes, parseEllipseNodeAttributes, parseLineNodeAttributes,
    parsePathNodeAttributes, parseCommonNodeAttributes,
    serializeVectorPathCommand,
    getViewBox,
} from '@/lib/svg';
import { throttle } from '@/lib/timing';

import { type RendererFrontend, type VectorPathCommand, VectorPathCommandType, type RGBAColor, type WorkingFileVectorLayer } from '@/types';

export const editingLayers = ref<WorkingFileVectorLayer[]>([]);
export const showShapeDrawer = ref(false);

export const styleDockVisible = ref(false);
export const styleDockLeft = ref(0);
export const styleDockTop = ref(0);

export const hasVisibleToolbarOverlay = computed(() => {
    return showShapeDrawer.value;
});

interface PermanentStorageState {
    selectedShapeType: string;
    strokeColor: RGBAColor;
    strokeWidth: number;
    fillColor: RGBAColor;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawShapeStateStore',
    state: {
        selectedShapeType: 'rectangle',
        strokeColor: {
            is: 'color',
            r: 0,
            g: 0,
            b: 0,
            alpha: 1,
            style: '#000000'
        },
        strokeWidth: 0,
        fillColor: {
            is: 'color',
            r: 0,
            g: 0,
            b: 0,
            alpha: 1,
            style: '#000000'
        },
    },
    restore: ['selectedShapeType', 'strokeColor', 'fillColor'],
});

export const selectedShapeType = permanentStorage.getWritableRef('selectedShapeType');
export const strokeColor = permanentStorage.getWritableRef('strokeColor');
export const fillColor = permanentStorage.getWritableRef('fillColor');

export interface EditControlPoint {
    layerIndex: number; // Index in editingLayers
    nodeIndex: number; // Indes of the editable node in the ordered query list.
    pathIndex: number; // Index in path command list
    attachToIndex?: number;
    x: number;
    y: number;
    sx?: number; // Starting point for drag
    sy?: number; // Starting point for drag
    tx?: number; // Transformed for view
    ty?: number; // Transformed for view
    xProp: 'x' | 'x1' | 'x2';
    yProp: 'y' | 'y1' | 'y2';
}

export const editControlPoints = ref<EditControlPoint[]>([]);
export const editControlPointsDirty = ref<boolean>(false);
export const editControlPointNodes = ref<Element[]>([]);
export const editControlPointNodeParsedAttributes = ref<Record<string, any>>([]);
export const hoveringEditControlPointIndices = ref<number[]>([]);
export const selectedEditControlPointIndices = ref<number[]>([]);

const createEditControlPoints = throttle(() => {
    const controlPoints: EditControlPoint[] = [];
    hoveringEditControlPointIndices.value = [];
    selectedEditControlPointIndices.value = [];
    editControlPointNodes.value = [];
    editControlPointNodeParsedAttributes.value = [];
    let nodeIndex = 0;
    
    for (const [layerIndex, layer] of editingLayers.value.entries()) {
        if (!layer.data.sourceDocument?.querySelectorAll) continue;
        const viewBox = getViewBox(layer.data.sourceDocument);
        const viewBoxXf = layer.transform.scale(
            layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
        ).translateSelf(
            viewBox.x, viewBox.y, 0.0,
        )
        const nodes = Array.from(
            layer.data.sourceDocument.querySelectorAll('rect,polygon,polyline,circle,ellipse,line,path')
        );
        for (const node of nodes) {
            const { transform } = parseCommonNodeAttributes(node);
            const nodeXf = viewBoxXf.multiply(transform);

            editControlPointNodes.value.push(node);
            switch (node.nodeName) {
                case 'rect': {
                    const { x, y, w, h } = parseRectNodeAttributes(node);
                    // TODO
                    editControlPointNodeParsedAttributes.value.push({
                        transform, x, y, w, h,
                    });
                    break;
                }
                case 'polygon': {
                    const { points } = parsePolygonNodeAttributes(node);
                    for (const [pointIndex, point] of points.entries()) {
                        const xfPoint = point.matrixTransform(nodeXf);
                        controlPoints.push({
                            layerIndex,
                            nodeIndex,
                            pathIndex: pointIndex,
                            x: xfPoint.x,
                            y: xfPoint.y,
                            xProp: 'x',
                            yProp: 'y',
                        });
                    }
                    editControlPointNodeParsedAttributes.value.push({
                        transform, points,
                    });
                    break;
                }
                case 'polyline': {
                    const { points } = parsePolylineNodeAttributes(node);
                    for (const [pointIndex, point] of points.entries()) {
                        const xfPoint = point.matrixTransform(nodeXf);
                        controlPoints.push({
                            layerIndex,
                            nodeIndex,
                            pathIndex: pointIndex,
                            x: xfPoint.x,
                            y: xfPoint.y,
                            xProp: 'x',
                            yProp: 'y',
                        });
                    }
                    editControlPointNodeParsedAttributes.value.push({
                        transform, points,
                    });
                    break;
                }
                case 'circle': {
                    const { x, y, r } = parseCircleNodeAttributes(node);
                    // TODO
                    editControlPointNodeParsedAttributes.value.push({
                        transform, x, y, r,
                    });
                    break;
                }
                case 'ellipse': {
                    const { x, y, rx, ry } = parseEllipseNodeAttributes(node);
                    // TODO
                    editControlPointNodeParsedAttributes.value.push({
                        transform, x, y, rx, ry,
                    });
                    break;
                }
                case 'line': {
                    const { x1, y1, x2, y2 } = parseLineNodeAttributes(node);
                    // TODO
                    editControlPointNodeParsedAttributes.value.push({
                        transform, x1, y1, x2, y2,
                    });
                    break;
                }
                case 'path': {
                    const { d } = parsePathNodeAttributes(node);
                    const point = new DOMPoint();
                    let previousCommand: VectorPathCommand | undefined;
                    let previousAttachToIndex: number = -1;
                    for (const [commandIndex, command] of d.entries()) {
                        let attachToIndex: number = controlPoints.length;
                        switch (command.type) {
                            case VectorPathCommandType.CUBIC_BEZIER_CURVE: {
                                point.x = command.x;
                                point.y = command.y;
                                let xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x',
                                    yProp: 'y',
                                });
                                point.x = command.x2;
                                point.y = command.y2;
                                xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    attachToIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x2',
                                    yProp: 'y2',
                                });
                                if (previousCommand) {
                                    point.x = command.x1;
                                    point.y = command.y1;
                                    xfPoint = point.matrixTransform(nodeXf);
                                    controlPoints.push({
                                        layerIndex,
                                        nodeIndex,
                                        pathIndex: commandIndex,
                                        attachToIndex: previousAttachToIndex,
                                        x: xfPoint.x,
                                        y: xfPoint.y,
                                        xProp: 'x1',
                                        yProp: 'y1',
                                    });
                                }
                                break;
                            }
                            case VectorPathCommandType.ELLIPTICAL_ARC: {
                                point.x = command.x;
                                point.y = command.y;
                                const xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x',
                                    yProp: 'y',
                                });
                                // TODO - control arc
                                break;
                            }
                            case VectorPathCommandType.LINE: {
                                point.x = command.x;
                                point.y = command.y;
                                const xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x',
                                    yProp: 'y',
                                });
                                break;
                            }
                            case VectorPathCommandType.MOVE: {
                                point.x = command.x;
                                point.y = command.y;
                                const xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x',
                                    yProp: 'y',
                                });
                                break;
                            }
                            case VectorPathCommandType.QUADRATIC_BEZIER_CURVE: {
                                point.x = command.x;
                                point.y = command.y;
                                let xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x',
                                    yProp: 'y',
                                });
                                point.x = command.x1;
                                point.y = command.y1;
                                xfPoint = point.matrixTransform(nodeXf);
                                controlPoints.push({
                                    layerIndex,
                                    nodeIndex,
                                    pathIndex: commandIndex,
                                    attachToIndex,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                    xProp: 'x1',
                                    yProp: 'y1',
                                });
                                if (previousCommand) {
                                    controlPoints.push({
                                        layerIndex,
                                        nodeIndex,
                                        pathIndex: commandIndex,
                                        attachToIndex: previousAttachToIndex,
                                        x: xfPoint.x,
                                        y: xfPoint.y,
                                        xProp: 'x1',
                                        yProp: 'y1',
                                    });
                                }
                                break;
                            }
                        }
                        previousCommand = command;
                        previousAttachToIndex = attachToIndex;
                    }
                    editControlPointNodeParsedAttributes.value.push({
                        transform, d,
                    });
                    break;
                }
                default: {
                    editControlPointNodeParsedAttributes.value.push({
                        transform,
                    });
                }
            }
            nodeIndex = editControlPointNodes.value.length;
        }
    }

    editControlPoints.value = controlPoints;
}, 100);

watch(() => editingLayers.value, createEditControlPoints, { deep: true });

interface ControlPointAttributeEditGroup {
    layerIndex: number;
    nodeIndex: number;
    editControlPointIndices: number[]
}

interface ControlPointAttributeEdit {
    layerId: number;
    nodeId: string;
    attributes: Record<string, string>;
}

export function renderControlPointAttributeEdits(
    editControlPointIndices: number[],
    renderer: RendererFrontend,
) {
    const editGroups: ControlPointAttributeEditGroup[] = [];
    const edits: ControlPointAttributeEdit[] = [];
    const scrapPoint = new DOMPoint();

    for (let pointIndex of editControlPointIndices) {
        const editPoint = editControlPoints.value[pointIndex];
        let editGroup = editGroups.find(
            (group) => group.layerIndex === editPoint.layerIndex && group.nodeIndex === editPoint.nodeIndex
        );
        if (editGroup) {
            editGroup.editControlPointIndices.push(pointIndex);
        } else {
            editGroup = {
                layerIndex: editPoint.layerIndex,
                nodeIndex: editPoint.nodeIndex,
                editControlPointIndices: [pointIndex],
            };
            editGroups.push(editGroup);
        }
    }

    for (const editGroup of editGroups) {
        const layer = editingLayers.value[editGroup.layerIndex];
        const layerId = layer.id;
        const node = editControlPointNodes.value[editGroup.nodeIndex];

        const nodeId = node.getAttribute('data-ogr-id');
        const attributes: Record<string, string> = {};

        if (!nodeId) continue;

        const originalAttributes = editControlPointNodeParsedAttributes.value[editGroup.nodeIndex];

        const viewBox = getViewBox(layer.data.sourceDocument);
        const nodeXf = layer.transform.scale(
            layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
        ).translateSelf(
            viewBox.x, viewBox.y, 0.0,
        ).multiplySelf(
            originalAttributes.transform
        ).invertSelf();

        switch (node.nodeName) {
            case 'rect': {
                break;
            }
            case 'polygon': {
                break;
            }
            case 'polyline': {
                break;
            }
            case 'circle': {
                break;
            }
            case 'ellipse': {
                break;
            }
            case 'line': {
                break;
            }
            case 'path': {
                let newCommands: VectorPathCommand[] = [...originalAttributes.d];
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    scrapPoint.x = point.x;
                    scrapPoint.y = point.y;
                    const xfPoint = scrapPoint.matrixTransform(nodeXf);
                    if (point.layerIndex !== editGroup.layerIndex || point.nodeIndex !== editGroup.nodeIndex) continue;
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        const command: VectorPathCommand = { ...newCommands[point.pathIndex] };
                        command[point.xProp] = xfPoint.x;
                        command[point.yProp] = xfPoint.y;
                        newCommands[point.pathIndex] = command;
                    }
                }
                let d = '';
                for (const [commandIndex, command] of newCommands.entries()) {
                    d += ' ' + serializeVectorPathCommand(
                        command,
                        commandIndex > 0 ? newCommands[commandIndex - 1] : undefined,
                    );
                }
                attributes.d = d.trim();
            }
        }

        renderer.updateVectorLayerAttributes(
            layerId,
            nodeId,
            attributes,
        )
    }

    return edits;
}

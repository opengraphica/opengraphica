import { computed, ref, watch } from 'vue';

import { PerformantStore } from '@/store/performant-store';

import { pointDistance2d } from '@/lib/math';
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
    xProp?: 'x' | 'x1' | 'x2' | 'cx' | 'rx' | 'width';
    yProp?: 'y' | 'y1' | 'y2' | 'cy' | 'ry' | 'height';
}

export const editControlPoints = ref<EditControlPoint[]>([]);
export const editControlPointsDirty = ref<boolean>(false);
export const editControlPointNodes = ref<Element[]>([]);
export const editControlPointNodeParsedAttributes = ref<Record<string, any>>([]);
export const hoveringEditControlPointIndices = ref<number[]>([]);
export const selectedEditControlPointIndices = ref<number[]>([]);
export const selectedEditControlAttachPointIndices = ref<number[]>([]); // Attach points that reference selectedEditControlPointIndices

const createEditControlPoints = throttle(() => {
    const controlPoints: EditControlPoint[] = [];
    hoveringEditControlPointIndices.value = [];
    selectedEditControlPointIndices.value = [];
    selectedEditControlAttachPointIndices.value = [];
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
        );
        const nodes = Array.from(
            layer.data.sourceDocument.querySelectorAll('rect,polygon,polyline,circle,ellipse,line,path')
        );
        for (const node of nodes) {
            const { transform } = parseCommonNodeAttributes(node);
            const nodeXf = viewBoxXf.multiply(transform);

            editControlPointNodes.value.push(node);
            switch (node.nodeName) {
                case 'rect': {
                    const { x, y, width, height } = parseRectNodeAttributes(node);
                    const point = new DOMPoint(x, y);
                    let xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 0,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'x',
                        yProp: 'y',
                    });
                    point.x = x + width;
                    point.y = y + height;
                    xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 1,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'width',
                        yProp: 'height',
                    });
                    editControlPointNodeParsedAttributes.value.push({
                        transform, x, y, width, height,
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
                    const { cx, cy, r } = parseCircleNodeAttributes(node);
                    const point = new DOMPoint(cx, cy);
                    let xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 0,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'cx',
                        yProp: 'cy',
                    });
                    point.y = cy - r;
                    xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 1,
                        attachToIndex: controlPoints.length - 1,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        yProp: 'ry',
                    });
                    editControlPointNodeParsedAttributes.value.push({
                        transform, cx, cy, r,
                    });
                    break;
                }
                case 'ellipse': {
                    const { cx, cy, rx, ry } = parseEllipseNodeAttributes(node);
                    const point = new DOMPoint(cx, cy);
                    let xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 0,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'cx',
                        yProp: 'cy',
                    });
                    point.x = cx;
                    point.y = cy - ry;
                    xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 1,
                        attachToIndex: controlPoints.length - 1,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        yProp: 'ry',
                    });
                    point.x = cx - rx;
                    point.y = cy;
                    xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 2,
                        attachToIndex: controlPoints.length - 2,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'rx',
                    });
                    editControlPointNodeParsedAttributes.value.push({
                        transform, cx, cy, rx, ry,
                    });
                    break;
                }
                case 'line': {
                    const { x1, y1, x2, y2 } = parseLineNodeAttributes(node);
                    const point = new DOMPoint(x1, y1);
                    let xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 0,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'x1',
                        yProp: 'y1',
                    });
                    point.x = x2;
                    point.y = y2;
                    xfPoint = point.matrixTransform(nodeXf);
                    controlPoints.push({
                        layerIndex,
                        nodeIndex,
                        pathIndex: 1,
                        x: xfPoint.x,
                        y: xfPoint.y,
                        xProp: 'x2',
                        yProp: 'y2',
                    });
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
                let x = parseFloat(originalAttributes.x);
                let y = parseFloat(originalAttributes.y);
                let width = parseFloat(originalAttributes.width);
                let height = parseFloat(originalAttributes.height);
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        if (point.xProp === 'x' && point.yProp === 'y') {
                            x = point.x;
                            y = point.y;
                        } else if (point.xProp === 'width' && point.yProp === 'height') {
                            width = point.x - x;
                            height = point.y - y;
                        }
                    }
                }
                scrapPoint.x = x;
                scrapPoint.y = y;
                let xfPoint = scrapPoint.matrixTransform(nodeXf);
                attributes.x = `${xfPoint.x}`;
                attributes.y = `${xfPoint.y}`;
                scrapPoint.x = width + (originalAttributes.x - x);
                scrapPoint.y = height + (originalAttributes.y - y);
                xfPoint = scrapPoint.matrixTransform(nodeXf);
                attributes.width = `${xfPoint.x}`;
                attributes.height = `${xfPoint.y}`;
                break;
            }
            case 'polygon': case 'polyline': {
                let newPoints: DOMPoint[] = [...originalAttributes.points];
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    scrapPoint.x = point.x;
                    scrapPoint.y = point.y;
                    const xfPoint = scrapPoint.matrixTransform(nodeXf);
                    if (point.layerIndex !== editGroup.layerIndex || point.nodeIndex !== editGroup.nodeIndex) continue;
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        newPoints[point.pathIndex].x = xfPoint.x;
                        newPoints[point.pathIndex].y = xfPoint.y;
                    }
                }
                let points = '';
                for (const point of newPoints) {
                    points += ' ' + point.x + ','  + point.y;
                }
                attributes.points = points.trim();
                break;
            }
            case 'circle': {
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        if (point.xProp === 'rx' || point.yProp === 'ry') {
                            const attachPoint = editControlPoints.value[point.attachToIndex!];
                            scrapPoint.x = point.x;
                            scrapPoint.y = point.y;
                            const xfPoint1 = scrapPoint.matrixTransform(nodeXf);
                            scrapPoint.x = attachPoint.x;
                            scrapPoint.y = attachPoint.y;
                            const xfPoint2 = scrapPoint.matrixTransform(nodeXf);
                            attributes.r = `${pointDistance2d(xfPoint1.x, xfPoint1.y, xfPoint2.x, xfPoint2.y)}`;
                        } else {
                            scrapPoint.x = point.x;
                            scrapPoint.y = point.y;
                            const xfPoint = scrapPoint.matrixTransform(nodeXf);
                            attributes[point.xProp as never] = `${xfPoint.x}`;
                            attributes[point.yProp as never] = `${xfPoint.y}`;
                        }
                    }
                }
                break;
            }
            case 'ellipse': {
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        if (point.xProp === 'rx' || point.yProp === 'ry') {
                            const attachPoint = editControlPoints.value[point.attachToIndex!];
                            scrapPoint.x = point.x;
                            scrapPoint.y = point.y;
                            const xfPoint1 = scrapPoint.matrixTransform(nodeXf);
                            scrapPoint.x = attachPoint.x;
                            scrapPoint.y = attachPoint.y;
                            const xfPoint2 = scrapPoint.matrixTransform(nodeXf);
                            attributes[point.xProp! ?? point.yProp!] = `${pointDistance2d(xfPoint1.x, xfPoint1.y, xfPoint2.x, xfPoint2.y)}`;
                        } else {
                            scrapPoint.x = point.x;
                            scrapPoint.y = point.y;
                            const xfPoint = scrapPoint.matrixTransform(nodeXf);
                            attributes[point.xProp as never] = `${xfPoint.x}`;
                            attributes[point.yProp as never] = `${xfPoint.y}`;
                        }
                    }
                }
                break;
            }
            case 'line': {
                for (const pointIndex of editGroup.editControlPointIndices) {
                    const point = editControlPoints.value[pointIndex];
                    scrapPoint.x = point.x;
                    scrapPoint.y = point.y;
                    const xfPoint = scrapPoint.matrixTransform(nodeXf);
                    if (editGroup.editControlPointIndices.includes(pointIndex)) {
                        attributes[point.xProp as never] = `${xfPoint.x}`;
                        attributes[point.yProp as never] = `${xfPoint.y}`;
                    }
                }
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
                        command[point.xProp!] = xfPoint.x;
                        command[point.yProp!] = xfPoint.y;
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

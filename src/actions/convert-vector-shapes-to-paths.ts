import { nextTick } from 'vue';
import { BaseAction } from './base';

import { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { getStoredSvgDocument, createStoredSvg, reserveStoredSvg, unreserveStoredSvg } from '@/store/svg';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';

import {
    generateSvgElementIds, parseRectNodeAttributes, parsePolygonNodeAttributes,
    parsePolylineNodeAttributes, parseCircleNodeAttributes, parseEllipseNodeAttributes,
    parseLineNodeAttributes,
} from '@/lib/svg';

import { UpdateLayerAction } from './update-layer';

import type { WorkingFileVectorLayer } from '@/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPE_ATTRIBUTES = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points'];

export class ConvertVectorShapesToPathsAction extends BaseAction {

    private layerId: number;
    private nodeIds: string[];

    private updateLayerAction: UpdateLayerAction<any> | undefined;

    constructor(
        layerId: number,
        nodeIds: string[],
    ) {
        super('convertVectorShapesToPaths', 'action.convertVectorShapesToPaths');
        this.layerId = layerId;
        this.nodeIds = nodeIds;
    }

    public async do() {
        super.do();

        if (this.updateLayerAction) {
            await this.updateLayerAction.do();
            return;
        }

        const layer = getLayerById<WorkingFileVectorLayer>(this.layerId);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        if (layer.type !== 'vector') {
            throw new Error('Aborted - Layer is not a vector layer.');
        }

        const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
        if (!svgDocument) {
            throw new Error('Aborted - Vector layer is missing a SVG document.');
        }

        for (const nodeId of this.nodeIds) {
            const node = svgDocument.querySelector(`[data-ogr-id="${nodeId}"]`);
            if (!node || node.tagName === 'path') continue;

            const path = svgDocument.createElementNS(SVG_NS, 'path');
            for (const attribute of Array.from(node.attributes)) {
                if (SHAPE_ATTRIBUTES.includes(attribute.name)) continue;
                path.setAttribute(attribute.name, attribute.value);
            }

            switch (node.tagName) {
                case 'rect': {
                    const { x, y, width, height } = parseRectNodeAttributes(node);
                    path.setAttribute('d', `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`);
                    break;
                }
                case 'circle': {
                    const { cx, cy, r } = parseCircleNodeAttributes(node);
                    const k = 0.5522847498307936;
                    let d = '';
                    if (r > 0) {
                        const rk = k * r;
                        d = [
                            `M ${cx} ${cy - r}`,
                            `C ${cx + rk} ${cy - r}, ${cx + r} ${cy - rk}, ${cx + r} ${cy}`,
                            `C ${cx + r} ${cy + rk}, ${cx + rk} ${cy + r}, ${cx} ${cy + r}`,
                            `C ${cx - rk} ${cy + r}, ${cx - r} ${cy + rk}, ${cx - r} ${cy}`,
                            `C ${cx - r} ${cy - rk}, ${cx - rk} ${cy - r}, ${cx} ${cy - r}`,
                            'Z',
                        ].join(' ');
                    }
                    path.setAttribute('d', d);
                    break;
                }
                case 'ellipse': {
                    const { cx, cy, rx, ry } = parseEllipseNodeAttributes(node);
                    const k = 0.5522847498307936;
                    let d = '';
                    if (rx > 0 && ry > 0) {
                        const x = k * rx;
                        const y = k * ry;
                        d = [
                            `M ${cx} ${cy - ry}`,
                            `C ${cx + x} ${cy - ry}, ${cx + rx} ${cy - y}, ${cx + rx} ${cy}`,
                            `C ${cx + rx} ${cy + y}, ${cx + x} ${cy + ry}, ${cx} ${cy + ry}`,
                            `C ${cx - x} ${cy + ry}, ${cx - rx} ${cy + y}, ${cx - rx} ${cy}`,
                            `C ${cx - rx} ${cy - y}, ${cx - x} ${cy - ry}, ${cx} ${cy - ry}`,
                            'Z',
                        ].join(' ');
                    }
                    path.setAttribute('d', d);
                    break;
                }
                case 'line': {
                    const { x1, y1, x2, y2 } = parseLineNodeAttributes(node);
                    path.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
                    break;
                }
                case 'polyline': {
                    const { points } = parsePolylineNodeAttributes(node);
                    const d: string[] = [];
                    for (const [pointIndex, point] of points.entries()) {
                        d.push(`${pointIndex > 0 ? 'L' : 'M'}${point.x},${point.y}`);
                    }
                    path.setAttribute('d', d.join(' '));
                    break;
                }
                case 'polygon': {
                    const { points } = parsePolygonNodeAttributes(node);
                    const d: string[] = [];
                    for (const [pointIndex, point] of points.entries()) {
                        d.push(`${pointIndex > 0 ? 'L' : 'M'}${point.x},${point.y}`);
                    }
                    path.setAttribute('d', d.join(' ') + ' Z');
                    break;
                }
            }

            node.after(path);
            node.remove();
        }

        generateSvgElementIds(svgDocument);

        const serializer = new XMLSerializer();
        const svgText = serializer.serializeToString(svgDocument);
        const blob = new Blob([svgText], {
            type: 'image/svg+xml',
        });

        const url = URL.createObjectURL(blob);
        const image = new Image()
        await new Promise((resolve) => {
            image.onload = resolve;
            image.onerror = resolve;
            image.src = url;
        });

        this.updateLayerAction = new UpdateLayerAction({
            id: this.layerId,
            data: {
                sourceUuid: await createStoredSvg(image),
            },
        });
        await this.updateLayerAction.do();
        this.freeEstimates.memory = this.updateLayerAction.memoryEstimate;
        this.freeEstimates.database = this.updateLayerAction.databaseEstimate;
    }

    public async undo() {
        super.undo();

        await this.updateLayerAction?.undo();
    }

    public free() {
        super.free();

        this.updateLayerAction?.free();
    }
}
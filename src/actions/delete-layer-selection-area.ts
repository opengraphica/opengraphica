import { nextTick } from 'vue';
import { BaseAction } from './base';

import {
    activeSelectionMask, appliedSelectionMask,
    activeSelectionPath, appliedSelectionPaths,
    type SelectionCombineMode,
} from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getLayerById } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';

import { ApplyActiveSelectionAction } from './apply-active-selection';
import { ClearSelectionAction } from './clear-selection';
import { InsertLayerAction } from './insert-layer';
import { UpdateLayerAction } from './update-layer';

import { Clipper, PolyType, ClipType, Paths, PolyFillType } from '@/lib/clipper';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { findPointListBounds, findRectListBounds } from '@/lib/math';
import {
    calculateShapeAabb, getViewBox, serializeVectorPathCommands,
    parseCommonNodeAttributes, parseNodeTransform, parsePathNodeAttributes,
    generateSvgElementIds,
} from '@/lib/svg';
import { pathContainsPath, pathToPolyline, polylineToSimplifiedPath } from '@/lib/vector-process';

import { transferRendererTilesToRasterLayerUpdates, useRenderer } from '@/renderers';

import { ConvertVectorShapesToPathsAction } from './convert-vector-shapes-to-paths';

import { VectorPathCommandType } from '@/types/vector';
import type {
    UpdateRasterLayerOptions,
    VectorPathCommand, VectorPathCommandMove, VectorPathCommandLine,
    WorkingFileAnyLayer,
} from '@/types';

const SVG_SHAPES = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path'];

interface DeleteLayerSelectionAreaOptions {
    clearSelection?: boolean;
    appliedSelectionPaths?: Array<Array<VectorPathCommandMove | VectorPathCommandLine>>;
    selectionCombineMode?: SelectionCombineMode;
}

export class DeleteLayerSelectionAreaAction extends BaseAction {

    private layerIds: number[];
    private clearSelection: boolean = false;
    private appliedSelectionPaths: Array<Array<VectorPathCommandMove | VectorPathCommandLine>> | null = null;
    private selectionCombineMode: SelectionCombineMode;

    private clearSelectionAction: ClearSelectionAction | null = null;
    private updateLayerActions: BaseAction[] = [];

    constructor(
        layerIds: number[] = workingFileStore.state.selectedLayerIds,
        options?: DeleteLayerSelectionAreaOptions
    ) {
        super('deleteLayerSelectionArea', 'action.deleteLayerSelectionArea');
        this.layerIds = layerIds;
        
        this.clearSelection = (options?.clearSelection === false) ? false : true;
        this.appliedSelectionPaths = options?.appliedSelectionPaths ?? null;
        this.selectionCombineMode = options?.selectionCombineMode ?? 'subtract';
    }

    public async do() {
        super.do();

        if (this.layerIds.length === 1 && this.layerIds[0] === -1) {
            let insertLayerAction: InsertLayerAction<any> | undefined = undefined;
            for (let i = this.previousActions.length - 1; i >= 0; i--) {
                if (this.previousActions[i] instanceof InsertLayerAction) {
                    insertLayerAction = this.previousActions[i] as InsertLayerAction<any>;
                    break;
                }
            }
            if (!insertLayerAction) {
                throw new Error('[src/actions/delete-layer-selection-area.ts] Layer ID not specified and previous action not found.');
            }
            this.layerIds = [insertLayerAction.insertedLayerId];
        }

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        const layersToModify: WorkingFileAnyLayer[] = [];
        for (const layerId of this.layerIds) {
            const layer = getLayerById(layerId);
            if (layer) {
                layersToModify.push(layer);
            }
        }

        // Edit image data for each layer
        this.updateLayerActions = [];
        for (const layer of layersToModify) {
            if (layer.type === 'raster') {
                // For a raster layer, just generate a new image

                const sourceImage = getStoredImageOrCanvas(layer.data.sourceUuid);
                if (sourceImage) {
                    const selectionMask = activeSelectionMask.value ?? appliedSelectionMask.value;
                    if (!selectionMask) continue;
                    const renderer = await useRenderer();
                    const tiles = await renderer.applySelectionMaskToAlphaChannel(layer.id, { invert: true });

                    const updateLayerAction = new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: layer.id,
                        data: {
                            tileUpdates: await transferRendererTilesToRasterLayerUpdates(tiles),
                            alreadyRendererd: true,
                        },
                    });
                    await updateLayerAction.do();
                    this.freeEstimates.memory += updateLayerAction.freeEstimates.memory;
                    this.freeEstimates.database += updateLayerAction.freeEstimates.database;
                    this.updateLayerActions.push(updateLayerAction);
                }

            } else if (layer.type === 'vector') {
                // For a vector layer, clip shapes with boolean subtract operation

                let svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
                if (!svgDocument) {
                    continue;
                }

                if (!this.appliedSelectionPaths && activeSelectionPath.value.length > 0) {
                    const applyActiveSelectionAction = new ApplyActiveSelectionAction();
                    await applyActiveSelectionAction.do();
                    this.freeEstimates.memory += applyActiveSelectionAction.freeEstimates.memory;
                    this.freeEstimates.database += applyActiveSelectionAction.freeEstimates.database;
                    this.updateLayerActions.push(applyActiveSelectionAction);
                }

                let appliedSelectionBoundsRects: DOMRect[] = [];
                for (const path of (this.appliedSelectionPaths || appliedSelectionPaths.value)) {
                    const { left, right, top, bottom } = findPointListBounds(path);
                    appliedSelectionBoundsRects.push(
                        new DOMRect(left, top, right - left, bottom - top)
                    );
                }
                const appliedSelectionBounds = findRectListBounds(appliedSelectionBoundsRects);

                const viewBox = getViewBox(svgDocument);
                const viewboxXf = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    -viewBox.x, -viewBox.y, 0.0,
                );

                // Identify shapes that might be impacted based on their bounding box, and convert them to paths.
                let allShapes = Array.from(svgDocument.querySelectorAll('[data-ogr-id]'));
                const clipSubjectShapeIds: string[] = [];
                const clipSubjectShapeIndices: number[] = [];
                for (const [shapeIndex, shape] of allShapes.entries()) {
                    if (!SVG_SHAPES.includes(shape.tagName)) continue;
                    
                    const { transform, stroke, strokeWidth } = parseCommonNodeAttributes(shape);
                    const nodeXf = viewboxXf.multiply(
                        transform,
                    );
                    const { scaleX, scaleY } = decomposeMatrix(nodeXf);

                    const shapeAabb = calculateShapeAabb(shape, nodeXf, stroke ? strokeWidth : 0, scaleX, scaleY);
                    if (
                        !shapeAabb
                        || shapeAabb.left > appliedSelectionBounds.right
                        || shapeAabb.right < appliedSelectionBounds.left
                        || shapeAabb.bottom < appliedSelectionBounds.top
                        || shapeAabb.top > appliedSelectionBounds.bottom
                    ) {
                        continue;
                    }

                    clipSubjectShapeIds.push(shape.getAttribute('data-ogr-id') ?? '');
                    clipSubjectShapeIndices.push(shapeIndex);
                }

                const convertVectorShapesToPathsAction = new ConvertVectorShapesToPathsAction(layer.id, clipSubjectShapeIds);
                await convertVectorShapesToPathsAction.do();
                this.freeEstimates.memory += convertVectorShapesToPathsAction.freeEstimates.memory;
                this.freeEstimates.database += convertVectorShapesToPathsAction.freeEstimates.database;
                this.updateLayerActions.push(convertVectorShapesToPathsAction);

                const appliedSelectionPathCommand = (this.appliedSelectionPaths || appliedSelectionPaths.value).map((path) => {
                    return serializeVectorPathCommands(path, true);
                }).join(' ');

                // Convert shapes to polylines, intersect, convert back to simplified bezier curves.
                const scrapPoint = new DOMPoint();
                svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
                allShapes = Array.from(svgDocument.querySelectorAll('[data-ogr-id]'));
                for (const shapeIndex of clipSubjectShapeIndices) {
                    const shape = allShapes[shapeIndex];
                    if (shape?.tagName !== 'path') continue;

                    const transform = parseNodeTransform(shape);
                    const nodeXf = viewboxXf.multiply(
                        transform,
                    );
                    const nodeXfInverse = nodeXf.inverse();

                    const { d } = parsePathNodeAttributes(shape);

                    const polyline = (await pathToPolyline(d)).filter((command) => {
                        return (
                            command.type === VectorPathCommandType.LINE
                            || command.type === VectorPathCommandType.MOVE
                        );
                    }).map((command) => {
                        scrapPoint.x = command.x;
                        scrapPoint.y = command.y;
                        const xfPoint = scrapPoint.matrixTransform(nodeXf);
                        command.x = xfPoint.x;
                        command.y = xfPoint.y;
                        return command;
                    });

                    const clipper = new Clipper();
                    clipper.AddPath(polyline, PolyType.ptSubject, true);
                    for (const path of (this.appliedSelectionPaths || appliedSelectionPaths.value)) {
                        clipper.AddPath(path, PolyType.ptClip, true);
                    }
                    const solution: Paths = [];
                    let clipType = ClipType.ctDifference;
                    if (this.selectionCombineMode === 'add') {
                        clipType = ClipType.ctUnion;
                    } else if (this.selectionCombineMode === 'intersect') {
                        clipType = ClipType.ctIntersection;
                    }
                    clipper.Execute(clipType, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd);

                    if (solution.length > 0) {

                        const newPathCommandGroups: VectorPathCommand[][] = [];
                        for (const paths of solution) {
                            const newPathCommands: VectorPathCommand[] = [];
                            for (const [pointIndex, point] of paths.entries()) {
                                scrapPoint.x = point.x;
                                scrapPoint.y = point.y;
                                const xfPoint = scrapPoint.matrixTransform(nodeXfInverse);
                                newPathCommands.push({
                                    type: pointIndex > 0 ? VectorPathCommandType.LINE : VectorPathCommandType.MOVE,
                                    x: xfPoint.x,
                                    y: xfPoint.y,
                                });
                            }
                            newPathCommandGroups.push(await polylineToSimplifiedPath(newPathCommands));
                        }
                        shape.setAttribute('d', newPathCommandGroups.map(
                            (commandGroup) => serializeVectorPathCommands(commandGroup, true)
                        ).join(' '));

                    } else if (await pathContainsPath(appliedSelectionPathCommand, polyline)) {
                        shape.remove();
                    }

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

                const updateLayerAction = new UpdateLayerAction({
                    id: layer.id,
                    data: {
                        sourceUuid: await createStoredSvg(image)
                    }
                });
                await updateLayerAction.do();
                this.freeEstimates.memory += updateLayerAction.freeEstimates.memory;
                this.freeEstimates.database += updateLayerAction.freeEstimates.database;
                this.updateLayerActions.push(updateLayerAction);
            }
        }

        if (this.clearSelection && !this.clearSelectionAction) {
            this.clearSelectionAction = new ClearSelectionAction();
        }

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.do();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);

        for (const layerId of this.layerIds) {
            const layer = getLayerById(layerId);
            if (layer) updateWorkingFileLayer(layer);
        }

    }

    public async undo() {
        super.undo();

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.undo();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }

        for (const updateLayerAction of [...this.updateLayerActions].reverse()) {
            await updateLayerAction.undo();
            this.freeEstimates.memory += updateLayerAction.freeEstimates.memory;
            this.freeEstimates.database += updateLayerAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);

        for (const layerId of this.layerIds) {
            const layer = getLayerById(layerId);
            if (layer) updateWorkingFileLayer(layer);
        }
    }

    public async free() {
        super.free();

        if (this.clearSelectionAction) {
            this.clearSelectionAction.free();
            this.clearSelectionAction = null;
        }

        for (const updateLayerAction of this.updateLayerActions) {
            updateLayerAction.free();
        }
        (this.updateLayerActions as any) = null;
    }
}
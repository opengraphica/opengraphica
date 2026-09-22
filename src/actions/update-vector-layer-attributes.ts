import { BaseAction } from './base';

import { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { getStoredSvgDocument, createStoredSvg, reserveStoredSvg, unreserveStoredSvg } from '@/store/svg';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';

import { useRenderer } from '@/renderers';

import type { WorkingFileVectorLayer } from '@/types';

export class UpdateVectorLayerAttributesAction extends BaseAction {

    private layerId: number;
    private nodeId: string;
    private attributes: Record<string, string | null>;
    private alreadyRendererd: boolean;

    private oldAttributes: Record<string, string | null> | undefined;
    private oldImageSourceUuid: string | undefined;
    private newImageSourceUuid: string | undefined;

    private isFirstRun = true;

    constructor(
        layerId: number,
        nodeId: string,
        attributes: Record<string, string | null>,
        alreadyRendererd?: boolean,
    ) {
        super('updateVectorLayerAttributes', 'action.updateVectorLayerAttributes');

        this.layerId = layerId;
        this.nodeId = nodeId;
        this.attributes = attributes;
        this.alreadyRendererd = alreadyRendererd ?? false;
    }

    public async do() {
        super.do();

        const layer = getLayerById<WorkingFileVectorLayer>(this.layerId);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        if (layer.type !== 'vector') {
            throw new Error('Aborted - Layer is not a vector layer.');
        }

        this.oldImageSourceUuid = layer.data.sourceUuid;
        const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(this.oldImageSourceUuid);
        if (!svgDocument) {
            throw new Error('Aborted - Vector layer is missing a SVG document.');
        }

        const node = svgDocument.querySelector(`[data-ogr-id="${this.nodeId}"]`);
        if (!node) {
            throw new Error('Aborted - Node with specified ID not found.');
        }

        if (!this.oldAttributes) {
            this.oldAttributes = {};
            for (const attributeName in this.attributes) {
                this.oldAttributes[attributeName] = node.getAttribute(attributeName);
            }
        }

        for (const attributeName in this.attributes) {
            const value = this.attributes[attributeName];
            if (value != null) {
                node.setAttribute(attributeName, value);
            } else {
                node.removeAttribute(attributeName);
            }
        }
        if (
            (!this.isFirstRun || !this.alreadyRendererd)
            && layer.data.sourceDocument
        ) {
            const renderer = await useRenderer();
            renderer.updateVectorLayerAttributes(
                this.layerId,
                this.nodeId,
                { ...this.attributes },
            );
        }

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

        this.newImageSourceUuid = await createStoredSvg(image);
        layer.data.sourceUuid = this.newImageSourceUuid;
        reserveStoredSvg(this.newImageSourceUuid, `${this.layerId}`);

        // Update the working file backup
        updateWorkingFileLayer(layer);

        regenerateLayerThumbnail(layer);

        // This assumes the new and old SVGs are roughly the same size, just an estimate.
        this.freeEstimates.memory = blob.size;

        this.isFirstRun = false;
    }

    public async undo() {
        super.undo();

        const layer = getLayerById<WorkingFileVectorLayer>(this.layerId);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        if (layer.type !== 'vector') {
            throw new Error('Aborted - Layer is not a vector layer.');
        }

        const svgDocument = layer.data.sourceDocument;
        if (!svgDocument && this.oldImageSourceUuid == null) {
            throw new Error('Aborted- Vector layer is missing a SVG document.');
        }

        if (svgDocument && this.oldAttributes) {
            const renderer = await useRenderer();

            const node = svgDocument.querySelector(`[data-ogr-id="${this.nodeId}"]`);

            if (!node) {
                throw new Error('Aborted - Node with specified ID not found.');
            }

            for (const attributeName in this.oldAttributes) {
                const value = this.oldAttributes[attributeName];
                if (value != null) {
                    node.setAttribute(attributeName, value);
                } else {
                    node.removeAttribute(attributeName);
                }
            }

            renderer.updateVectorLayerAttributes(
                this.layerId,
                this.nodeId,
                { ...this.oldAttributes },
            );
        }

        if (this.oldImageSourceUuid) {
            layer.data.sourceUuid = this.oldImageSourceUuid;
        }

        // Update the working file backup
        updateWorkingFileLayer(layer);

        regenerateLayerThumbnail(layer);
    }

    public free() {
        super.free();

        // This is in the undo history
        if (this.isDone) {
            if (this.oldImageSourceUuid != null && this.oldImageSourceUuid != this.newImageSourceUuid) {
                unreserveStoredSvg(this.oldImageSourceUuid, `${this.layerId}`);
            }
        }
        // This is in the redo history
        if (!this.isDone) {
            const layer = getLayerById<WorkingFileVectorLayer>(this.layerId);
            if (layer) {
                if (this.newImageSourceUuid && this.newImageSourceUuid !== layer.data.sourceUuid) {
                    unreserveStoredSvg(this.newImageSourceUuid, `${this.layerId}`);
                }
            }
        }

    }

}
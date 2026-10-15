import { t } from '@/i18n';

import historyStore from '@/store/history';
import { createStoredImage, getStoredImageCanvas } from '@/store/image';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';

import appEmitter from '@/lib/emitter';
import { getImageDataFromCanvas, createImageFromImageData } from '@/lib/image';
import {
    getViewBox,
    parseRectNodeAttributes, parsePolylineNodeAttributes, parsePolygonNodeAttributes,
    parseCircleNodeAttributes, parseEllipseNodeAttributes, parseLineNodeAttributes,
    parsePathNodeAttributes, parseNodeTransform,
} from '@/lib/svg';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import type {
    WorkingFileGradientLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer,
} from '@/types';

function flipImageDataX(imageData: ImageData) {
    const width = imageData.width;
    const height = imageData.height;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < Math.floor(width / 2); x++) {
            const leftIndex = (y * 4 * width) + (x * 4);
            const rightIndex = (y * 4 * width) + ((width - x) * 4);
            let tmpR = imageData.data[leftIndex];
            let tmpG = imageData.data[leftIndex + 1];
            let tmpB = imageData.data[leftIndex + 2];
            let tmpA = imageData.data[leftIndex + 3];
            imageData.data[leftIndex] = imageData.data[rightIndex];
            imageData.data[leftIndex + 1] = imageData.data[rightIndex + 1];
            imageData.data[leftIndex + 2] = imageData.data[rightIndex + 2];
            imageData.data[leftIndex + 3] = imageData.data[rightIndex + 3];
            imageData.data[rightIndex] = tmpR;
            imageData.data[rightIndex + 1] = tmpG;
            imageData.data[rightIndex + 2] = tmpB;
            imageData.data[rightIndex + 3] = tmpA;
        }
    }
}

function flipGradientDataX(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer['data'] {
    const newData = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer['data'];
    const width = workingFileStore.state.width;
    newData.start.x = width - data.start.x;
    newData.end.x = width - data.end.x;
    newData.focus.x = width - data.focus.x;
    return newData;
}

function flipVectorDataX(svgDocument: Document, width: number, height: number) {
    const shapes = svgDocument.querySelectorAll('[data-ogr-id]');
    for (const shape of shapes) {
        const shapeTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'disable' });
        const nodeInheritedTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'inheritedOnly' });
        const viewBox = getViewBox(svgDocument);
        const parentTransform = new DOMMatrix().scale(
            width / viewBox.width, height / viewBox.height, 1.0,
        ).translateSelf(
            -viewBox.x, -viewBox.y, 0.0,
        ).multiplySelf(
            nodeInheritedTransform,
        );

        switch (shape.tagName) {
            case 'rect': {
                const { x, y, width, height } = parseRectNodeAttributes(shape);
                // TODO - change transform
                break;
            }
            case 'circle': {
                const { cx, cy, r } = parseCircleNodeAttributes(shape);
                // TODO - change transform
                break;
            }
            case 'ellipse': {
                const { cx, cy, rx, ry } = parseEllipseNodeAttributes(shape);
                // TODO - change transform
                break;
            }
            case 'line': {
                const { x1, y1, x2, y2 } = parseLineNodeAttributes(shape);
                // TODO
                break;
            }
            case 'polyline': {
                const { points } = parsePolylineNodeAttributes(shape);
                // TODO
                break;
            }
            case 'polygon': {
                const { points } = parsePolygonNodeAttributes(shape);
                // TODO
                break;
            }
            case 'path': {
                const { d } = parsePathNodeAttributes(shape);
                // TODO
                break;
            }
        }
    }
}

function flipImageDataY(imageData: ImageData) {
    const width = imageData.width;
    const height = imageData.height;
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < Math.floor(height / 2); y++) {
            const topIndex = (y * 4 * width) + (x * 4);
            const bottomIndex = ((height - y) * 4 * width) + (x * 4);
            let tmpR = imageData.data[topIndex];
            let tmpG = imageData.data[topIndex + 1];
            let tmpB = imageData.data[topIndex + 2];
            let tmpA = imageData.data[topIndex + 3];
            imageData.data[topIndex] = imageData.data[bottomIndex];
            imageData.data[topIndex + 1] = imageData.data[bottomIndex + 1];
            imageData.data[topIndex + 2] = imageData.data[bottomIndex + 2];
            imageData.data[topIndex + 3] = imageData.data[bottomIndex + 3];
            imageData.data[bottomIndex] = tmpR;
            imageData.data[bottomIndex + 1] = tmpG;
            imageData.data[bottomIndex + 2] = tmpB;
            imageData.data[bottomIndex + 3] = tmpA;
        }
    }
}

function flipGradientDataY(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer['data'] {
    const newData = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer['data'];
    const height = workingFileStore.state.height;
    newData.start.y = height - data.start.y;
    newData.end.y = height - data.end.y;
    newData.focus.y = height - data.focus.y;
    return newData;
}

function flipVectorDataY(svgDocument: Document, width: number, height: number) {
    
}

async function transformLayersGeneral(
    actionId: string,
    imageDataModifier: (imageData: ImageData) => void,
    gradientModifier: (gradientData: WorkingFileGradientLayer['data']) => WorkingFileGradientLayer['data'],
    vectorModifier: (svgDocument: Document, width: number, height: number) => void,
) {
    const selectedLayers = getSelectedLayers();
    const updateActions: UpdateLayerAction<any>[] = [];
    for (const layer of selectedLayers) {
        if (layer.type === 'gradient') {
            const newGradientData = gradientModifier(layer.data);
            updateActions.push(
                new UpdateLayerAction({
                    id: layer.id,
                    data: newGradientData,
                })
            );
        } else if (layer.type === 'group') {
            // NOOP
        } else if (layer.type === 'raster') {
            const storedImage = await getStoredImageCanvas(layer.data.sourceUuid);
            if (!storedImage) continue;
            const imageData = getImageDataFromCanvas(storedImage);
            imageDataModifier(imageData);
            updateActions.push(
                new UpdateLayerAction({
                    id: layer.id,
                    data: {
                        sourceUuid: await createStoredImage(
                            await createImageFromImageData(imageData)
                        ),
                    },
                })
            );
        } else if (layer.type === 'rasterSequence') {
            const newSequence = JSON.parse(JSON.stringify(layer.data.sequence)) as WorkingFileRasterSequenceLayer['data'];
            for (const [frameIndex, frame] of layer.data.sequence.entries()) {
                const storedImage = await getStoredImageCanvas(frame.image.sourceUuid);
                if (!storedImage) continue;
                const imageData = getImageDataFromCanvas(storedImage);
                imageDataModifier(imageData);
                newSequence[frameIndex].image.sourceUuid = await createStoredImage(
                    await createImageFromImageData(imageData)
                );
            }
            updateActions.push(
                new UpdateLayerAction({
                    id: layer.id,
                    data: {
                        sequence: newSequence,
                    },
                })
            );
        } else if (layer.type === 'vector') {
            const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
            vectorModifier(svgDocument, layer.width, layer.height);

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

            updateActions.push(
                new UpdateLayerAction({
                    id: layer.id,
                    data: {
                        sequence: createStoredSvg(image),
                    },
                })
            );
        } else if (layer.type === 'video') {
            // NOOP
        } else if (layer.type === 'text') {
            // NOOP
        }
    }
    if (updateActions.length > 0) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction(actionId, 'action.' + actionId, updateActions)
        });
    } else {
        appEmitter.emit('app.notify', {
            title: t('module.imageTransform.noLayersSelected.title'),
            message: t('module.imageTransform.noLayersSelected.message'),
            duration: 6000,
        });
    }
}

export async function flipLayersX() {
    await transformLayersGeneral(
        'flipLayerX',
        flipImageDataX,
        flipGradientDataX,
        flipVectorDataX,
    );
}

export async function flipLayersY() {
    await transformLayersGeneral(
        'flipLayerY',
        flipImageDataY,
        flipGradientDataY,
        flipVectorDataY,
    );
}

export function rotateLayersClockwise() {

}

export function rotateLayersCounterclockwise() {

}

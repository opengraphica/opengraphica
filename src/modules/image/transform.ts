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
    serializeVectorPathCommands,
} from '@/lib/svg';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';

import { VectorPathCommandType } from '@/types/vector';
import type {
    UpdateRasterLayerOptions, UpdateRasterSequenceLayerOptions,
    WorkingFileGradientLayer, WorkingFileRasterSequenceLayer,
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
    return imageData;
}

function flipGradientDataX(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer['data'] {
    const newData = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer['data'];
    const width = workingFileStore.state.width;
    newData.start.x = width - data.start.x;
    newData.end.x = width - data.end.x;
    newData.focus.x = width - data.focus.x;
    return newData;
}

function flipVectorDataX(svgDocument: Document) {
    const shapes = svgDocument.querySelectorAll('[data-ogr-id]');
    for (const shape of Array.from(shapes)) {
        const shapeTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'disable' });
        const nodeInheritedTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'inheritedOnly' });
        const viewBox = getViewBox(svgDocument);
        const parentTransform = new DOMMatrix().translateSelf(
            -viewBox.x, -viewBox.y, 0.0,
        ).multiplySelf(
            nodeInheritedTransform,
        );
        const layerSpaceTransform = parentTransform.multiply(shapeTransform);
        const layerSpaceTransformInverse = layerSpaceTransform.inverse();

        const flipPoint = (point: DOMPoint) => {
            let xfPoint = point.matrixTransform(layerSpaceTransform);
            xfPoint.x = viewBox.width - xfPoint.x;
            return xfPoint.matrixTransform(layerSpaceTransformInverse);
        };

        switch (shape.tagName) {
            case 'rect': case 'circle': case 'ellipse': {
                let cx = 0;
                if (shape.tagName === 'rect') {
                    const { x, width } = parseRectNodeAttributes(shape);
                    cx = x + width / 2;
                } else {
                    ({ cx } = parseCircleNodeAttributes(shape));
                }
                const { a, b, c, d, e, f } = layerSpaceTransform;
                const mirroredLayerTransform = new DOMMatrix([a, -b, -c, d,
                    viewBox.width - e - 2 * a * cx,
                    f + 2 * b * cx,
                ]);
                {
                    const { a, b, c, d, e, f } = parentTransform.inverse()
                        .multiply(mirroredLayerTransform);
                    shape.setAttribute('transform', `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`);
                }
                break;
            }
            case 'line': {
                const { x1, y1, x2, y2 } = parseLineNodeAttributes(shape);
                const p1 = flipPoint(new DOMPoint(x1, y1));
                const p2 = flipPoint(new DOMPoint(x2, y2));
                shape.setAttribute('x1', `${p1.x}`);
                shape.setAttribute('y1', `${p1.y}`);
                shape.setAttribute('x2', `${p2.x}`);
                shape.setAttribute('y2', `${p2.y}`);
                break;
            }
            case 'polyline': case 'polygon': {
                const { points } = parsePolylineNodeAttributes(shape);
                for (const point of points) {
                    const xfPoint = flipPoint(point);
                    point.x = xfPoint.x;
                    point.y = xfPoint.y;
                }
                shape.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
                break;
            }
            case 'path': {
                const { d } = parsePathNodeAttributes(shape);
                for (const command of d) {
                    if (command.type === VectorPathCommandType.MOVE || command.type === VectorPathCommandType.LINE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        command.x = point.x;
                        command.y = point.y;
                    } else if (command.type === VectorPathCommandType.QUADRATIC_BEZIER_CURVE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        const control1 = flipPoint(new DOMPoint(command.x1, command.y1));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                    } else if (command.type === VectorPathCommandType.CUBIC_BEZIER_CURVE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        const control1 = flipPoint(new DOMPoint(command.x1, command.y1));
                        const control2 = flipPoint(new DOMPoint(command.x2, command.y2));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                        command.x2 = control2.x;
                        command.y2 = control2.y;
                    }
                }
                shape.setAttribute('d', serializeVectorPathCommands(d));
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
    return imageData;
}

function flipGradientDataY(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer['data'] {
    const newData = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer['data'];
    const height = workingFileStore.state.height;
    newData.start.y = height - data.start.y;
    newData.end.y = height - data.end.y;
    newData.focus.y = height - data.focus.y;
    return newData;
}

function flipVectorDataY(svgDocument: Document) {
    const shapes = svgDocument.querySelectorAll('[data-ogr-id]');
    for (const shape of Array.from(shapes)) {
        const shapeTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'disable' });
        const nodeInheritedTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'inheritedOnly' });
        const viewBox = getViewBox(svgDocument);
        const parentTransform = new DOMMatrix().translateSelf(
            -viewBox.x, -viewBox.y, 0.0,
        ).multiplySelf(
            nodeInheritedTransform,
        );
        const layerSpaceTransform = parentTransform.multiply(shapeTransform);
        const layerSpaceTransformInverse = layerSpaceTransform.inverse();

        const flipPoint = (point: DOMPoint) => {
            let xfPoint = point.matrixTransform(layerSpaceTransform);
            xfPoint.y = viewBox.height - xfPoint.y;
            return xfPoint.matrixTransform(layerSpaceTransformInverse);
        };

        switch (shape.tagName) {
            case 'rect': case 'circle': case 'ellipse': {
                let cy = 0;
                if (shape.tagName === 'rect') {
                    const { y, height } = parseRectNodeAttributes(shape);
                    cy = y + height / 2;
                } else {
                    ({ cy } = parseCircleNodeAttributes(shape));
                }
                const { a, b, c, d, e, f } = layerSpaceTransform;
                const mirroredLayerTransform = new DOMMatrix([a, -b, -c, d,
                    e + 2 * c * cy,
                    viewBox.height - f - 2 * d * cy,
                ]);
                {
                    const { a, b, c, d, e, f } = parentTransform.inverse()
                        .multiply(mirroredLayerTransform);
                    shape.setAttribute('transform', `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`);
                }
                break;
            }
            case 'line': {
                const { x1, y1, x2, y2 } = parseLineNodeAttributes(shape);
                const p1 = flipPoint(new DOMPoint(x1, y1));
                const p2 = flipPoint(new DOMPoint(x2, y2));
                shape.setAttribute('x1', `${p1.x}`);
                shape.setAttribute('y1', `${p1.y}`);
                shape.setAttribute('x2', `${p2.x}`);
                shape.setAttribute('y2', `${p2.y}`);
                break;
            }
            case 'polyline': case 'polygon': {
                const { points } = parsePolylineNodeAttributes(shape);
                for (const point of points) {
                    const xfPoint = flipPoint(point);
                    point.x = xfPoint.x;
                    point.y = xfPoint.y;
                }
                shape.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
                break;
            }
            case 'path': {
                const { d } = parsePathNodeAttributes(shape);
                for (const command of d) {
                    if (command.type === VectorPathCommandType.MOVE || command.type === VectorPathCommandType.LINE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        command.x = point.x;
                        command.y = point.y;
                    } else if (command.type === VectorPathCommandType.QUADRATIC_BEZIER_CURVE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        const control1 = flipPoint(new DOMPoint(command.x1, command.y1));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                    } else if (command.type === VectorPathCommandType.CUBIC_BEZIER_CURVE) {
                        const point = flipPoint(new DOMPoint(command.x, command.y));
                        const control1 = flipPoint(new DOMPoint(command.x1, command.y1));
                        const control2 = flipPoint(new DOMPoint(command.x2, command.y2));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                        command.x2 = control2.x;
                        command.y2 = control2.y;
                    }
                }
                shape.setAttribute('d', serializeVectorPathCommands(d));
                break;
            }
        }
    }
}

function rotateImageData90Clockwise(imageData: ImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const rotatedData = new Uint8ClampedArray(imageData.data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIndex = (y * width + x) * 4;
            const dstIndex = (x * height + (height - 1 - y)) * 4;
            rotatedData[dstIndex] = imageData.data[srcIndex];
            rotatedData[dstIndex + 1] = imageData.data[srcIndex + 1];
            rotatedData[dstIndex + 2] = imageData.data[srcIndex + 2];
            rotatedData[dstIndex + 3] = imageData.data[srcIndex + 3];
        }
    }
    return new ImageData(rotatedData, height, width);
}

function rotateGradientData(data: WorkingFileGradientLayer['data'], rotateDegrees: number): WorkingFileGradientLayer['data'] {
    const newData = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer['data'];
    const width = workingFileStore.state.width;
    const height = workingFileStore.state.height;
    const transform = new DOMMatrix()
        .translate(width / 2, height / 2)
        .rotate(0, 0, rotateDegrees)
        .translate(-width / 2, -height / 2);
    let scrapPoint = new DOMPoint(data.start.x, data.start.y).matrixTransform(transform);
    newData.start = {
        x: scrapPoint.x,
        y: scrapPoint.y,
    };
    scrapPoint = new DOMPoint(data.end.x, data.end.y).matrixTransform(transform);
    newData.end = {
        x: scrapPoint.x,
        y: scrapPoint.y,
    };
    scrapPoint = new DOMPoint(data.focus.x, data.focus.y).matrixTransform(transform);
    newData.focus = {
        x: scrapPoint.x,
        y: scrapPoint.y,
    };
    return newData;
}

function rotateVectorData(svgDocument: Document, rotateDegrees: number) {
    const shapes = svgDocument.querySelectorAll('[data-ogr-id]');
    for (const shape of Array.from(shapes)) {
        const shapeTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'disable' });
        const nodeInheritedTransform = parseNodeTransform(shape, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'inheritedOnly' });
        const viewBox = getViewBox(svgDocument);
        const parentTransform = new DOMMatrix().translateSelf(
            -viewBox.x, -viewBox.y, 0.0,
        ).multiplySelf(
            nodeInheritedTransform,
        );
        const layerSpaceTransform = parentTransform.multiply(shapeTransform);
        const layerSpaceTransformInverse = layerSpaceTransform.inverse();

        const rotatePoint = (point: DOMPoint) => {
            const xfPoint = point.matrixTransform(layerSpaceTransform);
            const cx = viewBox.width / 2;
            const cy = viewBox.height / 2;
            const dx = xfPoint.x - cx;
            const dy = xfPoint.y - cy;
            const cos = Math.cos(rotateDegrees * Math.DEGREES_TO_RADIANS);
            const sin = Math.sin(rotateDegrees * Math.DEGREES_TO_RADIANS);
            xfPoint.x = cx + dx * cos - dy * sin;
            xfPoint.y = cy + dx * sin + dy * cos;
            return xfPoint.matrixTransform(layerSpaceTransformInverse);
        };

        switch (shape.tagName) {
            case 'rect': case 'circle': case 'ellipse': {
                const cx = viewBox.width / 2;
                const cy = viewBox.height / 2;
                const rotateInLayerSpace = new DOMMatrix()
                    .translateSelf(cx, cy)
                    .rotateSelf(rotateDegrees)
                    .translateSelf(-cx, -cy);
                const rotatedLayerTransform = rotateInLayerSpace.multiply(layerSpaceTransform);
                const rotatedShapeTransform = parentTransform.inverse().multiply(rotatedLayerTransform);
                const { a, b, c, d, e, f } = rotatedShapeTransform;
                shape.setAttribute('transform', `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`);
                break;
            }
            case 'line': {
                const { x1, y1, x2, y2 } = parseLineNodeAttributes(shape);
                const p1 = rotatePoint(new DOMPoint(x1, y1));
                const p2 = rotatePoint(new DOMPoint(x2, y2));
                shape.setAttribute('x1', `${p1.x}`);
                shape.setAttribute('y1', `${p1.y}`);
                shape.setAttribute('x2', `${p2.x}`);
                shape.setAttribute('y2', `${p2.y}`);
                break;
            }
            case 'polyline': case 'polygon': {
                const { points } = parsePolylineNodeAttributes(shape);
                for (const point of points) {
                    const xfPoint = rotatePoint(point);
                    point.x = xfPoint.x;
                    point.y = xfPoint.y;
                }
                shape.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
                break;
            }
            case 'path': {
                const { d } = parsePathNodeAttributes(shape);
                for (const command of d) {
                    if (command.type === VectorPathCommandType.MOVE || command.type === VectorPathCommandType.LINE) {
                        const point = rotatePoint(new DOMPoint(command.x, command.y));
                        command.x = point.x;
                        command.y = point.y;
                    } else if (command.type === VectorPathCommandType.QUADRATIC_BEZIER_CURVE) {
                        const point = rotatePoint(new DOMPoint(command.x, command.y));
                        const control1 = rotatePoint(new DOMPoint(command.x1, command.y1));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                    } else if (command.type === VectorPathCommandType.CUBIC_BEZIER_CURVE) {
                        const point = rotatePoint(new DOMPoint(command.x, command.y));
                        const control1 = rotatePoint(new DOMPoint(command.x1, command.y1));
                        const control2 = rotatePoint(new DOMPoint(command.x2, command.y2));
                        command.x = point.x;
                        command.y = point.y;
                        command.x1 = control1.x;
                        command.y1 = control1.y;
                        command.x2 = control2.x;
                        command.y2 = control2.y;
                    }
                }
                shape.setAttribute('d', serializeVectorPathCommands(d));
                break;
            }
        }
    }
}

function rotateImageData90Counterclockwise(imageData: ImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const rotatedData = new Uint8ClampedArray(imageData.data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIndex = (y * width + x) * 4;
            const dstIndex = ((width - 1 - x) * height + y) * 4;
            rotatedData[dstIndex] = imageData.data[srcIndex];
            rotatedData[dstIndex + 1] = imageData.data[srcIndex + 1];
            rotatedData[dstIndex + 2] = imageData.data[srcIndex + 2];
            rotatedData[dstIndex + 3] = imageData.data[srcIndex + 3];
        }
    }
    return new ImageData(rotatedData, height, width);
}

function rotateTransform(oldTransform: DOMMatrix, layerWidth: number, layerHeight: number, rotateDegrees: number): DOMMatrix {
    const centerX = layerWidth / 2;
    const centerY = layerHeight / 2;
    const rotationAroundCenter = new DOMMatrix()
        .translate(centerX, centerY)
        .rotate(rotateDegrees)
        .translate(-centerX, -centerY);
    return oldTransform.multiply(rotationAroundCenter);
}

async function transformLayersGeneral(
    actionId: string,
    imageDataModifier: (imageData: ImageData) => ImageData,
    gradientModifier: (gradientData: WorkingFileGradientLayer['data']) => WorkingFileGradientLayer['data'],
    vectorModifier: (svgDocument: Document) => void,
    transformModifier: ((transform: DOMMatrix, layerWidth: number, layerHeight: number) => DOMMatrix) | undefined,
    isResizeExpected: boolean,
) {
    const selectedLayers = getSelectedLayers();
    const updateActions: BaseAction[] = [];
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
            let oldWidth = storedImage.width;
            let oldHeight = storedImage.height;
            let imageData = getImageDataFromCanvas(storedImage);
            imageData = imageDataModifier(imageData);
            const updateOptions: UpdateRasterLayerOptions = {
                id: layer.id,
                width: imageData.width,
                height: imageData.height,
                data: {
                    sourceUuid: await createStoredImage(
                        await createImageFromImageData(imageData)
                    ),
                },
            }
            if (imageData.width !== oldWidth || imageData.height !== oldHeight) {
                const oldCenter = layer.transform.transformPoint(
                    new DOMPoint(oldWidth / 2, oldHeight / 2)
                );
                const transform = new DOMMatrix([
                    layer.transform.a,
                    layer.transform.b,
                    layer.transform.c,
                    layer.transform.d,
                    oldCenter.x - layer.transform.a * imageData.width / 2 - layer.transform.c * imageData.height / 2,
                    oldCenter.y - layer.transform.b * imageData.width / 2 - layer.transform.d * imageData.height / 2,
                ]);
                updateOptions.transform = transform;
            }
            updateActions.push(new UpdateLayerAction(updateOptions));
        } else if (layer.type === 'rasterSequence') {
            const newSequence = JSON.parse(JSON.stringify(layer.data.sequence)) as WorkingFileRasterSequenceLayer['data']['sequence'];
            let newWidth = layer.width;
            let newHeight = layer.height;
            for (const [frameIndex, frame] of layer.data.sequence.entries()) {
                const storedImage = await getStoredImageCanvas(frame.image.sourceUuid);
                if (!storedImage) continue;
                let imageData = getImageDataFromCanvas(storedImage);
                imageData = imageDataModifier(imageData);
                newWidth = imageData.width;
                newHeight = imageData.height;
                newSequence[frameIndex].image.sourceUuid = await createStoredImage(
                    await createImageFromImageData(imageData)
                );
            }
            const updateOptions: UpdateRasterSequenceLayerOptions = {
                id: layer.id,
                width: newWidth,
                height: newHeight,
                data: {
                    sequence: newSequence,
                },
            };
            if (newWidth !== layer.width || newHeight !== layer.height) {
                const oldCenter = layer.transform.transformPoint(
                    new DOMPoint(layer.width / 2, layer.height / 2)
                );
                const transform = new DOMMatrix([
                    layer.transform.a,
                    layer.transform.b,
                    layer.transform.c,
                    layer.transform.d,
                    oldCenter.x - layer.transform.a * newWidth / 2 - layer.transform.c * newHeight / 2,
                    oldCenter.y - layer.transform.b * newWidth / 2 - layer.transform.d * newHeight / 2,
                ]);
                updateOptions.transform = transform;
            }
            updateActions.push(new UpdateLayerAction(updateOptions));
        } else if (layer.type === 'vector') {
            const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
            vectorModifier(svgDocument);

            const serializer = new XMLSerializer();
            const svgText = serializer.serializeToString(svgDocument);
            const blob = new Blob([svgText], {
                type: 'image/svg+xml',
            });

            const url = URL.createObjectURL(blob);
            const image = new Image();
            await new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;
                image.src = url;
            });

            updateActions.push(
                new UpdateLayerAction({
                    id: layer.id,
                    data: {
                        sourceUuid: await createStoredSvg(image),
                    },
                })
            );
            if (isResizeExpected) {
                updateActions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
        } else if (layer.type === 'video') {
            if (transformModifier) {
                updateActions.push(
                    new UpdateLayerAction({
                        id: layer.id,
                        transform: transformModifier(layer.transform, layer.width, layer.height),
                    })
                )
            }
        } else if (layer.type === 'text') {
            if (transformModifier) {
                updateActions.push(
                    new UpdateLayerAction({
                        id: layer.id,
                        transform: transformModifier(layer.transform, layer.width, layer.height),
                    })
                )
            }
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
        undefined,
        false,
    );
}

export async function flipLayersY() {
    await transformLayersGeneral(
        'flipLayerY',
        flipImageDataY,
        flipGradientDataY,
        flipVectorDataY,
        undefined,
        false,
    );
}

export async function rotateLayersClockwise() {
    await transformLayersGeneral(
        'rotateLayerClockwise',
        rotateImageData90Clockwise,
        (data) => rotateGradientData(data, 90),
        (svgDocument) => rotateVectorData(svgDocument, 90),
        (transform, width, height) => rotateTransform(transform, width, height, 90),
        true,
    );
}

export async function rotateLayersCounterclockwise() {
    await transformLayersGeneral(
        'rotateLayerCounterclockwise',
        rotateImageData90Counterclockwise,
        (data) => rotateGradientData(data, -90),
        (svgDocument) => rotateVectorData(svgDocument, -90),
        (transform, width, height) => rotateTransform(transform, width, height, -90),
        true,
    );
}

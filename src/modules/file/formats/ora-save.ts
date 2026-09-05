/**
 * This file implements the Open Raster specification, with customizations to support 
 * OpenGraphica's specific functionality.
 * @see https://www.openraster.org/
 */

import * as fflate from 'fflate';

import { getStoredImageCanvas } from '@/store/image';
import { getStoredSvgImage } from '@/store/svg';
import { getStoredVideo } from '@/store/video';
import workingFileStore from '@/store/working-file';

import { createArrayBufferFromBlob } from '@/lib/binary';
import { colorToHex, getColorModelName } from '@/lib/color';
import { getExtensionForMimeType } from '@/lib/file';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { createImageBlobFromCanvas, resizeImage } from '@/lib/image';
import { limitMaxDimension } from '@/lib/math';
import { indentXml } from '@/lib/xml';

import type { WorkingFileAnyLayer, WorkingFileLayerBlendingMode } from '@/types';

function serializeFloat(value: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '1.0';
    }
    if (Object.is(value, -0)) {
        return "-0.0";
    }
    let text = value.toString();
    if (Number.isInteger(value) && !/[eE]/.test(text)) {
        return `${text}.0`;
    }
    const match = text.match(/^([+-]?\d+)([eE][+-]?\d+)$/);
    if (match) {
        return `${match[1]}.0${match[2]}`;
    }
    return text;
}

function serializeXmlAttributeValue(value: any) {
    if (value === null) {
        return `{null}`;
    } else if (value === undefined) {
        return `{undefined}`;
    } else if (typeof value === 'boolean') {
        return `{boolean}${value}`;
    } else if (typeof value === 'number') {
        return `{number}${value}`;
    } else if (typeof value === 'string') {
        return `{string}${value};`
    } else if (typeof value === 'object') {
        if (value.is === 'color') {
            return `{color}${colorToHex(value, getColorModelName(value))}`;
        } else {
            return `{object}${JSON.stringify(value)}`;
        }
    }
    return '';
}

function blendingModeToCompositeOp(blendingMode: WorkingFileLayerBlendingMode): string {
    switch (blendingMode) {
        case 'normal': return 'svg:src-over';
        case 'dissolve': return 'svg:src-over'; // No equivalent
        case 'colorErase': return 'svg:src-over'; // No equivalent
        case 'erase': return 'svg:src-over'; // No equivalent
        case 'merge': return 'svg:src-over'; // No equivalent
        case 'split': return 'svg:src-over'; // No equivalent
        case 'lightenOnly': return 'svg:lighten';
        case 'lumaLightenOnly': return 'svg:src-over'; // No equivalent
        case 'screen': return 'svg:screen';
        case 'dodge': return 'svg:color-dodge';
        case 'linearDodge': return 'svg:src-over'; // No equivalent
        case 'addition': return 'svg:plus';
        case 'darkenOnly': return 'svg:darken';
        case 'lumaDarkenOnly': return 'svg:src-over'; // No equivalent
        case 'multiply': return 'svg:multiply';
        case 'burn': return 'svg:color-burn';
        case 'linearBurn': return 'svg:src-over'; // No equivalent
        case 'overlay': return 'svg:overlay';
        case 'softLight': return 'svg:soft-light';
        case 'hardLight': return 'svg:hard-light';
        case 'vividLight': return 'svg:src-over'; // No equivalent
        case 'pinLight': return 'svg:src-over'; // No equivalent
        case 'linearLight': return 'svg:src-over'; // No equivalent
        case 'hardMix': return 'svg:src-over'; // No equivalent
        case 'difference': return 'svg:difference';
        case 'exclusion': return 'svg:src-over'; // No equivalent
        case 'subtract': return 'svg:src-over'; // No equivalent
        case 'grainExtract': return 'svg:src-over'; // No equivalent
        case 'grainMerge': return 'svg:src-over'; // No equivalent
        case 'divide': return 'svg:src-over'; // No equivalent
        case 'hue': return 'svg:hue';
        case 'chroma': return 'svg:saturation';
        case 'color': return 'svg:color';
        case 'lightness': return 'svg:luminosity';
        case 'luminance': return 'svg:src-over'; // No equivalent
        default: return 'svg:src-over';
    }
}

async function generateLayer(
    xmlDocument: Document,
    layer: WorkingFileAnyLayer,
    data: Promise<[string, Uint8Array | [Uint8Array, fflate.AsyncZipOptions]]>[],
): Promise<Node> {
    const layerNode = xmlDocument.createElement(layer.type === 'group' ? 'stack' : 'layer');

    const decomposedTransform = decomposeMatrix(layer.transform);
    const { a, b, c, d, e, f } = layer.transform;

    layerNode.setAttribute('composite-op', blendingModeToCompositeOp(layer.blendingMode));
    layerNode.setAttribute('name', layer.name);
    layerNode.setAttribute('og:blending-mode', layer.blendingMode);
    layerNode.setAttribute('og:transform', `${a} ${b} ${c} ${d} ${e} ${f}`);
    layerNode.setAttribute('og:type', layer.type);
    layerNode.setAttribute('opacity', serializeFloat(layer.opacity));
    layerNode.setAttribute('visibility', layer.visible ? 'visible' : 'hidden');
    layerNode.setAttribute('x', `${Math.round(decomposedTransform.translateX)}`);
    layerNode.setAttribute('y', `${Math.round(decomposedTransform.translateY)}`);
    if (workingFileStore.get('selectedLayerIds').includes(layer.id)) {
        layerNode.setAttribute('selected', 'true');
    }

    if (layer.filters.length > 0) {
        const filtersNode = xmlDocument.createElement('og:filters');

        for (const filter of layer.filters) {
            const filterNode = xmlDocument.createElement('og:filter');
            filterNode.setAttribute('name', filter.name);
            filterNode.setAttribute('visibility', filter.disabled ? 'hidden' : 'visible');
            filterNode.setAttribute('mask-id', `${filter.maskId}`);

            for (const paramName in filter.params) {
                const paramNode = xmlDocument.createElement('og:filter-param');
                paramNode.setAttribute('name', paramName);
                paramNode.setAttribute('value', serializeXmlAttributeValue(filter.params[paramName]));
                filterNode.appendChild(paramNode);
            }
            filtersNode.appendChild(filterNode);
        }

        layerNode.appendChild(filtersNode);
    }
    
    if (layer.type === 'empty') {
        const layerDataFilename = `layer${layer.id}.svg`;
        layerNode.setAttribute('src', 'data/' + layerDataFilename);
        data.push(
            Promise.resolve([
                layerDataFilename,
                fflate.strToU8(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${workingFileStore.get('width')} ${workingFileStore.get('height')}"></svg>`),
            ])
        );
    } else if (layer.type === 'gradient') {
        layerNode.setAttribute('og:gradient-start-x', serializeFloat(layer.data.start.x));
        layerNode.setAttribute('og:gradient-start-y', serializeFloat(layer.data.start.y));
        layerNode.setAttribute('og:gradient-end-x', serializeFloat(layer.data.end.x));
        layerNode.setAttribute('og:gradient-end-y', serializeFloat(layer.data.end.y));
        layerNode.setAttribute('og:gradient-focus-x', serializeFloat(layer.data.focus.x));
        layerNode.setAttribute('og:gradient-focus-y', serializeFloat(layer.data.focus.y));
        layerNode.setAttribute('og:gradient-blend-color-space', layer.data.blendColorSpace);
        layerNode.setAttribute('og:gradient-fill-type', layer.data.fillType);
        layerNode.setAttribute('og:gradient-spread-method', layer.data.spreadMethod);
        for (const stop of layer.data.stops) {
            const stopNode = xmlDocument.createElement('og:gradient-stop');
            stopNode.setAttribute('offset', serializeFloat(stop.offset));
            stopNode.setAttribute('color', colorToHex(stop.color, getColorModelName(stop.color)));
            layerNode.appendChild(stopNode);
        }

        // TODO - generate image preview of gradient
        const layerDataFilename = `layer${layer.id}.svg`;
        layerNode.setAttribute('src', 'data/' + layerDataFilename);
        data.push(
            Promise.resolve([
                layerDataFilename,
                fflate.strToU8(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layer.width} ${layer.height}"></svg>`),
            ])
        );
    } else if (layer.type === 'group') {
        for (const childLayer of layer.layers) {
            const childLayerNode = await generateLayer(xmlDocument, childLayer, data);
            layerNode.prepend(childLayerNode);
        }
    } else if (layer.type === 'raster') {
        const storedImage = await getStoredImageCanvas(layer.data.sourceUuid);
        if (storedImage) {
            data.push(
                createArrayBufferFromBlob(
                    await createImageBlobFromCanvas(storedImage)
                ).then((arrayBuffer) => {
                    const layerDataFilename = `layer${layer.id}.png`;
                    layerNode.setAttribute('src', 'data/' + layerDataFilename);
                    return [
                        layerDataFilename,
                        [
                            new Uint8Array(arrayBuffer),
                            { level: 0 },
                        ],
                    ];
                })
            );
        }
    } else if (layer.type === 'rasterSequence') {
        const layerDataFilenamePrefix = `layer${layer.id}-`;
        for (const [frameIndex, frame] of layer.data.sequence.entries()) {
            const frameNode = xmlDocument.createElement('og:raster-frame');
            const frameFilename = layerDataFilenamePrefix + frameIndex + '.png';
            frameNode.setAttribute('start', serializeFloat(frame.start));
            frameNode.setAttribute('end', serializeFloat(frame.end));
            frameNode.setAttribute('src', 'data/' + frameFilename);
            layerNode.append(frameNode);
            const storedImage = await getStoredImageCanvas(frame.image.sourceUuid);
            if (storedImage) {
                data.push(
                    createArrayBufferFromBlob(
                        await createImageBlobFromCanvas(storedImage)
                    ).then((arrayBuffer) => {
                        if (frameIndex === 0) {
                            layerNode.setAttribute('src', 'data/' + frameFilename);
                        }
                        return [
                            frameFilename,
                            [
                                new Uint8Array(arrayBuffer),
                                { level: 0 },
                            ],
                        ];
                    })
                );
            }
        }
    } else if (layer.type === 'text') {
        layerNode.setAttribute('og:width', serializeFloat(layer.width));
        layerNode.setAttribute('og:height', serializeFloat(layer.height));
        layerNode.setAttribute('og:text-boundary', layer.data.boundary);
        layerNode.setAttribute('og:text-line-alignment', layer.data.lineAlignment);
        layerNode.setAttribute('og:text-line-direction', layer.data.lineDirection);
        layerNode.setAttribute('og:text-wrap-direction', layer.data.wrapDirection);
        layerNode.setAttribute('og:text-wrap-at', layer.data.wrapAt);
        for (const line of layer.data.lines) {
            const lineNode = xmlDocument.createElement('og:text-line');
            if (line.alignment) {
                lineNode.setAttribute('alignment', line.alignment);
            }
            if (line.direction) {
                lineNode.setAttribute('direction', line.direction);
            }
            for (const span of line.spans) {
                const spanNode = xmlDocument.createElement('og:text-span');
                spanNode.setAttribute('text', span.text);
                lineNode.appendChild(spanNode);
                for (const metaName in span.meta) {
                    const metaNode = xmlDocument.createElement('og:text-meta');
                    metaNode.setAttribute('name', metaName);
                    metaNode.setAttribute('value', serializeXmlAttributeValue(span.meta[metaName]));
                    spanNode.appendChild(metaNode);
                }
            }
            layerNode.appendChild(lineNode);
        }

        // TODO - generate image preview of text
        const layerDataFilename = `layer${layer.id}.svg`;
        layerNode.setAttribute('src', 'data/' + layerDataFilename);
        data.push(
            Promise.resolve([
                layerDataFilename,
                fflate.strToU8(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layer.width} ${layer.height}"></svg>`),
            ])
        );
    } else if (layer.type === 'vector') {
        const storedImage = await getStoredSvgImage(layer.data.sourceUuid);
        if (storedImage) {
            data.push(
                fetch(storedImage.src).then((result) => {
                    return result.arrayBuffer();
                }).then((arrayBuffer) => {
                    const layerDataFilename = `layer${layer.id}.svg`;
                    layerNode.setAttribute('src', 'data/' + layerDataFilename);
                    return [
                        layerDataFilename,
                        new Uint8Array(arrayBuffer),
                    ];
                })
            );
        }
    } else if (layer.type === 'vectorPath') {
        // Unused
    } else if (layer.type === 'video') {
        const storedVideo = await getStoredVideo(layer.data.sourceUuid);
        if (storedVideo) {
            data.push(
                fetch(storedVideo.src).then((result) => {
                    return result.blob();
                }).then((blob) => {
                    let extension = getExtensionForMimeType(blob.type);
                    const layerDataFilename = `layer${layer.id}.${extension}`;
                    return createArrayBufferFromBlob(blob).then((arrayBuffer) => {
                        layerNode.setAttribute('src', 'data/' + layerDataFilename);
                        return [
                            layerDataFilename,
                            [
                                new Uint8Array(arrayBuffer),
                                { level: 0 },
                            ]
                        ];
                    });
                })
            );
        }
    }
    return layerNode;
}

async function generateLayerStack() {
    const xmlDocument = document.implementation.createDocument(null, 'image', null);
    const data: Promise<[string, Uint8Array | [Uint8Array, fflate.AsyncZipOptions]]>[] = [];

    const image = xmlDocument.documentElement;
    image.setAttribute('xmlns:og', 'https://opengraphica.com/TR/openraster-extensions');
    image.setAttribute('version', '0.0.6');
    image.setAttribute('w', `${workingFileStore.get('width')}`);
    image.setAttribute('h', `${workingFileStore.get('height')}`);
    image.setAttribute('xres', `${workingFileStore.get('resolutionX')}`);
    image.setAttribute('yres', `${workingFileStore.get('resolutionY')}`);

    const background = workingFileStore.get('background');
    image.setAttribute('og:background-visibility', background.visible ? 'visible' : 'hidden');
    image.setAttribute('og:background-color', colorToHex(background.color, getColorModelName(background.color)));
    image.setAttribute('og:color-model', workingFileStore.get('colorModel'));
    image.setAttribute('og:color-space', workingFileStore.get('colorSpace'));
    image.setAttribute('og:draw-origin-x', serializeFloat(workingFileStore.get('drawOriginX')));
    image.setAttribute('og:draw-origin-y', serializeFloat(workingFileStore.get('drawOriginY')));
    image.setAttribute('og:measuring-units', workingFileStore.get('measuringUnits'));
    image.setAttribute('og:resolution-units', workingFileStore.get('resolutionUnits'));
    image.setAttribute('og:scale-factor', serializeFloat(workingFileStore.get('scaleFactor')));

    const rootStack = xmlDocument.createElement('stack');
    image.appendChild(rootStack);

    for (const layer of workingFileStore.get('layers')) {
        const layerNode = await generateLayer(xmlDocument, layer as never, data);
        rootStack.prepend(layerNode);
    }

    const masks = workingFileStore.get('masks');
    if (Object.keys(masks).length > 0) {
        const masksNode = xmlDocument.createElement('og:masks');
        image.appendChild(masksNode);
        for (const maskId in masks) {
            const maskNode = xmlDocument.createElement('og:mask');
            maskNode.setAttribute('id', maskId);
            maskNode.setAttribute('offset-x', serializeFloat(masks[maskId].offset.x));
            maskNode.setAttribute('offset-y', serializeFloat(masks[maskId].offset.y));
            maskNode.setAttribute('hash', masks[maskId].hash);
            masksNode.appendChild(maskNode);

            const storedImage = await getStoredImageCanvas(masks[maskId].sourceUuid);
            if (storedImage) {
                data.push(
                    createArrayBufferFromBlob(
                        await createImageBlobFromCanvas(storedImage)
                    ).then((arrayBuffer) => {
                        const maskDataFilename = `mask${maskId}.png`;
                        maskNode.setAttribute('src', 'data/' + maskDataFilename);
                        return [
                            maskDataFilename,
                            [
                                new Uint8Array(arrayBuffer),
                                { level: 0 },
                            ],
                        ];
                    })
                );
            }
        }
    }

    return {
        xmlDocument,
        data,
    }
}

export async function serializeWorkingFile(): Promise<Blob> {
    const { exportAsImage } = await import('@/modules/file/export');
    const width = workingFileStore.get('width');
    const height = workingFileStore.get('height');
    const mergedImageCanvas = (await exportAsImage({
        fileType: 'png',
        layerSelection: 'all',
        toCanvas: true,
    })).canvas!;
    const { width: thumbnailWidth, height: thumbnailHeight } = limitMaxDimension(width, height, 256);
    const mergedImageBuffer = await createArrayBufferFromBlob(
        await createImageBlobFromCanvas(mergedImageCanvas)
    );
    let thumbnailImageBuffer = mergedImageBuffer;
    if (thumbnailWidth < width) {
        try {
            const thumbnailCanvas = await resizeImage(mergedImageCanvas, thumbnailWidth, thumbnailHeight);
            thumbnailImageBuffer = await createArrayBufferFromBlob(
                await createImageBlobFromCanvas(thumbnailCanvas)
            );
        } catch (error) {
            console.warn('[src/modules/file/formats/ora.ts] Failed to generate thumbnail.', error);
        }
    }
    const { xmlDocument, data } = await generateLayerStack();
    const resolvedData: Record<string, Uint8Array | [Uint8Array, fflate.AsyncZipOptions]> = {};
    (await Promise.all(data)).forEach(([filename, arrayBuffer]) => {
        resolvedData[filename] = arrayBuffer;
    });
    const serializer = new XMLSerializer();
    const stackXml = fflate.strToU8(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        + indentXml(serializer.serializeToString(xmlDocument))
    );
    const zipFileBuffer = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
        fflate.zip({
            mimetype: [ fflate.strToU8('image/openraster'), { level: 0 }],
            'stack.xml': stackXml,
            'data': resolvedData,
            'Thumbnails': {
                'thumbnail.png': [ new Uint8Array(thumbnailImageBuffer), { level: 0 } ],
            },
            'mergedimage.png': [ new Uint8Array(mergedImageBuffer), { level: 0 } ],
        }, (error, data) => {
            if (error || !data?.length) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
    return new Blob([zipFileBuffer], { type: 'image/openraster' });
}
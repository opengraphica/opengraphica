/**
 * This file implements the Open Raster specification, with customizations to support 
 * OpenGraphica's specific functionality.
 * @see https://www.openraster.org/
 */

import * as fflate from 'fflate';

import { InsertLayerAction } from '@/actions/insert-layer';

import { hexToColor } from '@/lib/color';
import { createImageFromBlob } from '@/lib/image';
import { createVideoFromBlob } from '@/lib/video';

import { createStoredImage, getStoredImageOrCanvas } from '@/store/image';
import { createStoredSvg, getStoredSvgImage } from '@/store/svg';
import { createStoredVideo, getStoredVideo } from '@/store/video';
import workingFileStore, { type WorkingFileState } from '@/store/working-file';

import type {
    ColorModelName,
    MeasuringUnits, ResolutionUnits,
    InsertAnyLayerOptions,
    TextBoundary, TextDirection, TextLineAlignment, TextWrapAt,
    TextDocumentLine, TextDocumentSpan, TextDocumentSpanMeta,
    WorkingFileLayer, WorkingFileLayerType,
    WorkingFileLayerMask, WorkingFileLayerBlendingMode, WorkingFileLayerFilter, WorkingFileGradientColorStop,
    WorkingFileGradientColorSpace, WorkingFileGradientFillType, WorkingFileGradientSpreadMethod,
    WorkingFileGradientLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileGroupLayer,
    WorkingFileVectorLayer, WorkingFileVideoLayer, WorkingFileTextLayer,
} from '@/types';

function parseXmlAttributeValue(serialized: string): any {
    if (serialized.startsWith('{null}')) {
        return null;
    } else if (serialized.startsWith('{undefined}')) {
        return undefined;
    } else if (serialized.startsWith('{boolean}')) {
        return serialized.slice(9) == 'true';
    } else if (serialized.startsWith('{number}')) {
        return parseFloat(serialized.slice(8));
    } else if (serialized.startsWith('{string}')) {
        return serialized.slice(8);
    } else if (serialized.startsWith('{color}')) {
        return hexToColor(serialized.slice(7), 'rgba');
    } else if (serialized.startsWith('{object}')) {
        try {
            return JSON.parse(serialized.slice(8));
        } catch {
            return {};
        }
    }
}

function compositeOpToBlendingMode(compositeOp: string): WorkingFileLayerBlendingMode {
    switch (compositeOp) {
        case 'svg:src-over': return 'normal';
        case 'svg:multiply': return 'multiply';
        case 'svg:screen': return 'screen';
        case 'svg:overlay': return 'overlay';
        case 'svg:darken': return 'darkenOnly';
        case 'svg:lighten': return 'lightenOnly';
        case 'svg:color-dodge': return 'dodge';
        case 'svg:color-burn': return 'burn';
        case 'svg:hard-light': return 'hardLight';
        case 'svg:soft-light': return 'softLight';
        case 'svg:difference': return 'difference';
        case 'svg:color': return 'color';
        case 'svg:luminosity': return 'lightness';
        case 'svg:hue': return 'hue';
        case 'svg:saturation': return 'chroma';
        case 'svg:plus': return 'addition';
        case 'svg:dst-in': return 'normal'; // No equivalent
        case 'svg:dst-out': return 'normal'; // No equivalent
        case 'svg:src-atop': return 'normal'; // No equivalent
        case 'svg:dst-atop': return 'normal'; // No equivalent
        default: return 'normal';
    }
}

interface ParseLayersToActionsOptions {
    colorModel: ColorModelName,
    fileWidth: number,
    fileHeight: number,
    layerIdCounter: number,
    selectedLayerIds: number[],
    insert?: boolean;
}
async function parseLayersToActions(
    stackNode: Element,
    groupLayerId: number,
    archive: fflate.Unzipped,
    options: ParseLayersToActionsOptions
) {
    let insertLayerActions: InsertLayerAction<any>[] = [];
    let groupInsertLayerActions: InsertLayerAction<any>[] = [];

    for (let layerNode of Array.from(stackNode.children).reverse()) {
        if (!(layerNode.tagName === 'layer' || layerNode.tagName === 'stack')) continue;

        const id = options.layerIdCounter++;
        const src = layerNode.getAttribute('src') ?? '';
        const type = layerNode.getAttribute('og:type')
            ?? (
                layerNode.tagName === 'stack' ? 'group'
                : (src.endsWith('.svg') ? 'vector' : 'raster')
            );

        const blendingMode = layerNode.getAttribute('og:blending-mode')
            ?? compositeOpToBlendingMode(layerNode.getAttribute('composite-op') ?? 'svg:src-over');
        const name = layerNode.getAttribute('name') ?? '';
        const transformParams = (layerNode.getAttribute('og:transform') ?? '')
            .trim().split(/\s+/).map((str) => parseFloat(str));
        const transform = (transformParams.length === 6 || transformParams.length === 16)
            ? new DOMMatrix(transformParams)
            : new DOMMatrix([1, 0, 0, 1,
                parseFloat(layerNode.getAttribute('x') ?? '0'),
                parseFloat(layerNode.getAttribute('y') ?? '0'),
            ]);
        const opacity = parseFloat(layerNode.getAttribute('opacity') ?? '0.0');
        const visible = layerNode.getAttribute('visibility') != 'hidden';
        const selected = layerNode.getAttribute('selected') == 'true';
        if (selected) {
            options.selectedLayerIds.push(id);
        }

        let parsedLayer: Partial<WorkingFileLayer<any>> = {
            blendingMode: validateWorkingFileLayerBlendingMode(blendingMode),
            groupId: groupLayerId,
            id,
            name,
            opacity,
            transform,
            type: validateWorkingFileLayerType(type),
            visible,
        };

        const filtersNode = Array.from(layerNode.children).find((node) => node.tagName === 'og:filters');
        if (filtersNode) {
            const filters: WorkingFileLayerFilter[] = [];
            for (const filterNode of Array.from(filtersNode.children)) {
                if (filterNode.tagName !== 'og:filter') continue;
                const name = filterNode.getAttribute('name') ?? '';
                const disabled = (filterNode.getAttribute('visibility') == 'hidden') || undefined;
                let maskId: number | undefined = parseInt(filterNode.getAttribute('mask-id') ?? '-1');
                if (isNaN(maskId) || maskId == -1 || options.insert) maskId = undefined;

                const filter: WorkingFileLayerFilter = {
                    name,
                    params: {},
                    disabled,
                    maskId,
                }

                for (const filterParamNode of Array.from(filterNode.children)) {
                    if (filterParamNode.tagName !== 'og:filter-param') continue;
                    const name = filterParamNode.getAttribute('name');
                    const value = filterParamNode.getAttribute('value');
                    if (name && value) {
                        filter.params[name] = parseXmlAttributeValue(value);
                    }
                }

                filters.push(filter);
            }
            parsedLayer.filters = filters;
        }

        if (type === 'empty') {
            parsedLayer.width = options.fileWidth;
            parsedLayer.height = options.fileHeight;
        } else if (type === 'gradient') {
            let startX = parseFloat(layerNode.getAttribute('og:gradient-start-x') ?? '0');
            if (isNaN(startX)) startX = 0;
            let startY = parseFloat(layerNode.getAttribute('og:gradient-start-y') ?? '0');
            if (isNaN(startY)) startY = 0;
            let endX = parseFloat(layerNode.getAttribute('og:gradient-end-x') ?? '0');
            if (isNaN(endX)) endX = 0;
            let endY = parseFloat(layerNode.getAttribute('og:gradient-end-y') ?? '0');
            if (isNaN(endY)) endY = 0;
            let focusX = parseFloat(layerNode.getAttribute('og:gradient-focus-x') ?? '0');
            if (isNaN(focusX)) focusX = 0;
            let focusY = parseFloat(layerNode.getAttribute('og:gradient-focus-y') ?? '0');
            if (isNaN(focusY)) focusY = 0;

            const stops: WorkingFileGradientColorStop[] = [];
            for (const stopNode of Array.from(layerNode.children)) {
                if (stopNode.tagName !== 'og:gradient-stop') continue;
                let offset = parseFloat(stopNode.getAttribute('offset') ?? '0');
                if (isNaN(offset)) offset = 0;
                const color = hexToColor(stopNode.getAttribute('color') ?? '#000000', options.colorModel);
                stops.push({ offset, color });
            }

            (parsedLayer as Partial<WorkingFileGradientLayer>).data = {
                start: {
                    x: startX,
                    y: startY,
                },
                end: {
                    x: endX,
                    y: endY,
                },
                focus: {
                    x: focusX,
                    y: focusY,
                },
                blendColorSpace: validateWorkingFileGradientColorSpace(
                    layerNode.getAttribute('og:gradient-blend-color-space') ?? 'oklab'
                ),
                fillType: validateWorkingFileGradientFillType(
                    layerNode.getAttribute('og:gradient-fill-type') ?? 'linear'
                ),
                spreadMethod: validateWorkingFileGradientSpreadMethod(
                    layerNode.getAttribute('og:gradient-spread-method') ?? 'pad'
                ),
                stops,
            };
            parsedLayer.width = options.fileWidth;
            parsedLayer.height = options.fileHeight;
        } else if (type === 'group') {
            (parsedLayer as Partial<WorkingFileGroupLayer>).layers = [];
            groupInsertLayerActions = groupInsertLayerActions.concat(
                await parseLayersToActions(
                    layerNode,
                    id,
                    archive,
                    options,
                )
            );
        } else if (type === 'raster') {
            if (!archive[src]) continue;
            const sourceUuid = await createStoredImage(
                await createImageFromBlob(new Blob([archive[src]]))
                    .catch(() => new Image())
            ).catch(() => undefined);
            const sourceImage = getStoredImageOrCanvas(sourceUuid);
            if (!sourceImage) continue;
            (parsedLayer as Partial<WorkingFileRasterLayer>).data = {
                sourceUuid,
            };
            parsedLayer.width = sourceImage.width;
            parsedLayer.height = sourceImage.height;
        } else if (type === 'rasterSequence') {
            const sequence: WorkingFileRasterSequenceLayer['data']['sequence'] = [];

            let isFirstFrame = true;
            for (const frameNode of Array.from(layerNode.children)) {
                if (frameNode.tagName !== 'og:raster-frame') continue;
                let start = parseFloat(frameNode.getAttribute('start') ?? '0');
                if (isNaN(start)) start = 0;
                let end = parseFloat(frameNode.getAttribute('end') ?? '0');
                if (isNaN(end)) end = 0;
                const src = frameNode.getAttribute('src') ?? '';

                if (!archive[src]) continue;
                const sourceUuid = await createStoredImage(
                    await createImageFromBlob(new Blob([archive[src]]))
                        .catch(() => new Image())
                ).catch(() => undefined);

                if (isFirstFrame) {
                    const sourceImage = getStoredImageOrCanvas(sourceUuid);
                    if (!sourceImage) continue;
                    parsedLayer.width = sourceImage.width;
                    parsedLayer.height = sourceImage.height;
                }

                sequence.push({
                    start,
                    end,
                    image: {
                        sourceUuid,
                    },
                    thumbnailImageSrc: null,
                });

                isFirstFrame = false;
            }

            (parsedLayer as Partial<WorkingFileRasterSequenceLayer>).data = {
                currentFrame: sequence[0]?.image,
                sequence,
            };
        } else if (type === 'text') {
            const width = parseFloat(layerNode.getAttribute('og:width') ?? '');
            const height = parseFloat(layerNode.getAttribute('og:height') ?? '');
            const boundary = validateTextBoundary(layerNode.getAttribute('og:text-boundary') ?? '');
            const lineAlignment = validateTextLineAlignment(layerNode.getAttribute('og:text-line-alignment') ?? '');
            const lineDirection = validateTextDirection(layerNode.getAttribute('og:text-line-direction') ?? '');
            const wrapDirection = validateTextDirection(layerNode.getAttribute('og:text-wrap-direction') ?? '');
            const wrapAt = validateTextWrapAt(layerNode.getAttribute('og:text-wrap-at') ?? '');

            const lines: TextDocumentLine[] = [];
            for (const lineNode of Array.from(layerNode.children)) {
                if (lineNode.tagName !== 'og:text-line') continue;
                const alignment = lineNode.getAttribute('alignment');
                const direction = lineNode.getAttribute('direction');

                const spans: TextDocumentSpan[] = [];
                for (const spanNode of Array.from(lineNode.children)) {
                    if (spanNode.tagName !== 'og:text-span') continue;
                    const text = spanNode.getAttribute('text');
                    if (text == null) continue;

                    const meta: Partial<TextDocumentSpanMeta> = {};
                    for (const metaNode of Array.from(spanNode.children)) {
                        if (metaNode.tagName !== 'og:text-meta') continue;
                        const name = metaNode.getAttribute('name');
                        const value = metaNode.getAttribute('value');
                        if (!name || !value) continue;
                        meta[name] = parseXmlAttributeValue(value);
                    }

                    spans.push({
                        text,
                        meta,
                    });
                }

                const line: TextDocumentLine = {
                    alignment: alignment ? validateTextLineAlignment(alignment) : undefined,
                    direction: direction ? validateTextDirection(direction) : undefined,
                    spans,
                }

                lines.push(line);
            }

            (parsedLayer as Partial<WorkingFileTextLayer>).data = {
                boundary,
                lineAlignment,
                lineDirection,
                wrapDirection,
                wrapAt,
                lines,
            };
            if (!isNaN(width) && !isNaN(height)) {
                parsedLayer.width = width;
                parsedLayer.height = height;
            }
        } else if (type === 'vector') {
            if (!archive[src]) continue;
            let sourceUuid = await createStoredSvg(
                await createImageFromBlob(new Blob([archive[src]], { type: 'image/svg+xml' }))
                    .catch(() => new Image())
            ).catch(() => undefined);
            const sourceImage = getStoredSvgImage(sourceUuid);
            if (!sourceImage) continue;
            (parsedLayer as Partial<WorkingFileVectorLayer>).data = {
                sourceUuid,
            };
            parsedLayer.width = sourceImage.width;
            parsedLayer.height = sourceImage.height;
        } else if (type === 'vectorPath') {
            // Unused
        } else if (type === 'video') {
            if (!archive[src]) continue;
            let sourceUuid = await createStoredVideo(
                await createVideoFromBlob(new Blob([archive[src]], { type: 'video/mp4' }))
                    .catch(() => document.createElement('video'))
            ).catch(() => undefined);
            const sourceVideo = getStoredVideo(sourceUuid);
            if (!sourceVideo) continue;
            (parsedLayer as Partial<WorkingFileVideoLayer>).data = {
                sourceUuid,
            };
            parsedLayer.width = sourceVideo.videoWidth;
            parsedLayer.height = sourceVideo.videoHeight;
        }

        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<any>>(parsedLayer as InsertAnyLayerOptions<any>)
        );
    }

    if (groupInsertLayerActions.length > 0) {
        insertLayerActions = insertLayerActions.concat(groupInsertLayerActions);
    }

    return insertLayerActions;
}

interface ParseSerializedFileToActionsOptions {
    insert?: boolean;
}
export async function parseSerializedFileToActions(
    fileData: Uint8Array,
    options?: ParseSerializedFileToActionsOptions,
) {
    const archive = await new Promise<fflate.Unzipped>((resolve, reject) => {
        fflate.unzip(fileData, {
            filter(file) {
                return file.name !== 'mergedimage.png' && !file.name.startsWith('Thumbnails');
            }
        }, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });

    if (!archive['stack.xml']) {
        throw new Error('Missing stack.xml');
    }

    const stackXml = new DOMParser().parseFromString(new TextDecoder().decode(archive['stack.xml']), 'text/xml');
    const image = stackXml.documentElement;
    if (!image) {
        throw new Error('Missing root image element');
    }

    const colorModel = validateColorModelName(image.getAttribute('og:color-model') ?? 'rgba');

    const workingFileDefinition: Partial<WorkingFileState> = {
        background: {
            visible: image.getAttribute('og:background-visibility') == 'visible',
            color: hexToColor(image.getAttribute('og:background-color') ?? '#ffffff', colorModel),
        },
        colorModel,
        colorSpace: image.getAttribute('og:color-space') ?? 'sRGB',
        drawOriginX: parseFloat(image.getAttribute('og:draw-origin-x') ?? '0'),
        drawOriginY: parseFloat(image.getAttribute('og:draw-origin-y') ?? '0'),
        height: Math.floor(parseFloat(image.getAttribute('h') ?? '0')),
        measuringUnits: validateMeasuringUnits(image.getAttribute('og:measuring-units') ?? 'px'),
        resolutionUnits: validateResolutionUnits(image.getAttribute('og:resolution-units') ?? 'px/in'),
        resolutionX: Math.floor(parseFloat(image.getAttribute('xres') ?? '72')),
        resolutionY: Math.floor(parseFloat(image.getAttribute('yres') ?? '72')),
        scaleFactor: parseFloat(image.getAttribute('og:scale-factor') ?? '1'),
        width: Math.floor(parseFloat(image.getAttribute('w') ?? '0')),
    };

    if (workingFileDefinition.drawOriginX != null && isNaN(workingFileDefinition.drawOriginX)) {
        workingFileDefinition.drawOriginX = 0;
    }
    if (workingFileDefinition.drawOriginY != null && isNaN(workingFileDefinition.drawOriginY)) {
        workingFileDefinition.drawOriginY = 0;
    }
    if (workingFileDefinition.height != null && isNaN(workingFileDefinition.height)) {
        workingFileDefinition.height = 892;
    }
    if (workingFileDefinition.resolutionX != null && isNaN(workingFileDefinition.resolutionX)) {
        workingFileDefinition.resolutionX = 892;
    }
    if (workingFileDefinition.resolutionY != null && isNaN(workingFileDefinition.resolutionY)) {
        workingFileDefinition.resolutionY = 892;
    }
    if (workingFileDefinition.scaleFactor != null && isNaN(workingFileDefinition.scaleFactor)) {
        workingFileDefinition.scaleFactor = 1;
    }
    if (workingFileDefinition.width != null && isNaN(workingFileDefinition.width)) {
        workingFileDefinition.width = 818;
    }

    if (!options?.insert) {
        const masks: Record<number, WorkingFileLayerMask> = {};
        const masksNode = Array.from(image.children).find((node) => node.tagName === 'og:masks');
        let highestMaskId = -1;
        if (masksNode) {
            const maskNodes = masksNode.getElementsByTagName('og:mask');
            for (const maskNode of Array.from(maskNodes)) {
                const id = parseInt(maskNode.getAttribute('id') ?? '-1', 10);
                if (id < -1) continue;
                const hash = maskNode.getAttribute('hash');
                if (!hash) continue;
                const src = maskNode.getAttribute('src');
                if (!src) continue;
                const offsetX = parseFloat(maskNode.getAttribute('offset-x') ?? '0');
                const offsetY = parseFloat(maskNode.getAttribute('offset-y') ?? '0');
                if (!archive[src]) continue;
                const sourceUuid = await parseArrayBufferToStoredImage(archive[src]);
                masks[id] = {
                    sourceUuid,
                    offset: {
                        x: offsetX,
                        y: offsetY,
                    },
                    hash,
                };
                highestMaskId = Math.max(id, highestMaskId);
            }
        }
        workingFileDefinition.masks = masks;
        workingFileDefinition.maskIdCounter = highestMaskId + 1;
    }

    const rootStack = image.querySelector(':scope > stack');
    if (!rootStack) {
        throw new Error('Missing root stack element');
    }

    const parseLayerOptions = {
        colorModel,
        fileWidth: options?.insert ? workingFileStore.get('width') : workingFileDefinition.width!,
        fileHeight: options?.insert ? workingFileStore.get('height') : workingFileDefinition.height!,
        layerIdCounter: options?.insert ? workingFileStore.get('layerIdCounter') : 0,
        selectedLayerIds: [],
        insert: options?.insert,
    };
    const insertLayerActions = await parseLayersToActions(rootStack, -1, archive, parseLayerOptions);

    workingFileDefinition.layerIdCounter = parseLayerOptions.layerIdCounter;
    workingFileDefinition.selectedLayerIds = parseLayerOptions.selectedLayerIds;

    return { workingFileDefinition, insertLayerActions };
}

function validateColorModelName(colorModel: string): ColorModelName {
    if (['rgba', 'cmyka', 'hsla', 'hsva', 'laba', 'lcha'].includes(colorModel)) {
        return colorModel as ColorModelName;
    }
    return 'rgba';
}

function validateMeasuringUnits(measuringUnits: string): MeasuringUnits {
    if (['px', 'mm', 'cm', 'in'].includes(measuringUnits)) {
        return measuringUnits as MeasuringUnits;
    }
    return 'px';
}

function validateResolutionUnits(resolutionUnits: string): ResolutionUnits {
    if (['px/in', 'px/mm', 'px/cm'].includes(resolutionUnits)) {
        return resolutionUnits as ResolutionUnits;
    }
    return 'px/in';
}

function validateWorkingFileLayerType(workingFileLayerType: string): WorkingFileLayerType {
    if ([
        'empty', 'gradient', 'group', 'raster', 'rasterSequence', 'vector', 'vectorPath', 'video', 'text'
    ].includes(workingFileLayerType)) {
        return workingFileLayerType as WorkingFileLayerType;
    }
    return 'empty';
}

function validateWorkingFileLayerBlendingMode(workingFileLayerBlendingMode: string): WorkingFileLayerBlendingMode {
    if ([
        'normal', 'dissolve', 'colorErase', 'erase', 'merge', 'split',
         'lightenOnly', 'lumaLightenOnly', 'screen', 'dodge', 'linearDodge', 'addition',
         'darkenOnly', 'lumaDarkenOnly', 'multiply', 'burn', 'linearBurn',
         'overlay', 'softLight', 'hardLight', 'vividLight', 'pinLight', 'linearLight', 'hardMix',
         'difference', 'exclusion', 'subtract', 'grainExtract', 'grainMerge', 'divide',
         'hue', 'chroma', 'color', 'lightness', 'luminance',
    ].includes(workingFileLayerBlendingMode)) {
        return workingFileLayerBlendingMode as WorkingFileLayerBlendingMode;
    }
    return 'normal';
}

function validateWorkingFileGradientColorSpace(workingFileGradientColorSpace: string): WorkingFileGradientColorSpace {
    if (['oklab', 'srgb', 'linearSrgb'].includes(workingFileGradientColorSpace)) {
        return workingFileGradientColorSpace as WorkingFileGradientColorSpace;
    }
    return 'oklab';
}

function validateWorkingFileGradientFillType(workingFileGradientFillType: string): WorkingFileGradientFillType {
    if (['linear', 'radial'].includes(workingFileGradientFillType)) {
        return workingFileGradientFillType as WorkingFileGradientFillType;
    }
    return 'linear';
}

function validateWorkingFileGradientSpreadMethod(workingFileGradientSpreadMethod: string): WorkingFileGradientSpreadMethod {
    if (['pad', 'repeat', 'reflect', 'truncate'].includes(workingFileGradientSpreadMethod)) {
        return workingFileGradientSpreadMethod as WorkingFileGradientSpreadMethod;
    }
    return 'pad';
}

function validateTextBoundary(textBoundary: string): TextBoundary {
    if (['dynamic', 'box'].includes(textBoundary)) {
        return textBoundary as TextBoundary;
    }
    return 'dynamic';
}

function validateTextDirection(textDirection: string): TextDirection {
    if (['ltr', 'rtl', 'ttb', 'btt'].includes(textDirection)) {
        return textDirection as TextDirection;
    }
    return 'ltr';
}

function validateTextLineAlignment(textLineAlignment: string): TextLineAlignment {
    if (['start', 'center', 'end'].includes(textLineAlignment)) {
        return textLineAlignment as TextLineAlignment;
    }
    return 'start';
}

function validateTextWrapAt(textWrapAt: string): TextWrapAt {
    if (['word', 'wordThenLetter'].includes(textWrapAt)) {
        return textWrapAt as TextWrapAt;
    }
    return 'word';
}

async function parseArrayBufferToStoredImage(arrayBuffer: Uint8Array<ArrayBuffer>): Promise<string> {
    const imageBlob = new Blob([arrayBuffer]);
    const image = new Image();
    await new Promise<void>((resolve) => {
        image.onload = () => {
            resolve();
        };
        image.onerror = () => {
            resolve();
        };
        image.src = URL.createObjectURL(imageBlob);
    });
    return await createStoredImage(image);
}
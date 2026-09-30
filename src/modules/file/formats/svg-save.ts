import { v4 as uuidv4 } from 'uuid';

import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';

import { pointDistance2d } from '@/lib/math';
import { getViewBox, parseNodeTransform } from '@/lib/svg';
import { textMetaDefaults } from '@/lib/text-common';
import { calculateTextPlacement } from '@/lib/text-render';
import { indentXml } from '@/lib/xml';

import type { TextDocumentSpanMeta, WorkingFileAnyLayer, WorkingFileLayerBlendingMode } from '@/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SerializeWorkingFileOptions {
    layerSelection?: 'all' | 'selected';
}

async function generateLayer(
    svgDocument: XMLDocument,
    rootElement: Element,
    layer: WorkingFileAnyLayer,
    imageWidth: number,
    imageHeight: number,
    options?: SerializeWorkingFileOptions,
): Promise<void> {

    if (layer.type === 'group') {

        for (const childLayer of layer.layers) {
            generateLayer(svgDocument, rootElement, childLayer, imageWidth, imageHeight);
        }

    }

    if (
        options?.layerSelection === 'selected'
        && !workingFileStore.state.selectedLayerIds.includes(layer.id)
    ) {
        return;
    }

    if (layer.type === 'gradient') {
        const rect = svgDocument.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', `${imageWidth}`);
        rect.setAttribute('height', `${imageHeight}`);
        rect.setAttribute('opacity', `${layer.opacity}`);

        const spreadMethod: string | null = {
            'pad': 'pad',
            'repeat': 'repeat',
            'reflect': 'reflect',
            'truncate': null,
        }[layer.data.spreadMethod]

        const colorInterpolation: string | null = {
            'oklab': 'linearRGB',
            'srgb': 'sRGB',
            'linearSrgb': 'linearRGB',
        }[layer.data.blendColorSpace];

        const defs = svgDocument.createElementNS(SVG_NS, 'defs');
        let gradient: SVGElement | undefined;
        if (layer.data.fillType === 'linear') {

            const gradientId = `linear-gradient-${uuidv4()}`;
            rect.setAttribute('fill', `url(#${gradientId})`);
            gradient = svgDocument.createElementNS(SVG_NS, 'linearGradient');
            gradient.setAttribute('id', gradientId);
            const p1 = new DOMPoint(layer.data.start.x, layer.data.start.y)
                .matrixTransform(layer.transform)
                .matrixTransform(new DOMMatrix().scaleSelf(1 / imageWidth, 1 / imageHeight));
            const p2 = new DOMPoint(layer.data.end.x, layer.data.end.y)
                .matrixTransform(layer.transform)
                .matrixTransform(new DOMMatrix().scaleSelf(1 / imageWidth, 1 / imageHeight));
            gradient.setAttribute('x1', `${p1.x}`);
            gradient.setAttribute('y1', `${p1.y}`);
            gradient.setAttribute('x2', `${p2.x}`);
            gradient.setAttribute('y2', `${p2.y}`);

        } else if (layer.data.fillType === 'radial') {

            const gradientId = `radial-gradient-${uuidv4()}`;
            rect.setAttribute('fill', `url(#${gradientId})`);
            gradient = svgDocument.createElementNS(SVG_NS, 'radialGradient');
            gradient.setAttribute('id', gradientId);
            const center = new DOMPoint(layer.data.start.x, layer.data.start.y)
                .matrixTransform(layer.transform)
                .matrixTransform(new DOMMatrix().scaleSelf(1 / imageWidth, 1 / imageHeight));
            const radius = new DOMPoint(layer.data.end.x, layer.data.end.y)
                .matrixTransform(layer.transform)
                .matrixTransform(new DOMMatrix().scaleSelf(1 / imageWidth, 1 / imageHeight));
            const focus = new DOMPoint(layer.data.focus.x, layer.data.focus.y)
                .matrixTransform(layer.transform)
                .matrixTransform(new DOMMatrix().scaleSelf(1 / imageWidth, 1 / imageHeight));
            gradient.setAttribute('cx', `${center.x}`);
            gradient.setAttribute('cy', `${center.y}`);
            gradient.setAttribute('r', `${pointDistance2d(center.x, center.y, radius.x, radius.y)}`);
            gradient.setAttribute('fx', `${focus.x}`);
            gradient.setAttribute('fy', `${focus.y}`);

        }

        if (gradient) {
            if (spreadMethod != null) {
                gradient.setAttribute('spreadMethod', spreadMethod);
            }

            gradient.style.colorInterpolation = colorInterpolation;

            for (const stop of layer.data.stops.sort((a, b) => a.offset - b.offset)) {
                const stopElement = svgDocument.createElementNS(SVG_NS, 'stop');
                stopElement.setAttribute('offset', `${stop.offset}`);
                stopElement.setAttribute('stop-color', `${stop.color.style.slice(0, 7)}`);
                if (stop.color.alpha < 1) {
                    stopElement.setAttribute('stop-opacity', `${stop.color.alpha}`);
                }
                gradient.append(stopElement);
            }
            defs.append(gradient);
        }

        rootElement.append(defs);
        rootElement.append(rect);

    } else if (layer.type === 'raster') {

        const image = svgDocument.createElementNS(SVG_NS, 'image');
        image.setAttribute('href', serializeStoredImage(layer.data.sourceUuid));
        image.setAttribute('width', `${layer.width}`);
        image.setAttribute('height', `${layer.height}`);
        image.setAttribute('opacity', `${layer.opacity}`);
        {
            const { a, b, c, d, e, f } = layer.transform;
            image.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
        }
        rootElement.append(image);

    } else if (layer.type === 'rasterSequence') {

        if (layer.data.sequence.length === 0) return;
        const totalDuration = layer.data.sequence[layer.data.sequence.length - 1].end;

        for (const [frameIndex, frame] of layer.data.sequence.entries()) {
            const frameGroup = svgDocument.createElementNS(SVG_NS, 'g');
            {
                const { a, b, c, d, e, f } = layer.transform;
                frameGroup.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
            }
            frameGroup.setAttribute('opacity', frameIndex === 0 ? '1' : '0');

            const image = svgDocument.createElementNS(SVG_NS, 'image');
            image.setAttribute('href', serializeStoredImage(frame.image.sourceUuid));
            image.setAttribute('width', `${layer.width}`);
            image.setAttribute('height', `${layer.height}`);
            frameGroup.append(image);

            const animate = svgDocument.createElementNS(SVG_NS, 'animate');
            animate.setAttribute('attributeName', 'opacity');
            animate.setAttribute('dur', `${totalDuration / 1000}s`);
            animate.setAttribute('repeatCount', 'indefinite');
            const times = [0, frame.start, frame.end, totalDuration];
            const keyTimes = times.map(time => time / totalDuration);
            const values = times.map(time => time >= frame.start && time <= frame.end ? 1 : 0);
            animate.setAttribute('values', values.join(';'));
            animate.setAttribute('keyTimes', keyTimes.join(';'));
            frameGroup.append(animate);

            rootElement.append(frameGroup);
        }

    } else if (layer.type === 'text') {

        const text = svgDocument.createElementNS(SVG_NS, 'text');
        {
            const { a, b, c, d, e, f } = layer.transform;
            text.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
        }
        text.setAttribute('dominant-baseline', 'text-top');
        text.setAttribute('font-family', textMetaDefaults.family);
        text.setAttribute('font-size', `${textMetaDefaults.size}`);
        text.setAttribute('fill', `${textMetaDefaults.fillColor.style.slice(0, 7)}`);
        text.setAttribute('fill-opacity', `${textMetaDefaults.fillColor.alpha}`);
        text.setAttribute('stroke', `${textMetaDefaults.stroke1Color.style.slice(0, 7)}`);
        text.setAttribute('stroke-opacity', `${textMetaDefaults.stroke1Color.alpha}`);
        text.setAttribute('stroke-width', `${textMetaDefaults.stroke1Size}`);
        text.setAttribute('opacity', `${layer.opacity}`);

        let isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
        
        const { lines: lineRenderInfo, wrappedLines, wrapDirectionSize } = calculateTextPlacement(layer.data, {
            wrapSize: isHorizontal ? layer.width : layer.height,
        });

        if (isHorizontal) {
            for (const [lineIndex, line] of wrappedLines.entries()) {
                const renderInfo = lineRenderInfo[lineIndex];
                const y = renderInfo.wrapOffset;

                for (const span of line.spans) {
                    const firstGlyph = renderInfo.glyphs.find((glyph) => glyph.meta === span.meta);                
                    const tspan = svgDocument.createElementNS(SVG_NS, 'tspan');

                    const x = renderInfo.lineStartOffset + (firstGlyph?.advanceOffset ?? 0);
                    tspan.setAttribute('x', `${x}`);
                    tspan.setAttribute('y', `${y}`);
                    applyTextSpanMetaAttributes(tspan, span.meta);
                    tspan.textContent = span.text;
                    text.append(tspan);
                }
            }
        } else {
            for (const line of lineRenderInfo) {

                let lineX = line.wrapOffset;
                if (layer.data.wrapDirection === 'rtl') {
                    lineX = wrapDirectionSize - line.wrapOffset - lineRenderInfo[0].largestCharacterWidth;
                }

                for (const glyph of line.glyphs) {
                    const tspan = svgDocument.createElementNS(SVG_NS, 'tspan');
                    const x = lineX + ((line.largestCharacterWidth - glyph.characterWidth) / 2);
                    const y = glyph.advanceOffset;
                    tspan.setAttribute('x', `${x}`);
                    tspan.setAttribute('y', `${y}`);
                    applyTextSpanMetaAttributes(tspan, glyph.meta);
                    tspan.textContent = glyph.glyph.unicodes.map(value => String.fromCodePoint(value)).join('');
                    text.append(tspan);
                }
            }
        }

        rootElement.append(text);

    } else if (layer.type === 'vector') {

        const layerSvgDocument = await getStoredSvgDocument(layer.data.sourceUuid);
        const viewBox = getViewBox(layerSvgDocument);
        const svgTransform = parseNodeTransform(layerSvgDocument.documentElement);
        let layerRootElement = rootElement;

        const layerRootTransform = svgTransform.multiply(layer.transform).scaleSelf(
            layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
        ).translateSelf(
            -viewBox.x, -viewBox.y, 0.0,
        );

        if (!layerRootTransform.isIdentity) {
            layerRootElement = svgDocument.createElementNS(SVG_NS, 'g');
            const { a, b, c, d, e, f } = layerRootTransform;
            layerRootElement.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
            rootElement.append(layerRootElement);
        }
        layerRootElement.setAttribute('opacity', `${layer.opacity}`);
        for (const childElement of Array.from(layerSvgDocument.documentElement.children)) {
            layerRootElement.append(childElement);
        }

    } else if (layer.type === 'video') {

        // NOOP

    }
}

function applyTextSpanMetaAttributes(tspan: SVGTSpanElement, meta: Partial<TextDocumentSpanMeta>) {
    if (meta.family != null) {
        tspan.setAttribute('font-family', meta.family);
    }
    if (meta.size != null) {
        tspan.setAttribute('font-size', `${meta.size}`);
    }
    if (meta.bold) {
        tspan.setAttribute('font-weight', '500');
    }
    if (meta.oblique) {
        tspan.setAttribute('font-style', 'italic');
    }
    if (meta.underline || meta.overline || meta.strikethrough) {
        tspan.setAttribute('text-decoration', [
            meta.underline ? 'underline' : null,
            meta.overline ? 'overline' : null,
            meta.strikethrough ? 'line-through' : null,
        ].filter((style) => style != null).join(' '));
    }
    if (meta.fillColor) {
        tspan.setAttribute('fill', `${meta.fillColor.style.slice(0, 7)}`);
        tspan.setAttribute('fill-opacity', `${meta.fillColor.alpha}`);
    }
    if (meta.stroke1Color) {
        tspan.setAttribute('stroke', `${meta.stroke1Color.style.slice(0, 7)}`);
        tspan.setAttribute('stroke-opacity', `${meta.stroke1Color.alpha}`);
    }
    if (meta.stroke1Size) {
        tspan.setAttribute('stroke-width', `${meta.stroke1Size}`);
    }
}

export async function serializeWorkingFile(options?: SerializeWorkingFileOptions): Promise<Blob> {
    const width = workingFileStore.get('width');
    const height = workingFileStore.get('height');

    const emptySvgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
    const parser = new DOMParser();
    const svgDocument = parser.parseFromString(emptySvgString, 'image/svg+xml');

    for (const layer of workingFileStore.get('layers')) {
        await generateLayer(
            svgDocument,
            svgDocument.documentElement,
            layer as never,
            width,
            height,
            options,
        );
    }

    svgDocument.querySelectorAll('[data-ogr-id]').forEach((element) => element.removeAttribute('data-ogr-id'));

    const serializer = new XMLSerializer();
    const newSvgString = indentXml(serializer.serializeToString(svgDocument));

    return new Blob([newSvgString], { type: 'image/svg+xml' });
}

function serializeStoredImage(imageUuid?: string): string {
    const canvas = document.createElement('canvas');
    try {
        const sourceImage = getStoredImageOrCanvas(imageUuid);
        if (!sourceImage) return '';

        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) {
            return '';
        }
        ctx.imageSmoothingEnabled = false;
        
        if (canvasStore.state.renderer === 'webgl' && sourceImage instanceof ImageBitmap) {
            ctx.scale(1, -1);
            ctx.translate(0, -sourceImage.height);
        }
        if (sourceImage) {
            ctx.drawImage(sourceImage, 0, 0);
        }
        return canvas.toDataURL('image/png');
    } catch (error: any) {
        canvas.width = 1;
        canvas.height = 1;
    }
    return '';
}

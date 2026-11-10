import { BaseAction } from './base';

import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { textMetaDefaults } from '@/lib/text-common';

import { ClearSelectionAction } from './clear-selection';
import { UpdateFileAction } from './update-file';
import { UpdateLayerAction } from './update-layer';

import type {
    ColorModel, TextDocument,
    UpdateAnyLayerOptions, UpdateTextLayerOptions,
    WorkingFileLayer, WorkingFileGroupLayer, WorkingFileTextLayer,
    MeasuringUnits, ResolutionUnits,
} from '@/types';

async function generateResizeLayerActions(
    layers: WorkingFileLayer<ColorModel>[],
    mode: 'crop' | 'resample',
    widthRatio: number,
    heightRatio: number,
    cropLeft: number,
    cropTop: number,
): Promise<BaseAction[]> {
    let actions: BaseAction[] = [];
    for (let layer of layers) {
        if (layer.type === 'group') {
            await generateResizeLayerActions((layer as WorkingFileGroupLayer<ColorModel>).layers, mode, widthRatio, heightRatio, cropLeft, cropTop);
        } else if (layer.type === 'raster' || layer.type === 'rasterSequence' || layer.type === 'vector' || layer.type === 'gradient') {
            let transform = layer.transform;
            if (mode === 'crop') {
                transform = new DOMMatrix().translateSelf(-cropLeft, -cropTop).multiplySelf(layer.transform);
            } else {
                transform = new DOMMatrix().translateSelf(-cropLeft * widthRatio, -cropTop * heightRatio).scaleSelf(widthRatio, heightRatio).multiplySelf(layer.transform);
            }
            console.log('transform', transform);
            actions.push(
                new UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>({
                    id: layer.id,
                    transform
                })
            );
        } else if (layer.type === 'text') {
            let transform = layer.transform;
            if (mode === 'crop') {
                transform = new DOMMatrix().translateSelf(-cropLeft, -cropTop).multiplySelf(layer.transform);
                actions.push(
                    new UpdateLayerAction<UpdateTextLayerOptions<ColorModel>>({
                        id: layer.id,
                        transform,
                    })
                );
            } else {
                const decomposedTransform = decomposeMatrix(transform);
                transform = new DOMMatrix()
                    .translateSelf(-cropLeft * widthRatio, -cropTop * heightRatio)
                    .translateSelf(
                        -decomposedTransform.translateX + (decomposedTransform.translateX * widthRatio),
                        -decomposedTransform.translateY + (decomposedTransform.translateY * heightRatio)
                    )
                    .multiplySelf(layer.transform)
                const oldData = JSON.parse(JSON.stringify((layer as WorkingFileTextLayer).data)) as TextDocument;
                const newData = JSON.parse(JSON.stringify((layer as WorkingFileTextLayer).data)) as TextDocument;
                for (const line of newData.lines) {
                    for (const span of line.spans) {
                        span.meta.size = (span.meta.size ?? textMetaDefaults.size) * widthRatio;
                    }
                }
                actions.push(
                    new UpdateLayerAction<UpdateTextLayerOptions<ColorModel>>({
                        id: layer.id,
                        transform,
                        width: layer.width * widthRatio,
                        height: layer.height * heightRatio,
                        data: newData,
                    }, {
                        transform: layer.transform,
                        width: layer.width,
                        height: layer.height,
                        data: oldData,
                    })
                );
            }
        }
    }
    return actions;
}

export class CropResizeAction extends BaseAction {

    private mode!: 'crop' | 'resample';
    private widthRatio!: number;
    private heightRatio!: number;
    private cropOrResizeWidth!: number;
    private cropOrResizeHeight!: number;
    private cropLeft!: number;
    private cropTop!: number;
    private measuringUnits!: MeasuringUnits;
    private resolutionUnits!: ResolutionUnits;
    private resolutionX!: number;
    private resolutionY!: number;

    private actions: BaseAction[] = [];

    constructor(
        mode: 'crop' | 'resample',
        cropOrResizeWidth: number,
        cropOrResizeHeight: number,
        cropLeft: number,
        cropTop: number,
        widthRatio?: number,
        heightRatio?: number,
        measuringUnits?: MeasuringUnits,
        resolutionUnits?: ResolutionUnits,
        resolutionX?: number,
        resolutionY?: number,
    ) {
        super('cropResize', 'action.cropResize');
        this.mode = mode;
        this.cropOrResizeWidth = cropOrResizeWidth;
        this.cropOrResizeHeight = cropOrResizeHeight;
        this.cropLeft = cropLeft;
        this.cropTop = cropTop;
        this.widthRatio = widthRatio ?? 1;
        this.heightRatio = heightRatio ?? 1;
        this.measuringUnits = measuringUnits ?? workingFileStore.state.measuringUnits;
        this.resolutionUnits = resolutionUnits ?? workingFileStore.state.resolutionUnits;
        this.resolutionX = resolutionX ?? workingFileStore.state.resolutionX;
        this.resolutionY = resolutionY ?? workingFileStore.state.resolutionY;
    }

    public async do() {
        super.do();

        if (this.actions.length === 0) {
            const layers = workingFileStore.get('layers');

            this.actions = await generateResizeLayerActions(
                layers,
                this.mode,
                this.widthRatio,
                this.heightRatio,
                this.cropLeft,
                this.cropTop,
            );

            this.actions.push(new ClearSelectionAction());
            this.actions.push(
                new UpdateFileAction({
                    width: this.cropOrResizeWidth,
                    height: this.cropOrResizeHeight,
                    measuringUnits: this.measuringUnits,
                    resolutionX: this.resolutionX,
                    resolutionY: this.resolutionY,
                    resolutionUnits: this.resolutionUnits,
                })
            );
        }

        for (const action of this.actions) {
            await action.do();
        }
    }

    public async undo() {
        super.undo();

        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i];
            await action.undo();
        }

    }

}
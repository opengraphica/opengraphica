/**
 * This file constructs the necessary assets to render a vector layer.
 * It can run in the main thread or a worker.
 */
import { BackSide } from 'three/src/constants';
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Group } from 'three/src/objects/Group';
import { ImagePlaneGeometry } from '@/renderers/webgl2/geometries/image-plane-geometry';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Quaternion } from 'three/src/math/Quaternion';
import { ShapeGeometry } from 'three/src/geometries/ShapeGeometry';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';

import { createPathStrokeShapes } from './svg-stroke-path';

import { throttle } from '@/lib/timing';

import { getWebgl2RendererBackend, markRenderDirty, requestFrontendSvg } from '@/renderers/webgl2/backend';
import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { createCanvasFiltersFromLayerConfig, createLayerShaderUniformsAndDefines } from '../base/material';
import { assignMaterialBlendingMode } from '../base/blending-mode';
import { createRasterMaterial, disposeRasterMaterial, updateRasterMaterial } from '../raster/material';
import { SVGLoader } from './svg-loader';

import type { Scene, ShaderMaterial, SvgShapePath } from 'three';
import type {
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileVectorLayer, WorkingFileLayerFilter
} from '@/types';

const epsilon = 0.000001;

export class VectorLayerMeshController implements Webgl2RendererMeshController {
    
    material: InstanceType<typeof ShaderMaterial> | undefined;
    plane: InstanceType<typeof Mesh> | undefined;
    planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    scene: InstanceType<typeof Scene> | undefined;
    sourceSvg: Blob | undefined;
    sourceTexture: InstanceType<typeof Texture<any>> | undefined;
    sourceDocument: XMLDocument | undefined;
    shapeGroup: InstanceType<typeof Group> | undefined;

    domParser: DOMParser;
    svgLoader: SVGLoader;

    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    opacity: number = 1;
    filters: Array<Webgl2RendererCanvasFilter | null> = [];
    filtersOverride: Array<Webgl2RendererCanvasFilter | null> | undefined = undefined;
    height: number = 0;
    sourceUuid: string | undefined;
    tileUpdateId: string | undefined;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;
    width: number = 0;

    lastResizeScaledWidth: number = 0;
    lastResizeScaledHeight: number = 0;

    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;
    overrideFilterParamTextures: Texture<any>[] = [];
    svgMeshesById: Record<string, Array<Mesh>> = {};

    handleResize: (() => void);

    constructor() {
        this.domParser = new DOMParser();
        this.svgLoader = new SVGLoader();

        this.handleResize = throttle(() => {
            this.generateSvgTexture();
        }, 500);
    }

    attach(id: number) {
        this.id = id;
        const backend = getWebgl2RendererBackend();
        backend.addMeshController(id, this);
        this.scene = backend.scene;
        this.plane = new Mesh(undefined, undefined);
        this.plane.matrixAutoUpdate = false;
        this.scene.add(this.plane);

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        messageBus.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
    }

    queueRegenerateThumbnail() {
        clearTimeout(this.regenerateThumbnailTimeoutHandle);
        this.regenerateThumbnailTimeoutHandle = setTimeout(this.regenerateThumbnail.bind(this), 25);
    }
    regenerateThumbnail() {
        messageBus.emit('layer.regenerateThumbnail', this.id);
    }

    async scheduleMaterialUpdate(type: 'destroyAndCreate' | 'update') {
        if (
            (type === 'destroyAndCreate' && !this.materialUpdates.slice(0, -1).includes('destroyAndCreate')) ||
            (type === 'update' && !this.materialUpdates.slice(0, -1).includes('update'))
        ) {
            this.materialUpdates.unshift(type);
        }
        if (this.materialUpdates.length === 1) {
            this.disposeOverrideFilterParamTextures();

            while (this.materialUpdates.length > 0) {
                const updateType = this.materialUpdates[this.materialUpdates.length - 1];
                if (!updateType) break;
                if (updateType === 'destroyAndCreate') {
                    if (this.material) {
                        await disposeRasterMaterial(this.material);
                    }
                }
                if (!this.material || updateType === 'destroyAndCreate') {
                    this.material = await createRasterMaterial({
                        srcTexture: this.sourceTexture,
                        canvasFilters: this.filtersOverride ?? this.filters,
                        opacity: this.opacity,
                        premultiplyAlphaFix: true,
                    });
                    assignMaterialBlendingMode(this.material, this.blendingMode);
                } else {
                    await updateRasterMaterial(this.material, {
                        srcTexture: this.sourceTexture,
                        opacity: this.opacity,
                        premultiplyAlphaFix: true,
                    })
                }
                this.plane && (this.plane.material = this.material);
                this.materialUpdates.pop();
                if (this.materialUpdates.length < 1) {
                    markRenderDirty();
                    this.queueRegenerateThumbnail();
                }
            }
        }
    }

    updateBlendingMode(blendingMode: WorkingFileLayerBlendingMode) {
        if (blendingMode !== this.blendingMode) {
            this.blendingMode = blendingMode;
            this.scheduleMaterialUpdate('destroyAndCreate');
        }
    }

    updateOpacity(opacity: number) {
        if (opacity !== this.opacity) {
            this.opacity = opacity;
            this.scheduleMaterialUpdate('update');
        }
    }

    async updateData(data: WorkingFileVectorLayer['data']) {
        this.sourceUuid = data.sourceUuid;
        if (data.sourceDocument) {
            this.generateSvgMeshes(data.sourceDocument);
        } else if (data.sourceDocumentSerialized) {
            const sourceDocument = this.domParser.parseFromString(data.sourceDocumentSerialized, 'image/svg+xml');
            this.generateSvgMeshes(sourceDocument);
        } else {
            if (this.shapeGroup) {
                this.scene?.remove(this.shapeGroup);
                if (this.plane) {
                    this.scene?.add(this.plane);
                }
                this.disposeSvgMeshes();
            }
            this.generateSvgTexture();
        }
    }

    async updateFilters(filters: WorkingFileLayerFilter[]) {
        this.filters = await createCanvasFiltersFromLayerConfig(filters);
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    updateName(name: string) {
        if (this.plane) {
            this.plane.name = name;
        }
    }

    updateSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.planeGeometry?.dispose();
        this.planeGeometry = new ImagePlaneGeometry(width, height);
        if (this.plane) {
            this.plane.geometry = this.planeGeometry;
        }
        if (this.shapeGroup?.userData?.svgDocument && this.plane) {
            const viewBox = this.svgLoader.getViewBox(this.shapeGroup.userData.svgDocument);
            const width = viewBox.max.x - viewBox.min.x;
            const height = viewBox.max.y - viewBox.min.y;
            this.shapeGroup.matrix = this.plane.matrix.clone().multiply(
                new Matrix4().makeScale(this.width / width, this.height / height, 0.0)
            ).multiply(
                new Matrix4().makeTranslation(viewBox.min.x, viewBox.min.y, 0.0)
            );
        }
        this.handleResize?.();
    }

    updateTransform(transform: Float64Array) {
        this.plane?.matrix.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        if (this.shapeGroup && this.plane) {
            const viewBox = this.svgLoader.getViewBox(this.shapeGroup.userData.svgDocument);
            const width = viewBox.max.x - viewBox.min.x;
            const height = viewBox.max.y - viewBox.min.y;
            this.shapeGroup.matrix = this.plane.matrix.clone().multiply(
                new Matrix4().makeScale(this.width / width, this.height / height, 0.0)
            ).multiply(
                new Matrix4().makeTranslation(viewBox.min.x, viewBox.min.y, 0.0)
            );
        }
        markRenderDirty();
        this.handleResize?.();
    }

    updateVisible(visible: boolean) {
        this.visible = visible;
        let oldVisibility = this.plane?.visible;
        this.plane && (this.plane.visible = this.visibleOverride ?? this.visible);
        if (this.plane?.visible !== oldVisibility) {
            markRenderDirty();
        }
    }

    async generateSvgTexture() {
        if (this.shapeGroup) return;
        if (this.sourceUuid && this.plane) {
            this.disposeSvgMeshes();

            let scale = new Vector3();
            this.plane.matrix.decompose(new Vector3(), new Quaternion(), scale);
            const scaledWidth = scale.x * this.width;
            const scaledHeight = scale.y * this.height;
            if (
                Math.abs(scaledWidth - this.lastResizeScaledWidth) <= epsilon
                && Math.abs(scaledHeight - this.lastResizeScaledHeight) <= epsilon) {
                return;
            }
            this.lastResizeScaledWidth = scaledWidth;
            this.lastResizeScaledHeight = scaledHeight;

            const sourceTexture = await requestFrontendSvg(
                this.sourceUuid, scaledWidth, scaledHeight,
            );
            this.disposeSourceTexture();
            this.sourceTexture = sourceTexture;

            this.scheduleMaterialUpdate('update');
        } else {
            this.disposeSourceTexture();
            this.scheduleMaterialUpdate('update');
        }
    }

    async generateSvgMeshes(svgDocument: Document) {
        if (!(svgDocument instanceof XMLDocument)) return;
        this.sourceDocument = svgDocument;
        this.disposeSvgMeshes();
        if (this.width && this.height) {
            svgDocument.documentElement.setAttribute('width', `${this.width}`);
            svgDocument.documentElement.setAttribute('height', `${this.height}`);
        }
        const { paths } = this.svgLoader.parse(svgDocument);

        const renderOrder = this.plane?.renderOrder ?? this.shapeGroup?.renderOrder ?? 0;

        this.shapeGroup = new Group();
        this.shapeGroup.renderOrder = renderOrder;
        this.shapeGroup.userData.svgDocument = svgDocument;
        this.shapeGroup.matrixAutoUpdate = false;
        if (this.plane) {
            const viewBox = this.svgLoader.getViewBox(this.shapeGroup.userData.svgDocument);
            const width = viewBox.max.x - viewBox.min.x;
            const height = viewBox.max.y - viewBox.min.y;
            this.shapeGroup.matrix = this.plane.matrix.clone().multiply(
                new Matrix4().makeScale(this.width / width, this.height / height, 0.0)
            ).multiply(
                new Matrix4().makeTranslation(viewBox.min.x, viewBox.min.y, 0.0)
            );
        }

        for (const path of paths) {
            this.createPathShapes(path, renderOrder);
        }
        if (this.plane) {
            this.scene?.remove(this.plane);
        }
        this.scene?.add(this.shapeGroup);
    }

    async updateVectorLayerAttributes(nodeId: string, attributes: Record<string, string>) {
        if (!this.sourceDocument || !this.shapeGroup) return;
        let node = this.sourceDocument.querySelector(`[data-ogr-id="${nodeId}"]`);
        if (!node) return;
        const meshes = this.svgMeshesById[nodeId];
        if (meshes) {
            for (const mesh of meshes) {
                mesh.geometry?.dispose();
                (mesh.material as any)?.dispose();
                this.shapeGroup.remove(mesh);
            }
        }

        const renderOrder = this.plane?.renderOrder ?? this.shapeGroup?.renderOrder ?? 0;
        
        let currentChildNode: Element | null = null;
        while (node.parentElement) {
            const clonedNode = node.cloneNode() as Element;
            for (const attributeName in attributes) {
                clonedNode.setAttribute(attributeName, attributes[attributeName]);
            }
            if (currentChildNode) {
                clonedNode.append(currentChildNode)
            }
            currentChildNode = clonedNode;
            node = node?.parentElement;
        }
        if (!currentChildNode) return;

        // TODO - Reference parse document should be cached from generateSvgMeshes method,
        //        also it's missing the styles and defs.

        // TODO - Creating xml document doesn't work inside webworker.
        var newDoc = window.document.implementation.createDocument(null, 'svg');
        for (const attribute of Array.from(this.sourceDocument.documentElement.attributes)) {
            newDoc.documentElement.setAttribute(attribute.name, attribute.value);
        }
        newDoc.documentElement.append(currentChildNode);

        const { paths } = this.svgLoader.parse(newDoc);
        const path = paths[0];
        if (!path) return;

        this.createPathShapes(path, renderOrder);

        markRenderDirty();
    }

    createPathShapes(path: SvgShapePath, renderOrder: number) {
        if (!this.shapeGroup) return;
        const node = path.userData.node as Element;
        const id = node?.getAttribute('data-ogr-id');
        const nodeName = node?.nodeName ?? 'path';
        id && (this.svgMeshesById[id] = []);
        createFill:
        if (path.userData.style.fill !== 'none') {
            const shapes = path.toShapes();
            if (shapes.length === 0) break createFill;
            const material = new MeshBasicMaterial({
                color: path.color,
                side: BackSide,
                depthWrite: false,
                transparent: true,
            });
            for (const shape of shapes) {
                const geometry = new ShapeGeometry(shape);
                const mesh = new Mesh(geometry, material);
                mesh.renderOrder = renderOrder;
                id && this.svgMeshesById[id].push(mesh);
                this.shapeGroup.add(mesh);
            }
        }
        createStroke:
        if (path.userData.style.stroke != 'none' && path.userData.style.strokeWidth > 0) {
            const shapes = createPathStrokeShapes(path, {
                lineCap: path.userData.style.strokeLineCap,
                lineJoin: path.userData.style.strokeLineJoin,
                miterLimit: path.userData.style.strokeMiterLimit,
                width: path.userData.style.strokeWidth,
                closed: nodeName !== 'polyline'
                    && nodeName !== 'line'
                    && nodeName !== 'path',
            });
            if (shapes.length === 0) break createStroke;
            const material = new MeshBasicMaterial({
                color: path.userData.style.stroke,
                side: BackSide,
                depthWrite: false,
                transparent: true,
            });
            for (const shape of shapes) {
                const geometry = new ShapeGeometry(shape);
                const mesh = new Mesh(geometry, material);
                mesh.renderOrder = renderOrder;
                id && this.svgMeshesById[id].push(mesh);
                this.shapeGroup.add(mesh);
            }
        }
    }

    disposeSvgMeshes() {
        if (this.shapeGroup) {
            this.scene?.remove(this.shapeGroup);
            for (const child of this.shapeGroup.children) {
                if (child instanceof Mesh) {
                    child.geometry?.dispose();
                    child.geometry = undefined;
                    child.material?.dispose();
                    child.material = undefined;
                }
            }
            this.shapeGroup = undefined;
        }
        this.svgMeshesById = {};
    }
 
    reorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order + 0.1;
        }
        if (this.shapeGroup) {
            this.shapeGroup.renderOrder = order + 0.1;
        }
    }

    getTexture() {
        return Promise.resolve(this.sourceTexture ?? null);
    }

    getTransform() {
        return this.plane?.matrix ?? new Matrix4();
    }

    setDraftTexture(texture?: Texture<any>) {
        // TODO
    }
    
    swapScene(scene: Scene) {
        if (!this.plane) return;
        this.scene?.remove(this.plane);
        if (this.shapeGroup) {
            this.scene?.remove(this.shapeGroup);
            scene.add(this.shapeGroup);
        } else {
            scene.add(this.plane);
        }
        this.scene = scene;
    }

    async overrideFilters(filters?: Array<Webgl2RendererCanvasFilter | null>) {
        this.filtersOverride = filters;
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    overrideFilterParams(filterIndex: number, params?: Record<string, any> | null) {
        if (params === null) {
            this.filtersOverride = this.filters?.map((filter, otherIndex) => {
                return filterIndex === otherIndex ? null : filter;
            });
            this.scheduleMaterialUpdate('destroyAndCreate');
            return;
        } else if (this.filtersOverride) {
            this.filtersOverride = undefined;
            this.scheduleMaterialUpdate('destroyAndCreate');
        }

        let needsDestroyAndCreate = false;

        if (this.filters[filterIndex]) {
            if (params != null) {
                this.filters[filterIndex].overrideParams = params;
                this.filters[filterIndex].overrideDisabled = false;
            } else if (params === undefined) {
                if (this.filters[filterIndex].overrideDisabled != null) {
                    needsDestroyAndCreate = true;
                }
                delete this.filters[filterIndex].overrideParams;
                delete this.filters[filterIndex].overrideDisabled;
            }
        }

        if (!this.material) return;

        this.disposeOverrideFilterParamTextures();

        const { defines, uniforms, textures } = createLayerShaderUniformsAndDefines(
            this.sourceTexture?.width ?? 1,
            this.sourceTexture?.height ?? 1,
            this.filters,
        );
        this.overrideFilterParamTextures = textures;

        for (const defineName in defines) {
            if (this.material.defines[defineName] !== defines[defineName]) {
                this.material.defines[defineName] = defines[defineName];
                needsDestroyAndCreate = true;
            }
        }
        for (const uniformName in uniforms) {
            this.material.uniforms[uniformName] = uniforms[uniformName];
        }
        this.material.uniformsNeedUpdate = true;

        if (needsDestroyAndCreate) {
            this.scheduleMaterialUpdate('destroyAndCreate');
        }

        markRenderDirty();
    }

    disposeOverrideFilterParamTextures() {
        for (const texture of this.overrideFilterParamTextures) {
            texture.dispose();
        }
        this.overrideFilterParamTextures = [];
    }

    overrideVisibility(visible?: boolean) {
        this.visibleOverride = visible;
        this.updateVisible(this.visible);
    }

    readBufferTextureUpdate(texture?: Texture) {
        if (!this.material?.uniforms?.dstTexture) return;
        this.material.uniforms.dstTexture.value = texture;
        this.material.uniformsNeedUpdate = true;
    }
    
    detach() {
        const backend = getWebgl2RendererBackend();
        backend.removeMeshController(this.id);

        messageBus.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;

        this.plane && this.scene?.remove(this.plane);
        this.plane = undefined;

        this.disposeSvgMeshes();

        if (this.material) {
            disposeRasterMaterial(this.material);
            this.material = undefined;
        }

        this.disposeSourceTexture();

        this.scene = undefined;
    }

    disposeSourceTexture() {
        if (this.sourceTexture) {
            if (this.sourceTexture.userData.shouldDisposeBitmap) {
                this.sourceTexture.image?.close();
            }
            this.sourceTexture.dispose();
            this.sourceTexture = undefined;
        }
    }

}

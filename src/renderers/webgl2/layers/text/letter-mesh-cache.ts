import { mergeGeometries } from '@/renderers/webgl2/geometries/buffer-geometry-utils';

import { BackSide } from 'three/src/constants';
import { Euler } from 'three/src/math/Euler';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Path } from 'three/src/extras/core/Path';
import { Quaternion } from 'three/src/math/Quaternion';
import { Shape } from 'three/src/extras/core/Shape';
import { ShapeGeometry } from 'three/src/geometries/ShapeGeometry';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';

import { updateTextMaterial } from './material';

import { Clipper, PathPoint } from '@/lib/clipper';

import type { BufferGeometry, Material, Object3D, ShaderMaterial } from 'three';
import type { Glyph } from '@/lib/opentype';

interface GeometryMaterialGroup {
    fill: string;
    glyphGroups: Map<string, GlyphGroup>;
    material?: ShaderMaterial;
    mergedGeometry?: BufferGeometry;
    mergedGeometryKey?: MergedGeometryKey;
    mergedMesh?: Mesh;
}

interface GlyphGroup {
    glyph: Glyph;
    fontName: string;
    instances: GlyphGroupInstance[];
}

interface GlyphGroupInstance {
    x: number;
    y: number;
    fontSize: number;
    line: number;
    character: number;
}

interface StagedGlyph {
    glyph: Glyph;
    fontName: string;
    line: number;
    character: number;
    x: number;
    y: number;
    fontSize: number;
    fill: string;
}

type MergedGeometryKey = Array<number | string>;

interface GeometryToMerge {
    geometry: BufferGeometry;
    x: number;
    y: number;
    fontSize: number;
}

export class LetterMeshCache {

    parent: Object3D;

    material: ShaderMaterial | undefined;

    glyphGeometries: Map<string, BufferGeometry> = new Map();

    geometryMaterialGroups: Map<string, GeometryMaterialGroup> = new Map();

    stagedGlyphs: Map<number, StagedGlyph> = new Map();

    constructor(parent: Object3D) {
        this.parent = parent;
    }
    
    setMaterial(material: ShaderMaterial) {
        this.material = material;

        for (const materialGroup of this.geometryMaterialGroups.values()) {
            materialGroup.material?.dispose();
            materialGroup.material = this.material.clone();
            updateTextMaterial(materialGroup.material, { fill: materialGroup.fill });
            if (materialGroup.mergedMesh) {
                materialGroup.mergedMesh.material = materialGroup.material;
            }
        }
    }

    createGlyphGeometryKey(
        glyph: Glyph,
        fontName: string,
    ) {
        return fontName + ',' + glyph.unicodes.join(',');
    }

    createGeometryMaterialGroupKey(
        fill: string,
    ) {
        return fill;
    }

    createGlyphGroupKey(
        glyph: Glyph,
        fontName: string,
    ) {
        return fontName + ',' + glyph.unicodes.join(',');
    }

    addLetter(
        glyph: Glyph,
        fontName: string,
        line: number,
        character: number,
        x: number,
        y: number,
        fontSize: number,
        fill: string,
    ) {
        this.stagedGlyphs.set(line * 10000 + character, {
            glyph,
            fontName,
            line,
            character,
            x,
            y,
            fontSize,
            fill,
        })
    }

    createLetterGeometry(
        glyph: Glyph,
        fontName: string,
    ) {
        const commands = glyph.getPath(0, 0, 1000, {}).commands;
        let currentPath: Path | null = null;

        const paths: Array<{
            points: PathPoint[],
            clockwise: boolean,
            bounds: ReturnType<typeof Clipper.GetBounds>,
            holes: Array<Path>
        }> = [];

        // Translate path commands to segmented polygon paths
        for (const command of commands) {
            if (command.type === 'M' || command.type === 'Z') {
                if (currentPath != null) {
                    const points = currentPath.getPoints().map((vector) => ({ X: vector.x, Y: vector.y }));
                    paths.push({
                        points,
                        clockwise: Clipper.Orientation(points),
                        bounds: Clipper.GetBounds([points]),
                        holes: [],
                    });
                }
            }
            if (command.type === 'M') {
                currentPath = new Path();
                currentPath?.moveTo(command.x, command.y);
            } else if (command.type === 'L') {
                currentPath?.lineTo(command.x, command.y);
            } else if (command.type === 'Q') {
                currentPath?.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
            } else if (command.type === 'C') {
                currentPath?.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
            } else if (command.type === 'Z') {
                currentPath?.closePath();
            }
        }
        if (currentPath != null) {
            const points = currentPath.getPoints().map((vector) => ({ X: vector.x, Y: vector.y }));
            paths.push({
                points,
                clockwise: Clipper.Orientation(points),
                bounds: Clipper.GetBounds([points]),
                holes: [],
            });
        }

        // Find holes
        for (let i = paths.length - 1; i >= 0; i--) {
            parentPathCheck:
            for (let j = 0; j < paths.length; j++) {
                if (i === j) continue;
                if (paths[i].clockwise === paths[j].clockwise) continue;
                if (!(
                    paths[i].bounds.left >= paths[j].bounds.left
                    && paths[i].bounds.right <= paths[j].bounds.right
                    && paths[i].bounds.top >= paths[j].bounds.top
                    && paths[i].bounds.bottom <= paths[j].bounds.bottom
                )) continue;
                const checkPointCount = Math.min(10, paths[i].points.length);
                for (let p = 0; p < checkPointCount; p++) {
                    const pi = Math.floor((p / checkPointCount) * paths[i].points.length);
                    if (!Clipper.PointInPolygon(paths[i].points[pi], paths[j].points)) continue parentPathCheck;
                }
                paths[j].holes.push(
                    new Path().setFromPoints(paths[i].points.map((point) => new Vector2(point.X, point.Y)))
                );
                paths.splice(i, 1);
                break;
            }
        }

        // Generate a shape based on polygons and holes
        const shapeGeometries: ShapeGeometry[] = [];
        for (const path of paths) {
            const shape = new Shape();
            shape.setFromPoints(
                path.points.map((point) => new Vector2(point.X, point.Y))
            );
            for (const hole of path.holes) {
                shape.holes.push(hole);
            }
            shapeGeometries.push(new ShapeGeometry(shape));
        }

        // Merge all the shape geometries together for the glyph
        const geometry = shapeGeometries.length == 0
            ? shapeGeometries[0]
            : mergeGeometries(shapeGeometries);
        if (!geometry || shapeGeometries.length > 1) {
            for (const geometry of shapeGeometries) {
                geometry.dispose();
            }
        }
        
        if (geometry) {
            const geometryKey = this.createGlyphGeometryKey(glyph, fontName);
            this.glyphGeometries.set(geometryKey, geometry);
        }

        return geometry;
    }

    getGeometryMaterialGroup(
        fill: string,
    ) {
        const materialGroupKey = this.createGeometryMaterialGroupKey(fill);
        let materialGroup = this.geometryMaterialGroups.get(materialGroupKey);
        if (materialGroup) return materialGroup;

        materialGroup = {
            glyphGroups: new Map(),
            mergedGeometry: undefined,
            fill,
        };
        this.geometryMaterialGroups.set(materialGroupKey, materialGroup);
        return materialGroup;
    }

    getGlyphGroup(
        materialGroup: GeometryMaterialGroup,
        glyph: Glyph,
        fontName: string,
    ) {
        const glyphGroupInstanceKey = this.createGlyphGroupKey(glyph, fontName);
        let glyphGroup = materialGroup.glyphGroups.get(glyphGroupInstanceKey);
        if (glyphGroup) return glyphGroup;

        glyphGroup = {
            glyph,
            fontName,
            instances: [],
        };
        materialGroup.glyphGroups.set(glyphGroupInstanceKey, glyphGroup);
        return glyphGroup;
    }

    mergedGeometryKeyIsEqual(key1?: MergedGeometryKey, key2?: MergedGeometryKey) {
        if (key1 == null || key2 == null) return false;
        if (key1.length !== key2.length) return false;
        for (let i = 0; i < key1.length; i++) {
            if (key1[i] !== key2[i]) return false;
        }
        return true;
    }

    updateGlyphGroupInstance(
        glyphGroupInstances: GlyphGroupInstance[],
        x: number,
        y: number,
        fontSize: number,
        line: number,
        character: number,
    ) {
        let existingInstance: GlyphGroupInstance | undefined;
        for (const instance of glyphGroupInstances) {
            if (line === instance.line && character === instance.character) {
                existingInstance = instance;
                break;
            }
        }
        if (existingInstance) {
            if (existingInstance.x !== x || existingInstance.y !== y || existingInstance.fontSize != fontSize) {
                existingInstance.x = x;
                existingInstance.y = y;
                existingInstance.fontSize = fontSize;
            }
        } else {
            glyphGroupInstances.push({
                x,
                y,
                fontSize,
                line,
                character,
            });
        }
    }

    finalize() {
        // Add new glyphs
        for (const stagedGlyph of this.stagedGlyphs.values()) {
            const { glyph, fontName, fill, x, y, fontSize, line, character } = stagedGlyph;

            const materialGroup = this.getGeometryMaterialGroup(fill);
            const glyphGroup = this.getGlyphGroup(materialGroup, glyph, fontName);
            this.updateGlyphGroupInstance(glyphGroup.instances, x, y, fontSize, line, character);
        }

        // Re-generate geometries and remove old glyphs
        const discardedMaterialGroupKeys: string[] = [];
        for (const [materialGroupKey, materialGroup] of this.geometryMaterialGroups.entries()) {
            let isMaterialGroupUsed = false;

            let mergedGeometryKey: Array<string | number> = [];
            let geometriesToMerge: GeometryToMerge[] = [];

            const discardedGlyphGroupKeys: string[] = [];
            for (const [glyphGroupKey, glyphGroup] of materialGroup.glyphGroups.entries()) {
                let isGlyphGroupUsed = false;

                for (let i = glyphGroup.instances.length - 1; i >= 0; i--) {
                    const glyphInstance = glyphGroup.instances[i];

                    const expectedGlyph = this.stagedGlyphs.get(glyphInstance.line * 10000 + glyphInstance.character);
                    if (
                        expectedGlyph?.glyph !== glyphGroup.glyph
                        || expectedGlyph?.fontName !== glyphGroup.fontName
                        || expectedGlyph?.fill !== materialGroup.fill
                    ) {
                        glyphGroup.instances.splice(i, 1);
                        continue;
                    }

                    // At this point we know we're using this glyph, so fetch its geometry and add it to
                    // the list of geometries for this specific material to be merged together.

                    isMaterialGroupUsed = true;
                    isGlyphGroupUsed = true;

                    const geometryKey = this.createGlyphGeometryKey(glyphGroup.glyph, glyphGroup.fontName);
                    let geometry = this.glyphGeometries.get(geometryKey) ?? this.createLetterGeometry(
                        glyphGroup.glyph, glyphGroup.fontName,
                    );
                    if (!geometry) continue;

                    mergedGeometryKey.push(glyphGroup.glyph.index);
                    mergedGeometryKey.push(glyphGroup.fontName);
                    mergedGeometryKey.push(glyphInstance.x);
                    mergedGeometryKey.push(glyphInstance.y);
                    mergedGeometryKey.push(glyphInstance.fontSize);

                    geometriesToMerge.push({
                        geometry,
                        x: glyphInstance.x,
                        y: glyphInstance.y,
                        fontSize: glyphInstance.fontSize,
                    });
                }

                if (!isGlyphGroupUsed) {
                    discardedGlyphGroupKeys.push(glyphGroupKey);
                }
            }
            for (const key of discardedGlyphGroupKeys) {
                materialGroup.glyphGroups.delete(key);
            }

            // Create a new merged geometry for letters that don't repeat enough.
            if (!this.mergedGeometryKeyIsEqual(mergedGeometryKey, materialGroup.mergedGeometryKey)) {
                if (materialGroup.mergedMesh) {
                    this.parent.remove(materialGroup.mergedMesh);
                }
                materialGroup.mergedGeometry?.dispose();
                materialGroup.mergedGeometryKey = mergedGeometryKey;

                if (geometriesToMerge.length > 0) {
                    const geometries: BufferGeometry[] = [];
                    for (const geometry of geometriesToMerge) {
                        const matrix = new Matrix4();
                        matrix.compose(
                            new Vector3(geometry.x, geometry.y, 0),
                            new Quaternion().setFromEuler(new Euler(0, 0, 0)),
                            new Vector3(geometry.fontSize * 0.001, geometry.fontSize * 0.001, geometry.fontSize * 0.001)
                        );
                        geometries.push(geometry.geometry.clone().applyMatrix4(matrix));
                    }
    
                    // Generate the merged geometry and mesh; add to scene
                    materialGroup.mergedGeometry = mergeGeometries(geometries) ?? undefined;
                    if (materialGroup.mergedGeometry) {
                        if (materialGroup.mergedMesh) {
                            materialGroup.mergedMesh.geometry = materialGroup.mergedGeometry;
                        } else {
                            materialGroup.mergedMesh = new Mesh(materialGroup.mergedGeometry, materialGroup.material);
                        }
                        this.parent.add(materialGroup.mergedMesh);
                    }

                    // Update the material of the merged mesh
                    if (!materialGroup.material) {
                        materialGroup.material = this.material?.clone();
                        if (materialGroup.material) {
                            updateTextMaterial(materialGroup.material, { fill: materialGroup.fill });
                            if (materialGroup.mergedMesh) {
                                materialGroup.mergedMesh.material = materialGroup.material;
                            }
                        }
                    }
                }
            }

            if (!isMaterialGroupUsed) {
                if (materialGroup.mergedMesh) {
                    this.parent.remove(materialGroup.mergedMesh);
                }
                materialGroup.mergedGeometry?.dispose();
                materialGroup.mergedGeometry = undefined;
                materialGroup.material?.dispose();
                materialGroup.material = undefined;
                discardedMaterialGroupKeys.push(materialGroupKey);
            }
        }
        for (const key of discardedMaterialGroupKeys) {
            this.geometryMaterialGroups.delete(key);
        }

        this.stagedGlyphs.clear();
    }

    dispose() {
        this.material = undefined; // Reference only; Expected that the mesh controller disposes of this.

        for (const materialGroup of this.geometryMaterialGroups.values()) {
            if (materialGroup.mergedMesh) {
                materialGroup.mergedMesh.geometry?.dispose();
                this.parent.remove(materialGroup.mergedMesh);
            }
            materialGroup.material?.dispose();
            materialGroup.mergedGeometry?.dispose();
            materialGroup.glyphGroups.clear();
        }
        for (const geometry of this.glyphGeometries.values()) {
            geometry.dispose();
        }

        this.geometryMaterialGroups.clear();
        this.glyphGeometries.clear();
    }
}

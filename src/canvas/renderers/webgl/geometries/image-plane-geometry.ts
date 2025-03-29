import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute';

class ImagePlaneGeometry extends BufferGeometry {
    parameters!: { width: number, height: number };

    geometryType = 'ImagePlaneGeometry';

    constructor( width = 1, height = 1) {
        super();

        this.parameters = {
            width: width,
            height: height
        };

        const indices: number[] = [];
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        for (let iy = 0; iy < 2; iy++) {
            const y = iy * height;
            for (let ix = 0; ix < 2; ix++) {
                const x = ix * width;
                vertices.push(x, y, 0);
                normals.push(0, 0, 1);
                uvs.push(ix);
                uvs.push(1 - iy);
            }
        }

        for (let iy = 0; iy < 1; iy++) {
            for (let ix = 0; ix < 1; ix ++) {
                const a = ix + 2 * iy;
                const b = ix + 2 * (iy + 1);
                const c = (ix + 1) + 2 * (iy + 1);
                const d = (ix + 1) + 2 * iy;
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        this.setIndex(indices);
        this.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
        this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));

        this.computeTangents();
    }

    static fromJSON(data: { width: number, height: number }) {
        return new ImagePlaneGeometry(data.width, data.height);
    }
}

export { ImagePlaneGeometry, ImagePlaneGeometry as ImagePlaneBufferGeometry };
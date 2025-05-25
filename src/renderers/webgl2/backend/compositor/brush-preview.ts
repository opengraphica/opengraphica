import { ClampToEdgeWrapping, RGBAFormat, SRGBColorSpace, NearestFilter } from 'three/src/constants';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Vector4 } from 'three/src/math/Vector4';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import { BrushStroke } from './brush-stroke';

import type { RendererBrushStrokePreviewsettings } from '@/types';
import type { WebGLRenderer } from 'three';

export class BrushPreview {
    renderer: WebGLRenderer;
    renderTarget!: WebGLRenderTarget;

    p0x = 10; p0y = 32;
    p1x = 64; p1y = 32 + 48;
    p2x = 256 - 64; p2y = 32 - 48;
    p3x = 256 - 10; p3y = 32;
    t0!: number; t1!: number; t2!: number; t3!: number;
    lut!: Float32Array;
    length!: number;

    constructor(renderer: WebGLRenderer) {
        this.renderer = renderer;

        this.renderTarget = new WebGLRenderTarget(256, 64, {
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            depthBuffer: false,
            colorSpace: SRGBColorSpace,
            stencilBuffer: false,
            generateMipmaps: false,
        });
        this.lut = new Float32Array(64 * 2);
        this.makeLUT();
    }

    cubicBezierAt(p0: number, p1: number, p2: number, p3: number, t: number) {
        const q0 = Math.pow(1.0 - t, 3.0) * p0;
        const q1 = 3.0 * Math.pow(1.0 - t, 2.0) * t * p1;
        const q2 = 3.0 * (1.0 - t) * Math.pow(t, 2.0) * p2;
        const q3 = Math.pow(t, 3.0) * p3;
        return q0 + q1 + q2 + q3;
    }

    cubicBezierX(t: number) {
        return this.cubicBezierAt(this.p0x, this.p1x, this.p2x, this.p3x, t);
    }

    cubicBezierY(t: number) {
        return this.cubicBezierAt(this.p0y, this.p1y, this.p2y, this.p3y, t);
    }

    distance(ax: number, ay: number, bx: number, by: number) {
        const dx = ax - bx, dy = ay - by;
        return Math.hypot(dx, dy);
    }

    getT(tPrev: number, x0: number, y0: number, x1: number, y1: number) {
        return tPrev + Math.sqrt(this.distance(x0, y0, x1, y1));
    }

    makeLUT() {
        const steps = 64;
        let length = 0;

        let t = 0;
        this.t0 = 0;
        this.t1 = this.getT(this.t0, this.p0x, this.p0y, this.p1x, this.p1y);
        this.t2 = this.getT(this.t1, this.p1x, this.p1y, this.p2x, this.p2y);
        this.t3 = this.getT(this.t2, this.p2x, this.p2y, this.p3x, this.p3y);

        let prevX = this.cubicBezierX(t);
        let prevY = this.cubicBezierY(t);
        this.lut[0] = 0;
        this.lut[1] = 0;

        let x: number;
        let y: number;
        for (let i = 1; i <= steps; i++) {
            t = i / steps;
            x = this.cubicBezierX(t);
            y = this.cubicBezierY(t);
            length += this.distance(prevX, prevY, x, y);
            this.lut[i * 2] = t;
            this.lut[i * 2 + 1] = length;
            prevX = x;
            prevY = y;
        }

        this.length = length;
    }

    getTAtLength(targetLength: number): number {
        if (targetLength <= 0) return 0;
        if (targetLength >= this.length) return 1;

        let low = 0, high = (this.lut.length / 2) - 2;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midLen = this.lut[mid * 2 + 1];

            if (midLen < targetLength) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const aT = this.lut[high * 2];
        const aLength = this.lut[high * 2 + 1];
        const bT = this.lut[low * 2];
        const bLength = this.lut[low * 2 + 1];
        const ratio = (targetLength - aLength) / (bLength - aLength);
        return aT + (bT - aT) * ratio;
    }

    async generate(originalViewport: Vector4, settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap> {

        const brushStroke = new BrushStroke(
            this.renderer,
            originalViewport,
            this.renderTarget.texture,
            new Matrix4(),
            {
                layerId: -1,
                color: settings.color,
                size: settings.size,
                hardness: settings.hardness,
                colorBlendingPersistence: settings.colorBlendingPersistence,
            },
        );

        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.setRenderTarget(null);

        let distance = 0;
        let t: number;
        let tt: number;
        let pressure: number;
        let size: number;
        let step: number;
        let x: number;
        let y: number;
        let density: number;
        let colorBlendingStrength: number;
        let concentration: number;
        while (distance < this.length) {
            t = this.getTAtLength(distance);
            
            pressure = 1;
            if (t < 0.4) {
                pressure = t / 0.4;
            } else if (t > 0.6) {
                pressure = (1 - t) / 0.4;
            }
            
            size = settings.size * (settings.pressureMinSize + (1.0 - settings.pressureMinSize) * pressure);
            density = settings.pressureMinDensity + (settings.density - settings.pressureMinDensity) * pressure;
            colorBlendingStrength = settings.pressureMinColorBlendingStrength + (settings.colorBlendingStrength - settings.pressureMinColorBlendingStrength) * (1 - pressure);
            concentration = settings.pressureMinConcentration + (settings.concentration - settings.pressureMinConcentration) * pressure;

            step = Math.max(1, size * settings.spacing);

            x = this.cubicBezierX(t);
            y = this.cubicBezierY(t);
            x += ((Math.random() * 2) - 1) * settings.jitter * size;
            y += ((Math.random() * 2) - 1) * settings.jitter * size;

            brushStroke.move(x, y, size, density, colorBlendingStrength, concentration);

            distance += step;
        }

        brushStroke.composite();

        const buffer = new Uint8Array(this.renderTarget.width * this.renderTarget.height * 4);
        this.renderer.readRenderTargetPixels(this.renderTarget, 0, 0, this.renderTarget.width, this.renderTarget.height, buffer);

        brushStroke.dispose();

        return await createImageBitmap(
            new ImageData(new Uint8ClampedArray(buffer), this.renderTarget.width, this.renderTarget.height),
            { imageOrientation: 'flipY' },
        );
    }
}

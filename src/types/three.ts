import type { Matrix3, ShapePath, Vector2, Vector3 } from 'three';

declare module 'three' {
    export interface WebGLRenderer {
        context: WebGLRenderingContext | WebGL2RenderingContext;
    }

    export interface WebGLCapabilitiesParameters {
        desynchronized?: boolean;
    }

    export interface Curve<TVector extends Vector2 | Vector3> {
        isArcCurve?: boolean;
        isCubicBezierCurve?: boolean;
        isEllipseCurve?: boolean;
        isLineCurve?: boolean;
        isQuadraticBezierCurve?: boolean;
        isSplineCurve?: boolean;
        v0: TVector;
        v1: TVector;
        v2: TVector;
        v3: TVector;
        aX: number;
        aY: number;
        xRadius: number;
        yRadius: number;
        aEndAngle: number;
        aStartAngle: number;
        aClockwise: boolean;
        aRotation: number;
        points: Vector2[];
    }

    export interface SvgParsedStyle {
        fill: string;
        fillOpacity: number;
        stroke: string;
        strokeLineCap: 'round' | 'square' | 'butt';
        strokeLineJoin: 'round' | 'bevel' | 'miter' | 'miter-clip';
        strokeMiterLimit: number;
        strokeOpacity: number;
        strokeWidth: number;
    }

    export interface SvgParsedGradientStop {
        offset: number;
        color: string;
        opacity: number;
    }

    export interface SvgParsedGradient {
        type: 'radialGradient' | 'linearGradient';
        attrs: Record<string, string>;
        stops: SvgParsedGradientStop[] | null;
        href: string | null;
    }

    export interface SvgShapePath extends Omit<ShapePath, 'userData'> {
        userData: {
            node: Element;
            style: SvgParsedStyle;
            transform: Matrix3;
            gradients: Record<string, SvgParsedGradient>;
        };
    }
}

export {};
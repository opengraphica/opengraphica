import type { WebGLRenderer } from 'three';

declare module 'three' {
    export interface WebGLRenderer {
        context: WebGLRenderingContext | WebGL2RenderingContext;
    }
}

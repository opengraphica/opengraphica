import { Matrix4 } from 'three/src/math/Matrix4';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

/**
 * @module OutputShader
 * @three_import import { OutputShader } from 'three/addons/shaders/OutputShader.js';
 */

/**
 * Performs tone mapping and color space conversion for
 * FX workflows.
 *
 * Used by {@link OutputPass}.
 *
 * @constant
 * @type {ShaderMaterial~Shader}
 */
const OutputShader = {

    name: 'OutputShader',

    defines: {

        cTransparencyEnabled: 0,
        cImageBoundaryEnabled: 1,

    },

    uniforms: {

        tDiffuse: { value: null },
        toneMappingExposure: { value: 1 },
        backgroundColor: { value: null },
        transparencyGridMap: { value: null },
        backgroundTileSizeOpacityDimensions: { value: new Vector4(16, 1, 1, 1) },
        imageDimensions: { value: new Vector2() },
        backgroundInverseViewProjection: { value: new Matrix4() },
        backgroundWorldToLocal: { value: new Matrix4() },

    },

    vertexShader: /* glsl */`
        precision highp float;

        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;

        attribute vec3 position;
        attribute vec2 uv;

        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`
        precision highp float;

        uniform sampler2D tDiffuse;

        uniform vec4 backgroundColor;
        uniform sampler2D transparencyGridMap;
        uniform vec4 backgroundTileSizeOpacityDimensions;
        uniform vec2 imageDimensions;
        uniform mat4 backgroundInverseViewProjection;
        uniform mat4 backgroundWorldToLocal;

        #include <tonemapping_pars_fragment>
        #include <colorspace_pars_fragment>

        const float TRANSPARENCY_EPSILON = 1.0 / 255.0;

        varying vec2 vUv;

        void main() {

            gl_FragColor = texture2D( tDiffuse, vUv );

            // tone mapping

            #ifdef LINEAR_TONE_MAPPING

                gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

            #elif defined( REINHARD_TONE_MAPPING )

                gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

            #elif defined( CINEON_TONE_MAPPING )

                gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

            #elif defined( ACES_FILMIC_TONE_MAPPING )

                gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

            #elif defined( AGX_TONE_MAPPING )

                gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

            #elif defined( NEUTRAL_TONE_MAPPING )

                gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

            #elif defined( CUSTOM_TONE_MAPPING )

                gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

            #endif

            // background color

            vec4 background = vec4(0.0);
            float backgroundOpacity = backgroundTileSizeOpacityDimensions.y;
            #if cTransparencyEnabled == 1
                vec2 uvPerScreenX = vec2(1.0 / imageDimensions.x, 0.0);
                vec2 uvPerScreenY = vec2(0.0, 1.0 / imageDimensions.y);

                mat2 uvFromScreen = mat2(
                    uvPerScreenX,
                    uvPerScreenY
                );

                float screenUvDet = uvFromScreen[0][0] * uvFromScreen[1][1] - uvFromScreen[1][0] * uvFromScreen[0][1];
                mat2 screenFromUv = mat2(
                    uvFromScreen[1][1], -uvFromScreen[0][1],
                    -uvFromScreen[1][0],  uvFromScreen[0][0]
                ) / screenUvDet;

                vec2 screenAxisU = normalize(screenFromUv[0]);
                vec2 screenAxisV = normalize(screenFromUv[1]);
                vec2 screenOffset = screenFromUv * vUv;

                vec2 gridPixelPosition = vec2(
                    dot(screenOffset, screenAxisU),
                    dot(screenOffset, screenAxisV)
                );

                vec2 gridUv = gridPixelPosition / backgroundTileSizeOpacityDimensions.x;
                vec2 wrappedGridUv = fract(gridUv);
                vec2 gridUvDx = vec2(1.0 / imageDimensions.x, 0.0);
                vec2 gridUvDy = vec2(0.0, 1.0 / imageDimensions.y);

                vec3 transparencyGridColor = texture2D(transparencyGridMap, wrappedGridUv).rgb;

                background = vec4(
                    (
                        (transparencyGridColor * (1.0 - backgroundColor.a))
                        + (backgroundColor.rgb * backgroundColor.a)
                    ) * step(TRANSPARENCY_EPSILON, backgroundOpacity),
                    backgroundOpacity
                );
            #else
                background = vec4(
                    backgroundColor.rgb * backgroundColor.a * step(TRANSPARENCY_EPSILON, backgroundOpacity),
                    backgroundColor.a * backgroundOpacity
                );
            #endif

            gl_FragColor = vec4(
                gl_FragColor.rgb + background.rgb * (1.0 - gl_FragColor.a), 
                gl_FragColor.a + background.a * (1.0 - gl_FragColor.a)
            );

            // image boundary clipping

            #if cImageBoundaryEnabled == 1
                vec2 backgroundDimensions = backgroundTileSizeOpacityDimensions.zw;
                vec2 ndc = vUv * 2.0 - 1.0;
                vec4 nearH = backgroundInverseViewProjection * vec4(ndc, -1.0, 1.0);
                vec4 farH = backgroundInverseViewProjection * vec4(ndc, 1.0, 1.0);
                vec3 rayOrigin = nearH.xyz / nearH.w;
                vec3 rayDir = farH.xyz / farH.w - rayOrigin;
                vec3 localOrigin = (backgroundWorldToLocal * vec4(rayOrigin, 1.0)).xyz;
                vec3 localDir = (backgroundWorldToLocal * vec4(rayDir, 0.0)).xyz;
                float t = -localOrigin.z / localDir.z;
                vec2 hit = (localOrigin + t * localDir).xy;

                float mask =
                    step(0.0, t) *
                    step(0.0, hit.x) *
                    step(hit.x, backgroundDimensions.x) *
                    step(0.0, hit.y) *
                    step(hit.y, backgroundDimensions.y);
                gl_FragColor.a *= mask;
            #endif

            // color space

            #ifdef SRGB_TRANSFER

                gl_FragColor = sRGBTransferOETF( gl_FragColor );

            #endif

        }`

};

export { OutputShader };

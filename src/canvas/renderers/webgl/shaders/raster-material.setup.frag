#define RASTER_COLOR_SPACE_CONVERSION_NONE 0
#define RASTER_COLOR_SPACE_CONVERSION_SRGB_TO_LINEAR_SRGB 1

uniform sampler2D srcTexture;
uniform sampler2D dstTexture;

varying vec2 vUv;
varying vec2 vScreenUv;

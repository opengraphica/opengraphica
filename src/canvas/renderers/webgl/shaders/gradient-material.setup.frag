#define GRADIENT_COLOR_SPACE_OKLAB 0
#define GRADIENT_COLOR_SPACE_SRGB 1
#define GRADIENT_COLOR_SPACE_LINEAR_SRGB 2

#define GRADIENT_FILL_TYPE_LINEAR 0
#define GRADIENT_FILL_TYPE_RADIAL 1

#define GRADIENT_SPREAD_METHOD_PAD 0
#define GRADIENT_SPREAD_METHOD_REPEAT 1
#define GRADIENT_SPREAD_METHOD_REFLECT 2
#define GRADIENT_SPREAD_METHOD_TRUNCATE 3

uniform sampler2D gradientMap;
uniform vec2 start;
uniform vec2 end;
uniform vec2 focus;
uniform sampler2D dstTexture;

varying vec2 vUv;
varying vec2 vScreenUv;
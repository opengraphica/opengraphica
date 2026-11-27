uniform float pXOffset;
uniform float pYOffset;
uniform float pBlurRadius;
uniform float pGrowRadius;
uniform vec4 pColor;

void processDropShadow(inout vec4 position, inout vec2 uv) {
    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));

    vec2 topLeftOffset = vec2(
        min(-pBlurRadius - pGrowRadius + pXOffset, 0.0),
        min(-pBlurRadius - pGrowRadius + pYOffset, 0.0)
    );
    vec2 bottomRightOffset = vec2(
        max(pBlurRadius + pGrowRadius + pXOffset, 0.0),
        max(pBlurRadius + pGrowRadius + pYOffset, 0.0)
    );
    vec2 scale = (layerResolution + bottomRightOffset - topLeftOffset) / layerResolution;

    position.xy *= scale;
    position.xy += topLeftOffset;

    uv *= scale;
    uv += (vec2(topLeftOffset.x, min(0.0, -pBlurRadius -pGrowRadius - pYOffset)) / layerResolution);
}
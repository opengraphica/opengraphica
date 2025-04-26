
vec4 materialMain(vec2 uv) {
    vec2 fragCoord = vec2(uv.x * float(cCanvasWidth), (1.0 - uv.y) * float(cCanvasHeight));

#if cFillType == GRADIENT_FILL_TYPE_LINEAR
    vec2 dt = end - start;
    vec2 pt = fragCoord - start;
    float t = dot(pt, dt) / dot(dt, dt);
#elif cFillType == GRADIENT_FILL_TYPE_RADIAL
    float radius = distance(start, end);
    float startRadius = 0.0;
    float ellipseRatio = 1.0;
    vec2 axis = end - start;
    float l2 = dot(axis, axis);
    vec2 focusProjected = focus;
    if (l2 != 0.0) {
        float d = dot(fragCoord - start, axis) / l2;
        vec2 proj = start + d * axis;
        fragCoord = proj - (proj - fragCoord) * ellipseRatio;
        
        float d2 = dot(focus - start, axis) / l2;
        vec2 proj2 = start + d2 * axis;
        focusProjected = proj2 - (proj2 - focus) * ellipseRatio;
    }
    float gradientLength = 1.0;
    vec2 diff = focusProjected - start;
    vec2 rayDirection = normalize(fragCoord - focusProjected);
    float a = dot(rayDirection, rayDirection);
    float b = 2.0 * dot(rayDirection, diff);
    float c = dot(diff, diff) - radius * radius;
    float disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
        float projectT = (-b + sqrt(abs(disc))) / (2.0 * a);
        vec2 projection = focusProjected + rayDirection * projectT;
        gradientLength = distance(projection, focusProjected);
    }
    float t = (distance(fragCoord, focusProjected) - startRadius) / gradientLength;
#endif // cFillType

#if cSpreadMethod == GRADIENT_SPREAD_METHOD_PAD
    t = clamp(t, 0.0, 1.0);
#elif cSpreadMethod == GRADIENT_SPREAD_METHOD_REPEAT
    t = fract(t);
#elif cSpreadMethod == GRADIENT_SPREAD_METHOD_REFLECT
    bool isMirror = mod(t, 2.0) < 1.0;
    if (isMirror) {
        t = fract(t);
    } else {
        t = (1.0 - fract(t));
    }
#elif cSpreadMethod == GRADIENT_SPREAD_METHOD_TRUNCATE
    if (t > 1.0 || t < 0.0) {
        discard;
    }
#endif // cSpreadMethod

    vec4 color = texture2D(stops, vec2(t, 0.0));

#if cBlendColorSpace == GRADIENT_COLOR_SPACE_SRGB
    color.a = (
        (1.0 - srgbChannelToLinearSrgbChannel(1.0 - color.a)) * mix(1.0, 0.0, float(cAverageBrightness)) +
        (srgbChannelToLinearSrgbChannel(color.a)) * mix(0.0, 1.0, float(cAverageBrightness))
    );
#elif cBlendColorSpace == GRADIENT_COLOR_SPACE_OKLAB
    color.a = (
        (1.0 - (oklabToRgb(vec3(1.0 - color.a, 0.0, 0.0)).r)) * mix(1.0, 0.0, float(cAverageBrightness)) +
        (oklabToRgb(vec3(color.a, 0.0, 0.0)).r) * mix(0.0, 1.0, float(cAverageBrightness))
    );
#endif // cBlendColorSpace

    return color;
}

void main() {
    gl_FragColor = materialMain(vUv);
    
    //[INJECT_FILTERS_HERE]
}

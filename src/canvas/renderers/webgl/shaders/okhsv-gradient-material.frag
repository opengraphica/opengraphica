#define PI 3.14159265358979323846

const int GradientTypeSaturationValue = 0;
const int GradientTypeHue = 1;

uniform float hue;
uniform float verticalBorderPercentage;
uniform float horizontalBorderPercentage;

float cbrt(float x) {
    return sign(x) * pow(abs(x), 1.0 / 3.0);
}

struct RGB { float r; float g; float b; };
struct LAB { float L; float a; float b; };

// Finds the maximum saturation possible for a given hue that fits in sRGB
// Saturation here is defined as S = C/L
// a and b must be normalized so a^2 + b^2 == 1
float compute_max_saturation(float a, float b) {
    // Max saturation will be when one of r, g or b goes below zero.

    // Select different coefficients depending on which component goes below zero first
    float k0, k1, k2, k3, k4, wl, wm, ws;

    if (-1.88170328 * a - 0.80936493 * b > 1.0) {
        // Red component
        k0 = +1.19086277; k1 = +1.76576728; k2 = +0.59662641; k3 = +0.75515197; k4 = +0.56771245;
        wl = +4.0767416621; wm = -3.3077115913; ws = +0.2309699292;
    } else if (1.81444104 * a - 1.19445276 * b > 1.0) {
        // Green component
        k0 = +0.73956515; k1 = -0.45954404; k2 = +0.08285427; k3 = +0.12541070; k4 = +0.14503204;
        wl = -1.2684380046; wm = +2.6097574011; ws = -0.3413193965;
    } else {
        // Blue component
        k0 = +1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = +0.00692167;
        wl = -0.0041960863; wm = -0.7034186147; ws = +1.7076147010;
    }

    // Approximate max saturation using a polynomial:
    float S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

    // Do one step Halley's method to get closer
    // this gives an error less than 10e6, except for some blue hues where the dS/dh is close to infinite
    // this should be sufficient for most applications, otherwise do two/three steps 

    float k_l = +0.3963377774 * a + 0.2158037573 * b;
    float k_m = -0.1055613458 * a - 0.0638541728 * b;
    float k_s = -0.0894841775 * a - 1.2914855480 * b;

    {
        float l_ = 1.0 + S * k_l;
        float m_ = 1.0 + S * k_m;
        float s_ = 1.0 + S * k_s;

        float l = l_ * l_ * l_;
        float m = m_ * m_ * m_;
        float s = s_ * s_ * s_;

        float l_dS = 3.0 * k_l * l_ * l_;
        float m_dS = 3.0 * k_m * m_ * m_;
        float s_dS = 3.0 * k_s * s_ * s_;

        float l_dS2 = 6.0 * k_l * k_l * l_;
        float m_dS2 = 6.0 * k_m * k_m * m_;
        float s_dS2 = 6.0 * k_s * k_s * s_;

        float f  = wl * l     + wm * m     + ws * s;
        float f1 = wl * l_dS  + wm * m_dS  + ws * s_dS;
        float f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

        S = S - f * f1 / (f1*f1 - 0.5 * f * f2);
    }

    return S;
}

RGB oklab_to_linear_srgb(in LAB lab) {
    float L = pow(
        (lab.L * 0.9999999984505198) + (0.39633779217376786 * lab.a) + (0.2158037580607588 * lab.b),
        3.0
    );
    float M = pow(
        (lab.L * 1.0000000088817608) - (0.10556134232365635 * lab.a) - (0.0638541747717059 * lab.b),
        3.0
    );
    float S = pow(
        (lab.L * 1.0000000546724109) - (0.08948418209496576 * lab.a) - (1.2914855378640917 * lab.b),
        3.0
    );
    return RGB(
        (4.076741661347994 * L) - (3.307711590408193 * M) + (0.230969928729428 * S),
        (-1.2684380040921763 * L) + (2.6097574006633715 * M) - (0.3413193963102197 * S),
        (-0.004196086541837188 * L) - (0.7034186144594493 * M) + (1.7076147009309444 * S)
    );
}

// finds L_cusp and C_cusp for a given hue
// a and b must be normalized so a^2 + b^2 == 1
struct LC { float L; float C; };
LC find_cusp(float a, float b) {
	// First, find the maximum saturation (saturation S = C/L)
	float S_cusp = compute_max_saturation(a, b);

	// Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
	RGB rgb_at_max = oklab_to_linear_srgb(LAB(1.0, S_cusp * a, S_cusp * b));
	float L_cusp = cbrt(1.f / max(max(rgb_at_max.r, rgb_at_max.g), rgb_at_max.b));
	float C_cusp = L_cusp * S_cusp;

	return LC( L_cusp , C_cusp );
}

struct HSV { float h; float s; float v; };
struct HSL { float h; float s; float l; };

// Alternative representation of (L_cusp, C_cusp)
// Encoded so S = C_cusp/L_cusp and T = C_cusp/(1-L_cusp) 
// The maximum value for C in the triangle is then found as fmin(S*L, T*(1-L)), for a given L
struct ST { float S; float T; };

// toe function for L_r
float toe(float x) {
	const float k_1 = 0.206f;
	const float k_2 = 0.03f;
	const float k_3 = (1.f + k_1) / (1.f + k_2);
	return 0.5f * (k_3 * x - k_1 + sqrt((k_3 * x - k_1) * (k_3 * x - k_1) + 4.f * k_2 * k_3 * x));
}

// inverse toe function for L_r
float toe_inv(float x) {
	const float k_1 = 0.206f;
	const float k_2 = 0.03f;
	const float k_3 = (1.f + k_1) / (1.f + k_2);
	return (x * x + k_1 * x) / (k_3 * (x + k_2));
}

ST to_ST(LC cusp) {
	float L = cusp.L;
	float C = cusp.C;
	return ST( C / L, C / (1.0 - L) );
}

RGB okhsv_to_srgb(HSV hsv) {
	float h = hsv.h;
	float s = hsv.s;
	float v = hsv.v;

	float a_ = cos(2.f * PI * h);
	float b_ = sin(2.f * PI * h);
	
	LC cusp = find_cusp(a_, b_);
	ST ST_max = to_ST(cusp);
	float S_max = ST_max.S;
	float T_max = ST_max.T;
	float S_0 = 0.5f;
	float k = 1.0 - S_0 / S_max;

	// first we compute L and V as if the gamut is a perfect triangle:

	// L, C when v==1:
	float L_v = 1.0 - s * S_0 / (S_0 + T_max - T_max * k * s);
	float C_v = s * T_max * S_0 / (S_0 + T_max - T_max * k * s);

	float L = v * L_v;
	float C = v * C_v;

	// then we compensate for both toe and the curved top part of the triangle:
	float L_vt = toe_inv(L_v);
	float C_vt = C_v * L_vt / L_v;

	float L_new = toe_inv(L);
	C = C * L_new / L;
	L = L_new;

	RGB rgb_scale = oklab_to_linear_srgb(LAB( L_vt, a_ * C_vt, b_ * C_vt ));
	float scale_L = cbrt(1.f / max(max(rgb_scale.r, rgb_scale.g), max(rgb_scale.b, 0.f)));

	L = L * scale_L;
	C = C * scale_L;

	RGB rgb = oklab_to_linear_srgb(LAB( L, C * a_, C * b_ ));
	return rgb;
}

float normalizeHue(float hue) {
    float normalized = 0.0;
    normalized += step(0.0, hue) * hue;
    normalized += step(hue, -0.0000001) * hue + 360.0;
    return normalized;
}

vec3 lchToLab(in vec3 lch) {
    return vec3(
        lch.x,
        lch.y * cos((lch.z / 180.0) * PI),
        lch.y * sin((lch.z / 180.0) * PI)
    );
}

vec3 labToLch(in vec3 lab) {
    float c = sqrt(lab.y * lab.y + lab.z * lab.z);
    return vec3(
        lab.x,
        c,
        normalizeHue((atan(lab.z, lab.y) * 180.0) / PI)
    );
}

varying vec2 vUv;

void main() {
    vec2 sv = vec2(
        clamp((vUv.x * (1.0 + horizontalBorderPercentage * 2.0)) - horizontalBorderPercentage, 0.0, 1.0),
        clamp((vUv.y * (1.0 + verticalBorderPercentage * 2.0)) - verticalBorderPercentage, 0.0, 1.0)
    );

    RGB rgb;
    if (cGradientType == GradientTypeHue) {
        vec3 lch = vec3(0.82, 0.32, sv.x * 360.0);
        vec3 lab = lchToLab(lch);
        rgb = oklab_to_linear_srgb(LAB(lab.x, lab.y, lab.z));
        // rgb = okhsv_to_srgb(HSV( sv.x, 1.0, 1.0 ));
    } else {
        rgb = okhsv_to_srgb(HSV( hue, sv.x, sv.y ));
    }

    gl_FragColor = vec4(rgb.r, rgb.g, rgb.b, 1.0);
    #include <colorspace_fragment>
}


type DimensionUnit = 'px' | 'mm' | 'cm' | 'in';
type ResolutionUnit = 'px/in' | 'px/mm' | 'px/cm';

export function convertUnits(value: number, from: DimensionUnit, to: DimensionUnit, resolution: number, resolutionUnit: ResolutionUnit): number {
    if (from === 'px') {
        if (to === 'mm') {
            if (resolutionUnit !== 'px/mm') {
                if (resolutionUnit === 'px/in') {
                    resolution *= 1 / 25.4;
                }
                if (resolutionUnit === 'px/cm') {
                    resolution *= 1 / 0.1;
                }
            }
            value = value / resolution;
        }
        else if (to === 'cm') {
            if (resolutionUnit !== 'px/cm') {
                if (resolutionUnit === 'px/in') {
                    resolution *= 1 / 2.54;
                }
                if (resolutionUnit === 'px/mm') {
                    resolution *= 1 / 10.0;
                }
            }
            value = value / resolution;
        }
        else if (to === 'in') {
            if (resolutionUnit !== 'px/in') {
                if (resolutionUnit === 'px/cm') {
                    resolution *= 2.54;
                }
                if (resolutionUnit === 'px/mm') {
                    resolution *= 25.4;
                }
            }
            value = value / resolution;
        }
    }
    else if (to === 'px') {
        if (from === 'mm') {
            if (resolutionUnit !== 'px/mm') {
                if (resolutionUnit === 'px/in') {
                    resolution *= 1 / 25.4;
                }
                if (resolutionUnit === 'px/cm') {
                    resolution *= 1 / 0.1;
                }
            }
            value = value * resolution;
        }
        else if (from === 'cm') {
            if (resolutionUnit !== 'px/cm') {
                if (resolutionUnit === 'px/in') {
                    resolution *= 1 / 2.54;
                }
                if (resolutionUnit === 'px/mm') {
                    resolution *= 1 / 10.0;
                }
            }
            value = value * resolution;
        }
        else if (from === 'in') {
            if (resolutionUnit !== 'px/in') {
                if (resolutionUnit === 'px/cm') {
                    resolution *= 2.54;
                }
                if (resolutionUnit === 'px/mm') {
                    resolution *= 25.4;
                }
            }
            value = value * resolution;
        }
    }
    else {
        value = convertUnits(convertUnits(value, from, 'px', resolution, resolutionUnit), 'px', to, resolution, resolutionUnit);
    }
    return value;
}

/**
 * Class for calculating font metrics.
 */
export class FontMetrics {
    static kerningTestCanvas: HTMLCanvasElement | null;
    static kerningTestCtx: CanvasRenderingContext2D | null;

    public fontFamily!: string;
    public pxSize!: number;
    public baseline!: number;
    private kerningMap: Map<any, any> = new Map();
    public testWidth: number = 0;
    public offsetHeight: number = 0;

    constructor(fontFamily: string, fontSize: number) {
        this.fontFamily = fontFamily;
        this.pxSize = fontSize;

        // Preparing container
		const line = document.createElement('div');
		const body = document.body;
		line.style.position = 'absolute';
		line.style.whiteSpace = 'nowrap';
		line.style.font = this.pxSize + 'px ' + fontFamily;
		body.appendChild(line);

		// Now we can measure width and height of the letter
		const text = '——————————'; // 10 symbols to be more accurate with width
		line.innerHTML = text;
		this.testWidth = line.offsetWidth / text.length;
		this.offsetHeight = line.offsetHeight;

		// Now creating 1px sized item that will be aligned to baseline
		// to calculate baseline shift
		const baseline = document.createElement('span');
		baseline.style.display = 'inline-block';
		baseline.style.overflow = 'hidden';
		baseline.style.width = '1px';
		baseline.style.height = '1px';
		line.appendChild(baseline);

        // Baseline is important for positioning text on canvas
		this.baseline = baseline.offsetTop + baseline.offsetHeight;

		document.body.removeChild(line);
    }

    /**
	 * Creates a canvas for kerning testing.
	 */
    private getKerningTestCanvas(): { canvas: HTMLCanvasElement | null, ctx: CanvasRenderingContext2D | null } {
        if (!FontMetrics.kerningTestCanvas) {
            FontMetrics.kerningTestCanvas = document.createElement('canvas');
            FontMetrics.kerningTestCanvas.width = 10;
            FontMetrics.kerningTestCanvas.height = 10;
            FontMetrics.kerningTestCanvas.setAttribute('style', 'font-kerning: normal; text-rendering: optimizeLegibility;');
            try {
                FontMetrics.kerningTestCtx = FontMetrics.kerningTestCanvas.getContext('2d');
            } catch (error) {}
        }
        return {
            canvas: FontMetrics.kerningTestCanvas,
            ctx: FontMetrics.kerningTestCtx
        }
    }

    /**
	 * Attempts to determine the height of a letter via pixel comparison
	 * @param {string} letter - The letter to check
	 * @param {string} [baseline] - Baseline position override
	 */
	public calculateLetterBounds(letter: string, baseline: 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top') {
        const { canvas, ctx } = this.getKerningTestCanvas();
        let start: number = 0;
        let end: number = 0;
        if (canvas && ctx) {
            baseline = baseline || 'alphabetic';
            canvas.width = this.testWidth;
            canvas.height = this.offsetHeight;
            ctx.clearRect(0, 0, this.testWidth, this.offsetHeight);
            ctx.font =
                ' ' + (this.pxSize) + 'px' +
                ' ' + this.fontFamily;
            ctx.textAlign = 'left';
            ctx.textBaseline = baseline;
            ctx.fillStyle = '#000000';
            ctx.fillText(letter, 0, baseline === 'alphabetic' ? this.baseline : 0);
            const pixels = ctx.getImageData(0, 0, this.testWidth, this.offsetHeight).data;
            const pixelLength = pixels.length;
            start = 0;
            end = this.offsetHeight;
            for (let i = 0; i < pixelLength; i += 4) {
                if (pixels[i + 3] !== 0) {
                    start = Math.floor(i / 4 / this.testWidth);
                    break;
                }
            }
            for (let i = pixelLength - 4; i >= 0; i -= 4) {
                if (pixels[i + 3] !== 0) {
                    end = Math.floor(i / 4 / this.testWidth);
                    break;
                }
            }
            canvas.width = 10;
            canvas.height = 10;
        }
		return {
			top: start,
			bottom: end,
			height: end - start
		}
	}

    /**
	 * Calculate the kerning offset between two letters.
	 * @param {string} letters - a two character string of the two letters to determine font kerning from. Returns the kerning offset that should be used to draw the 2nd letter. 
	 * @param {object} flags - font style, such as bold or italic
	 */
	public getKerningOffset(letters: string, flags: { weight?: number, style?: string } = {}) {
		let offset = this.kerningMap.get(letters);
		if (offset == null) {
            const { ctx } = this.getKerningTestCanvas();
            if (ctx) {
                ctx.font =
                    ' ' + (flags.style ? flags.style : 'normal') +
                    ' ' + (flags.weight ? flags.weight : '') +
                    ' ' + (this.pxSize) + 'px' +
                    ' ' + this.fontFamily;
                offset = ctx.measureText(letters).width - (ctx.measureText(letters[0]).width + ctx.measureText(letters[1]).width);
                this.kerningMap.set(letters, offset);
            }
		}
		return offset;
	}
}

const fontMetricsMap = new Map<string, FontMetrics>();

/**
 * Calculates font metrics for the given font name/size and returns it. Caches by default.
 * @param {string} fontFamily - Name of the font loaded on the page to calculate metrics for.
 * @param {number} fontSize - The font size in pixels to calculate metrics for.
 * @param {boolean} noCache - Skip caching if the metrics is expected to change in the future (e.g. font family not loaded yet.) 
 */
export function getFontMetrics(fontFamily: string, fontSize: number, noCache: boolean = false) {
    let fontMetrics = fontMetricsMap.get(fontFamily + '_' + fontSize);
    if (!fontMetrics) {
        fontMetrics = new FontMetrics(fontFamily, fontSize);
        if (!noCache) {
            fontMetricsMap.set(fontFamily + '_' + fontSize, fontMetrics);
        }
    }
    return fontMetrics;
}

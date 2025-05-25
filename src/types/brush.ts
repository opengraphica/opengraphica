export interface BrushCategoryWithBrushes {
    id: string;
    icon: string;
    brushes: BrushDefinition[];
    brushPreviews: Array<HTMLCanvasElement | undefined>;
}

export interface BrushDefinition {
    categories: string[];

    // Brush id used internally to pick a brush
    id: string;

    // Custom name for this brush (if omitted, uses i18n with id)
    name?: string;

    // Hides the brush from the UI
    hidden?: boolean;

    // SVG Path command that defines the brush shape
    shape: string;

    // Sharp edges at 1, fully soft edges at 0
    hardness: number;

    // Percentage of the brush size use for spacing between brush stamps (1 = 100%)
    spacing: number;

    // Percentage of the brush size used to randomly offset the brush stamp in x and y position (1 = 100%)
    jitter: number;

    // Rotation of the brush shape, in radians
    angle: number;

    // Larger values make the pressure more exponentially biased towards zero, making skinnier lines easier to draw. Default is 1.
    pressureTaper: number;

    // Percentage of the brush size (max size) that will be used as the size when the minimum amount of pen pressure is used
    pressureMinSize: number;

    // Opacity of a single brush stamp when the maximum pen pressure is used, or pressure is not available
    density: number;

    // Opacity of a single brush stamp when the minimum pen pressure is used
    pressureMinDensity: number;

    // 0 ignores colors underneath brush, and 1 fully uses color underneath brush
    colorBlendingStrength: number;

    // When pressure is used, this is the minimum color blending strength at 0% pressure
    pressureMinColorBlendingStrength: number;

    // Higher values makes it take longer for colorBlendingStrength to have an effect
    colorBlendingPersistence: number;

    // Controls alpha blending with the underlying image. 1 always draws on top of transparent areas, and 0 never draws
    concentration: number;

    // When pen pressure is used, this is the minimum concentration value at 0% pressure
    pressureMinConcentration: number;
}
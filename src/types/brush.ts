export interface BrushCategoryWithBrushes {
    id: string;
    icon: string;
    brushes: BrushDefinition[];
}

export interface BrushDefinition {
    categories: string[];

    // Brush id used internally to pick a brush
    id: string;

    // Custom name for this brush (if omitted, uses i18n with id)
    name?: string;

    // SVG Path command that defines the brush shape
    shape: string;

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

    // Opacity of a single brush stamp when the minimum pen pressure is used
    pressureMinDensity: number;

    // Opacity of a single brush stamp when the maximum pen pressure is used
    pressureMaxDensity: number;

    // 0 ignores colors underneath brush, and 1 fully uses color underneath brush
    colorBlendingFactor: number;

    // Higher values makes it take longer for colorBlendingFactor to have an effect
    colorBlendingPersistence: number;

    // 0 always draws on top of transparent areas, and 1 never draws
    alphaBlendingFactor: number;
}
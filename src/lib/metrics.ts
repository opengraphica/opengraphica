
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

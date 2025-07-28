
// Older Safari versions implement Float32Array but not Float16Array...
if (!window.Float16Array) {
    if (window.Float32Array) {
        window.Float16Array = window.Float32Array as any;
    } else if (window.Float64Array) {
        window.Float16Array = window.Float64Array as any;
    }
}
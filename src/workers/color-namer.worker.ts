import colorNamer from 'color-namer';

import type { ColorNameRequest, ColorNameResponse } from './color-namer.types';

self.onmessage = ({ data }) => {
    if (data.type === 'COLOR_NAME') {
        nameColor(data);
    }
}

function nameColor(request: ColorNameRequest) {
    let name = '';
    try {
        name = colorNamer(request.hexColor, { pick: ['ntc'] }).ntc[0]?.name;
    } catch (error) {
        // Ignore
    }
    self.postMessage({
        type: 'COLOR_NAME_RESULT',
        uuid: request.uuid,
        name,
    } as ColorNameResponse);
}

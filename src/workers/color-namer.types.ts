export interface ColorNameRequest {
    type: 'COLOR_NAME';
    uuid: string;
    hexColor: string;
}

export interface ColorNameResponse {
    type: 'COLOR_NAME_RESULT';
    uuid: string;
    name: string;
}

export interface FileSystemWritableFileStream extends WritableStream {
    write: (data: any) => Promise<any>;
    seek: (position: number) => Promise<void>;
    truncate: () => Promise<any>;
}

export interface FileSystemHandlePermissionDescriptor {
    mode: 'read' | 'readwrite';
}

export interface FileSystemHandle {
    kind: Readonly<string>;
    name: Readonly<string>;
    isSameEntry: (a: FileSystemHandle, b: FileSystemHandle) => boolean;
    queryPermission: (fileSystemHandlePermissionDescriptor?: FileSystemHandlePermissionDescriptor) => Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission: (fileSystemHandlePermissionDescriptor?: FileSystemHandlePermissionDescriptor) => Promise<'granted' | 'denied' | 'prompt'>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: Readonly<'file'>;
    getFile: () => Promise<File>;
    createWritable: () => Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: Readonly<'directory'>;
    entries: () => Array<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
    getFileHandle: (name: string, options?: { create?: boolean; }) => FileSystemFileHandle;
    getDirectoryHandle: (name: string, options?: { create?: boolean; }) => FileSystemDirectoryHandle;
    keys: () => Array<string>;
    removeEntry: (name: string, options?: { recursive?: boolean; }) => Promise<void>;
    resolve: (possibleDescendant: string) => Promise<string[] | null>;
    values: () => Array<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

export interface ShowOpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
        description: string;
        accept: {
            [key: string]: string[];
        };
    }>;
}

export type ShowOpenFilePicker = (opts?: ShowOpenFilePickerOptions) => Promise<FileSystemHandle[]>;

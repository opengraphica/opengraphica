export interface DndLayoutMenuBar {
    layout: {
        docks: string[];
        tools: string[];
    }
}

export interface DndLayoutDock {
    layout: {
        name: string;
        ratio: number;
        title?: string;
    }[];
}

export type DndLayoutComponent = DndLayoutMenuBar | DndLayoutDock;

export interface DndLayout {
    menuBar: DndLayoutMenuBar;
    dock: DndLayoutDock;
}

export interface ActionGroupControlEventHandler {
    action: string;
    arguments?: any[];
}

export interface MenuBarToolGroupButton {
    id?: string;
    type: 'button';
    icon: string;
    label: string;
    description: string;
    displayTitle?: string;
    expanded?: boolean;
    showDock?: boolean;
    popoverVisible?: boolean;
    action?: {
        type: 'dock' | 'toolGroup' | 'tool' | 'runModule';
        target: string;
    };
    onPrimaryClick?: ActionGroupControlEventHandler;
    onSecondaryClick?: ActionGroupControlEventHandler;
    controls?: MenuBarToolGroupButton[];
}

export interface ToolDefinition {
    controller: string;
    toolbar?: {
        exclusive: boolean;
        position?: 'auto' | 'top' | 'bottom';
        target: string;
    };
    overlays: string[];
    hideDialogs?: boolean;
}

export interface ToolGroupDefinition {
    tools: {
        [key: string]: ToolDefinition;
    }
}

export interface ModuleDefinition {
    action: {
        type: 'ui' | 'function';
        target: string;
    };
    preload?: boolean;
    cancelable?: boolean;
}

export interface ModuleGroupDefinition {
    modules: {
        [key: string]: ModuleDefinition;
    }
}



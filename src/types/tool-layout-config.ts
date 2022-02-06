export interface DndLayoutMenuBar {
    type: 'menuBar';
    actionGroupLayout: {
        start: string[];
        center: string[];
        end: string[];
        favorites: string[];
    }
}

export interface DndLayoutDock {
    type: 'dock';
    dockLayout: string[];
}

export type DndLayoutComponent = DndLayoutMenuBar | DndLayoutDock;

export interface DndLayout {
    header?: DndLayoutMenuBar[];
    footer?: DndLayoutMenuBar[];
    sidebarLeft?: DndLayoutComponent[];
    sidebarRight?: DndLayoutComponent[];
}

export interface ActionGroupControlEventHandler {
    action: string;
    arguments?: any[];
}

export interface LayoutShortcutGroupDefinitionControlButton {
    type: 'button';
    icon: string;
    label: string;
    displayTitle?: string;
    expanded?: boolean;
    showDock?: boolean;
    popoverVisible?: boolean;
    action?: {
        type: 'dock' | 'toolGroup' | 'runModule';
        target: string;
    };
    onPrimaryClick?: ActionGroupControlEventHandler;
    onSecondaryClick?: ActionGroupControlEventHandler;
}

export type LayoutShortcutGroupDefinitionControl = LayoutShortcutGroupDefinitionControlButton;

export interface LayoutShortcutGroupDefinition {
    id?: string;
    name: string;
    draggable: boolean;
    controls: LayoutShortcutGroupDefinitionControl[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    controller: string;
    toolbar?: {
        exclusive: boolean;
        position?: 'top' | 'bottom';
        target: string;
    };
    overlays: string[];
}

export interface ToolGroupDefinition {
    name: string;
    description: string;
    tools: {
        [key: string]: ToolDefinition;
    }
}

export interface ModuleDefinition {
    name: string;
    description: string;
    action: {
        type: 'ui' | 'function';
        target: string;
    };
    preload?: boolean;
    cancelable?: boolean;
}

export interface ModuleGroupDefinition {
    name: string;
    description: string;
    modules: {
        [key: string]: ModuleDefinition;
    }
}



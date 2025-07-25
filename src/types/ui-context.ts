export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface UIContextParams {
  url: string;
  selector?: string;
  viewport?: Viewport;
  includeResponsive?: boolean;
  includeAccessibility?: boolean;
  cropToElement?: boolean;
  waitFor?: string | number;
  fullPage?: boolean;
}

export interface AccessibilityInfo {
  role: string;
  label?: string;
  description?: string;
  landmarks: string[];
  colorContrast?: {
    foreground: string;
    background: string;
    ratio: number;
    level: 'AA' | 'AAA' | 'fail';
  };
  keyboardAccessible: boolean;
  focusable: boolean;
}

export interface ResponsiveView {
  breakpoint: number;
  screenshot: string; // base64
  computedStyles: Record<string, any>;
  viewport: Viewport;
  deviceInfo?: {
    name: string;
    type: 'mobile' | 'tablet' | 'desktop';
    userAgent: string;
  };
}

export interface UIContextResult {
  screenshot: string; // base64 image
  html: string; // relevant DOM fragment
  css: string; // applicable CSS rules
  computedStyles: Record<string, any>;
  elementBounds: Rectangle;
  accessibility: AccessibilityInfo;
  responsive?: ResponsiveView[];
  context: {
    pageTitle: string;
    url: string;
    timestamp: string;
    userAgent: string;
    selector?: string;
    viewport: Viewport;
  };
  performance?: {
    captureTime: number;
    imageSize: number;
    domSize: number;
    cssSize: number;
  };
}

export interface ComponentIsolationParams {
  url: string;
  selector: string;
  includeParents?: boolean;
  includeChildren?: boolean;
  styleScope?: 'component' | 'global' | 'inherited';
  captureStates?: boolean; // hover, focus, active, etc.
}

export interface StateVariation {
  state: string; // hover, focus, active, disabled, etc.
  screenshot: string;
  computedStyles: Record<string, any>;
  description: string;
}

export interface LayoutAnalysis {
  position: string;
  display: string;
  boxModel: {
    margin: string;
    border: string;
    padding: string;
    content: Rectangle;
  };
  flexbox?: {
    direction: string;
    wrap: string;
    justifyContent: string;
    alignItems: string;
    gap: string;
  };
  grid?: {
    templateColumns: string;
    templateRows: string;
    gap: string;
    areas: string;
  };
  float?: string;
  zIndex?: number;
}

export interface ComponentResult {
  componentScreenshot: string; // cropped to element
  parentContext?: string; // surrounding DOM
  styleDependencies: string[]; // all CSS affecting element
  stateVariations?: StateVariation[];
  layoutAnalysis: LayoutAnalysis;
  children?: Array<{
    selector: string;
    tagName: string;
    textContent?: string;
    bounds: Rectangle;
  }>;
  inheritance: {
    inheritedStyles: Record<string, any>;
    cascadeOrigin: Array<{
      property: string;
      value: string;
      source: 'user-agent' | 'user' | 'author' | 'inline';
      specificity: number;
    }>;
  };
}

export interface VisualComparisonParams {
  beforeUrl: string;
  afterUrl: string;
  selector?: string;
  diffSensitivity?: 'low' | 'medium' | 'high';
  threshold?: number; // 0-1, how much difference to consider significant
}

export interface ElementChange {
  selector: string;
  boundsBefore: Rectangle;
  boundsAfter: Rectangle;
  styleChanges: Record<string, { old: string; new: string }>;
  changeType: 'moved' | 'resized' | 'styled' | 'added' | 'removed';
  severity: 'low' | 'medium' | 'high';
}

export interface VisualComparisonResult {
  beforeScreenshot: string;
  afterScreenshot: string;
  diffImage: string; // highlighted differences
  changedElements: ElementChange[];
  diffRegions: Rectangle[];
  similarity: number; // 0-1 score
  summary: {
    totalChanges: number;
    significantChanges: number;
    changeTypes: Record<string, number>;
    affectedSelectors: string[];
  };
}

export interface ResponsiveCaptureParams {
  url: string;
  breakpoints: number[];
  selector?: string;
  devicePresets?: Array<{
    name: string;
    width: number;
    height: number;
    userAgent: string;
    deviceType: 'mobile' | 'tablet' | 'desktop';
  }>;
}

export interface ResponsiveCaptureResult {
  views: ResponsiveView[];
  breakpointAnalysis: Array<{
    breakpoint: number;
    issues: Array<{
      type: 'overflow' | 'layout-break' | 'text-truncation' | 'image-distortion';
      description: string;
      affectedElements: string[];
      severity: 'low' | 'medium' | 'high';
    }>;
  }>;
  recommendations: Array<{
    breakpoint: number;
    suggestion: string;
    cssHint: string;
  }>;
}

import type { Page } from 'playwright';
import type { ComponentIndex, ProjectIndex, BoundingBox } from './project-indexer.js';
import { BrowserManager } from '../utils/browser.js';
import { ImageProcessor } from '../utils/image-processor.js';

export interface VisualAnalysisResult {
  componentBounds: BoundingBox;
  screenshot: string; // base64
  computedStyles: Record<string, string>;
  accessibility: {
    role?: string;
    label?: string;
    description?: string;
  };
}

export class VisualAnalyzer {
  private browserManager: BrowserManager;
  private imageProcessor: ImageProcessor;

  constructor() {
    this.browserManager = new BrowserManager();
    this.imageProcessor = new ImageProcessor();
  }

  async analyzeComponent(
    devServerUrl: string,
    componentSelector: string,
    breakpoints: { name: string; width: number; height: number }[] = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 },
    ]
  ): Promise<Record<string, VisualAnalysisResult>> {
    await this.browserManager.initialize();
    const page = await this.browserManager.createPage();
    
    const results: Record<string, VisualAnalysisResult> = {};
    
    try {
      for (const breakpoint of breakpoints) {
        await page.setViewportSize({
          width: breakpoint.width,
          height: breakpoint.height,
        });
        
        await page.goto(devServerUrl);
        await page.waitForLoadState('networkidle');
        
        // Wait for component to be visible
        await page.waitForSelector(componentSelector, { timeout: 5000 });
        
        const result = await this.captureComponentData(page, componentSelector);
        results[breakpoint.name] = result;
      }
    } finally {
      await this.browserManager.close();
    }
    
    return results;
  }

  private async captureComponentData(
    page: Page,
    selector: string
  ): Promise<VisualAnalysisResult> {
    const element = await page.locator(selector).first();
    
    // Get bounding box
    const boundingBox = await element.boundingBox();
    if (!boundingBox) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Capture screenshot of just the component
    const screenshot = await element.screenshot({ type: 'png' });
    const base64Screenshot = await ImageProcessor.optimizeScreenshotToBase64(screenshot);
    
    // Get computed styles
    const computedStyles = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const relevantStyles: Record<string, string> = {};
      
      // Capture important styling properties
      const properties = [
        'display', 'position', 'width', 'height', 'margin', 'padding',
        'border', 'background', 'color', 'font-family', 'font-size',
        'font-weight', 'line-height', 'text-align', 'flex-direction',
        'justify-content', 'align-items', 'grid-template-columns',
        'grid-template-rows', 'gap', 'border-radius', 'box-shadow',
        'opacity', 'transform', 'transition', 'z-index'
      ];
      
      for (const prop of properties) {
        relevantStyles[prop] = styles.getPropertyValue(prop);
      }
      
      return relevantStyles;
    });
    
    // Get accessibility information
    const accessibility = await element.evaluate((el) => {
      return {
        role: el.getAttribute('role') || undefined,
        label: el.getAttribute('aria-label') || el.getAttribute('alt') || undefined,
        description: el.getAttribute('aria-description') || el.getAttribute('title') || undefined,
      };
    });
    
    return {
      componentBounds: boundingBox,
      screenshot: base64Screenshot,
      computedStyles,
      accessibility,
    };
  }

  async analyzeFullPage(url: string): Promise<{
    screenshot: string;
    components: Array<{
      selector: string;
      bounds: BoundingBox;
      tagName: string;
      className?: string;
      id?: string;
    }>;
  }> {
    await this.browserManager.initialize();
    const page = await this.browserManager.createPage();
    
    try {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Capture full page screenshot
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const base64Screenshot = await ImageProcessor.optimizeScreenshotToBase64(screenshot);
      
      // Find all potentially interesting components
      const components = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const componentData: Array<{
          selector: string;
          bounds: BoundingBox;
          tagName: string;
          className?: string;
          id?: string;
        }> = [];
        
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          
          // Filter out tiny elements and elements outside viewport
          if (rect.width < 10 || rect.height < 10 || 
              rect.top < 0 || rect.left < 0) {
            continue;
          }
          
          // Prefer elements with semantic meaning
          const isSemanticElement = [
            'HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER',
            'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'IMG', 'VIDEO'
          ].includes(el.tagName);
          
          const hasImportantClass = el.className && 
            typeof el.className === 'string' && 
            el.className.length > 0;
          
          const hasId = el.id && el.id.length > 0;
          
          if (isSemanticElement || hasImportantClass || hasId) {
            let selector = el.tagName.toLowerCase();
            if (el.id) selector += `#${el.id}`;
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(' ').filter(c => c.length > 0);
              if (classes.length > 0) {
                selector += `.${classes.join('.')}`;
              }
            }
            
            componentData.push({
              selector,
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              tagName: el.tagName,
              className: el.className as string || undefined,
              id: el.id || undefined,
            });
          }
        }
        
        return componentData;
      });
      
      return {
        screenshot: base64Screenshot,
        components,
      };
    } finally {
      await this.browserManager.close();
    }
  }
}

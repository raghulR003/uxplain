import type { Page } from 'playwright';
import { getBrowserManager } from '../utils/browser.js';
import { ImageProcessor } from '../utils/image-processor.js';
import { DOMAnalyzer } from '../utils/dom-analyzer.js';
import { CSSParser } from '../utils/css-parser.js';
import type { 
  UIContextParams, 
  UIContextResult, 
  Viewport,
  AccessibilityInfo,
  ResponsiveView 
} from '../types/index.js';

export class UIContextTool {
  static async captureUIContext(params: UIContextParams): Promise<UIContextResult> {
    const browserManager = getBrowserManager();
    await browserManager.initialize();
    
    const page = await browserManager.createPage();
    
    try {
      // Set viewport if specified
      if (params.viewport) {
        await browserManager.updateViewport(params.viewport);
      }

      // Navigate to the URL
      await page.goto(params.url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait for additional content if specified
      if (params.waitFor) {
        if (typeof params.waitFor === 'string') {
          await page.waitForSelector(params.waitFor, { timeout: 10000 });
        } else {
          await page.waitForTimeout(params.waitFor);
        }
      }

      const startTime = Date.now();

      // Capture screenshot
      const screenshot = await this.captureScreenshot(page, params);
      
      // Extract DOM and CSS context
      const { html, css, computedStyles, elementBounds } = await this.extractContext(page, params);
      
      // Get accessibility information
      const accessibility = params.includeAccessibility 
        ? await this.extractAccessibilityInfo(page, params.selector)
        : this.getDefaultAccessibilityInfo();

      // Capture responsive views if requested
      const responsive = params.includeResponsive 
        ? await this.captureResponsiveViews(page, params)
        : undefined;

      const endTime = Date.now();

      // Get page context
      const context = await this.getPageContext(page, params);

      return {
        screenshot,
        html,
        css,
        computedStyles,
        elementBounds,
        accessibility,
        responsive,
        context,
        performance: {
          captureTime: endTime - startTime,
          imageSize: ImageProcessor.calculateImageSize(screenshot),
          domSize: Buffer.byteLength(html, 'utf8'),
          cssSize: Buffer.byteLength(css, 'utf8'),
        },
      };
    } finally {
      await page.close();
    }
  }

  private static async captureScreenshot(page: Page, params: UIContextParams): Promise<string> {
    try {
      let screenshotOptions: any = {
        type: 'png',
        // Note: quality option is not supported for PNG format in Playwright
      };

      if (params.fullPage) {
        screenshotOptions.fullPage = true;
      }

      // If selector is specified and cropToElement is true, crop to that element
      if (params.selector && params.cropToElement) {
        const element = page.locator(params.selector).first();
        if (await element.isVisible()) {
          const buffer = await element.screenshot(screenshotOptions);
          return await ImageProcessor.optimizeScreenshotToBase64(buffer);
        }
      }

      // Otherwise take full page or viewport screenshot
      const buffer = await page.screenshot(screenshotOptions);
      return await ImageProcessor.optimizeScreenshotToBase64(buffer);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw new Error(`Screenshot capture failed: ${(error as Error).message}`);
    }
  }

  private static async extractContext(page: Page, params: UIContextParams) {
    try {
      // Extract HTML
      const html = await DOMAnalyzer.extractHTML(page, params.selector, true);
      
      // Get computed styles for the target element
      let computedStyles: Record<string, any> = {};
      let elementBounds = { x: 0, y: 0, width: 0, height: 0 };

      if (params.selector) {
        const elementInfo = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;

          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          
          const computedStyles: Record<string, string> = {};
          for (let i = 0; i < styles.length; i++) {
            const prop = styles[i];
            computedStyles[prop] = styles.getPropertyValue(prop);
          }

          return {
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            computedStyles,
          };
        }, params.selector);

        if (elementInfo) {
          computedStyles = elementInfo.computedStyles;
          elementBounds = elementInfo.bounds;
        }
      }

      // Extract CSS
      const css = await this.extractCSS(page, params.selector);

      return {
        html,
        css,
        computedStyles,
        elementBounds,
      };
    } catch (error) {
      console.error('Context extraction failed:', error);
      throw new Error(`Context extraction failed: ${(error as Error).message}`);
    }
  }

  private static async extractCSS(page: Page, selector?: string): Promise<string> {
    try {
      // Get all stylesheets
      const allCSS = await page.evaluate(() => {
        const stylesheets: string[] = [];
        
        // Get external stylesheets
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            if (sheet.cssRules) {
              Array.from(sheet.cssRules).forEach((rule) => {
                stylesheets.push(rule.cssText);
              });
            }
          } catch (e) {
            // CORS issues with external stylesheets
            console.warn('Cannot access stylesheet:', e);
          }
        });

        // Get inline styles
        Array.from(document.querySelectorAll('[style]')).forEach((el) => {
          const element = el as HTMLElement;
          if (element.style.cssText) {
            stylesheets.push(`${element.tagName.toLowerCase()} { ${element.style.cssText} }`);
          }
        });

        return stylesheets.join('\n');
      });

      // If selector is specified, extract only relevant CSS
      if (selector && allCSS) {
        const targetSelectors = [selector];
        
        // Add parent selectors for context
        const parentSelectors = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return [];
          
          const selectors: string[] = [];
          let parent = el.parentElement;
          
          while (parent && parent !== document.body && selectors.length < 3) {
            if (parent.className) {
              selectors.push('.' + parent.className.split(' ')[0]);
            }
            if (parent.id) {
              selectors.push('#' + parent.id);
            }
            parent = parent.parentElement;
          }
          
          return selectors;
        }, selector);

        targetSelectors.push(...parentSelectors);
        return CSSParser.extractRelevantCSS(allCSS, targetSelectors);
      }

      return allCSS;
    } catch (error) {
      console.error('CSS extraction failed:', error);
      return '';
    }
  }

  private static async extractAccessibilityInfo(page: Page, selector?: string): Promise<AccessibilityInfo> {
    try {
      if (!selector) {
        // Page-level accessibility info
        return await page.evaluate(() => {
          const landmarks = Array.from(document.querySelectorAll('[role], nav, main, aside, header, footer'))
            .map(el => (el as HTMLElement).getAttribute('role') || el.tagName.toLowerCase())
            .filter(Boolean);

          return {
            role: document.documentElement.getAttribute('role') || 'document',
            label: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            landmarks,
            keyboardAccessible: true, // Basic assumption
            focusable: true,
          };
        });
      }

      // Element-specific accessibility info
      return await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (!el) {
          return {
            role: '',
            landmarks: [],
            keyboardAccessible: false,
            focusable: false,
          };
        }

        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const label = el.getAttribute('aria-label') || 
                     el.getAttribute('aria-labelledby') ||
                     (el as any).textContent?.trim() || '';
        const description = el.getAttribute('aria-describedby') || 
                           el.getAttribute('title') || '';

        // Check if element is focusable
        const focusable = el.tabIndex >= 0 || 
                         ['a', 'button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase()) ||
                         el.getAttribute('contenteditable') === 'true';

        return {
          role,
          label,
          description,
          landmarks: [role],
          keyboardAccessible: focusable,
          focusable,
        };
      }, selector);
    } catch (error) {
      console.error('Accessibility extraction failed:', error);
      return this.getDefaultAccessibilityInfo();
    }
  }

  private static getDefaultAccessibilityInfo(): AccessibilityInfo {
    return {
      role: '',
      landmarks: [],
      keyboardAccessible: false,
      focusable: false,
    };
  }

  private static async captureResponsiveViews(page: Page, params: UIContextParams): Promise<ResponsiveView[]> {
    const breakpoints = [320, 768, 1024, 1440]; // Default breakpoints
    const views: ResponsiveView[] = [];

    for (const breakpoint of breakpoints) {
      try {
        const viewport: Viewport = { width: breakpoint, height: 720 };
        await page.setViewportSize(viewport);
        
        // Wait for layout to settle
        await page.waitForTimeout(500);

        // Capture screenshot
        const screenshotOptions: any = {
          type: 'png',
          // Note: quality option is not supported for PNG format in Playwright
        };

        let screenshot: string;
        if (params.selector && params.cropToElement) {
          const element = page.locator(params.selector).first();
          if (await element.isVisible()) {
            const buffer = await element.screenshot(screenshotOptions);
            screenshot = await ImageProcessor.optimizeScreenshotToBase64(buffer, { quality: 80 });
          } else {
            continue; // Skip if element not visible at this breakpoint
          }
        } else {
          const buffer = await page.screenshot(screenshotOptions);
          screenshot = await ImageProcessor.optimizeScreenshotToBase64(buffer, { quality: 80 });
        }

        // Get computed styles at this breakpoint
        const computedStyles = params.selector ? await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return {};

          const styles = window.getComputedStyle(el);
          const result: Record<string, string> = {};
          
          // Get key responsive properties
          const responsiveProps = [
            'display', 'position', 'width', 'height', 'margin', 'padding',
            'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
            'grid-template-columns', 'grid-template-rows', 'gap',
            'font-size', 'line-height', 'overflow'
          ];

          responsiveProps.forEach(prop => {
            result[prop] = styles.getPropertyValue(prop);
          });

          return result;
        }, params.selector) : {};

        views.push({
          breakpoint,
          screenshot,
          computedStyles,
          viewport,
          deviceInfo: {
            name: this.getDeviceName(breakpoint),
            type: this.getDeviceType(breakpoint),
            userAgent: await page.evaluate(() => navigator.userAgent),
          },
        });
      } catch (error) {
        console.error(`Failed to capture responsive view for ${breakpoint}px:`, error);
      }
    }

    return views;
  }

  private static getDeviceName(width: number): string {
    if (width <= 480) return 'Mobile';
    if (width <= 768) return 'Tablet (Portrait)';
    if (width <= 1024) return 'Tablet (Landscape)';
    return 'Desktop';
  }

  private static getDeviceType(width: number): 'mobile' | 'tablet' | 'desktop' {
    if (width <= 480) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  private static async getPageContext(page: Page, params: UIContextParams) {
    const title = await page.title();
    const url = page.url();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const viewport = page.viewportSize() || { width: 1280, height: 720 };

    return {
      pageTitle: title,
      url,
      timestamp: new Date().toISOString(),
      userAgent,
      selector: params.selector,
      viewport,
    };
  }
}

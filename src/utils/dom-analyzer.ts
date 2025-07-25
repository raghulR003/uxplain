import { JSDOM } from 'jsdom';
import type { Page } from 'playwright';

export interface DOMElement {
  tagName: string;
  selector: string;
  textContent?: string;
  attributes: Record<string, string>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
  children: DOMElement[];
}

export interface DOMAnalysis {
  element: DOMElement;
  parents: DOMElement[];
  siblings: DOMElement[];
  descendants: DOMElement[];
  path: string[];
}

export class DOMAnalyzer {
  static async analyzeElement(
    page: Page,
    selector: string
  ): Promise<DOMAnalysis | null> {
    try {
      const element = await page.locator(selector).first();
      
      if (!(await element.isVisible())) {
        throw new Error(`Element ${selector} is not visible`);
      }

      // Get element information
      const elementInfo = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;

        const rect = el.getBoundingClientRect();
        const computedStyles = window.getComputedStyle(el);
        
        // Convert computed styles to plain object
        const styles: Record<string, string> = {};
        for (let i = 0; i < computedStyles.length; i++) {
          const prop = computedStyles[i];
          styles[prop] = computedStyles.getPropertyValue(prop);
        }

        // Get attributes
        const attributes: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attributes[attr.name] = attr.value;
        }

        return {
          tagName: el.tagName.toLowerCase(),
          textContent: el.textContent?.trim() || '',
          attributes,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          computedStyles: styles,
        };
      }, selector);

      if (!elementInfo) {
        throw new Error(`Element ${selector} not found`);
      }

      // Get parent elements
      const parents = await this.getParentElements(page, selector);
      
      // Get sibling elements
      const siblings = await this.getSiblingElements(page, selector);
      
      // Get child elements (limited depth to avoid huge trees)
      const descendants = await this.getDescendantElements(page, selector, 2);
      
      // Generate CSS path
      const path = await this.generateCSSPath(page, selector);

      const domElement: DOMElement = {
        selector,
        tagName: elementInfo.tagName,
        textContent: elementInfo.textContent,
        attributes: elementInfo.attributes,
        bounds: elementInfo.bounds,
        computedStyles: elementInfo.computedStyles,
        children: descendants,
      };

      return {
        element: domElement,
        parents,
        siblings,
        descendants,
        path,
      };
    } catch (error) {
      console.error('DOM analysis failed:', error);
      return null;
    }
  }

  private static async getParentElements(
    page: Page,
    selector: string
  ): Promise<DOMElement[]> {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return [];

      const generateSelector = (element: Element): string => {
        let selector = element.tagName.toLowerCase();
        if (element.id) {
          selector += `#${element.id}`;
        } else if (element.className) {
          const classes = element.className.trim().split(/\s+/);
          selector += '.' + classes.join('.');
        }
        return selector;
      };

      const parents: any[] = [];
      let parent = el.parentElement;
      
      while (parent && parent !== document.body && parents.length < 5) {
        const rect = parent.getBoundingClientRect();
        const computedStyles = window.getComputedStyle(parent);
        
        const styles: Record<string, string> = {};
        for (let i = 0; i < computedStyles.length; i++) {
          const prop = computedStyles[i];
          styles[prop] = computedStyles.getPropertyValue(prop);
        }

        const attributes: Record<string, string> = {};
        for (let i = 0; i < parent.attributes.length; i++) {
          const attr = parent.attributes[i];
          attributes[attr.name] = attr.value;
        }

        parents.push({
          tagName: parent.tagName.toLowerCase(),
          selector: generateSelector(parent),
          textContent: parent.textContent?.trim() || '',
          attributes,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          computedStyles: styles,
          children: [],
        });

        parent = parent.parentElement;
      }

      return parents;
    }, selector);
  }

  private static async getSiblingElements(
    page: Page,
    selector: string
  ): Promise<DOMElement[]> {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.parentElement) return [];

      const generateSelector = (element: Element): string => {
        let selector = element.tagName.toLowerCase();
        if (element.id) {
          selector += `#${element.id}`;
        } else if (element.className) {
          const classes = element.className.trim().split(/\s+/);
          selector += '.' + classes.join('.');
        }
        return selector;
      };

      const siblings: any[] = [];
      const parent = el.parentElement;
      
      for (let i = 0; i < parent.children.length && siblings.length < 10; i++) {
        const sibling = parent.children[i] as HTMLElement;
        if (sibling === el) continue;

        const rect = sibling.getBoundingClientRect();
        const computedStyles = window.getComputedStyle(sibling);
        
        const styles: Record<string, string> = {};
        for (let j = 0; j < computedStyles.length; j++) {
          const prop = computedStyles[j];
          styles[prop] = computedStyles.getPropertyValue(prop);
        }

        const attributes: Record<string, string> = {};
        for (let j = 0; j < sibling.attributes.length; j++) {
          const attr = sibling.attributes[j];
          attributes[attr.name] = attr.value;
        }

        siblings.push({
          tagName: sibling.tagName.toLowerCase(),
          selector: generateSelector(sibling),
          textContent: sibling.textContent?.trim() || '',
          attributes,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          computedStyles: styles,
          children: [],
        });
      }

      return siblings;
    }, selector);
  }

  private static async getDescendantElements(
    page: Page,
    selector: string,
    maxDepth: number = 2
  ): Promise<DOMElement[]> {
    return await page.evaluate(
      ({ sel, depth }: { sel: string; depth: number }) => {
        const el = document.querySelector(sel);
        if (!el) return [];

        const generateSelector = (element: Element): string => {
          let selector = element.tagName.toLowerCase();
          if (element.id) {
            selector += `#${element.id}`;
          } else if (element.className) {
            const classes = element.className.trim().split(/\s+/);
            selector += '.' + classes.join('.');
          }
          return selector;
        };

        const descendants: any[] = [];
        
        function traverse(element: Element, currentDepth: number): void {
          if (currentDepth >= depth) return;
          
          for (let i = 0; i < element.children.length && descendants.length < 20; i++) {
            const child = element.children[i] as HTMLElement;
            const rect = child.getBoundingClientRect();
            const computedStyles = window.getComputedStyle(child);
            
            const styles: Record<string, string> = {};
            for (let j = 0; j < computedStyles.length; j++) {
              const prop = computedStyles[j];
              styles[prop] = computedStyles.getPropertyValue(prop);
            }

            const attributes: Record<string, string> = {};
            for (let j = 0; j < child.attributes.length; j++) {
              const attr = child.attributes[j];
              attributes[attr.name] = attr.value;
            }

            descendants.push({
              tagName: child.tagName.toLowerCase(),
              selector: generateSelector(child),
              textContent: child.textContent?.trim() || '',
              attributes,
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              computedStyles: styles,
              children: [],
            });

            traverse(child, currentDepth + 1);
          }
        }

        traverse(el, 0);
        return descendants;
      },
      { sel: selector, depth: maxDepth }
    );
  }

  private static async generateCSSPath(
    page: Page,
    selector: string
  ): Promise<string[]> {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return [];

      const path: string[] = [];
      let element: Element | null = el;

      while (element && element !== document.documentElement) {
        let selector = element.tagName.toLowerCase();
        
        if (element.id) {
          selector += `#${element.id}`;
          path.unshift(selector);
          break; // ID is unique, stop here
        }
        
        if (element.className) {
          const classes = element.className.trim().split(/\s+/);
          selector += '.' + classes.join('.');
        }

        // Add nth-child if needed for uniqueness
        if (element.parentElement) {
          const siblings = Array.from(element.parentElement.children)
            .filter(child => child.tagName === element!.tagName);
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `:nth-child(${index})`;
          }
        }

        path.unshift(selector);
        element = element.parentElement;
      }

      return path;
    }, selector);
  }

  static async extractHTML(
    page: Page,
    selector?: string,
    includeContext: boolean = true
  ): Promise<string> {
    try {
      if (!selector) {
        return await page.content();
      }

      if (includeContext) {
        // Get element with some parent context
        return await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return '';
          
          // Try to get meaningful parent context
          let parent = el.parentElement;
          while (parent && parent.children.length === 1 && parent !== document.body) {
            parent = parent.parentElement;
          }
          
          return parent ? parent.outerHTML : el.outerHTML;
        }, selector);
      } else {
        // Get just the element
        return await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : '';
        }, selector);
      }
    } catch (error) {
      console.error('HTML extraction failed:', error);
      return '';
    }
  }

  static parseHTMLWithJSDOM(htmlString: string): Document | null {
    try {
      const dom = new JSDOM(htmlString);
      return dom.window.document;
    } catch (error) {
      console.error('JSDOM parsing failed:', error);
      return null;
    }
  }
}

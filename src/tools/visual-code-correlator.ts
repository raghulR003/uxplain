import type { Page } from 'playwright';
import type { ComponentIndex, ProjectIndex } from './project-indexer.js';
import { ProjectIndexer } from './project-indexer.js';
import { IndexSearchEngine } from './index-search-engine.js';
import { BrowserManager } from '../utils/browser.js';

export interface VisualCodeCorrelation {
  visualElement: {
    selector: string;
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    tagName: string;
    className: string;
    id: string;
  };
  sourceComponent: ComponentIndex | null;
  confidence: number; // 0-1 score of how confident we are in the match
  matchReason: string;
  codeSnippet?: string;
  responsiveIssues: string[];
  recommendations: string[];
}

export interface VisualAnalysisResult {
  url: string;
  timestamp: string;
  correlations: VisualCodeCorrelation[];
  projectPath?: string;
  screenshots: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
  summary: {
    totalElements: number;
    matchedComponents: number;
    unmatchedElements: number;
    criticalIssues: number;
  };
}

export class VisualCodeCorrelator {
  private browserManager: BrowserManager;
  private projectIndex: ProjectIndex | null = null;
  private searchEngine: IndexSearchEngine | null = null;

  constructor() {
    this.browserManager = new BrowserManager();
  }

  async analyzeWithCodeCorrelation(
    url: string,
    projectPath?: string,
    elementType?: 'button' | 'input' | 'card' | 'all'
  ): Promise<VisualAnalysisResult> {
    // Load project index if path provided
    if (projectPath) {
      this.projectIndex = await ProjectIndexer.loadIndex(projectPath);
      if (this.projectIndex) {
        this.searchEngine = new IndexSearchEngine(this.projectIndex);
        console.log(`📚 Loaded project index with ${this.projectIndex.components.length} components`);
      } else {
        console.warn(`⚠️ No index found at ${projectPath}. Visual elements won't be correlated with source code.`);
      }
    }

    await this.browserManager.initialize();
    const page = await this.browserManager.createPage();

    try {
      // Capture responsive screenshots and analyze elements
      const screenshots = await this.captureResponsiveScreenshots(page, url);
      const visualElements = await this.extractTargetElements(page, elementType);
      
      // Correlate visual elements with source components
      const correlations = await this.correlateElementsWithComponents(visualElements, page);

      const summary = this.generateSummary(correlations);

      return {
        url,
        timestamp: new Date().toISOString(),
        correlations,
        projectPath,
        screenshots,
        summary,
      };
    } finally {
      await this.browserManager.close();
    }
  }

  private async captureResponsiveScreenshots(page: Page, url: string): Promise<{
    desktop: string;
    tablet: string;
    mobile: string;
  }> {
    const screenshots = { desktop: '', tablet: '', mobile: '' };
    
    const breakpoints = [
      { name: 'desktop', width: 1200, height: 800 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 },
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      screenshots[breakpoint.name as keyof typeof screenshots] = screenshot.toString('base64');
      
      console.log(`📸 Captured ${breakpoint.name} screenshot (${breakpoint.width}x${breakpoint.height})`);
    }

    return screenshots;
  }

  private async extractTargetElements(page: Page, elementType?: string): Promise<any[]> {
    return await page.evaluate((type) => {
      function getSelectorsForType(type: string | undefined): string[] {
        switch (type) {
          case 'button':
            return ['button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]'];
          case 'input':
            return ['input', 'textarea', 'select'];
          case 'card':
            return ['.card', '[class*="card"]', '[data-testid*="card"]'];
          default:
            return [
              'button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]',
              'input', 'textarea', 'select',
              '.card', '[class*="card"]', '[data-testid*="card"]',
              'nav', 'header', 'main', 'section', 'article',
              '[onclick]', 'a[href]'
            ];
        }
      }

      function generateUniqueSelector(element: Element): string {
        if (element.id) return `#${element.id}`;
        
        let selector = element.tagName.toLowerCase();
        if (element.className) {
          const classes = element.className.split(' ').filter(c => c.length > 0);
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }
        
        // Add position if needed to make unique
        const siblings = Array.from(element.parentElement?.children || []);
        const index = siblings.indexOf(element);
        if (index > 0) {
          selector += `:nth-child(${index + 1})`;
        }
        
        return selector;
      }

      const selectors = getSelectorsForType(type);
      const elements: any[] = [];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);

          // Skip invisible elements
          if (rect.width === 0 || rect.height === 0 || styles.display === 'none') {
            return;
          }

          elements.push({
            selector: generateUniqueSelector(el),
            text: el.textContent?.trim().substring(0, 100) || '',
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            tagName: el.tagName.toLowerCase(),
            className: el.className || '',
            id: el.id || '',
            attributes: {
              role: el.getAttribute('role'),
              ariaLabel: el.getAttribute('aria-label'),
              type: el.getAttribute('type'),
              placeholder: el.getAttribute('placeholder'),
            },
            styles: {
              position: styles.position,
              display: styles.display,
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontSize: styles.fontSize,
              fontWeight: styles.fontWeight,
              padding: styles.padding,
              margin: styles.margin,
              border: styles.border,
              borderRadius: styles.borderRadius,
            },
            elementIndex: index,
          });
        });
      });

      return elements;
    }, elementType);
  }

  private async correlateElementsWithComponents(visualElements: any[], page: Page): Promise<VisualCodeCorrelation[]> {
    const correlations: VisualCodeCorrelation[] = [];

    for (const element of visualElements) {
      let correlation: VisualCodeCorrelation = {
        visualElement: element,
        sourceComponent: null,
        confidence: 0,
        matchReason: 'No project index available',
        responsiveIssues: [],
        recommendations: [],
      };

      if (this.searchEngine && this.projectIndex) {
        correlation = await this.findComponentMatch(element);
      }

      // Analyze responsive issues
      correlation.responsiveIssues = this.analyzeResponsiveIssues(element);
      correlation.recommendations = this.generateRecommendations(element, correlation.sourceComponent);

      correlations.push(correlation);
    }

    return correlations;
  }

  private async findComponentMatch(visualElement: any): Promise<VisualCodeCorrelation> {
    if (!this.searchEngine || !this.projectIndex) {
      return {
        visualElement,
        sourceComponent: null,
        confidence: 0,
        matchReason: 'No search engine available',
        responsiveIssues: [],
        recommendations: [],
      };
    }

    // Strategy 1: Search by element text content
    let bestMatch: ComponentIndex | null = null;
    let confidence = 0;
    let matchReason = '';

    if (visualElement.text && visualElement.text.length > 2) {
      const textResults = this.searchEngine.searchComponents({
        text: visualElement.text,
        componentType: 'any',
      });

      if (textResults.length > 0) {
        bestMatch = textResults[0].component;
        confidence = Math.min(textResults[0].relevanceScore / 20, 0.8);
        matchReason = `Matched by text content: "${visualElement.text}"`;
      }
    }

    // Strategy 2: Search by element type and attributes
    if (!bestMatch || confidence < 0.5) {
      const typeQuery = this.buildTypeQuery(visualElement);
      const typeResults = this.searchEngine.searchComponents(typeQuery);

      if (typeResults.length > 0 && typeResults[0].relevanceScore > 5) {
        if (!bestMatch || typeResults[0].relevanceScore > confidence * 20) {
          bestMatch = typeResults[0].component;
          confidence = Math.min(typeResults[0].relevanceScore / 15, 0.9);
          matchReason = `Matched by element type and props: ${typeQuery.text}`;
        }
      }
    }

    // Strategy 3: Search by CSS classes
    if ((!bestMatch || confidence < 0.6) && visualElement.className) {
      const classNames = visualElement.className.split(' ').filter((c: string) => c.length > 2);
      for (const className of classNames) {
        const classResults = this.searchEngine.searchComponents({
          text: className,
          componentType: 'any',
        });

        if (classResults.length > 0 && classResults[0].relevanceScore > 3) {
          if (!bestMatch || classResults[0].relevanceScore > confidence * 15) {
            bestMatch = classResults[0].component;
            confidence = Math.min(classResults[0].relevanceScore / 12, 0.7);
            matchReason = `Matched by CSS class: "${className}"`;
          }
        }
      }
    }

    // Extract relevant code snippet
    let codeSnippet = '';
    if (bestMatch) {
      codeSnippet = this.extractRelevantCodeSnippet(bestMatch, visualElement);
    }

    return {
      visualElement,
      sourceComponent: bestMatch,
      confidence,
      matchReason: bestMatch ? matchReason : 'No matching component found',
      codeSnippet,
      responsiveIssues: [],
      recommendations: [],
    };
  }

  private buildTypeQuery(visualElement: any): { text?: string; tags?: string[] } {
    const query: { text?: string; tags?: string[] } = {};

    if (visualElement.tagName === 'button' || visualElement.attributes.role === 'button') {
      query.text = 'button';
      query.tags = ['interactive'];
    } else if (['input', 'textarea', 'select'].includes(visualElement.tagName)) {
      query.text = 'input';
      query.tags = ['interactive'];
    } else if (visualElement.className.includes('card')) {
      query.text = 'card';
      query.tags = ['container'];
    } else if (visualElement.tagName === 'nav') {
      query.text = 'navigation';
    }

    return query;
  }

  private extractRelevantCodeSnippet(component: ComponentIndex, visualElement: any): string {
    const sourceLines = component.sourceCode.split('\n');
    
    // Try to find the JSX return statement
    const returnIndex = sourceLines.findIndex(line => line.trim().includes('return'));
    if (returnIndex !== -1) {
      // Extract a relevant portion around the return statement
      const start = Math.max(0, returnIndex - 2);
      const end = Math.min(sourceLines.length, returnIndex + 15);
      return sourceLines.slice(start, end).join('\n');
    }

    // Fallback: return first 20 lines
    return sourceLines.slice(0, 20).join('\n');
  }

  private analyzeResponsiveIssues(element: any): string[] {
    const issues: string[] = [];

    // Check touch target size
    if (element.bounds.width < 44 || element.bounds.height < 44) {
      issues.push(`Touch target too small: ${element.bounds.width}x${element.bounds.height}px (minimum 44x44px)`);
    }

    // Check for very small text
    const fontSize = parseInt(element.styles.fontSize);
    if (fontSize && fontSize < 14) {
      issues.push(`Font size too small: ${fontSize}px (minimum 14px for mobile)`);
    }

    // Check for insufficient color contrast (basic check)
    if (element.styles.color && element.styles.backgroundColor) {
      // This is a simplified check - in practice you'd use a proper contrast ratio calculation
      if (element.styles.color === element.styles.backgroundColor) {
        issues.push('Potential color contrast issue');
      }
    }

    return issues;
  }

  private generateRecommendations(element: any, component: ComponentIndex | null): string[] {
    const recommendations: string[] = [];

    if (element.bounds.width < 44 || element.bounds.height < 44) {
      recommendations.push('Increase padding or min-height/min-width to meet 44px touch target minimum');
    }

    if (!element.attributes.ariaLabel && !element.text) {
      recommendations.push('Add aria-label for better accessibility');
    }

    if (component && component.props.length > 8) {
      recommendations.push('Consider breaking down this component - it has many props and might be too complex');
    }

    if (element.tagName === 'div' && element.attributes.role === 'button') {
      recommendations.push('Consider using a semantic <button> element instead of div with button role');
    }

    return recommendations;
  }

  private generateSummary(correlations: VisualCodeCorrelation[]): {
    totalElements: number;
    matchedComponents: number;
    unmatchedElements: number;
    criticalIssues: number;
  } {
    const totalElements = correlations.length;
    const matchedComponents = correlations.filter(c => c.sourceComponent !== null).length;
    const unmatchedElements = totalElements - matchedComponents;
    const criticalIssues = correlations.reduce((count, c) => count + c.responsiveIssues.length, 0);

    return {
      totalElements,
      matchedComponents,
      unmatchedElements,
      criticalIssues,
    };
  }
}

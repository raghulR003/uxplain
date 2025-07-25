import postcss from 'postcss';
import { parse, generate, walk } from 'css-tree';
import type { CssNode } from 'css-tree';

export interface CSSRule {
  selector: string;
  properties: Array<{
    property: string;
    value: string;
    important: boolean;
  }>;
  specificity: number;
  source: 'inline' | 'internal' | 'external' | 'user-agent';
  media?: string;
}

export interface CSSAnalysis {
  rules: CSSRule[];
  totalRules: number;
  selectors: string[];
  properties: string[];
  mediaQueries: string[];
  errors: string[];
}

export class CSSParser {
  static async parseCSS(cssText: string): Promise<CSSAnalysis> {
    const analysis: CSSAnalysis = {
      rules: [],
      totalRules: 0,
      selectors: [],
      properties: [],
      mediaQueries: [],
      errors: [],
    };

    if (!cssText.trim()) {
      return analysis;
    }

    try {
      // Use css-tree for parsing
      const ast = parse(cssText, {
        onParseError: (error: any) => {
          analysis.errors.push(`Parse error: ${error.message} at line ${error.line}`);
        },
      });

      walk(ast, (node: CssNode) => {
        if (node.type === 'Rule') {
          const rule = this.extractRule(node);
          if (rule) {
            analysis.rules.push(rule);
            analysis.selectors.push(rule.selector);
            rule.properties.forEach(prop => {
              if (!analysis.properties.includes(prop.property)) {
                analysis.properties.push(prop.property);
              }
            });
          }
        } else if (node.type === 'Atrule' && node.name === 'media') {
          const mediaQuery = generate(node.prelude || { type: 'Raw', value: '' });
          analysis.mediaQueries.push(mediaQuery);
        }
      });

      analysis.totalRules = analysis.rules.length;
    } catch (error) {
      analysis.errors.push(`CSS parsing failed: ${(error as Error).message}`);
    }

    return analysis;
  }

  private static extractRule(ruleNode: any): CSSRule | null {
    try {
      const selector = generate(ruleNode.prelude);
      const properties: Array<{ property: string; value: string; important: boolean }> = [];

      if (ruleNode.block && ruleNode.block.children) {
        ruleNode.block.children.forEach((child: any) => {
          if (child.type === 'Declaration') {
            properties.push({
              property: child.property,
              value: generate(child.value),
              important: child.important || false,
            });
          }
        });
      }

      return {
        selector,
        properties,
        specificity: this.calculateSpecificity(selector),
        source: 'external' as const,
      };
    } catch (error) {
      return null;
    }
  }

  static calculateSpecificity(selector: string): number {
    // Simplified specificity calculation
    let specificity = 0;
    
    // Count IDs
    const idMatches = selector.match(/#[a-zA-Z][\w-]*/g);
    specificity += (idMatches?.length || 0) * 100;
    
    // Count classes, attributes, and pseudo-classes
    const classMatches = selector.match(/\.[a-zA-Z][\w-]*|\[[^\]]*\]|:[a-zA-Z][\w-]*/g);
    specificity += (classMatches?.length || 0) * 10;
    
    // Count elements and pseudo-elements
    const elementMatches = selector.match(/[a-zA-Z][\w-]*|::[a-zA-Z][\w-]*/g);
    specificity += (elementMatches?.length || 0) * 1;
    
    return specificity;
  }

  static extractRelevantCSS(
    cssText: string,
    targetSelectors: string[]
  ): string {
    try {
      const ast = parse(cssText);
      const relevantRules: string[] = [];

      walk(ast, (node: CssNode) => {
        if (node.type === 'Rule') {
          const selector = generate(node.prelude || { type: 'Raw', value: '' });
          
          // Check if this rule applies to any of our target selectors
          const isRelevant = targetSelectors.some(target => 
            this.selectorMatches(selector, target)
          );

          if (isRelevant) {
            relevantRules.push(generate(node));
          }
        }
      });

      return relevantRules.join('\n\n');
    } catch (error) {
      console.error('CSS extraction failed:', error);
      return cssText; // Return original on error
    }
  }

  private static selectorMatches(ruleSelector: string, targetSelector: string): boolean {
    // Simplified selector matching - in production, this would be more sophisticated
    return ruleSelector.includes(targetSelector.replace(/^\./, '')) ||
           targetSelector.includes(ruleSelector.replace(/^\./, '')) ||
           ruleSelector === targetSelector;
  }

  static async processPostCSS(cssText: string, plugins: any[] = []): Promise<string> {
    try {
      const result = await postcss(plugins).process(cssText, { from: undefined });
      return result.css;
    } catch (error) {
      console.error('PostCSS processing failed:', error);
      return cssText;
    }
  }

  static minifyCSS(cssText: string): string {
    try {
      const ast = parse(cssText);
      // Generate minified CSS (css-tree automatically compresses by default)
      return generate(ast);
    } catch (error) {
      console.error('CSS minification failed:', error);
      return cssText;
    }
  }

  static validateCSS(cssText: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      parse(cssText, {
        onParseError: (error: any) => {
          errors.push(`${error.message} at line ${error.line}`);
        },
      });
    } catch (error) {
      errors.push(`Critical parsing error: ${(error as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

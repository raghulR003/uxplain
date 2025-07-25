import type { ComponentIndex, ProjectIndex } from './project-indexer.js';

export interface SearchQuery {
  text?: string;
  tags?: string[];
  framework?: string;
  componentType?: 'functional' | 'class' | 'any';
  hasProps?: boolean;
  hasSideEffects?: boolean;
  usedIn?: string[];
}

export interface SearchResult {
  component: ComponentIndex;
  relevanceScore: number;
  matches: {
    field: string;
    snippet: string;
    highlightStart: number;
    highlightEnd: number;
  }[];
}

export interface SimilarityResult {
  component: ComponentIndex;
  similarityScore: number;
  similarityType: 'visual' | 'semantic' | 'usage';
}

export class IndexSearchEngine {
  private index: ProjectIndex;

  constructor(index: ProjectIndex) {
    this.index = index;
  }

  searchComponents(query: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];

    for (const component of this.index.components) {
      const relevanceScore = this.calculateRelevanceScore(component, query);
      
      if (relevanceScore > 0) {
        const matches = this.findMatches(component, query);
        results.push({
          component,
          relevanceScore,
          matches,
        });
      }
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  findSimilarComponents(
    componentId: string,
    similarityType: 'visual' | 'semantic' | 'usage' = 'semantic',
    limit: number = 5
  ): SimilarityResult[] {
    const targetComponent = this.index.components.find(c => c.id === componentId);
    if (!targetComponent) {
      return [];
    }

    const similarities: SimilarityResult[] = [];

    for (const component of this.index.components) {
      if (component.id === componentId) continue;

      const score = this.calculateSimilarityScore(targetComponent, component, similarityType);
      
      if (score > 0.1) { // Minimum similarity threshold
        similarities.push({
          component,
          similarityScore: score,
          similarityType,
        });
      }
    }

    return similarities
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  searchByVisualSimilarity(base64Image: string, threshold: number = 0.7): SimilarityResult[] {
    // This would require actual image comparison logic
    // For now, return empty array as placeholder
    console.warn('Visual similarity search not yet implemented');
    return [];
  }

  getComponentUsageGraph(): Map<string, string[]> {
    const usageGraph = new Map<string, string[]>();

    // Build usage relationships
    for (const component of this.index.components) {
      usageGraph.set(component.id, component.usedIn);
    }

    // Add reverse relationships from pages
    for (const page of this.index.pages) {
      for (const componentName of page.components) {
        const component = this.index.components.find(c => c.name === componentName);
        if (component) {
          const currentUsage = usageGraph.get(component.id) || [];
          if (!currentUsage.includes(page.id)) {
            currentUsage.push(page.id);
            usageGraph.set(component.id, currentUsage);
          }
        }
      }
    }

    return usageGraph;
  }

  getComponentsByTag(tag: string): ComponentIndex[] {
    return this.index.components.filter(component => 
      component.tags.includes(tag)
    );
  }

  getComponentsByFramework(framework: string): ComponentIndex[] {
    // This could be enhanced to detect framework usage per component
    return this.index.components;
  }

  private calculateRelevanceScore(component: ComponentIndex, query: SearchQuery): number {
    let score = 0;

    // Text search in name, description, and source code
    if (query.text) {
      const searchText = query.text.toLowerCase();
      
      // Name match (highest weight)
      if (component.name.toLowerCase().includes(searchText)) {
        score += 10;
      }
      
      // Description match
      if (component.description.toLowerCase().includes(searchText)) {
        score += 5;
      }
      
      // Source code match (lower weight, as it might be noisy)
      if (component.sourceCode.toLowerCase().includes(searchText)) {
        score += 2;
      }
      
      // Props match
      for (const prop of component.props) {
        if (prop.name.toLowerCase().includes(searchText) || 
            prop.type.toLowerCase().includes(searchText)) {
          score += 3;
        }
      }
    }

    // Tag matching
    if (query.tags && query.tags.length > 0) {
      const matchingTags = component.tags.filter(tag => 
        query.tags!.includes(tag)
      );
      score += matchingTags.length * 4;
    }

    // Component type filtering
    if (query.componentType && query.componentType !== 'any') {
      const isFunctional = component.sourceCode.includes('function ') || 
                          component.sourceCode.includes('const ') ||
                          component.sourceCode.includes('=>');
      const isClass = component.sourceCode.includes('class ') ||
                     component.sourceCode.includes('extends');
      
      if (query.componentType === 'functional' && isFunctional) {
        score += 2;
      } else if (query.componentType === 'class' && isClass) {
        score += 2;
      } else {
        score -= 5; // Penalty for wrong type
      }
    }

    // Props filtering
    if (query.hasProps !== undefined) {
      const hasProps = component.props.length > 0;
      if (query.hasProps === hasProps) {
        score += 2;
      } else {
        score -= 3;
      }
    }

    // Side effects filtering
    if (query.hasSideEffects !== undefined) {
      const hasSideEffects = component.tags.includes('side-effects');
      if (query.hasSideEffects === hasSideEffects) {
        score += 2;
      } else {
        score -= 3;
      }
    }

    // Usage filtering
    if (query.usedIn && query.usedIn.length > 0) {
      const usageMatches = component.usedIn.filter(usage => 
        query.usedIn!.includes(usage)
      );
      score += usageMatches.length * 3;
    }

    return Math.max(0, score);
  }

  private calculateSimilarityScore(
    component1: ComponentIndex,
    component2: ComponentIndex,
    type: 'visual' | 'semantic' | 'usage'
  ): number {
    switch (type) {
      case 'semantic':
        return this.calculateSemanticSimilarity(component1, component2);
      case 'usage':
        return this.calculateUsageSimilarity(component1, component2);
      case 'visual':
        return this.calculateVisualSimilarity(component1, component2);
      default:
        return 0;
    }
  }

  private calculateSemanticSimilarity(comp1: ComponentIndex, comp2: ComponentIndex): number {
    let score = 0;
    
    // Tag similarity
    const commonTags = comp1.tags.filter(tag => comp2.tags.includes(tag));
    score += commonTags.length * 0.2;
    
    // Props similarity
    const commonPropTypes = comp1.props
      .map(p => p.type)
      .filter(type => comp2.props.some(p => p.type === type));
    score += commonPropTypes.length * 0.15;
    
    // Import similarity
    const commonImports = comp1.imports.filter(imp => comp2.imports.includes(imp));
    score += commonImports.length * 0.1;
    
    // Name similarity (simple string similarity)
    const nameSimilarity = this.calculateStringSimilarity(comp1.name, comp2.name);
    score += nameSimilarity * 0.3;
    
    return Math.min(1, score);
  }

  private calculateUsageSimilarity(comp1: ComponentIndex, comp2: ComponentIndex): number {
    // Components used in similar contexts
    const commonUsageContexts = comp1.usedIn.filter(context => 
      comp2.usedIn.includes(context)
    );
    
    const totalContexts = new Set([...comp1.usedIn, ...comp2.usedIn]).size;
    
    if (totalContexts === 0) return 0;
    
    return commonUsageContexts.length / totalContexts;
  }

  private calculateVisualSimilarity(comp1: ComponentIndex, comp2: ComponentIndex): number {
    // This would require actual image comparison
    // For now, use style-based similarity as a proxy
    
    const styles1 = comp1.styles.computedStyles;
    const styles2 = comp2.styles.computedStyles;
    
    const styleKeys = new Set([...Object.keys(styles1), ...Object.keys(styles2)]);
    let similarStyles = 0;
    
    for (const key of styleKeys) {
      if (styles1[key] === styles2[key]) {
        similarStyles++;
      }
    }
    
    return styleKeys.size > 0 ? similarStyles / styleKeys.size : 0;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array.from({ length: str2.length + 1 }, (_, i) => [i]);
    matrix[0] = Array.from({ length: str1.length + 1 }, (_, i) => i);
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private findMatches(component: ComponentIndex, query: SearchQuery): SearchResult['matches'] {
    const matches: SearchResult['matches'] = [];
    
    if (!query.text) return matches;
    
    const searchText = query.text.toLowerCase();
    
    // Find matches in different fields
    const fields = [
      { name: 'name', content: component.name },
      { name: 'description', content: component.description },
      { name: 'sourceCode', content: component.sourceCode },
    ];
    
    for (const field of fields) {
      const content = field.content.toLowerCase();
      const index = content.indexOf(searchText);
      
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + searchText.length + 50);
        const snippet = field.content.substring(start, end);
        
        matches.push({
          field: field.name,
          snippet,
          highlightStart: index - start,
          highlightEnd: index - start + searchText.length,
        });
      }
    }
    
    return matches;
  }
}

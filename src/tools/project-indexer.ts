import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import { BrowserManager } from '../utils/browser.js';
import { ImageProcessor } from '../utils/image-processor.js';

export interface ComponentIndex {
  id: string;
  name: string;
  filePath: string;
  sourceCode: string;
  
  // Visual data
  screenshots: {
    desktop?: string;
    tablet?: string;
    mobile?: string;
  };
  
  bounds: {
    desktop?: BoundingBox;
    tablet?: BoundingBox;
    mobile?: BoundingBox;
  };
  
  // Code metadata
  props: PropDefinition[];
  imports: string[];
  dependencies: string[];
  
  // Styling
  styles: {
    css: string;
    computedStyles: Record<string, string>;
  };
  
  // Relationships
  usedIn: string[];
  children: string[];
  
  // Metadata
  description: string;
  tags: string[];
  lastModified: Date;
}

export interface ProjectIndex {
  metadata: {
    projectPath: string;
    framework: 'react' | 'vue' | 'angular' | 'unknown';
    lastIndexed: Date;
    componentsCount: number;
    pagesCount: number;
  };
  
  components: ComponentIndex[];
  pages: PageIndex[];
  embeddings?: {
    [componentId: string]: {
      visual: number[];
      semantic: number[];
    };
  };
}

export interface PageIndex {
  id: string;
  name: string;
  route: string;
  filePath: string;
  components: string[];
  screenshots: {
    desktop?: string;
    tablet?: string;
    mobile?: string;
  };
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export class ProjectIndexer {
  private projectPath: string;
  private index: ProjectIndex;
  private browserManager: BrowserManager;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.browserManager = new BrowserManager();
    this.index = {
      metadata: {
        projectPath,
        framework: 'unknown',
        lastIndexed: new Date(),
        componentsCount: 0,
        pagesCount: 0,
      },
      components: [],
      pages: [],
    };
  }

  async indexProject(): Promise<ProjectIndex> {
    console.log(`🔍 Starting project indexing for: ${this.projectPath}`);
    
    try {
      // Step 1: Analyze project structure
      await this.analyzeProjectStructure();
      
      // Step 2: Discover components
      await this.discoverComponents();
      
      // Step 3: Discover pages/routes
      await this.discoverPages();
      
      // Step 4: Initialize browser for visual analysis
      await this.browserManager.initialize();
      
      // Step 5: Capture visual data (if dev server is running)
      await this.captureVisualData();
      
      // Step 6: Save index
      await this.saveIndex();
      
      console.log(`✅ Indexing complete! Found ${this.index.components.length} components and ${this.index.pages.length} pages`);
      
      return this.index;
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      throw error;
    } finally {
      await this.browserManager.close();
    }
  }

  private async analyzeProjectStructure(): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Detect framework
      if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
        this.index.metadata.framework = 'react';
      } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
        this.index.metadata.framework = 'vue';
      } else if (packageJson.dependencies?.['@angular/core']) {
        this.index.metadata.framework = 'angular';
      }
      
      console.log(`📦 Detected framework: ${this.index.metadata.framework}`);
    } catch (error) {
      console.warn('⚠️ Could not analyze package.json, proceeding with unknown framework');
    }
  }

  private async discoverComponents(): Promise<void> {
    const srcPath = path.join(this.projectPath, 'src');
    const components = await this.findComponentFiles(srcPath);
    
    for (const filePath of components) {
      try {
        const component = await this.analyzeComponent(filePath);
        this.index.components.push(component);
      } catch (error) {
        console.warn(`⚠️ Failed to analyze component: ${filePath}`, error);
      }
    }
    
    this.index.metadata.componentsCount = this.index.components.length;
    console.log(`🧩 Discovered ${this.index.components.length} components`);
  }

  private async findComponentFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.findComponentFiles(fullPath));
        } else if (entry.isFile() && this.isComponentFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  private isComponentFile(fileName: string): boolean {
    const componentExtensions = ['.tsx', '.jsx', '.vue', '.ts', '.js'];
    const hasValidExtension = componentExtensions.some(ext => fileName.endsWith(ext));
    
    // Basic heuristic: file name starts with capital letter (React convention)
    // or contains "component" in the name
    const isComponentName = /^[A-Z]/.test(fileName) || 
                           fileName.toLowerCase().includes('component');
    
    return hasValidExtension && isComponentName;
  }

  private async analyzeComponent(filePath: string): Promise<ComponentIndex> {
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const componentName = fileName.replace(/\.(tsx?|jsx?|vue)$/, '');
    
    // Basic analysis - this could be enhanced with AST parsing
    const imports = this.extractImports(sourceCode);
    const props = this.extractProps(sourceCode);
    
    return {
      id: this.generateComponentId(filePath),
      name: componentName,
      filePath: path.relative(this.projectPath, filePath),
      sourceCode,
      screenshots: {},
      bounds: {},
      props,
      imports,
      dependencies: [],
      styles: {
        css: '',
        computedStyles: {},
      },
      usedIn: [],
      children: [],
      description: this.generateDescription(componentName, sourceCode),
      tags: this.generateTags(sourceCode),
      lastModified: stats.mtime,
    };
  }

  private extractImports(sourceCode: string): string[] {
    const importRegex = /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(sourceCode)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractProps(sourceCode: string): PropDefinition[] {
    // Basic prop extraction - this could be enhanced with TypeScript AST parsing
    const props: PropDefinition[] = [];
    
    // Look for interface/type definitions
    const interfaceRegex = /interface\s+\w*Props\s*{([^}]+)}/g;
    const match = interfaceRegex.exec(sourceCode);
    
    if (match) {
      const propsBody = match[1];
      const propLines = propsBody.split('\n').map(line => line.trim()).filter(Boolean);
      
      for (const line of propLines) {
        const propMatch = line.match(/(\w+)(\?)?:\s*([^;]+)/);
        if (propMatch) {
          props.push({
            name: propMatch[1],
            type: propMatch[3].trim(),
            required: !propMatch[2], // No '?' means required
          });
        }
      }
    }
    
    return props;
  }

  private generateComponentId(filePath: string): string {
    return path.relative(this.projectPath, filePath).replace(/[/\\]/g, '_').replace(/\.[^.]+$/, '');
  }

  private generateDescription(name: string, sourceCode: string): string {
    // Extract JSDoc comments or generate based on component structure
    const jsdocMatch = sourceCode.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
    if (jsdocMatch) {
      return jsdocMatch[1].trim();
    }
    
    return `${name} component`;
  }

  private generateTags(sourceCode: string): string[] {
    const tags: string[] = [];
    
    if (sourceCode.includes('useState')) tags.push('stateful');
    if (sourceCode.includes('useEffect')) tags.push('side-effects');
    if (sourceCode.includes('props.children')) tags.push('container');
    if (sourceCode.includes('onClick') || sourceCode.includes('onPress')) tags.push('interactive');
    if (sourceCode.includes('styled') || sourceCode.includes('className')) tags.push('styled');
    
    return tags;
  }

  private async discoverPages(): Promise<void> {
    // This would be enhanced to discover routes based on the framework
    const pagesPath = path.join(this.projectPath, 'src', 'pages');
    
    try {
      const pageFiles = await this.findPageFiles(pagesPath);
      
      for (const filePath of pageFiles) {
        try {
          const page = await this.analyzePage(filePath);
          this.index.pages.push(page);
        } catch (error) {
          console.warn(`⚠️ Failed to analyze page: ${filePath}`, error);
        }
      }
    } catch (error) {
      // Pages directory might not exist
    }
    
    this.index.metadata.pagesCount = this.index.pages.length;
    console.log(`📄 Discovered ${this.index.pages.length} pages`);
  }

  private async findPageFiles(dirPath: string): Promise<string[]> {
    // Similar to findComponentFiles but for pages
    return this.findComponentFiles(dirPath);
  }

  private async analyzePage(filePath: string): Promise<PageIndex> {
    const fileName = path.basename(filePath);
    const pageName = fileName.replace(/\.(tsx?|jsx?|vue)$/, '');
    const sourceCode = await fs.readFile(filePath, 'utf8');
    
    // Extract components used in this page
    const usedComponents = this.extractUsedComponents(sourceCode);
    
    return {
      id: this.generateComponentId(filePath),
      name: pageName,
      route: this.generateRouteFromFileName(pageName),
      filePath: path.relative(this.projectPath, filePath),
      components: usedComponents,
      screenshots: {},
    };
  }

  private extractUsedComponents(sourceCode: string): string[] {
    // Extract JSX component usage
    const componentRegex = /<([A-Z]\w*)/g;
    const components = new Set<string>();
    let match;
    
    while ((match = componentRegex.exec(sourceCode)) !== null) {
      components.add(match[1]);
    }
    
    return Array.from(components);
  }

  private generateRouteFromFileName(fileName: string): string {
    if (fileName.toLowerCase() === 'index' || fileName.toLowerCase() === 'home') {
      return '/';
    }
    return `/${fileName.toLowerCase()}`;
  }

  private async captureVisualData(): Promise<void> {
    // This would require a running development server
    // For now, we'll skip visual capture in the basic implementation
    console.log('📸 Visual capture skipped - requires running dev server');
  }

  private async saveIndex(): Promise<void> {
    const indexPath = path.join(this.projectPath, '.ui-context-index.json');
    await fs.writeFile(indexPath, JSON.stringify(this.index, null, 2));
    console.log(`💾 Index saved to: ${indexPath}`);
  }

  static async loadIndex(projectPath: string): Promise<ProjectIndex | null> {
    const indexPath = path.join(projectPath, '.ui-context-index.json');
    
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      return JSON.parse(indexData);
    } catch (error) {
      return null;
    }
  }
}

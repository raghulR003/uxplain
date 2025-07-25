#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { ProjectIndexer } from '../tools/project-indexer.js';
import { IndexSearchEngine } from '../tools/index-search-engine.js';
import { VisualAnalyzer } from '../tools/visual-analyzer.js';

interface IndexOptions {
  path: string;
  output: string;
}

interface SearchOptions {
  path: string;
  query?: string;
  tags?: string;
  limit: string;
}

interface SimilarOptions {
  path: string;
  component: string;
  type: string;
  limit: string;
}

interface VisualAnalyzeOptions {
  url: string;
  selector?: string;
  output: string;
}

interface StatsOptions {
  path: string;
}

const program = new Command();

program
  .name('ui-context-indexer')
  .description('Index and search UI components in your project')
  .version('1.0.0');

program
  .command('index')
  .description('Index the current project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-o, --output <output>', 'Output file for index', '.ui-context-index.json')
  .action(async (options: IndexOptions) => {
    const projectPath = path.resolve(options.path);
    console.log(`🔍 Indexing project: ${projectPath}`);
    
    try {
      const indexer = new ProjectIndexer(projectPath);
      const index = await indexer.indexProject();
      
      console.log('\n📊 Indexing Results:');
      console.log(`- Framework: ${index.metadata.framework}`);
      console.log(`- Components: ${index.metadata.componentsCount}`);
      console.log(`- Pages: ${index.metadata.pagesCount}`);
      console.log(`- Index saved to: ${path.join(projectPath, options.output)}`);
      
      // Display component summary
      if (index.components.length > 0) {
        console.log('\n🧩 Discovered Components:');
        for (const component of index.components.slice(0, 10)) {
          console.log(`  - ${component.name} (${component.props.length} props, tags: ${component.tags.join(', ')})`);
        }
        if (index.components.length > 10) {
          console.log(`  ... and ${index.components.length - 10} more`);
        }
      }
      
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search indexed components')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-q, --query <query>', 'Search query')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-l, --limit <limit>', 'Limit results', '10')
  .action(async (options: SearchOptions) => {
    const projectPath = path.resolve(options.path);
    
    try {
      const index = await ProjectIndexer.loadIndex(projectPath);
      if (!index) {
        console.error('❌ No index found. Run "ui-context-indexer index" first.');
        process.exit(1);
      }
      
      const searchEngine = new IndexSearchEngine(index);
      
      const searchQuery = {
        text: options.query,
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
      };
      
      const results = searchEngine.searchComponents(searchQuery);
      const limit = parseInt(options.limit);
      
      console.log(`🔍 Search Results (${results.length} found):\n`);
      
      for (const result of results.slice(0, limit)) {
        console.log(`📦 ${result.component.name} (score: ${result.relevanceScore.toFixed(1)})`);
        console.log(`   📁 ${result.component.filePath}`);
        console.log(`   📝 ${result.component.description}`);
        console.log(`   🏷️  Tags: ${result.component.tags.join(', ')}`);
        
        if (result.component.props.length > 0) {
          console.log(`   ⚙️  Props: ${result.component.props.map(p => `${p.name}: ${p.type}`).join(', ')}`);
        }
        
        if (result.matches.length > 0) {
          console.log(`   🎯 Matches:`);
          for (const match of result.matches.slice(0, 2)) {
            const snippet = match.snippet.length > 100 
              ? match.snippet.substring(0, 100) + '...'
              : match.snippet;
            console.log(`      ${match.field}: "${snippet}"`);
          }
        }
        
        console.log('');
      }
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
  });

program
  .command('similar')
  .description('Find similar components')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-c, --component <component>', 'Component ID or name')
  .option('-t, --type <type>', 'Similarity type: semantic, visual, usage', 'semantic')
  .option('-l, --limit <limit>', 'Limit results', '5')
  .action(async (options: SimilarOptions) => {
    const projectPath = path.resolve(options.path);
    
    try {
      const index = await ProjectIndexer.loadIndex(projectPath);
      if (!index) {
        console.error('❌ No index found. Run "ui-context-indexer index" first.');
        process.exit(1);
      }
      
      const searchEngine = new IndexSearchEngine(index);
      
      // Find component by name or ID
      let componentId = options.component;
      const component = index.components.find(c => 
        c.id === componentId || c.name === componentId
      );
      
      if (!component) {
        console.error(`❌ Component "${componentId}" not found.`);
        console.log('\n📋 Available components:');
        for (const comp of index.components.slice(0, 10)) {
          console.log(`  - ${comp.name} (${comp.id})`);
        }
        process.exit(1);
      }
      
      componentId = component.id;
      const similarityType = options.type as 'semantic' | 'visual' | 'usage';
      const limit = parseInt(options.limit);
      
      const results = searchEngine.findSimilarComponents(componentId, similarityType, limit);
      
      console.log(`🔍 Components similar to "${component.name}" (${similarityType} similarity):\n`);
      
      for (const result of results) {
        console.log(`📦 ${result.component.name} (${(result.similarityScore * 100).toFixed(1)}% similar)`);
        console.log(`   📁 ${result.component.filePath}`);
        console.log(`   📝 ${result.component.description}`);
        console.log(`   🏷️  Tags: ${result.component.tags.join(', ')}`);
        console.log('');
      }
      
    } catch (error) {
      console.error('❌ Similar component search failed:', error);
      process.exit(1);
    }
  });

program
  .command('visual-analyze')
  .description('Analyze visual components from a running dev server')
  .option('-u, --url <url>', 'Dev server URL', 'http://localhost:3000')
  .option('-s, --selector <selector>', 'Component CSS selector')
  .option('-o, --output <output>', 'Output directory for analysis', './visual-analysis')
  .action(async (options: VisualAnalyzeOptions) => {
    console.log(`🎨 Analyzing visual components at: ${options.url}`);
    
    try {
      const analyzer = new VisualAnalyzer();
      
      if (options.selector) {
        // Analyze specific component
        const results = await analyzer.analyzeComponent(options.url, options.selector);
        
        console.log(`📸 Captured component "${options.selector}" across breakpoints:`);
        for (const [breakpoint, result] of Object.entries(results)) {
          console.log(`  - ${breakpoint}: ${result.componentBounds.width}x${result.componentBounds.height}`);
          console.log(`    Screenshot size: ${result.screenshot.length} chars (base64)`);
          console.log(`    Computed styles: ${Object.keys(result.computedStyles).length} properties`);
        }
      } else {
        // Analyze full page
        const result = await analyzer.analyzeFullPage(options.url);
        
        console.log(`📸 Full page analysis complete:`);
        console.log(`  - Screenshot size: ${result.screenshot.length} chars (base64)`);
        console.log(`  - Components found: ${result.components.length}`);
        
        console.log('\n🧩 Detected components:');
        for (const component of result.components.slice(0, 10)) {
          console.log(`  - ${component.tagName}${component.id ? '#' + component.id : ''}${component.className ? '.' + component.className.split(' ').join('.') : ''}`);
          console.log(`    Bounds: ${component.bounds.width}x${component.bounds.height} at (${component.bounds.x}, ${component.bounds.y})`);
        }
        
        if (result.components.length > 10) {
          console.log(`  ... and ${result.components.length - 10} more`);
        }
      }
      
    } catch (error) {
      console.error('❌ Visual analysis failed:', error);
      if (error instanceof Error && error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        console.log('💡 Make sure your development server is running at the specified URL.');
      }
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show project statistics')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options: StatsOptions) => {
    const projectPath = path.resolve(options.path);
    
    try {
      const index = await ProjectIndexer.loadIndex(projectPath);
      if (!index) {
        console.error('❌ No index found. Run "ui-context-indexer index" first.');
        process.exit(1);
      }
      
      const searchEngine = new IndexSearchEngine(index);
      
      console.log('📊 Project Statistics:\n');
      
      console.log(`🏗️  Framework: ${index.metadata.framework}`);
      console.log(`📅 Last indexed: ${new Date(index.metadata.lastIndexed).toLocaleString()}`);
      console.log(`📦 Total components: ${index.metadata.componentsCount}`);
      console.log(`📄 Total pages: ${index.metadata.pagesCount}\n`);
      
      // Tag distribution
      const tagCounts = new Map<string, number>();
      for (const component of index.components) {
        for (const tag of component.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      
      console.log('🏷️  Tag Distribution:');
      const sortedTags = Array.from(tagCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      for (const [tag, count] of sortedTags) {
        console.log(`   ${tag}: ${count} components`);
      }
      
      // Component complexity
      const propsStats = index.components.map(c => c.props.length);
      const avgProps = propsStats.reduce((a, b) => a + b, 0) / propsStats.length;
      const maxProps = Math.max(...propsStats);
      
      console.log(`\n⚙️  Component Complexity:`);
      console.log(`   Average props per component: ${avgProps.toFixed(1)}`);
      console.log(`   Most complex component: ${maxProps} props`);
      
      // Usage graph stats
      const usageGraph = searchEngine.getComponentUsageGraph();
      const usageCounts = Array.from(usageGraph.values()).map(arr => arr.length);
      const avgUsage = usageCounts.reduce((a, b) => a + b, 0) / usageCounts.length;
      const maxUsage = Math.max(...usageCounts);
      
      console.log(`\n🔗 Usage Statistics:`);
      console.log(`   Average usage per component: ${avgUsage.toFixed(1)}`);
      console.log(`   Most used component: ${maxUsage} usages`);
      
    } catch (error) {
      console.error('❌ Stats generation failed:', error);
      process.exit(1);
    }
  });

// Only run if this is the main module
if (require.main === module) {
  program.parse();
}

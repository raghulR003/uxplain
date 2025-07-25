#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { UIContextTool } from './tools/ui-context.js';
import { ProjectIndexer } from './tools/project-indexer.js';
import { IndexSearchEngine } from './tools/index-search-engine.js';
import { VisualAnalyzer } from './tools/visual-analyzer.js';
import { VisualCodeCorrelator } from './tools/visual-code-correlator.js';
import { closeBrowserManager } from './utils/browser.js';
import type { UIContextParams } from './types/index.js';

// Server configuration
const SERVER_NAME = 'ui-context-mcp-server';
const SERVER_VERSION = '0.1.0';

class UIContextMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // === PROJECT MANAGEMENT TOOLS ===
          {
            name: 'index_project',
            description: '🔧 SETUP TOOL: Index a React/Vue project to enable intelligent code-visual correlation. Must be run first before using analysis tools.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Absolute path to the project directory to index',
                },
                includeVisualAnalysis: {
                  type: 'boolean',
                  description: 'Whether to include visual analysis (requires running dev server)',
                  default: false,
                },
                devServerUrl: {
                  type: 'string',
                  description: 'URL of the running development server for visual analysis',
                  default: 'http://localhost:3000',
                },
              },
              required: ['projectPath'],
            },
          },
          
          // === VISUAL ANALYSIS TOOLS ===
          {
            name: 'screenshot_page',
            description: '📸 BASIC TOOL: Take a simple screenshot of a webpage. Use only for basic visual inspection or documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to capture',
                },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'number', default: 1200 },
                    height: { type: 'number', default: 800 },
                  },
                  description: 'Viewport size for capturing',
                },
                fullPage: {
                  type: 'boolean',
                  description: 'Whether to capture the full page',
                  default: false,
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'analyze_responsive_design',
            description: '📱 RESPONSIVE TOOL: Analyze responsive behavior across mobile, tablet, desktop. Use when user asks about responsive issues, breakpoints, or mobile layout.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to analyze for responsive behavior',
                },
                selector: {
                  type: 'string',
                  description: 'Optional CSS selector to focus on specific element',
                },
              },
              required: ['url'],
            },
          },
          
          // === ELEMENT-SPECIFIC ANALYSIS TOOLS ===
          {
            name: 'analyze_button_elements',
            description: '🎯 BUTTON SPECIALIST: Analyze button positioning, touch targets, accessibility, and responsive behavior. Use when user asks about buttons, click elements, or interactive controls.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to analyze for button elements',
                },
                projectPath: {
                  type: 'string',
                  description: 'Optional: Path to indexed project for source code correlation',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'analyze_form_elements',
            description: '📝 FORM SPECIALIST: Analyze forms, inputs, validation, and user interaction patterns. Use when user asks about forms, inputs, or data entry.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to analyze for form elements',
                },
                projectPath: {
                  type: 'string',
                  description: 'Optional: Path to indexed project for source code correlation',
                },
              },
              required: ['url'],
            },
          },
          
          // === INTELLIGENT CODE CORRELATION ===
          {
            name: 'correlate_visual_to_source',
            description: '🧠 INTELLIGENT CORRELATOR: Map visual elements to their React/Vue source code. Use when user wants to understand which components create specific visual elements, or asks about connecting UI to code. REQUIRES indexed project.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to analyze for visual-code correlation',
                },
                projectPath: {
                  type: 'string',
                  description: 'REQUIRED: Absolute path to the indexed project directory',
                },
                focusElement: {
                  type: 'string',
                  enum: ['buttons', 'forms', 'cards', 'navigation', 'all'],
                  description: 'Type of elements to focus analysis on',
                  default: 'all',
                },
                includeRecommendations: {
                  type: 'boolean',
                  description: 'Whether to include improvement recommendations',
                  default: true,
                },
              },
              required: ['url', 'projectPath'],
            },
          },
          
          // === COMPONENT SEARCH & DISCOVERY ===
          {
            name: 'search_components',
            description: '🔍 SEARCH TOOL: Search indexed components by name, functionality, or properties. Use when user wants to find specific components in their codebase.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Absolute path to the indexed project directory',
                },
                query: {
                  type: 'string',
                  description: 'Text search query across component names, descriptions, and source code',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by component tags (e.g., "interactive", "stateful", "styled")',
                },
                componentType: {
                  type: 'string',
                  enum: ['functional', 'class', 'any'],
                  description: 'Filter by component type',
                  default: 'any',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10,
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'get_project_insights',
            description: '📊 INSIGHTS TOOL: Get comprehensive statistics and health metrics for an indexed project. Use when user wants to understand their codebase structure.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Absolute path to the indexed project directory',
                },
              },
              required: ['projectPath'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'index_project':
            return await this.handleIndexProject(args as any);

          case 'screenshot_page':
            return await this.handleScreenshotPage(args as any);

          case 'analyze_responsive_design':
            return await this.handleAnalyzeResponsiveDesign(args as any);

          case 'analyze_button_elements':
            return await this.handleAnalyzeButtonElements(args as any);

          case 'analyze_form_elements':
            return await this.handleAnalyzeFormElements(args as any);

          case 'correlate_visual_to_source':
            return await this.handleCorrelateVisualToSource(args as any);

          case 'search_components':
            return await this.handleSearchComponents(args as any);

          case 'get_project_insights':
            return await this.handleGetProjectInsights(args as any);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error(`Tool execution failed for ${name}:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });
  }

  private async handleScreenshotPage(params: any) {
    console.log(`Taking screenshot of: ${params.url}`);
    
    const simpleParams: UIContextParams = {
      url: params.url,
      viewport: params.viewport,
      fullPage: params.fullPage || false,
    };
    
    const result = await UIContextTool.captureUIContext(simpleParams);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `# Screenshot Captured

**URL**: ${params.url}
**Viewport**: ${result.context.viewport.width}x${result.context.viewport.height}
**Timestamp**: ${result.context.timestamp}

This is a basic screenshot capture. For detailed analysis, use specialized tools like "analyze_button_elements" or "correlate_visual_to_source".`,
        },
        {
          type: 'image' as const,
          data: result.screenshot,
          mimeType: 'image/png',
        },
      ],
    };
  }

  private async handleAnalyzeResponsiveDesign(params: any) {
    console.log(`Analyzing responsive design for: ${params.url}`);
    
    const responsiveParams: UIContextParams = {
      url: params.url,
      selector: params.selector,
      includeResponsive: true,
      viewport: { width: 1200, height: 800 },
    };
    
    const result = await UIContextTool.captureUIContext(responsiveParams);
    
    const content = [
      {
        type: 'text' as const,
        text: `# Responsive Design Analysis

## Overview
- **URL**: ${result.context.url}
- **Analysis Type**: Multi-breakpoint responsive analysis
- **Breakpoints Tested**: Mobile (375px), Tablet (768px), Desktop (1200px)

## Responsive Behavior
${result.responsive ? result.responsive.map(view => `
### ${view.deviceInfo?.name} (${view.breakpoint}px)
**Device Type**: ${view.deviceInfo?.type}
**Key Layout Changes**:
${Object.entries(view.computedStyles).map(([prop, value]) => `- **${prop}**: ${value}`).join('\n')}
`).join('\n') : 'No responsive views captured'}

## Responsive Issues Found
${params.selector ? `Focused on element: \`${params.selector}\`` : 'Full page analysis'}

**Recommendations**:
- Ensure touch targets are at least 44px on mobile
- Check text readability at smaller sizes
- Verify navigation is accessible on mobile
- Test form elements on touch devices`,
      },
      {
        type: 'image' as const,
        data: result.screenshot,
        mimeType: 'image/png',
      },
    ];

    // Add responsive view images
    if (result.responsive) {
      result.responsive.forEach((view) => {
        content.push({
          type: 'image' as const,
          data: view.screenshot,
          mimeType: 'image/png',
        });
      });
    }

    return { content };
  }

  private async handleAnalyzeButtonElements(params: any) {
    console.log(`Analyzing button elements for: ${params.url}`);
    
    // Use the visual-code correlator if project path is provided
    if (params.projectPath) {
      const correlator = new VisualCodeCorrelator();
      const correlation = await correlator.analyzeWithCodeCorrelation(
        params.url,
        params.projectPath,
        'button'
      );
      
      const buttonElements = correlation.correlations.filter((c: any) => 
        ['button', 'input'].includes(c.visualElement.tagName) || 
        c.visualElement.attributes?.role === 'button'
      );
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Button Analysis with Source Code Correlation

## Summary
- **Total Buttons Found**: ${buttonElements.length}
- **Successfully Matched to Code**: ${buttonElements.filter((b: any) => b.sourceComponent).length}
- **Accessibility Issues**: ${buttonElements.filter((b: any) => b.responsiveIssues.length > 0).length}

## Button-Specific Analysis

${buttonElements.map((button: any, index: number) => `
### Button ${index + 1}: "${button.visualElement.text || button.visualElement.selector}"

**Visual Properties**:
- Position: (${button.visualElement.bounds.x}, ${button.visualElement.bounds.y})
- Size: ${button.visualElement.bounds.width}×${button.visualElement.bounds.height}px
- Touch Target: ${button.visualElement.bounds.width >= 44 && button.visualElement.bounds.height >= 44 ? '✅ Adequate' : '❌ Too Small'}

${button.sourceComponent ? `**Source Component**: \`${button.sourceComponent.name}\`
**File**: \`${button.sourceComponent.filePath}\`
**Props**: ${button.sourceComponent.props.map((p: any) => p.name).join(', ') || 'None'}` : '**No Source Component Found**'}

${button.responsiveIssues.length > 0 ? `**Issues**:
${button.responsiveIssues.map((issue: string) => `- ⚠️ ${issue}`).join('\n')}` : '✅ No issues found'}

${button.recommendations.length > 0 ? `**Recommendations**:
${button.recommendations.map((rec: string) => `- 💡 ${rec}`).join('\n')}` : ''}
`).join('\n---\n')}

## Button-Specific Recommendations
1. **Touch Targets**: Ensure all buttons are at least 44×44px for mobile accessibility
2. **Spacing**: Maintain adequate spacing (8px minimum) between buttons
3. **States**: Implement clear hover, focus, and active states
4. **Labels**: Provide descriptive text or aria-labels for icon buttons`,
        }],
      };
    } else {
      // Fallback to basic visual analysis
      const result = await UIContextTool.captureUIContext({
        url: params.url,
        includeAccessibility: true,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Basic Button Analysis

**URL**: ${params.url}

This is a basic button analysis. For intelligent code correlation and detailed recommendations, please:

1. First index your project: Use "index_project" tool
2. Then use this tool with the projectPath parameter

**Current Analysis**: Basic visual inspection
**Accessibility Info**: ${result.accessibility ? 'Included' : 'Not available'}

💡 **Tip**: Provide the projectPath parameter to get source code correlation and detailed recommendations.`,
        }],
      };
    }
  }

  private async handleAnalyzeFormElements(params: any) {
    console.log(`Analyzing form elements for: ${params.url}`);
    
    // Similar structure to button analysis but focused on forms
    if (params.projectPath) {
      const correlator = new VisualCodeCorrelator();
      const correlation = await correlator.analyzeWithCodeCorrelation(
        params.url,
        params.projectPath,
        'input'
      );
      
      const formElements = correlation.correlations.filter((c: any) => 
        ['input', 'textarea', 'select', 'form'].includes(c.visualElement.tagName)
      );
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Form Elements Analysis

## Summary
- **Form Elements Found**: ${formElements.length}
- **Matched to Source Code**: ${formElements.filter((f: any) => f.sourceComponent).length}
- **Validation Issues**: ${formElements.filter((f: any) => f.responsiveIssues.length > 0).length}

## Form-Specific Analysis

${formElements.map((element: any, index: number) => `
### ${element.visualElement.tagName.toUpperCase()} ${index + 1}: "${element.visualElement.text || element.visualElement.attributes?.placeholder || element.visualElement.selector}"

**Properties**:
- Type: ${element.visualElement.attributes?.type || 'text'}
- Required: ${element.visualElement.attributes?.required ? 'Yes' : 'No'}
- Label: ${element.visualElement.attributes?.ariaLabel || 'Missing'}

${element.sourceComponent ? `**Source Component**: \`${element.sourceComponent.name}\`` : '**No Source Component Found**'}

${element.responsiveIssues.length > 0 ? `**Issues**:
${element.responsiveIssues.map((issue: string) => `- ⚠️ ${issue}`).join('\n')}` : '✅ No issues found'}
`).join('\n---\n')}`,
        }],
      };
    } else {
      return {
        content: [{
          type: 'text' as const,
          text: `# Form Analysis - Project Indexing Required

To analyze form elements with source code correlation, please:

1. Index your project first: Use "index_project" tool with your project path
2. Then run this analysis again with the projectPath parameter

This will enable intelligent mapping of form elements to your React/Vue components.`,
        }],
      };
    }
  }

  private async handleCorrelateVisualToSource(params: any) {
    console.log(`Correlating visual elements to source code for: ${params.url}`);
    
    try {
      // This is the primary intelligent correlation tool
      const index = await ProjectIndexer.loadIndex(params.projectPath);
      if (!index) {
        return {
          content: [{
            type: 'text' as const,
            text: `# Project Not Indexed

The project at \`${params.projectPath}\` has not been indexed yet.

**Please run the indexing tool first**:
1. Use "index_project" tool with projectPath: "${params.projectPath}"
2. Then run this correlation analysis again

This will enable intelligent mapping of visual elements to your source code components.`,
          }],
        };
      }
      
      const correlator = new VisualCodeCorrelator();
      const correlation = await correlator.analyzeWithCodeCorrelation(
        params.url,
        params.projectPath,
        params.focusElement
      );
      
      return {
        content: [{
          type: 'text' as const,
          text: `# 🧠 Intelligent Visual-to-Source Code Correlation

## Analysis Summary
- **URL**: ${params.url}
- **Focus**: ${params.focusElement || 'All elements'}
- **Total Elements**: ${correlation.summary.totalElements}
- **Successfully Correlated**: ${correlation.summary.matchedComponents}
- **Unmatched Elements**: ${correlation.summary.unmatchedElements}

## 🎯 Matched Elements with Source Code

${correlation.correlations.filter((c: any) => c.sourceComponent).map((match: any, index: number) => `
### ${index + 1}. ${match.visualElement.tagName.toUpperCase()}: "${match.visualElement.text || 'Unnamed'}"

**🔗 Source Component**: \`${match.sourceComponent.name}\`
**📁 File**: \`${match.sourceComponent.filePath}\`
**🎯 Confidence**: ${(match.confidence * 100).toFixed(1)}%
**🔍 Match Reason**: ${match.matchReason}

**Visual Position**: (${match.visualElement.bounds.x}, ${match.visualElement.bounds.y})
**Size**: ${match.visualElement.bounds.width}×${match.visualElement.bounds.height}px

**Component Details**:
- **Props**: ${match.sourceComponent.props.length > 0 ? match.sourceComponent.props.map((p: any) => `\`${p.name}\``).join(', ') : 'None'}
- **Tags**: ${match.sourceComponent.tags.join(', ') || 'None'}

${match.codeSnippet ? `**📝 Relevant Code**:
\`\`\`tsx
${match.codeSnippet}
\`\`\`` : ''}

${match.responsiveIssues.length > 0 ? `**⚠️ Issues Found**:
${match.responsiveIssues.map((issue: string) => `- ${issue}`).join('\n')}` : ''}

${params.includeRecommendations && match.recommendations.length > 0 ? `**💡 Recommendations**:
${match.recommendations.map((rec: string) => `- ${rec}`).join('\n')}` : ''}
`).join('\n---\n')}

## 🎨 Visual Elements Overview
This correlation enables you to:
- **Understand** which React/Vue components create specific visual elements
- **Debug** layout and styling issues directly in the source code
- **Refactor** with confidence knowing the visual impact
- **Maintain** design system consistency

**Next Steps**: Use the component file paths to make targeted improvements to your codebase.`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `# Correlation Analysis Failed

**Error**: ${(error as Error).message}

**Troubleshooting**:
1. Ensure the project has been indexed using "index_project"
2. Verify the URL is accessible and loads properly
3. Check that the project path is correct

**Debug Info**: ${(error as Error).stack}`,
        }],
      };
    }
  }

  private async handleGetProjectInsights(params: any) {
    // Rename from handleGetProjectStats for better clarity
    return await this.handleGetProjectStats(params);
  }

  private async handleCaptureUIContext(params: UIContextParams) {
    console.log(`Capturing UI context for: ${params.url}`);
    
    const result = await UIContextTool.captureUIContext(params);
    
    const content = [
      {
        type: 'text' as const,
        text: `# UI Context Analysis

## Page Information
- **URL**: ${result.context.url}
- **Title**: ${result.context.pageTitle}
- **Viewport**: ${result.context.viewport.width}x${result.context.viewport.height}
- **Timestamp**: ${result.context.timestamp}

## Element Information
${params.selector ? `- **Target Selector**: ${params.selector}` : '- **Scope**: Full page'}
- **Element Bounds**: ${result.elementBounds.width}x${result.elementBounds.height} at (${result.elementBounds.x}, ${result.elementBounds.y})

## Performance Metrics
- **Capture Time**: ${result.performance?.captureTime}ms
- **Image Size**: ${Math.round((result.performance?.imageSize || 0) / 1024)}KB
- **DOM Size**: ${Math.round((result.performance?.domSize || 0) / 1024)}KB
- **CSS Size**: ${Math.round((result.performance?.cssSize || 0) / 1024)}KB

## HTML Structure
\`\`\`html
${result.html}
\`\`\`

## CSS Styles
\`\`\`css
${result.css}
\`\`\`

## Computed Styles
\`\`\`json
${JSON.stringify(result.computedStyles, null, 2)}
\`\`\`

${result.accessibility ? `## Accessibility Information
- **Role**: ${result.accessibility.role}
- **Label**: ${result.accessibility.label || 'None'}
- **Focusable**: ${result.accessibility.focusable}
- **Keyboard Accessible**: ${result.accessibility.keyboardAccessible}
- **Landmarks**: ${result.accessibility.landmarks.join(', ')}` : ''}

${result.responsive ? `## Responsive Views
${result.responsive.map(view => `### ${view.deviceInfo?.name} (${view.breakpoint}px)
- **Device Type**: ${view.deviceInfo?.type}
- **Key Styles**: ${Object.entries(view.computedStyles).map(([prop, value]) => `${prop}: ${value}`).join(', ')}`).join('\n\n')}` : ''}

---

This context provides comprehensive information about the UI element or page, including visual appearance, structural markup, styling rules, and accessibility properties. Use this information to understand the current state and suggest improvements or fixes.
`,
      },
      {
        type: 'image' as const,
        data: result.screenshot,
        mimeType: 'image/png',
      },
    ];

    // Add responsive view images
    if (result.responsive) {
      result.responsive.forEach((view, index) => {
        content.push({
          type: 'image' as const,
          data: view.screenshot,
          mimeType: 'image/png',
        });
      });
    }

    return {
      content,
    };
  }

  private async handleIndexProject(params: any) {
    console.log(`Indexing project: ${params.projectPath}`);
    
    try {
      const indexer = new ProjectIndexer(params.projectPath);
      const index = await indexer.indexProject();
      
      // If visual analysis is requested and dev server URL is provided
      if (params.includeVisualAnalysis && params.devServerUrl) {
        console.log(`Performing visual analysis at: ${params.devServerUrl}`);
        const visualAnalyzer = new VisualAnalyzer();
        const visualAnalysis = await visualAnalyzer.analyzeFullPage(params.devServerUrl);
        
        // Store visual analysis results in the index for future use
        // This could be extended to store screenshots with the index
      }
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Project Indexing Complete

## Project Analysis Results

**Framework Detected**: ${index.metadata.framework}
**Components Found**: ${index.metadata.componentsCount}
**Pages Found**: ${index.metadata.pagesCount}
**Index Location**: ${params.projectPath}/.ui-context-index.json

## Discovered Components

${index.components.map(component => `
### ${component.name}
- **File**: ${component.filePath}
- **Description**: ${component.description}
- **Props**: ${component.props.length} properties
- **Tags**: ${component.tags.join(', ') || 'None'}
- **Imports**: ${component.imports.length} dependencies
`).join('\n')}

## Project Statistics

- **Total Lines of Code**: ${index.components.reduce((acc, c) => acc + c.sourceCode.split('\n').length, 0).toLocaleString()}
- **Average Props per Component**: ${(index.components.reduce((acc, c) => acc + c.props.length, 0) / index.components.length).toFixed(1)}
- **Most Complex Component**: ${index.components.reduce((max, c) => c.props.length > max.props.length ? c : max, index.components[0])?.name || 'None'} (${Math.max(...index.components.map(c => c.props.length))} props)

The project has been successfully indexed and is ready for component search and analysis!`,
        }],
      };
    } catch (error) {
      console.error('Project indexing failed:', error);
      return {
        content: [{
          type: 'text' as const,
          text: `# Project Indexing Failed

**Error**: ${(error as Error).message}

**Possible Solutions**:
1. Ensure the project path exists and is accessible
2. Verify the project contains a valid package.json
3. Check that the project has React/Vue/Angular components in the src/ directory
4. Make sure you have read permissions for the project directory

**Project Path Provided**: ${params.projectPath}`,
        }],
      };
    }
  }

  private async handleSearchComponents(params: any) {
    console.log(`Searching components in: ${params.projectPath}`);
    
    try {
      const index = await ProjectIndexer.loadIndex(params.projectPath);
      if (!index) {
        return {
          content: [{
            type: 'text' as const,
            text: `# No Index Found

The project at \`${params.projectPath}\` has not been indexed yet.

**Please run the indexing tool first**:
\`\`\`
Use the "index_project" tool with projectPath: "${params.projectPath}"
\`\`\``,
          }],
        };
      }
      
      const searchEngine = new IndexSearchEngine(index);
      const searchQuery = {
        text: params.query,
        tags: params.tags,
        componentType: params.componentType,
        hasProps: params.hasProps,
        hasSideEffects: params.hasSideEffects,
      };
      
      const results = searchEngine.searchComponents(searchQuery);
      const limitedResults = results.slice(0, params.limit || 10);
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Component Search Results

**Query**: ${params.query || 'All components'}
**Filters Applied**: ${JSON.stringify(searchQuery, null, 2)}
**Results Found**: ${results.length} total, showing top ${limitedResults.length}

${limitedResults.length === 0 ? '**No matching components found.**' : limitedResults.map((result, index) => `
## ${index + 1}. ${result.component.name} (Score: ${result.relevanceScore.toFixed(1)})

**File**: \`${result.component.filePath}\`
**Description**: ${result.component.description}
**Tags**: ${result.component.tags.join(', ') || 'None'}
**Props**: ${result.component.props.length > 0 ? result.component.props.map(p => `${p.name}: ${p.type}`).join(', ') : 'None'}

${result.matches.length > 0 ? `**Matches Found**:
${result.matches.map(match => `- **${match.field}**: "${match.snippet.substring(0, 100)}${match.snippet.length > 100 ? '...' : ''}"`).join('\n')}` : ''}
`).join('\n')}

${results.length > limitedResults.length ? `\n**Note**: ${results.length - limitedResults.length} additional results not shown. Increase the limit parameter to see more.` : ''}`,
        }],
      };
    } catch (error) {
      console.error('Component search failed:', error);
      return {
        content: [{
          type: 'text' as const,
          text: `# Component Search Failed

**Error**: ${(error as Error).message}

Please ensure the project has been indexed first using the "index_project" tool.`,
        }],
      };
    }
  }

  private async handleFindSimilarComponents(params: any) {
    console.log(`Finding similar components to: ${params.componentId}`);
    
    try {
      const index = await ProjectIndexer.loadIndex(params.projectPath);
      if (!index) {
        return {
          content: [{
            type: 'text' as const,
            text: `# No Index Found

The project at \`${params.projectPath}\` has not been indexed yet. Please run the "index_project" tool first.`,
          }],
        };
      }
      
      const searchEngine = new IndexSearchEngine(index);
      
      // Find the target component
      const targetComponent = index.components.find(c => 
        c.id === params.componentId || c.name === params.componentId
      );
      
      if (!targetComponent) {
        const availableComponents = index.components.map(c => c.name).join(', ');
        return {
          content: [{
            type: 'text' as const,
            text: `# Component Not Found

Component "${params.componentId}" was not found in the indexed project.

**Available components**: ${availableComponents}`,
          }],
        };
      }
      
      const similarComponents = searchEngine.findSimilarComponents(
        targetComponent.id,
        params.similarityType || 'semantic',
        params.limit || 5
      );
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Similar Components to "${targetComponent.name}"

**Similarity Type**: ${params.similarityType || 'semantic'}
**Components Found**: ${similarComponents.length}

## Target Component
**Name**: ${targetComponent.name}
**File**: \`${targetComponent.filePath}\`
**Description**: ${targetComponent.description}
**Tags**: ${targetComponent.tags.join(', ') || 'None'}

${similarComponents.length === 0 ? '**No similar components found.**' : `## Similar Components

${similarComponents.map((similar, index) => `
### ${index + 1}. ${similar.component.name} (${(similar.similarityScore * 100).toFixed(1)}% similar)

**File**: \`${similar.component.filePath}\`
**Description**: ${similar.component.description}
**Tags**: ${similar.component.tags.join(', ') || 'None'}
**Props**: ${similar.component.props.length > 0 ? similar.component.props.map(p => `${p.name}: ${p.type}`).join(', ') : 'None'}
`).join('\n')}`}`,
        }],
      };
    } catch (error) {
      console.error('Similar component search failed:', error);
      return {
        content: [{
          type: 'text' as const,
          text: `# Similar Component Search Failed

**Error**: ${(error as Error).message}

Please ensure the project has been indexed first using the "index_project" tool.`,
        }],
      };
    }
  }

  private async handleGetProjectStats(params: any) {
    console.log(`Getting project statistics for: ${params.projectPath}`);
    
    try {
      const index = await ProjectIndexer.loadIndex(params.projectPath);
      if (!index) {
        return {
          content: [{
            type: 'text' as const,
            text: `# No Index Found

The project at \`${params.projectPath}\` has not been indexed yet. Please run the "index_project" tool first.`,
          }],
        };
      }
      
      const searchEngine = new IndexSearchEngine(index);
      
      // Calculate statistics
      const tagDistribution = new Map<string, number>();
      for (const component of index.components) {
        for (const tag of component.tags) {
          tagDistribution.set(tag, (tagDistribution.get(tag) || 0) + 1);
        }
      }
      
      const propsStats = index.components.map(c => c.props.length);
      const avgProps = propsStats.length > 0 ? propsStats.reduce((a, b) => a + b, 0) / propsStats.length : 0;
      const maxProps = Math.max(...propsStats, 0);
      const minProps = Math.min(...propsStats, 0);
      
      const usageGraph = searchEngine.getComponentUsageGraph();
      const usageCounts = Array.from(usageGraph.values()).map(arr => arr.length);
      const avgUsage = usageCounts.length > 0 ? usageCounts.reduce((a, b) => a + b, 0) / usageCounts.length : 0;
      const maxUsage = Math.max(...usageCounts, 0);
      
      const topTags = Array.from(tagDistribution.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      const mostComplexComponent = index.components.reduce((max, c) => 
        c.props.length > max.props.length ? c : max, 
        index.components[0]
      );
      
      return {
        content: [{
          type: 'text' as const,
          text: `# Project Statistics

## Overview
**Framework**: ${index.metadata.framework}
**Last Indexed**: ${new Date(index.metadata.lastIndexed).toLocaleString()}
**Total Components**: ${index.metadata.componentsCount}
**Total Pages**: ${index.metadata.pagesCount}

## Component Complexity Analysis
**Average Props per Component**: ${avgProps.toFixed(1)}
**Most Complex Component**: ${mostComplexComponent?.name || 'None'} (${maxProps} props)
**Simplest Component**: ${index.components.find(c => c.props.length === minProps)?.name || 'None'} (${minProps} props)

## Tag Distribution
${topTags.length > 0 ? topTags.map(([tag, count]) => `- **${tag}**: ${count} components`).join('\n') : 'No tags found'}

## Usage Statistics
**Average Usage per Component**: ${avgUsage.toFixed(1)}
**Most Used Component**: ${maxUsage} usages
**Total Component Relationships**: ${Array.from(usageGraph.values()).flat().length}

## Component Details
${index.components.map(component => `
### ${component.name}
- **File**: ${component.filePath}
- **Props**: ${component.props.length}
- **Tags**: ${component.tags.join(', ') || 'None'}
- **Imports**: ${component.imports.length}
- **Last Modified**: ${new Date(component.lastModified).toLocaleDateString()}
`).join('\n')}

## Health Metrics
- **Components with Props**: ${index.components.filter(c => c.props.length > 0).length}/${index.components.length}
- **Interactive Components**: ${index.components.filter(c => c.tags.includes('interactive')).length}/${index.components.length}
- **Stateful Components**: ${index.components.filter(c => c.tags.includes('stateful')).length}/${index.components.length}
- **Components with Side Effects**: ${index.components.filter(c => c.tags.includes('side-effects')).length}/${index.components.length}`,
        }],
      };
    } catch (error) {
      console.error('Project statistics failed:', error);
      return {
        content: [{
          type: 'text' as const,
          text: `# Project Statistics Failed

**Error**: ${(error as Error).message}

Please ensure the project has been indexed first using the "index_project" tool.`,
        }],
      };
    }
  }

  private setupErrorHandlers(): void {
    // Handle server errors
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]:', error);
    };

    // Handle process cleanup
    process.on('SIGINT', async () => {
      console.log('\nShutting down UI Context MCP Server...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down UI Context MCP Server...');
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    try {
      await closeBrowserManager();
      console.log('Browser resources cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`UI Context MCP Server v${SERVER_VERSION} running`);
  }
}

// Start the server
const server = new UIContextMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

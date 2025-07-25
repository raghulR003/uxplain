# VS Code Setup Guide for UI Context MCP Server

This guide walks you through setting up the UI Context MCP Server with VS Code and GitHub Copilot.

## Prerequisites

✅ **VS Code 1.102 or later** - [Download VS Code](https://code.visualstudio.com/download)  
✅ **GitHub Copilot subscription** - [Get Copilot](https://github.com/features/copilot)  
✅ **Node.js 18+** - [Download Node.js](https://nodejs.org/)  

## Quick Setup (Recommended)

### 1. Open the Project in VS Code

```bash
# Navigate to the project directory
cd /Users/raghul-23609/Desktop/Uxplain/2_CODE/ui-context-mcp-server

# Open in VS Code
code .
```

### 2. Build the Server

The project includes a pre-configured `.vscode/mcp.json` file, but you need to build it first:

```bash
npm install
npm run build
```

### 3. Enable MCP in VS Code

1. **Open Copilot Chat**: 
   - Press `Ctrl+Cmd+I` (Mac) or `Ctrl+Alt+I` (Windows/Linux)
   - Or use Command Palette: `Cmd+Shift+P` → "Chat: Focus on Chat View"

2. **Switch to Agent Mode**:
   - Click the dropdown in the chat box
   - Select **"Agent"** from the dropdown

3. **Enable MCP Tools**:
   - Click the **"Tools"** button in the chat interface
   - You should see "ui-context" server listed
   - Enable the tools you want to use

### 4. Start the MCP Server

VS Code should automatically detect and start the MCP server. If not:

1. Open the `.vscode/mcp.json` file
2. You'll see a **"Start"** button above the server configuration
3. Click it to start the server

## Manual Configuration (Alternative)

If you want to configure the server manually or for a different project:

### Option 1: Workspace Configuration

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "ui-context": {
      "command": "node",
      "args": ["path/to/ui-context-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Option 2: Global User Configuration

1. **Open Command Palette**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. **Run Command**: "MCP: Open User Configuration"
3. **Add Server Configuration**:

```json
{
  "servers": {
    "ui-context": {
      "command": "node",
      "args": ["/absolute/path/to/ui-context-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can use the specialized tools in Copilot Chat:

### � First: Index Your Project

```
Index my React project at /path/to/my-project to enable intelligent code correlation
```

### 🎯 Button Analysis with Code Correlation

```
Analyze the button elements at http://localhost:3000 and correlate them with my React components to check positioning and accessibility
```

### 📱 Responsive Design Analysis

```
Analyze the responsive design of http://localhost:3000 across different breakpoints and identify layout issues
```

### 🧠 Visual-to-Source Code Correlation

```
Correlate the visual elements at http://localhost:3000 with my indexed project components and give me actionable recommendations for improvement
```

### � Form Element Analysis

```
Analyze the form elements at http://localhost:3000/checkout and check them against my indexed components for validation and accessibility issues
```

### 🔍 Component Search & Discovery

```
Search my indexed project for button components and show me their usage patterns
```

### 📊 Project Health Insights

```
Give me comprehensive insights about my project structure and component health metrics
```

## Troubleshooting

### Server Won't Start

1. **Check the build**: Run `npm run build` in the server directory
2. **Verify Node.js version**: Run `node --version` (should be 18+)
3. **Check file paths**: Ensure the path in `.vscode/mcp.json` is correct
4. **View server logs**: 
   - Command Palette → "MCP: List Servers" 
   - Select "ui-context" → "Show Output"

### Tools Not Appearing

1. **Check Agent Mode**: Make sure you're in Agent mode, not Ask mode
2. **Enable Tools**: Click the Tools button and verify ui-context is enabled
3. **Restart Server**: In MCP server list, restart the ui-context server
4. **Check Copilot Subscription**: Ensure your GitHub Copilot subscription is active

### Wrong Tool Being Used

If the AI is using `screenshot_page` instead of intelligent correlation tools:

1. **Be Specific**: Use phrases like "correlate with source code" or "analyze button elements"
2. **Mention Your Project**: Include "with my React project" or "using my indexed components"
3. **Request Indexing First**: Make sure your project is indexed before asking for code correlation

**Example Good Prompts**:
- ✅ "Analyze button positioning and correlate with my React components"
- ✅ "Check form accessibility using my indexed project components"
- ❌ "Capture the UI" (too generic, will use basic screenshot tool)

### Permission Issues

If you see permission errors:

```bash
chmod +x /path/to/ui-context-mcp-server/dist/index.js
```

### Network/Browser Issues

The server uses Playwright which requires browser installation:

```bash
# In the server directory
npx playwright install chromium
```

## Advanced Configuration

### Development Mode

For development with auto-restart on file changes:

```json
{
  "servers": {
    "ui-context": {
      "command": "node",
      "args": ["dist/index.js"],
      "dev": {
        "watch": "dist/**/*.js",
        "debug": { "type": "node" }
      }
    }
  }
}
```

### Environment Variables

Configure the server with environment variables:

```json
{
  "servers": {
    "ui-context": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "BROWSER_TIMEOUT": "30000",
        "VIEWPORT_WIDTH": "1280",
        "VIEWPORT_HEIGHT": "720"
      }
    }
  }
}
```

## VS Code Extensions

Consider installing these complementary extensions:

- **GitHub Copilot** (required)
- **GitHub Copilot Chat** (usually bundled)
- **Thunder Client** - For API testing
- **Live Server** - For local development testing

## Next Steps

1. **Index Your Project First**: Run the indexing tool on your React/Vue project
2. **Test Basic Functionality**: Try a simple screenshot capture
3. **Test Intelligent Correlation**: Use button or form analysis with your indexed project
4. **Explore Specialized Tools**: Try responsive analysis and component search
5. **Integrate with Your Workflow**: Use for real debugging scenarios
6. **Share with Team**: The `.vscode/mcp.json` can be committed to version control

## Tool Selection Guide

The server provides **8 specialized tools** designed for different scenarios:

### 🔧 Setup Tools
- **`index_project`**: Run this first to enable intelligent analysis

### 📸 Basic Analysis
- **`screenshot_page`**: Simple screenshots (when you just need a quick visual)

### 📱 Responsive Analysis
- **`analyze_responsive_design`**: Cross-breakpoint layout analysis

### 🎯 Element-Specific Tools
- **`analyze_button_elements`**: Button positioning, touch targets, accessibility
- **`analyze_form_elements`**: Form validation, input patterns, UX

### 🧠 Intelligent Correlation
- **`correlate_visual_to_source`**: Map visual elements to React/Vue components

### 🔍 Code Discovery
- **`search_components`**: Find components in your indexed codebase
- **`get_project_insights`**: Project health and component statistics

**Pro Tip**: The AI will automatically choose the right tool based on your request, but being specific helps ensure you get the intelligent analysis you want!

## Support

- **Issues**: Check the [GitHub Issues](link-to-issues)
- **Documentation**: See the main [README.md](README.md)
- **VS Code MCP Docs**: [Official VS Code MCP Documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

---

**Happy debugging with AI-powered UI context! 🎉**

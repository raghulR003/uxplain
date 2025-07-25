# UI Context MCP Server

An intelligent MCP (Model Context Protocol) server that provides component-aware UI analysis by correlating visual elements with their React/Vue source code. Perfect for AI-powered frontend development and debugging.

## 🚀 **Key Features**

- 🧠 **Intelligent Code Correlation**: Map visual elements to React/Vue components
- � **Specialized Analysis**: Button accessibility, form validation, responsive design
- 📱 **Multi-Breakpoint Testing**: Responsive behavior across devices
- 🔍 **Component Discovery**: Semantic search through your indexed codebase
- 📊 **Project Insights**: Architecture health and design pattern analysis
- 🎨 **Visual Analysis**: Screenshots, DOM structure, CSS context
- ⚡ **AI-Optimized**: Purpose-driven tools that eliminate AI confusion

## 📦 **Quick Start**

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **VS Code 1.102+** - [Download here](https://code.visualstudio.com/)
- **GitHub Copilot subscription** - [Get Copilot](https://github.com/features/copilot)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ui-context-mcp-server.git
cd ui-context-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Test the server (optional)
npm test
```

### VS Code Setup

1. **Open the project in VS Code**:
   ```bash
   code .
   ```

2. **The server is pre-configured** - VS Code will automatically detect the `.vscode/mcp.json` configuration

3. **Start the MCP server**:
   - Open the `.vscode/mcp.json` file
   - Click the **"Start"** button above the server configuration
   - Or: Command Palette → "MCP: Start Server" → select "ui-context"

4. **Enable in Copilot Chat**:
   - Open Copilot Chat: `Ctrl+Cmd+I` (Mac) or `Ctrl+Alt+I` (Windows/Linux)
   - Switch to **Agent mode** (dropdown in chat box)
   - Click **"Tools"** button → Enable "ui-context" server

## 🎯 **Usage Examples**

### Step 1: Index Your Project (Required for Intelligence)

```
Index my React project at /path/to/my-project to enable component correlation
```

### Step 2: Intelligent Analysis

#### Button Analysis with Code Correlation
```
Analyze button positioning at localhost:3000 and correlate with my React components to check accessibility
```

#### Responsive Design Analysis  
```
Check responsive behavior of localhost:3000 across mobile, tablet, desktop breakpoints
```

#### Visual-to-Source Code Mapping
```
Correlate all interactive elements at localhost:3000 with my indexed components and suggest improvements
```

#### Component Discovery
```
Search my project for button-like components and identify usage inconsistencies
```

## 🛠️ **Available Tools**

The server provides **8 specialized tools** designed for different analysis needs:

### 🔧 **Setup Tools**
- **`index_project`** - Index React/Vue project to enable intelligent correlation

### 📸 **Visual Analysis**  
- **`screenshot_page`** - Basic webpage screenshots
- **`analyze_responsive_design`** - Multi-breakpoint responsive analysis

### 🎯 **Element-Specific Analysis**
- **`analyze_button_elements`** - Button positioning, accessibility, touch targets
- **`analyze_form_elements`** - Form validation, input patterns, UX analysis

### 🧠 **Intelligent Correlation**
- **`correlate_visual_to_source`** - Map visual elements to React/Vue source code

### 🔍 **Component Discovery**
- **`search_components`** - Semantic search through indexed components
- **`get_project_insights`** - Project health metrics and architecture analysis

## 🚨 **Troubleshooting**

### Server Won't Start
```bash
# Check Node.js version (needs 18+)
node --version

# Rebuild the project
npm run build

# Check for errors
npm run test
```

### Tools Not Appearing in VS Code
1. Ensure you're in **Agent mode** (not Ask mode)
2. Click **"Tools"** button and enable "ui-context" server
3. Restart the MCP server: Command Palette → "MCP: Restart Server"

### AI Using Wrong Tool
Be specific in your requests:
- ✅ **Good**: "Analyze button accessibility and correlate with my React components"
- ❌ **Avoid**: "Check my website" (too generic)

## 📁 **Project Structure**

```
ui-context-mcp-server/
├── src/
│   ├── index.ts                    # Main MCP server (8 tools)
│   ├── tools/                      # Specialized analysis tools
│   │   ├── ui-context.ts          # Basic screenshot/DOM capture
│   │   ├── visual-code-correlator.ts # Visual-to-code mapping
│   │   ├── project-indexer.ts     # Component discovery & indexing
│   │   └── index-search-engine.ts # Semantic component search
│   └── utils/                     # Browser management & processing
├── .vscode/
│   └── mcp.json                   # Pre-configured VS Code setup
├── sample-react-project/           # Test project for validation
└── dist/                          # Compiled output
```

## 🤝 **Contributing**

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite**: `npm test`
5. **Submit a pull request**

### Development Setup
```bash
# Clone your fork
git clone https://github.com/your-username/ui-context-mcp-server.git
cd ui-context-mcp-server

# Install dependencies
npm install

# Start development mode
npm run dev

# Run tests
npm test
```

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Model Context Protocol** by Anthropic for enabling AI tool integration
- **Playwright** for reliable browser automation
- **VS Code team** for MCP support in GitHub Copilot
- **TypeScript** for type safety and developer experience

## 📞 **Support**

- **📚 Documentation**: Check out [VSCODE_SETUP.md](VSCODE_SETUP.md) for detailed setup
- **🐛 Issues**: [GitHub Issues](https://github.com/your-username/ui-context-mcp-server/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/your-username/ui-context-mcp-server/discussions)
- **📖 MCP Protocol**: [Official MCP Documentation](https://modelcontextprotocol.io/)

---

**Transform your frontend development with AI-powered component-aware analysis! 🚀**
**Transform your frontend development with AI-powered component-aware analysis! 🚀**

## Troubleshooting

### Browser Installation Issues

```bash
# Manually install browsers
npx playwright install chromium
```

### Memory Issues

Adjust viewport sizes and disable full-page capture for large pages:

```json
{
  "viewport": {"width": 1280, "height": 720},
  "fullPage": false
}
```

### Network Timeouts

Increase wait times for slow-loading pages:

```json
{
  "waitFor": 5000
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Playwright](https://playwright.dev)
- [Claude Desktop](https://claude.ai/desktop)
- [VS Code Extensions](https://marketplace.visualstudio.com/vscode)

## Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation
- Review existing issues and discussions

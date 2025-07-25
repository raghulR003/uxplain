import type { Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import type { Viewport } from '../types/index.js';

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: Viewport;
  userAgent?: string;
  deviceScaleFactor?: number;
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      browserType: 'chromium',
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.browser) return;

    const browserType = this.getBrowserType();
    
    this.browser = await browserType.launch({
      headless: this.config.headless,
      timeout: this.config.timeout,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      deviceScaleFactor: this.config.deviceScaleFactor,
      ignoreHTTPSErrors: true,
    });

    // Set reasonable timeouts
    this.context.setDefaultTimeout(this.config.timeout!);
    this.context.setDefaultNavigationTimeout(this.config.timeout!);
  }

  private getBrowserType() {
    switch (this.config.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      await this.initialize();
    }

    const page = await this.context!.newPage();
    
    // Enable console logging for debugging
    page.on('console', (msg: ConsoleMessage) => {
      if (process.env.DEBUG_BROWSER) {
        console.log(`Browser console [${msg.type()}]:`, msg.text());
      }
    });

    // Handle page errors
    page.on('pageerror', (error: Error) => {
      console.warn('Page error:', error.message);
    });

    return page;
  }

  async updateViewport(viewport: Viewport): Promise<void> {
    // Update the config for future pages
    this.config.viewport = viewport;
    
    // Note: Existing pages need to be updated individually using page.setViewportSize()
    // This is typically done when creating a new page or in the capture methods
  }

  async setUserAgent(userAgent: string): Promise<void> {
    if (this.context) {
      await this.context.setExtraHTTPHeaders({
        'User-Agent': userAgent,
      });
    }
    this.config.userAgent = userAgent;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.close();
  }

  isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }

  getConfig(): BrowserConfig {
    return { ...this.config };
  }
}

// Singleton instance for the server
let browserManager: BrowserManager | null = null;

export function getBrowserManager(config?: BrowserConfig): BrowserManager {
  if (!browserManager) {
    browserManager = new BrowserManager(config);
  }
  return browserManager;
}

export async function closeBrowserManager(): Promise<void> {
  if (browserManager) {
    await browserManager.close();
    browserManager = null;
  }
}

// Device presets for responsive testing
export const DEVICE_PRESETS = {
  mobile: {
    iPhone13: {
      name: 'iPhone 13',
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      deviceType: 'mobile' as const,
    },
    pixel5: {
      name: 'Pixel 5',
      width: 393,
      height: 851,
      deviceScaleFactor: 2.75,
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      deviceType: 'mobile' as const,
    },
  },
  tablet: {
    iPadAir: {
      name: 'iPad Air',
      width: 820,
      height: 1180,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      deviceType: 'tablet' as const,
    },
    galaxyTab: {
      name: 'Galaxy Tab S7',
      width: 753,
      height: 1037,
      deviceScaleFactor: 2.2,
      userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Safari/537.36',
      deviceType: 'tablet' as const,
    },
  },
  desktop: {
    laptop: {
      name: 'Laptop',
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Safari/537.36',
      deviceType: 'desktop' as const,
    },
    desktop: {
      name: 'Desktop',
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Safari/537.36',
      deviceType: 'desktop' as const,
    },
  },
} as const;

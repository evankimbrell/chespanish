import http from 'http';

interface CDPTab {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface CDPMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
}

export class BrowserController {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<
    number,
    { resolve: (r: unknown) => void; reject: (e: Error) => void }
  >();
  private consoleErrors: string[] = [];
  private connected = false;

  async connect(port = 9222): Promise<void> {
    const tabs = await this.getTabs(port);
    const tab =
      tabs.find((t) => t.url.includes('localhost:3000') || t.url.includes(':3000')) ?? tabs[0];
    if (!tab?.webSocketDebuggerUrl) throw new Error('No suitable Chrome tab found on port ' + port);

    return new Promise((resolve, reject) => {
      // Use native WebSocket (Node 22+)
      this.ws = new WebSocket(tab.webSocketDebuggerUrl);

      this.ws.addEventListener('open', () => {
        this.connected = true;
        // Enable console capture
        this.send('Runtime.enable', {}).catch(() => {});
        this.send('Page.enable', {}).catch(() => {});
        resolve();
      });

      this.ws.addEventListener('error', (e) => {
        reject(new Error('CDP WebSocket error: ' + String(e)));
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string) as CDPMessage;
          if (msg.id !== undefined) {
            const pending = this.pendingMessages.get(msg.id);
            if (pending) {
              this.pendingMessages.delete(msg.id);
              if (msg.error) pending.reject(new Error(msg.error.message));
              else pending.resolve(msg.result ?? {});
            }
          } else if (msg.method === 'Runtime.consoleAPICalled') {
            const type = (msg.params as { type?: string })?.type;
            if (type === 'error' || type === 'warning') {
              const args = (msg.params as { args?: { value?: unknown }[] })?.args ?? [];
              this.consoleErrors.push(args[0]?.value ? String(args[0].value) : JSON.stringify(msg.params));
            }
          }
        } catch {}
      });
    });
  }

  private getTabs(port: number): Promise<CDPTab[]> {
    return new Promise((resolve, reject) => {
      http
        .get(`http://localhost:${port}/json`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as CDPTab[]);
            } catch {
              reject(new Error('Invalid JSON from CDP /json endpoint'));
            }
          });
        })
        .on('error', (e) => reject(new Error(`CDP connection failed: ${e.message}. Is Chrome running with --remote-debugging-port=${port}?`)));
    });
  }

  private send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('BrowserController not connected'));
        return;
      }
      const id = ++this.messageId;
      this.pendingMessages.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));

      // Timeout after 10s
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`CDP command ${method} timed out`));
        }
      }, 10000);
    });
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await this.waitForLoad();
  }

  async click(selector: string): Promise<void> {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  }

  async evaluate(js: string): Promise<unknown> {
    const result = (await this.send('Runtime.evaluate', {
      expression: js,
      awaitPromise: true,
      returnByValue: true,
    })) as { result?: { value?: unknown } };
    return result?.result?.value;
  }

  async injectFakeAudio(audioBuffer: Buffer): Promise<void> {
    const base64 = audioBuffer.toString('base64');
    await this.evaluate(`
      (async () => {
        const ctx = new AudioContext();
        const raw = atob(${JSON.stringify(base64)});
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.loop = true;
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);
        source.start();
        navigator.mediaDevices.getUserMedia = () => Promise.resolve(dest.stream);
        return 'injected';
      })()
    `);
  }

  async waitForSelector(selector: string, timeout = 5000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const exists = await this.evaluate(
        `!!document.querySelector(${JSON.stringify(selector)})`
      );
      if (exists) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Selector "${selector}" not found after ${timeout}ms`);
  }

  async waitForLoad(timeout = 5000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const ready = await this.evaluate(`document.readyState`);
      if (ready === 'complete') return;
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async getConsoleErrors(): Promise<string[]> {
    return [...this.consoleErrors];
  }

  async screenshot(): Promise<Buffer> {
    const result = (await this.send('Page.captureScreenshot', { format: 'png' })) as {
      data?: string;
    };
    if (!result?.data) throw new Error('Screenshot failed');
    return Buffer.from(result.data, 'base64');
  }

  async isAvailable(port = 9222): Promise<boolean> {
    try {
      const tabs = await this.getTabs(port);
      return tabs.length > 0;
    } catch {
      return false;
    }
  }

  disconnect(): void {
    this.connected = false;
    this.ws?.close();
    this.ws = null;
  }
}

let messageIdCounter = 0;
const pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

// Ensure we only add the listener once in the browser environment
if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
  (window as any).chrome.webview.addEventListener('message', (event: any) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.id && pendingRequests.has(data.id)) {
        const { resolve, reject } = pendingRequests.get(data.id)!;
        pendingRequests.delete(data.id);
        let result = data.result;
        if (typeof result === 'string') {
          try {
            result = JSON.parse(result);
          } catch(e) {}
        }
        
        if (data.error) {
          reject(new Error(data.error));
        } else {
          if (result && typeof result === 'object' && result.success === false) {
             reject(new Error(result.error || result.data?.errorMessage || 'Desktop application returned an error'));
          } else {
             resolve(result);
          }
        }
      }
    } catch (e) {
      console.error("[Desktop IPC] Failed to parse message", e);
    }
  });
}

export async function invokeDesktop<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  if (typeof window === 'undefined' || !(window as any).chrome?.webview) {
    throw new Error("Desktop IPC is not available. Are you running inside the LodgeCore Desktop app?");
  }

  const id = `req_${Date.now()}_${++messageIdCounter}`;
  
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    
    // 30 second timeout for hardware operations (like card reading)
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Desktop IPC timeout for method: ${method}`));
      }
    }, 30000);

    const payload = JSON.stringify({ id, method, params });
    (window as any).chrome.webview.postMessage(payload);
  });
}

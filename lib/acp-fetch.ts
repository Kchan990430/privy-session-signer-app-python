// Custom fetch wrapper for ACP API calls to handle CORS
export function createACPFetch() {
  // Save the original fetch
  const originalFetch = global.fetch || window.fetch;
  
  // Return a wrapped fetch function
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlString = url.toString();
    
    // Check if this is an ACP API call
    if (urlString.includes('acpx.virtuals.gg/api/') || urlString.includes('acpx.virtuals.io/api/')) {
      // Intercepting ACP API call
      
      // Extract the path after /api/
      const match = urlString.match(/acpx\.virtuals\.(gg|io)\/api\/(.+)/);
      if (match) {
        const apiPath = match[2];
        const proxyUrl = `/api/acp-proxy/api/${apiPath}`;
        
        // Use the proxy URL instead
        return originalFetch(proxyUrl, init);
      }
    }
    
    // For non-ACP URLs, use the original fetch
    return originalFetch(url, init);
  };
}

// Install the custom fetch globally in browser
if (typeof window !== 'undefined') {
  // Installing custom fetch wrapper
  (window as any).fetch = createACPFetch();
}
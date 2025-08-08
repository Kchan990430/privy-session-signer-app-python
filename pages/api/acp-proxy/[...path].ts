import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path;
  
  // Construct the full URL
  const baseUrl = 'https://acpx.virtuals.gg';
  const url = `${baseUrl}/${pathString}`;
  
  // Add query parameters if present
  const queryString = req.url?.split('?')[1];
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  try {
    console.log(`[ACP Proxy] Method: ${req.method}, URL: ${fullUrl}`);
    console.log(`[ACP Proxy] Headers:`, req.headers);
    
    // Forward the request to the ACP API
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Forward the wallet-address header if present
        ...(req.headers['wallet-address'] && {
          'wallet-address': req.headers['wallet-address'] as string
        }),
        // Add user agent
        'User-Agent': 'ACP-SDK-Proxy/1.0',
      },
      // Forward the body for POST/PUT requests
      ...(req.body && req.method !== 'GET' && {
        body: JSON.stringify(req.body)
      }),
    });

    console.log(`[ACP Proxy] Response status: ${response.status}`);
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      console.log(`[ACP Proxy] Non-JSON response:`, text);
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[ACP Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy request',
      details: error instanceof Error ? error.message : 'Unknown error',
      url: fullUrl
    });
  }
}
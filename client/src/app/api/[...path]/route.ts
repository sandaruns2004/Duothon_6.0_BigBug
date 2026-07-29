import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    const internalUrl = process.env.INTERNAL_API_URL || 'http://api-gateway:3000';
    // Remove the Next.js origin and construct the new target URL
    const url = new URL(request.url);
    const targetUrl = `${internalUrl}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host'); // Let fetch set the host header
    
    // For GET/HEAD requests, body must be null
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err: any) {
    console.error('API Proxy Error:', err.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Service Unavailable: Could not proxy to backend (${err.message})`
      }), 
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

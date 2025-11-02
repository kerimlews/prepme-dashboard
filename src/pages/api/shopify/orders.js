export const prerender = false;

export async function GET({ url }) {
  const date = url.searchParams.get('created_at_min');
  const status = url.searchParams.get('status') || 'open';
  
  try {
    const SHOPIFY_CONFIG = {
      storeUrl: '6be389.myshopify.com',
      accessToken: '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',
      apiVersion: '2024-01'
    };

    const SHOPIFY_BASE_URL = `https://${SHOPIFY_CONFIG.storeUrl}/admin/api/${SHOPIFY_CONFIG.apiVersion}`;
    
    const headers = {
      'X-Shopify-Access-Token': SHOPIFY_CONFIG.accessToken,
      'Content-Type': 'application/json',
    };

    const params = new URLSearchParams();
    params.append('status', status);
    params.append('fulfillment_status', 'unfulfilled');

    if (date) {
      const formattedDate = new Date(date).toISOString().split('T')[0];
      params.append('created_at_min', `${formattedDate}T00:00:00Z`);
    }

    // Add build-time protection
    if (import.meta.env?.SSG) {
      return new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🛍️ Fetching Shopify orders:', `${SHOPIFY_BASE_URL}/orders.json?${params}`);
    
    const response = await fetch(`${SHOPIFY_BASE_URL}/orders.json?${params}`, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ 
      orders: data.orders || [],
      total: data.orders?.length || 0
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Error in orders API:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to fetch orders from Shopify'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
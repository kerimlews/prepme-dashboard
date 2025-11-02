export const prerender = false;

const SHOPIFY_CONFIG = {
  storeUrl: '6be389.myshopify.com',
  accessToken: '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',
  apiVersion: '2024-01'
};

export async function GET({ params }) {
  try {
    const productId = params.id;
    
    const SHOPIFY_BASE_URL = `https://${SHOPIFY_CONFIG.storeUrl}/admin/api/${SHOPIFY_CONFIG.apiVersion}`;
    
    const headers = {
      'X-Shopify-Access-Token': SHOPIFY_CONFIG.accessToken,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${SHOPIFY_BASE_URL}/products/${productId}.json`, { 
      headers,
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ product: data.product }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in products API:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
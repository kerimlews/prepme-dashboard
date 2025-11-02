export const prerender = false;

export async function GET({ url }) {
  try {
    const idsParam = url.searchParams.get('ids');
    const fields = url.searchParams.get('fields') || 'id,title,handle,images,variants,body_html';
    
    if (!idsParam) {
      return new Response(JSON.stringify({ error: 'Missing ids parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const productIds = idsParam.split(',').map(id => id.trim()).filter(id => id);
    
    if (productIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid product IDs provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add build-time protection
    if (import.meta.env?.SSG) {
      return new Response(JSON.stringify({ products: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const batchSize = 100;
    const allProducts = [];

    console.log(`🛍️ Fetching ${productIds.length} products from Shopify`);

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batchIds = productIds.slice(i, i + batchSize);
      const idsQuery = batchIds.join(',');
      
      let apiUrl = `${SHOPIFY_BASE_URL}/products.json?ids=${idsQuery}&limit=250`;
      if (fields) {
        apiUrl += `&fields=${fields}`;
      }
      
      console.log(`📦 Fetching batch ${Math.floor(i/batchSize) + 1}:`, batchIds.length, 'products');
      
      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allProducts.push(...(data.products || []));

      // Rate limiting protection
      if (i + batchSize < productIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return new Response(JSON.stringify({ 
      products: allProducts,
      total: allProducts.length,
      requested: productIds.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in products API:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to fetch products from Shopify'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
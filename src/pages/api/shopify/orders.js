import { convertStringToDDMMYYYY } from "../../../utils/helpers";

// src/pages/api/shopify/orders.js
export const prerender = false;

export async function GET({ url }) {
  const created = url.searchParams.get('created_at_min');
  const status = url.searchParams.get('status') || 'open';
  
  const [year, month, day] = created.split('T')[0].split('-'); // Note: [year, day, month]
  
  const date = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  
  console.log(date);
  
  try {
    const SHOPIFY_CONFIG = {
      storeUrl: '6be389.myshopify.com',
      accessToken: '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',
      apiVersion: '2025-10'
    };

    const SHOPIFY_BASE_URL = `https://${SHOPIFY_CONFIG.storeUrl}/admin/api/${SHOPIFY_CONFIG.apiVersion}`;
    
    const headers = {
      'X-Shopify-Access-Token': SHOPIFY_CONFIG.accessToken,
      'Content-Type': 'application/json',
    };

    // Add build-time protection
    if (import.meta.env?.SSG) {
      return new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🛍️ Fetching Shopify orders via GraphQL');
    
    console.log(date);
    
    const query = `
query FetchOrdersByTag {
  orders(first: 250, query: "tag:${date} AND status:open") {
    nodes {
      id
      name
      tags
      createdAt
      paymentGatewayNames
      totalPrice
      statusPageUrl
      registeredSourceUrl

      customAttributes {
        key
        value
      }
       
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      billingAddress {
        address1
        city
      }
      shippingAddress {
        address1
        city
      }
      customer {
        id
        displayName
        email
        firstName
        lastName
      }
      lineItems(first: 250) {
        nodes {
          title
          quantity
          variant {
            id
            title
            displayName
            product {
              id
            }
          }
        }
      }
    }
  }
}
`;

    const response = await fetch(`${SHOPIFY_BASE_URL}/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    const  {data} = await response.json();
      
    const normalizedOrders = data.orders.nodes.map(n => ({
      ...n,
      lineItems: n?.lineItems?.nodes || []
    }))
    
    return new Response(JSON.stringify({ 
      orders: normalizedOrders,
      total: normalizedOrders.length
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


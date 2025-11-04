import { useState, useCallback } from 'react';
import { nonXLProducts } from '../utils/constants';
import { extractMeals, calculateSize, generateId } from '../utils/helpers';

export const useShopify = () => {
  const [orders, setOrders] = useState({ orders: [], additionalOrders: [] });
  const [loading, setLoading] = useState(false);
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [error, setError] = useState(null);

  // Bulk fetch products by IDs
  const fetchProducts = useCallback(async (productIds) => {
    try {
      if (!productIds || productIds.length === 0) {
        return [];
      }

      const idsString = productIds.join(',');
      const response = await fetch(`/api/shopify/products?ids=${idsString}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.products || [];
    } catch (err) {
      console.error('Error fetching products:', err);
      return [];
    }
  }, []);

  // Single product fetch (for backward compatibility)
  const fetchProduct = useCallback(async (productId) => {
    try {
      const products = await fetchProducts([productId]);
      return products[0] || null;
    } catch (err) {
      console.error('Error fetching product:', err);
      return null;
    }
  }, [fetchProducts]);

  const fetchOrdersByDate = useCallback(async (date) => {
    try {

      const response = await fetch(`/api/shopify/orders?created_at_min=${date}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.orders || [];
    } catch (err) {
      console.error('Error fetching orders:', err);
      throw err;
    }
  }, []);

  // Bulk process products for better performance
  const processOrdersWithProducts = useCallback(async (orders, pretplateData) => {
    // Collect all unique product IDs from all orders
    const productIds = [];
    const orderProductMap = new Map(); // Map order index to product IDs
    
    orders.forEach((order, index) => {
      const orderProductIds = order.lineItems
        .map(item => item?.variant?.product?.id?.replace('gid://shopify/Product/', ''))
        .filter(id => id);
      
      if (orderProductIds.length > 0) {
        productIds.push(...orderProductIds);
        orderProductMap.set(index, orderProductIds);
      }
    });

    // Fetch all products in bulk
    const uniqueProductIds = [...new Set(productIds)];
    const products = await fetchProducts(uniqueProductIds);
        
    // Create a map for quick product lookup
    const productMap = new Map();
    products.forEach(product => {
      productMap.set(product.id, product);
    });

    // Process each order with the pre-fetched products
    const processedOrders = [];
    
    for (const [orderIndex, productIds] of orderProductMap) {
      const order = orders[orderIndex];
      const customerName = `${order.customer?.firsName || ''} ${order.customer?.lastName || ''}`.trim();
      const isPaket = order.lineItems.some(item => 
        item.title && (item.title.includes('PAKET') || item.title.includes('paket'))
      );

      if (isPaket) {
        const mainProductId = order.lineItems[0].product_id;
        const product = productMap.get(mainProductId);
        let meals = {};
        
        if (product && product.body_html) {
          meals = extractMeals(product.body_html);
        }

        const isXL = order.lineItems[0].variant_title?.includes('XL') || 
                     order.lineItems[0].title?.includes('XL');

        if (isXL) {
          const xlMeals = {};
          for (const [meal, quantity] of Object.entries(meals)) {
            xlMeals[`XL ${meal}`] = quantity;
          }
          meals = xlMeals;
        }
        
        const totalMeals = Object.values(meals).reduce((sum, qty) => sum + qty, 0);
        const size = calculateSize(totalMeals);
        
        meals = Object.keys(meals).length > 0 ? meals : { [product?.title || 'Unknown Product']: 1 };
        
        processedOrders.push({
          id: generateId(),
          name: customerName,
          totalMeals,
          price: order.totalPrice,
          meals,
          pretplata: false,
          url: order.statusPageUrl,
          isCOD: order.paymentGatewayNames && order.paymentGatewayNames.includes("Cash on Delivery (COD)"),
          address: order?.billingAddress?.address1 || order?.shippingAddress?.address1 || '',
          target: (order.billingAddress?.city === 'Osijek' || order.shippingAddress?.city === 'Osijek') ? 'OS' : 'HR',
          size
        });
      } else {
        const meals = {};
        let totalMeals = 0;
        let hasValidItems = false;
        
        for (const item of order.lineItems) {
          // Check if it's mjesecna pretplata
          if (item.name && item.name.startsWith('Mjesečna pretplata')) {
            setMonthlySubs(prev => [...prev, {
              url: order.statusPageUrl,
              name: item.name,
              customer: customerName
            }]);
            continue;
          }
          
          if (!nonXLProducts.includes(item.title)) {
            meals[item.title] = (meals[item.title] || 0) + item.quantity;
            totalMeals += item.quantity;
            hasValidItems = true;
          }
        }
        
        if (hasValidItems) {
          processedOrders.push({
            id: generateId(),
            name: customerName,
            totalMeals,
            price: order.totalPrice,
            meals,
            url: order.statusPageUrl,
            pretplata: false,
            isCOD: order.paymentGatewayNames && order.paymentGatewayNames.includes("Cash on Delivery (COD)"),
            address: order?.billingAddress?.address1 || order?.shippingAddress?.address1 || '',
            target: (order.billingAddress?.city === 'Osijek' || order.shippingAddress?.city === 'Osijek') ? 'OS' : 'HR',
            size: calculateSize(totalMeals)
          });
        }
      }
    }
    
    return processedOrders;
  }, [fetchProducts]);

  const fetchOrders = async (selectedDate, pretplateData) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch real orders from Shopify API
      const shopifyOrders = await fetchOrdersByDate(selectedDate);
      
      if (shopifyOrders.length === 0) {
        const emptyResult = { orders: [], additionalOrders: [] };
        setOrders(emptyResult);
        return emptyResult;
      }

      // Process orders with bulk product fetching
      const processedOrders = await processOrdersWithProducts(shopifyOrders, pretplateData);
            
      const newProcessedOrders = processedOrders.filter(order => order.target === 'OS');
      const newAdditionalOrders = processedOrders.filter(order => order.target !== 'OS');
      
      
      const result = { 
        orders: newProcessedOrders, 
        additionalOrders: newAdditionalOrders 
      };
      
      console.log({shopifyOrders, result});
      
      setOrders(result);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch orders from Shopify';
      setError(errorMessage);
      console.error('Error in fetchOrders:', err);
      
      // Return empty result on error
      const emptyResult = { orders: [], additionalOrders: [] };
      setOrders(emptyResult);
      return emptyResult;
    } finally {
      setLoading(false);
    }
  };

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    orders,
    loading,
    monthlySubs,
    error,
    fetchOrders,
    fetchProducts, // Export bulk products fetch
    fetchProduct,  // Export single product fetch
    clearError
  };
};
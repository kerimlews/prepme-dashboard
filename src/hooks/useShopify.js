import { useState, useCallback } from 'react';
import { nonXLProducts } from '../utils/constants';
import { extractMeals, calculateSize, generateId } from '../utils/helpers';

export const useShopify = () => {
  const [orders, setOrders] = useState({ orders: [], additionalOrders: [] });
  const [loading, setLoading] = useState(false);
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [error, setError] = useState(null);

  const fetchProduct = useCallback(async (productId) => {
    try {
      const response = await fetch(`/api/shopify/products/${productId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.product;
    } catch (err) {
      console.error('Error fetching product:', err);
      return null;
    }
  }, []);

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
      
      return data.orders;
    } catch (err) {
      console.error('Error fetching orders:', err);
      throw err;
    }
  }, []);

  const processOrder = useCallback(async (order, pretplateData) => {
    const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim();
    const isPaket = order.line_items.some(item => 
      item.title && (item.title.includes('PAKET') || item.title.includes('paket'))
    );

    if (isPaket) {
      const product = await fetchProduct(order.line_items[0].product_id);
      let meals = {};
      
      if (product && product.body_html) {
        meals = extractMeals(product.body_html);
      }

      const isXL = order.line_items[0].variant_title?.includes('XL') || 
                   order.line_items[0].title?.includes('XL');

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
      
      return {
        id: generateId(),
        name: customerName,
        totalMeals,
        price: order.total_price,
        meals,
        pretplata: false,
        url: order.order_status_url,
        isCOD: order.payment_gateway_names && order.payment_gateway_names.includes("Cash on Delivery (COD)"),
        address: order?.billing_address?.address1 || order?.shipping_address?.address1 || '',
        target: (order.billing_address?.city === 'Osijek' || order.shipping_address?.city === 'Osijek') ? 'OS' : 'HR',
        size
      };
    } else {
      const meals = {};
      let totalMeals = 0;
      
      for (const item of order.line_items) {
        // Check if it's mjesecna pretplata
        if (item.name && item.name.startsWith('Mjesečna pretplata')) {
          setMonthlySubs(prev => [...prev, {
            url: order.order_status_url,
            name: item.name,
            customer: customerName
          }]);
          continue;
        }
        
        if (!nonXLProducts.includes(item.title)) {
          meals[item.title] = (meals[item.title] || 0) + item.quantity;
          totalMeals += item.quantity;
        }
      }
      
      if (totalMeals > 0) {
        return {
          id: generateId(),
          name: customerName,
          totalMeals,
          price: order.total_price,
          meals,
          url: order.order_status_url,
          pretplata: false,
          isCOD: order.payment_gateway_names && order.payment_gateway_names.includes("Cash on Delivery (COD)"),
          address: order?.billing_address?.address1 || order?.shipping_address?.address1 || '',
          target: (order.billing_address?.city === 'Osijek' || order.shipping_address?.city === 'Osijek') ? 'OS' : 'HR',
          size: calculateSize(totalMeals)
        };
      }
    }
    
    return null;
  }, [fetchProduct]);

  const fetchOrders = async (selectedDate, pretplateData) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch real orders from Shopify API
      const shopifyOrders = await fetchOrdersByDate(selectedDate);
      
      const processPromises = shopifyOrders.map(order => 
        processOrder(order, pretplateData)
      );
      
      // Filter out null values (orders without meals or monthly subscriptions)
      const processedOrders = (await Promise.all(processPromises)).filter(Boolean);
            
      const newProcessedOrders = processedOrders.filter(order => order.target === 'OS');
      const newAdditionalOrders = processedOrders.filter(order => order.target !== 'OS');
      
      const result = { 
        orders: newProcessedOrders, 
        additionalOrders: newAdditionalOrders 
      };
      
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
    clearError
  };
};
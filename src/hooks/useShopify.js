import { useState, useCallback } from 'react';
import { nonXLProducts } from '../utils/constants';
import { extractMeals, calculateSize, generateId } from '../utils/helpers';
import dummyOrders from '../shopfydata.json';
import dummyProduct from '../product.json';

export const useShopify = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [error, setError] = useState(null);

  const fetchProduct = useCallback(async (productId) => {
    try {
      // Mock implementation - replace with actual API call
      const mockProduct = dummyProduct;
      
      return mockProduct.product;
    } catch (err) {
      console.error('Error fetching product:', err);
      return null;
    }
  }, []);

  const processOrder = useCallback(async (order, pretplateData) => {
    const customerName = `${order.customer.first_name} ${order.customer.last_name}`;
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
      
      return {
        id: generateId(),
        name: customerName,
        totalMeals,
        price: '0.00',
        meals,
        pretplata: false,
        target: 'OS',
        subscription: { current: 1, total: 1 },
        size
      };
    } else {
      const meals = {};
      let totalMeals = 0;
      
      for (const item of order.line_items) {
        // Check if it's mjesecna pretplata

        if (item.name.startsWith('Mjesečna pretplata')) {
          setMonthlySubs(prev => [...prev, {
            url: order.order_status_url,
            name: item.name
          }])
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
          address: order?.billing_address?.address1 || order?.billing_address?.address2,
          target: order.billing_address.city === 'Osijek' ? 'OS' : 'HR',
          subscription: { current: 0, total: 0 },
          size: calculateSize(totalMeals)
        };
      }
    }
    
    return null;
  }, [fetchProduct]);

  const fetchOrders = useCallback(async (selectedDate, pretplateData) => {
    setLoading(true);
    setError(null);
    
    try {
      
      const processedOrders = [];
      for (const order of dummyOrders.orders) {
        const processedOrder = await processOrder(order, pretplateData);
        console.log('processedOrder', processedOrder);
        
        if (processedOrder) {
          processedOrders.push(processedOrder);
        }
      }

      setOrders(processedOrders);
      return processedOrders;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [processOrder]);

  return {
    orders,
    loading,
    monthlySubs,
    error,
    fetchOrders
  };
};
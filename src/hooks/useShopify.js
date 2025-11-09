import { useState, useCallback } from 'react';
import { calculateSize, generateId } from '../utils/helpers';

export const useShopify = (imports) => {
  const [orders, setOrders] = useState({ orders: [], additionalOrders: [] });
  const [loading, setLoading] = useState(false);
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [error, setError] = useState(null);

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
  // KONVERTUJ SHOPIFY IMPORTE U TABELU - RAZVRSTAJ MJESECTNE PRETPLATE 
  // NAZIVI TREBAJU ODGOVARATI 
  const processOrdersWithProducts = useCallback(async (orders) => {
    // Process each order with the pre-fetched products
    const processedOrders = [];
    
    for (const order of orders) {
      
      const customerName = order.customer?.displayName;
      
      const meals = {};
      let totalMeals = 0;

      for (const item of order.lineItems) {       
        const isMonthlySub = item.title.startsWith('Mjesečna pretplata');

        // AKO JE MJESENCA PRESKOCI - POTREBNO DODATI RUCNO U EXCEL PRETPLATE
        if (isMonthlySub) {
            setMonthlySubs(prev => [...prev, {
              url: order.statusPageUrl,
              name: item.name,
              customer: customerName
            }]);
            continue;
        }

        // AKO U VARIJANTAMA IMA XL
        const isXL = item.variant.title?.includes('XL');

        const sizes = ['Standard', 'XL', item.title];
        const variants = item?.variant?.title?.split(' / ')?.filter(key => !sizes.includes(key)).join(' - ');

        // CLEAR TITLE NAME
        item.title = item.title.replace('XL', '').replace('Standard', '').split(' -')[0];

        // NADOVEZI NA TITLE DODATKE
        item.title = `${isXL ? 'XL ' : ''}${item.title}${variants ? ` - ${variants}` : ''}`
        
        const paket = imports.find(p => p.name === item.title);

        if (paket) {
          totalMeals = Object.values(paket.meals).reduce((sum, qty) => sum + qty, 0);
          meals = Object.keys(paket.meals).length > 0 ? paket.meals : { [paket?.title || 'Unknown Product']: 1 };
        } else {
          meals[item.title] = (meals[item.title] || 0) + 1;
        }
      }

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
        size: calculateSize(totalMeals)
      });
    }
    
    return processedOrders;
  }, []);

  const fetchOrders = async (selectedDate) => {
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
      const processedOrders = await processOrdersWithProducts(shopifyOrders);
            
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
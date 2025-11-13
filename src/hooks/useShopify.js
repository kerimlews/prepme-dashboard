import { useState, useCallback } from 'react';
import { calculateSize, generateId, normalizeString } from '../utils/helpers';

function multiplyMeals(meals, quantity) {
    const result = {};
    for (const [meal, count] of Object.entries(meals)) {
        result[meal] = count * quantity;
    }
    return result;
}

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
      
      let meals = {};
      let totalMeals = 0;

      for (const item of order.lineItems) {       
        const isMonthlySub = item.title.startsWith('Mjesečna pretplata');

        // AKO JE MJESENCA PRESKOCI - POTREBNO DODATI RUCNO U EXCEL PRETPLATE
        if (isMonthlySub) {
          console.log('MONTHLY SUB', item);
          
            setMonthlySubs(prev => [...prev, {
              url: order.statusPageUrl,
              name: item.title,
              customer: customerName,
              ...item
            }]);
            continue;
        }

        // AKO U VARIJANTAMA IMA XL
        const isXL = item.variant.title?.includes('XL');

        const sizes = ['Standard', 'XL', item.title];
        const variants = item?.variant?.title?.split(' / ')?.filter(key => !sizes.includes(key)).join(' - ');

        // CLEAR TITLE NAME
        item.title = item.title.replace('XL', '').replace('Standard', '');

        // NADOVEZI NA TITLE DODATKE
        item.title = `${isXL ? 'XL ' : ''}${item.title}${variants ? ` - ${variants}` : ''}`
        
        const paket = imports.find(p => normalizeString(p.name) === normalizeString(item.title));

        if (!paket && item.title.includes('paket')) {
          console.log('NOT FOUND', { ORG: imports, imports: imports.map(i => normalizeString(i.name)), item: normalizeString(item.title), paket });
        }
        
        if (paket) {
          paket.meals = multiplyMeals(paket.meals, item.quantity);
          totalMeals = Object.values(paket.meals).reduce((sum, qty) => sum + qty, 0);
          meals = Object.keys(paket.meals).length > 0 ? paket.meals : { [paket?.title || 'Unknown Product']: 1 };
        } else {
          meals[item.title] = (meals[item.title] || 0) + item.quantity;
          totalMeals = Object.values(meals).reduce((sum, qty) => sum + qty, 0);
        }
      }

      const address = order?.shippingAddress?.address1 || order?.billingAddress?.address1 || '';
      const city = (order.shippingAddress?.city || order.billingAddress?.city || '').toLowerCase();
      const isNearbyOsijek = ['Bilje', 'Darda', 'Mece', 'Višnjevac', 'Josipovac', 'Livana', 'Antunovac', 'Brijest', 'Briješće'].some(ad => address.toLowerCase().includes(ad.toLowerCase()));

      processedOrders.push({
        id: generateId(),
        name: customerName,
        totalMeals,
        price: order.totalPrice,
        meals,
        pretplata: false,
        url: order.statusPageUrl,
        isCOD: order.paymentGatewayNames && order.paymentGatewayNames.includes("Cash on Delivery (COD)"),
        address,
        target: city === 'osijek' || isNearbyOsijek ? 'OS' : 'HR',
        size: calculateSize(totalMeals)
      });
    }
    
    return processedOrders;
  }, [imports]);

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
            
      const newProcessedOrders = processedOrders.filter(order => order.target !== 'OS');
      const newAdditionalOrders = processedOrders.filter(order => order.target === 'OS');
      
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
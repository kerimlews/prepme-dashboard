export const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

export const calculateSize = (totalMeals) => {
  if (totalMeals <= 5) return '*M';
  if (totalMeals <= 11) return '*S';
  if (totalMeals <= 17) return '*X';
  if (totalMeals <= 28) return '*XL';
  return '*XXL';
};


// Helper function to merge meals with quantity addition
export const mergeMeals = (meals1, meals2) => {
  const merged = { ...meals1 };
  
  Object.entries(meals2 || {}).forEach(([meal, quantity]) => {
    merged[meal] = (merged[meal] || 0) + quantity;
  });
  
  return merged;
};

// Helper function to calculate combined price
export const calculateCombinedPrice = (price1, price2) => {
  const value1 = parseFloat((price1 || '0').replace(',', '.')) || 0;
  const value2 = parseFloat((price2 || '0').replace(',', '.')) || 0;
  const combined = value1 + value2;
  return combined.toFixed(2).replace('.', ',');
};

export const extractMeals = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  const mealElements = doc.querySelectorAll('h5 strong');
  const mealCounts = {};
  let totalCount = 0;
  
  mealElements.forEach(element => {
    const mealText = element.textContent.trim();
    
    if (mealText && 
        !mealText.includes('Sadržaj paketa:') && 
        !mealText.includes('Balansirani užitak') &&
        !mealText.includes('XL veličina') &&
        mealText.length > 5) {
      
      const match = mealText.match(/^(\d+)\s*x\s*(.+)$/);
      
      if (match) {
        const quantity = parseInt(match[1]);
        const mealName = match[2]
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (mealName) {
          if (!mealCounts[mealName]) {
            mealCounts[mealName] = 0;
          }
          mealCounts[mealName] += quantity;
          totalCount += quantity;
        }
      }
    }
  });
  
  return mealCounts;
};

export const determineType = (name, target, price) => {
  const nameUpper = name.toUpperCase();
  const targetUpper = target.toUpperCase();
  const priceNum = parseFloat(price.replace(',', '.'));
  
  if (nameUpper.includes('AMBASADOR') || targetUpper.includes('AMBASADOR')) {
    return 'AMBASADOR';
  } else if (nameUpper.includes('MARSA') || targetUpper.includes('MARSA')) {
    return 'MARSA PRIV';
  } else if (priceNum === 0 || nameUpper.includes('FREE') || nameUpper.includes('PROMO') || nameUpper.includes('GIVEAWAY')) {
    return 'GIVEAWAY';
  } else {
    return 'PRIV';
  }
};

export const parseSubscription = (subscriptionText) => {
  if (!subscriptionText) return { current: 1, total: 1 };
  
  // Handle various formats: "1/4", "2/4", "1/2", etc.
  const parts = subscriptionText.split('/').map(part => part.trim());
  
  // Extract numbers from strings like "1/4", "2/4", etc.
  const current = parseInt(parts[0]) || 1;
  const total = parseInt(parts[1]) || 4;
  
  return { current, total };
};

export const getWeekDayCroatian = (dateString) => {
  const date = new Date(dateString);
  const weekdays = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
  return weekdays[date.getDay()];
};

export const formatPrice = (price) => {
  return price.replace(',', '.');
};

export const getWeekDay = (dateString) => {
  const date = new Date(dateString);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdays[date.getDay()];
};

export const addOrderDatesToPretplate = (pretplateData, orderDates = []) => {
  return pretplateData.map(pretplate => ({
    ...pretplate,
    orderDates: orderDates.length > 0 ? orderDates : [getTodayDate()] // Default to today if no dates provided
  }));
};

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const hasOrderOnDate = (orderDates, selectedDate) => {
  return orderDates && selectedDate && orderDates.includes(selectedDate);
};
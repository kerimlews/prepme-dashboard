import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { calculateSize, parseSubscription, generateId, determineType, formatDateFromInput, formatDateToDDMMYYYY, convertStringToDDMMYYYY } from '../utils/helpers';

export const useFileParser = () => {
  const [naziviData, setNaziviData] = useState([]);
  const [pretplateData, setPretplateData] = useState([]);

  // Update pretplateData when nazivi changes
  useEffect(() => {
    if (naziviData.length === 0) {
      return;
    }

    // Create mapping from nazivi
    const naziviMap = new Map();
    naziviData.forEach(naziv => {
      if (naziv.jelo && naziv.webNaziv) {
        naziviMap.set(naziv.jelo.trim().toLowerCase(), naziv.webNaziv.trim());
      }
    });

    // Map pretplate meal names
    const mappedPretplateData = pretplateData.map(pretplate => {
      const updatedMeals = {};
      
      Object.entries(pretplate.meals || {}).forEach(([mealName, quantity]) => {
        const normalizedMealName = mealName.trim().toLowerCase();
        const mappedName = naziviMap.get(normalizedMealName) || mealName;
        updatedMeals[mappedName] = quantity;
      });

      return {
        ...pretplate,
        meals: updatedMeals
      };
    });

    setPretplateData(mappedPretplateData);
  }, [naziviData]);

    const parseNaziviFile = useCallback((file) => {
        return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convert sheet to JSON with the correct column names from your image
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                        
            // Map the data to our expected format
            const parsedData = jsonData
                .filter(item => typeof item.__EMPTY_2 === 'string' && typeof item.__EMPTY_3 === 'string')
                .map(item => ({
                    id: generateId(),
                    jelo: item.__EMPTY_2 || '',
                    webNaziv: item.__EMPTY_3 || ''
                }));
                        
            setNaziviData(parsedData);
            resolve(parsedData);
            } catch (error) {
            console.error('Error parsing nazivi file:', error);
            reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
        });
    }, []);
    
    // In your price calculation logic, add this check:
function calculatePrice(item) {
  // If there's a subscription pattern like "2/4", "1/5", etc., price should be 0
  if (item.price && /^\d+\/\d+$/.test(item.price.toString().trim())) {
    return "0";
  }
  
  // Your existing price calculation logic here
  return item.price || "0";
}

  const parsePretplateFile = useCallback((file) => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (e) => {
              try {                    
                  const data = new Uint8Array(e.target.result);
                  const workbook = XLSX.read(data, { type: 'array' });
                  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                  
                  // Read from row 8 as specified
                  const range = XLSX.utils.decode_range(firstSheet['!ref']);
                  range.s.r = 7; // Start from row 8 (0-indexed)
                  
                  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { range });
                  
                  console.log('Raw pretplate data:', jsonData); // For debugging
                  
                  // Group meals by customer
                  const customersMap = new Map();
                  const currentYear = new Date().getFullYear();
                  
                  // Track dates for each customer
                  const customerDates = new Map();
                  
                  // First, collect all customer data AND dates
                  jsonData.forEach((row, rowIndex) => {
                      Object.entries(row).forEach(([customerInfo, cellValue]) => {
                          // Skip if customerInfo is '__rowNum__' or if cellValue is empty
                          if (customerInfo === '__rowNum__' || !cellValue || cellValue.toString().trim() === '') {
                              return;
                          }
                          
                          const cellText = cellValue.toString().trim();
                          
                          // Check if this is a DATE row first
                          const dateMatch = cellText.match(/^(\d{1,2})\.(\d{1,2})\.\s*(.*)?$/);
                          if (dateMatch) {
                              const day = parseInt(dateMatch[1]);
                              const month = parseInt(dateMatch[2]);
                              
                              // Validate it's a real date
                              if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                                  const formattedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${currentYear}`;
                                  
                                  // Parse customer information from the key to find which customer this date belongs to
                                  const parts = customerInfo.split('/').map(part => part.trim());
                                  if (parts.length >= 3) {
                                      const name = parts[0];
                                      
                                      if (!customerDates.has(name)) {
                                          customerDates.set(name, []);
                                      }
                                      if (!customerDates.get(name).includes(formattedDate)) {
                                          customerDates.get(name).push(formattedDate);
                                          console.log(`Found date for ${name}: ${formattedDate} from "${cellText}"`);
                                      }
                                  }
                              }
                              return; // Skip further processing for date rows
                          }
                          
                          // Otherwise, process as customer/meal data
                          // Parse customer information from the key
                          const parts = customerInfo.split('/').map(part => part.trim());

                          if (parts.length < 3) return;

                          const name = parts[0];
                          const sizeText = parts[1]?.replace(/X/gi, '') || '5';
                          const target = parts[2];

                          // Parse the remaining parts dynamically
                          let price = '0,00';
                          let subscription = '1/4';
                          let type = 'PRETPLATA';
                          let size = calculateSize(parseInt(sizeText));

                          // Process remaining parts (index 3+)
                          for (let i = 3; i < parts.length; i++) {
                              let part = parts[i];
                              
                              // Split part by spaces to handle cases like "191,00 1/4"
                              const subParts = part.split(/\s+/);
                              
                              for (let subPart of subParts) {
                                  // Check for subscription pattern (like 1/4, 2/4, etc.)
                                  if (subPart.match(/^\d+\/\d+$/)) {
                                      subscription = subPart;
                                  }
                                  // Check for price pattern (numbers with comma)
                                  else if (subPart.match(/^\d+[,.]\d+$/)) {
                                      price = subPart.replace('.', ',');
                                  }
                                  // Check for price pattern (whole numbers)
                                  else if (subPart.match(/^\d+$/)) {
                                      // Only treat as price if we haven't found one yet and it's not part of subscription
                                      if (price === '0,00' && !subPart.match(/\//)) {
                                          price = subPart + ',00';
                                      }
                                  }
                                  // Check for FREE/PROMO
                                  else if (subPart === 'FREE' || subPart === 'PROMO') {
                                      price = subPart;
                                  }
                                  // Check for type (PRIV, AMBASADOR, GIVEAWAY, etc.)
                                  else if (subPart.match(/^(PRIV|AMBASADOR|GIVEAWAY|PRETPLATA|MARSA)/i)) {
                                      type = subPart.toUpperCase();
                                  }
                                  // Check for size pattern (like *M, *S, *XL) - ignore these
                                  else if (subPart.match(/^\*[A-Z]/)) {
                                      // Ignore size markers like *M, *S, *XL
                                      continue;
                                  }
                              }
                          }

                          // Fallback: if no specific type found but PRIV appears anywhere in the string, set as PRIV
                          if (type === 'PRETPLATA' && customerInfo.toUpperCase().includes('PRIV')) {
                              type = 'PRIV';
                          }

                          // Fallback: if AMBASADOR appears anywhere, set as AMBASADOR
                          if (customerInfo.toUpperCase().includes('AMBASADOR')) {
                              type = 'AMBASADOR';
                          }

                          // Parse subscription
                          const parsedSubscription = parseSubscription(subscription);

                          // Get or create customer
                          if (!customersMap.has(name)) {
                              customersMap.set(name, {
                                  id: generateId(),
                                  name,
                                  totalMeals: 0,
                                  price,
                                  meals: {},
                                  pretplata: true,
                                  target,
                                  subscription: parsedSubscription,
                                  size,
                                  type: type,
                                  orderDates: []
                              });
                          }
                          
                          const customer = customersMap.get(name);
                          
                          // Parse meal from the value (only if it's not a date)
                          if (cellText && !cellText.match(/^\d{1,2}\.\d{1,2}\.?/)) {
                              // Parse meal quantity and name
                              const quantityMatch = cellText.match(/^(\d+)\s*X?\s*(.+)$/i);

                              if (quantityMatch) {
                                  // Has quantity prefix like "2X" or "2 X"
                                  const quantity = parseInt(quantityMatch[1]);
                                  let mealName = quantityMatch[2]?.trim();
                                  
                                  mealName = mealName.replace(/\s+/g, ' ').trim();
                                  
                                  // Skip if meal name is only 'x'
                                  if (mealName.toLowerCase() === 'x') {
                                      return;
                                  }
                                  if (!customer.meals[mealName]) {
                                      customer.meals[mealName] = 0;
                                  }
                                  customer.meals[mealName] += quantity;
                                  customer.totalMeals += quantity;
                              } else {
                                  // No quantity prefix - just use the text as-is
                                  let mealName = cellText.trim();
                                  
                                  mealName = mealName.replace(/\s+/g, ' ').trim();
                                  
                                  // Skip if meal name is only 'x'
                                  if (['x', '...'].includes(mealName.toLowerCase())) {
                                      return;
                                  }
                                  if (!customer.meals[mealName]) {
                                      customer.meals[mealName] = 0;
                                  }
                                  customer.meals[mealName] += 1;
                                  customer.totalMeals += 1;
                              }
                          }
                      });
                  });
                  
                  // Now assign the collected dates to customers
                  customersMap.forEach((customer, name) => {
                      const dates = customerDates.get(name) || [];
                      if (dates.length > 0) {
                          // Sort dates chronologically
                          customer.orderDates = dates.sort((a, b) => {
                              const [dayA, monthA, yearA] = a.split('/').map(Number);
                              const [dayB, monthB, yearB] = b.split('/').map(Number);
                              const dateA = new Date(yearA, monthA - 1, dayA);
                              const dateB = new Date(yearB, monthB - 1, dayB);
                              return dateA - dateB;
                          });

                          console.log(`Assigned ${dates.length} dates to ${name}:`, customer.orderDates);
                      } else {
                          console.log(`No dates found for ${name}`);
                      }
                  });
                  
                  // Convert map to array
                  const parsedData = Array.from(customersMap.values());
                  
                  console.log(parsedData.orderDates);
                  
                  console.log('Parsed pretplate data:', parsedData); // For debugging
                  
                  setPretplateData(parsedData);
                  resolve(parsedData);
              } catch (error) {
                  console.error('Error parsing pretplate file:', error);
                  reject(error);
              }
          };
        
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsArrayBuffer(file);
      });
  }, []);

  const addNazivi = useCallback((item) => {
    const newItem = { ...item, id: generateId() };
    setNaziviData(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateNazivi = useCallback((id, updates) => {
    setNaziviData(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const deleteNazivi = useCallback((id) => {
    setNaziviData(prev => prev.filter(item => item.id !== id));
  }, []);

  const addPretplate = useCallback((item) => {
    const newItem = { 
      ...item, 
      id: generateId(),
      size: calculateSize(item.totalMeals),
      pretplata: true 
    };
    setPretplateData(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updatePretplate = useCallback((id, updates) => {
    setPretplateData(prev => prev.map(item => 
      item.id === id ? { 
        ...item, 
        ...updates,
        size: calculateSize(updates.totalMeals || item.totalMeals)
      } : item
    ));
  }, []);

  const deletePretplate = useCallback((id) => {
    setPretplateData(prev => prev.filter(item => item.id !== id));
  }, []);

  return {
    naziviData,
    pretplateData,
    parseNaziviFile,
    parsePretplateFile,
    addNazivi,
    updateNazivi,
    deleteNazivi,
    addPretplate,
    updatePretplate,
    deletePretplate
  };
};
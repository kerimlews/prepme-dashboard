import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { calculateSize, parseSubscription, generateId, determineType } from '../utils/helpers';

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
                
                // Process each row (each row contains meals for multiple customers)
                jsonData.forEach((row, rowIndex) => {
                    Object.entries(row).forEach(([customerInfo, mealValue]) => {
                    // Skip if customerInfo is '__rowNum__' or if mealValue is empty
                    if (customerInfo === '__rowNum__' || !mealValue || mealValue.toString().trim() === '') {
                        return;
                    }
                    
                    // Parse customer information from the key
                    // Format: "Name / TotalMealsX / Target / Price Subscription / Size"
                    const parts = customerInfo.split('/').map(part => part.trim());
                    
                    if (parts.length < 3) return;
                    
                    const name = parts[0];
                    const sizeText = parts[1]?.replace('X', '')?.replace('x', '') || '5';
                    const target = parts[2];
                    const priceAndSubscription = parts[3]?.split(' ') || [];
                    const price = priceAndSubscription[0] || '0,00';
                    const subscriptionText = priceAndSubscription[1] || '1/4';
                    const size = parts[4] || calculateSize(parseInt(sizeText));
                    
                    // Parse subscription
                    const subscription = parseSubscription(subscriptionText);
                    
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
                            subscription,
                            size,
                            type: determineType(name, target, price) // Helper function to determine type
                        });
                    }
                    
                    const customer = customersMap.get(name);
                    
                    // Parse meal from the value
                    if (mealValue && typeof mealValue === 'string') {
                        const mealText = mealValue.trim();
                        
                        // Skip date rows (they contain dates like "24.6.", "1.7.", etc.)
                        if (mealText.match(/^\d{1,2}\.\d{1,2}\.?/)) {
                        return;
                        }
                        
                        // Parse meal quantity and name
                        // Examples: "2X KUS SALATA", "XL RISOTO", "BBQ JUN"
                        const mealMatch = mealText.match(/^(\d+)?\s*X?\s*(XL\s+)?(.+)$/i);
                        
                        if (mealMatch) {
                        const quantity = mealMatch[1] ? parseInt(mealMatch[1]) : 1;
                        const isXL = mealMatch[2] || mealMatch[3]?.toUpperCase().includes('XL');
                        let mealName = mealMatch[3]?.trim();
                        
                        // Add XL prefix if needed
                        if (isXL && !mealName.toUpperCase().startsWith('XL ')) {
                            mealName = `XL ${mealName}`;
                        }
                        
                        if (mealName) {
                            // Clean up meal name
                            mealName = mealName.replace(/\s+/g, ' ').trim();
                            
                            if (!customer.meals[mealName]) {
                            customer.meals[mealName] = 0;
                            }
                            customer.meals[mealName] += quantity;
                            customer.totalMeals += quantity;
                        }
                        }
                    }
                    });
                });
                
                // Convert map to array
                const parsedData = Array.from(customersMap.values());
                
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
import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { calculateSize, parseSubscription, generateId, determineType, formatDateFromInput, formatDateToDDMMYYYY, convertStringToDDMMYYYY } from '../utils/helpers';
import ExcelJS from 'exceljs';

export const useFileParser = () => {
  const [naziviData, setNaziviData] = useState([]);
  const [imports, setImports] = useState([]);
  const [pretplateData, setPretplateData] = useState([]);
  const [groupedDates, setGroupedDates] = useState({});

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
                    console.log('workbook start');
                    
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Process first sheet (original logic)
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    const parsedData = jsonData
                        .filter(item => typeof item.__EMPTY_2 === 'string' && typeof item.__EMPTY_3 === 'string')
                        .map(item => ({
                            id: generateId(),
                            jelo: item.__EMPTY_2 || '',
                            webNaziv: item.__EMPTY_3 || ''
                        }));
                    
                    setNaziviData(parsedData);

                    // Process 'Import' sheet
                    const importSheet = workbook.Sheets['import'];
                    const importData = [];
                    
                    console.log('workbook', workbook.Sheets);
                    if (importSheet) {
                        const importJsonData = XLSX.utils.sheet_to_json(importSheet, { 
                            header: 1, // Get raw data as array
                            defval: '' 
                        });
                        
                        
                        let currentPackage = null;
                        
                        for (const row of importJsonData) {
                            // Skip empty rows
                            if (!row || row.length < 21) continue; // Need at least 21 columns for T and U
                            
                            const colT = row[19]; // Column T (index 19 since it's 0-based)
                            const colU = row[20]; // Column U (index 20)
                            
                            // Skip if both columns are empty
                            if (!colT && !colU) continue;
                            
                            // Check if this is a package row (contains "x" in column T)
                            if (colT && typeof colT === 'string' && colT.includes('x') && colU) {
                                // Save previous package if exists
                                if (currentPackage) {
                                    importData.push(currentPackage);
                                }
                                
                                // Extract number from "10x" format
                                const totalMeals = parseInt(colT.replace('x', '')) || 0;
                                
                                currentPackage = {
                                    id: generateId(),
                                    name: colU.trim(),
                                    totalMeals: totalMeals,
                                    meals: {}
                                };
                            } 
                            // Check if this is a meal row (has number in T and text in U)
                            else if (currentPackage && colT && !isNaN(colT) && colU) {
                                const mealCount = parseInt(colT) || 1;
                                const mealName = colU.trim();
                                
                                if (mealName && mealName !== currentPackage.name) {
                                    currentPackage.meals[mealName] = mealCount;
                                }
                            }
                        }
                        
                        // Push the last package
                        if (currentPackage) {
                            importData.push(currentPackage);
                        }
                        
                        console.log('workbook', importData);
                        
                        setImports(importData);
                    }

                    resolve({
                        naziviData: parsedData,
                        importData: importData
                    });
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
                  const currentYear = new Date().getFullYear();
                  
                  // Track dates for each customer
                  const customerDates = new Map();
                  
                  let currGroupedDates = {};

                  // First, collect all customer data AND dates
                  jsonData.forEach((row, rowIndex) => {
                                              
                        //   const testCases = [
                        //     '1/ 19.8.',
                        //     '1 / 19.8.',
                        //     '1/ 19.8',
                        //     '1/ 19.8 some text',
                        //     '23/ 5.12. more text here',
                        //     '1/19.8.',
                        //     '19.9.',
                        //     '19.9'
                        // ];
                        const regex = /^(?:(\d{1,2})\s*\/\s*)?(\d{1,2})\.(\d{1,2})(?:\.|\s*(.*))?$/;

                      Object.entries(row).forEach(([customerInfo, cellValue]) => {
                          // Skip if customerInfo is '__rowNum__' or if cellValue is empty
                          if (customerInfo === '__rowNum__' || !cellValue || cellValue.toString().trim() === '') {
                              return;
                          }
                          
                          const cellText = cellValue.toString().trim();

                        // Check if this is a DATE row first
                        const dateMatch = cellText.match(regex);
                        if (dateMatch) {
                            const weekNumber = dateMatch[1] ? parseInt(dateMatch[1]) : null;
                            const day = parseInt(dateMatch[2]);
                            const month = parseInt(dateMatch[3]);
                            
                            // Validate it's a real date
                            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                                const dateString = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${currentYear}`;
                                                             // Parse customer information from the key to find which customer this date belongs to
                                const parts = customerInfo.split('/').map(part => part.trim());

                                if (parts.length >= 3) {
                                    const name = parts[0];
                                    // Determine which week number to use
                                    const targetWeekNumber = weekNumber !== null
                                        ? weekNumber
                                        : currGroupedDates[name]
                                        ? Math.max(...Object.keys(currGroupedDates[name]))
                                        : 1; 

                                    if (name === 'Zvonimir Cvetković') console.log(name, { targetWeekNumber, groupedDates: currGroupedDates[name] });
                                    
                                    if (!customerDates.has(name)) {
                                        customerDates.set(name, []);
                                    }
                                    if (!customerDates.get(name).includes(dateString)) {
                                        customerDates.get(name).push(dateString);
                                        console.log(`Found date for ${name}: ${dateString} from "${cellText}"`);
                                    }
                                    
                                    currGroupedDates = {
                                        ...currGroupedDates,
                                        [name]: {
                                            ...(currGroupedDates[name] || {}),
                                            [targetWeekNumber]: [...(currGroupedDates[name]?.[targetWeekNumber] || []), dateString]
                                        }
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
                              const quantityMatch = cellText.match(/^(\d+)\s*(?:X\s|\sX\s)?(.+)$/i);

                                if (quantityMatch) {
                                    // Has quantity prefix like "2X" or "2 X"
                                    const quantity = parseInt(quantityMatch[1]);
                                    let mealName = quantityMatch[2]?.trim();
                                    
                                    mealName = mealName.replace(/\s+/g, ' ').trim();
                                    
                                    // Skip if meal name is only 'x'
                                    if (mealName.toLowerCase() === 'x') {
                                        return;
                                    }
                                    
                                    // Remove the standalone "X" only if it's at the very beginning after quantity
                                    // but keep "X" when it's part of words like "XL", "X-LARGE", etc.
                                    if (mealName.match(/^X(\s|$)/i)) {
                                        mealName = mealName.substring(1).trim();
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
                                  if (['x', '...', '?', 'skip', 'to go', 'PAUZA (2X TO GO)'].includes(mealName.toLowerCase())) {
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
                  
                  setGroupedDates(currGroupedDates);

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

                          // console.log(`Assigned ${dates.length} dates to ${name}:`, customer.orderDates);
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


async function updateExcelFile(file, mealsData) {
    try {
        // Read the Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        // Get the first worksheet
        const worksheet = workbook.getWorksheet(1);

        // Update quantities based on meal names
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const mealNameCell = row.getCell(3); // Column C
                const quantityCell = row.getCell(2); // Column B
                
                const mealName = mealNameCell.value;
                if (mealName && mealsData.hasOwnProperty(mealName)) {
                    quantityCell.value = mealsData[mealName];
                }
            }
        });

        // Download the updated file with preserved styles
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'updated_meals_preserved.xlsx';
        link.click();
        
        URL.revokeObjectURL(link.href);
        
    } catch (error) {
        console.error('Error processing Excel file:', error);
        alert('Error processing file: ' + error.message);
    }
}

  return {
    naziviData,
    pretplateData,
    imports,
    groupedDates,
    updateExcelFile,
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
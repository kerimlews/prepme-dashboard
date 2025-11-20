import React, { useMemo, useState } from 'react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from 'docx';
import pkg from 'file-saver';
import Header from './components/Header';
import Controls from './components/Controls';
import Sidebar from './components/Sidebar';
import OrdersTable from './components/OrdersTable';
import { NaziviModal, PretplateModal } from './components/Modal';
import StatusMessage from './components/StatusMessage';
import { useShopify } from './hooks/useShopify';
import { useFileParser } from './hooks/useFileParser';
//import './styles/App.css';
import { calculateCombinedPrice, calculateSize, formatDateToDDMMYYYY, generateId, getTodayDate, hasOrderOnDate, mergeMeals, normalizeString } from './utils/helpers';
import MonthlySubs from './components/MonthlySubs';
import NotFoundMeals from './components/NotFoundMeals';
const { saveAs } = pkg;
import './styles/App.css';

// Helper function to map meal names
const mapMealNames = (meals, naziviData, imports) => {
  if (!meals) return {};

  // normalize keys
  const keys = naziviData.reduce((acc, a) => ({
    ...acc,
    [a.webNaziv.toLowerCase().trim()]: a.jelo
  }), {});
  
  const imprtNames = imports.map(i => normalizeString(i.name));

  const values = Object.values(keys).map(k => k.toLowerCase().trim());

  const notfound = {};
  
  let updatedMeals = {};
  Object.entries(meals).forEach(([mealName, quantity]) => {
    const normalizeMealName = mealName.toLowerCase().trim();
    const mappedName = keys[normalizeMealName] || mealName;
    if (!keys[normalizeMealName] && !values.includes(normalizeMealName) && !imprtNames.includes(normalizeString(normalizeMealName))) notfound[mappedName] = 1;
    
    const paket = imports.find(i => normalizeString(i.name) === normalizeString(normalizeMealName));

    if (paket) {
      Object.keys(paket.meals).forEach(mealKey => {
        updatedMeals[mealKey] = (updatedMeals[mealKey] || 0) + paket.meals[mealKey]
      })
    } else {
      updatedMeals[mappedName] = (updatedMeals[mappedName] || 0) + quantity;
    }

  });
    
  return { meals: updatedMeals, notfound };
};

// Helper function to get weekday in Croatian
const getWeekDayCroatian = (dateString) => {
  const date = new Date(dateString);
  const weekdays = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
  return weekdays[date.getDay() - 1];
};

const App = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [pretplateSelectedDate, setPretplateSelectedDate] = useState();
  const [status, setStatus] = useState({ message: '', type: '' });
  const [naziviModal, setNaziviModal] = useState({ isOpen: false, editingItem: null });
  const [pretplateModal, setPretplateModal] = useState({ isOpen: false, editingItem: null });
  const [ordersTableData, setOrdersTableData] = useState([]);
  const [notfoundMeals, setNotfoundMeals] = useState({});
  const [dodatno, setDodatno] = useState([]);
  const [kalkulatorFile, setKalkulatorFile] = useState();
  
  const {
    imports,
    naziviData,
    pretplateData,
    groupedDates,
    parseNaziviFile,
    updateExcelFile,
    parsePretplateFile,
    addNazivi,
    updateNazivi,
    deleteNazivi,
    addPretplate,
    updatePretplate,
    deletePretplate
  } = useFileParser();
  
  const {
    orders: { orders, additionalOrders },
    loading,
    monthlySubs,
    fetchOrders
  } = useShopify(imports);
    
  // console.log({ naziviData, orders, imports });
  
  const sumMeals = meals => Object.keys(meals).reduce((acc, a) => acc + meals[a], 0);

  // Create orders function - maps Shopify orders and merges with filtered pretplate
  const handleCreateOrders = () => {
    if (!selectedDate) {
      showStatus('Please select a date first!', 'error');
      return;
    }

    if (orders.length === 0 && pretplateData.length === 0) {
      showStatus('No data available. Please import Shopify orders or pretplate data first!', 'error');
      return;
    }

    // Get pretplate data filtered by selected date from right sidebar
    const dateFilteredPretplate = pretplateData.filter(pretplate =>
      hasOrderOnDate(pretplate.orderDates, pretplateSelectedDate || selectedDate)
    ).map(d => ({ ...d, pretplata: true }));

    // Create a map for quick lookup
    const ordersMap = new Map();

    let notfoundMeals = {};
        
    
    // Then process Shopify orders and merge with existing pretplate
    [...orders, ...dateFilteredPretplate, ...dodatno].forEach(shopifyOrder => {
      const lowerName = shopifyOrder.name.toLowerCase();
      const existingOrder = ordersMap.get(lowerName);
      
      const { meals, notfound } = mapMealNames(shopifyOrder.meals, naziviData, imports);
      const { meals: existingMeals, notfound: notfoundExisting } = existingOrder ? mapMealNames(existingOrder.meals, naziviData, imports) : { meals: [], notfound: [] };
      
      shopifyOrder.meals = meals;
      
      notfoundMeals = { ...notfoundMeals, ...notfound, ...notfoundExisting };
      
      if (existingOrder) {
        // Merge with existing pretplate order
        const mergedMeals = mergeMeals(existingMeals, meals);

        const totalMeals = sumMeals(existingOrder.meals) + sumMeals(shopifyOrder.meals);
        
        const obj = {
          ...existingOrder, // Pretplate data takes precedence
          meals: mergedMeals,
          totalMeals,
          pretplata: existingOrder.pretplata || shopifyOrder.pretplata,
          price: calculateCombinedPrice(existingOrder.price, shopifyOrder.price),
          size: calculateSize(totalMeals),
        };

        if (obj.subscription) {
          obj.subscription.current 
        }
        ordersMap.set(lowerName, obj);
      } else {
        // New order from Shopify
        ordersMap.set(lowerName, {
          ...shopifyOrder,
          totalMeals: sumMeals(shopifyOrder.meals)
        });
      }
    });

    setNotfoundMeals(notfoundMeals);

    // Convert map back to array
    const newOrdersTableData = Array.from(ordersMap.values());
    
    setOrdersTableData(newOrdersTableData);
    
    const mergedCount = newOrdersTableData.filter(order => order.pretplata).length;
    
    showStatus(`Created ${newOrdersTableData.length} orders (${mergedCount} pretplate, ${newOrdersTableData.length - mergedCount} Shopify-only)`);
  };

  // CRUD operations for middle table
  const addOrderToTable = (orderData) => {
    const newOrder = {
      ...orderData,
      id: generateId(),
    };
    setOrdersTableData(prev => [...prev, newOrder]);
  };


  const updateOrderInTable = (id, updates) => {
    setOrdersTableData(prev => prev.map(item => {
      if (item.id === id) {
        const updated = {...item, ...updates};

        const totalMeals = Object.keys(updated.meals).reduce((acc, key) => acc + updated.meals[key], 0);

        return {
          ...updated,
          size: calculateSize(totalMeals),
          totalMeals
        };
      }
      return item;
    }));
  };

  const deleteOrderFromTable = (id) => {
    setOrdersTableData(prev => prev.filter(item => item.id !== id));
  };

  // Calculate counts based on orders table data
  const tableCounts = useMemo(() => {
    const totalOrders = ordersTableData.length;
    const totalPretplate = ordersTableData.filter(item => item.pretplata).length;
    const newOrders = totalOrders - totalPretplate;
    
    return { totalOrders, totalPretplate, newOrders };
  }, [ordersTableData]);

  const showStatus = (message, type = 'success') => {
      setStatus({ message, type });
    };

    const clearStatus = () => {
      setStatus({ message: '', type: '' });
    };

  const handleRefresh = async () => {
    if (!selectedDate) {
      showStatus('Please select a date first!', 'error');
      return;
    }

    showStatus('Refreshing and merging data...');
    
    try {
      await fetchOrders(selectedDate, pretplateData);
      // The useMemo hook will automatically update ordersTableData
      showStatus('Data refreshed and merged successfully!');
    } catch (error) {
      showStatus('Error refreshing data: ' + error.message, 'error');
    }
  };

  const handleExportPdf = async () => {
    if (ordersTableData.length === 0) {
      showStatus('No data to export!', 'error');
      return;
    }
    
    try {
      updateExcelFile(kalkulatorFile, ordersTableData.reduce((acc, a) => {
        Object.keys(a.meals).forEach(key => {
          acc[key] = (acc[key] || 0) + a.meals[key]
        })
        return acc
      }, {}))
      // Calculate total meals sum
      const totalMealsSum = ordersTableData.reduce((sum, order) => sum + (order.totalMeals || 0), 0);
      
      const date = new Date(selectedDate).toISOString();

      // Get weekday for selected date in Croatian
      const weekday = getWeekDayCroatian(date);
      
      // Create DOCX document
      const doc = await generateDocxDocument(ordersTableData, date, weekday, totalMealsSum);
      
      // Save the document
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `orders_${date.split('T')[0]}.docx`);
      
      showStatus(`DOCX exported successfully! Orders: ${tableCounts.totalOrders}, Pretplate: ${tableCounts.totalPretplate}, New: ${tableCounts.newOrders}`);
    } catch (error) {
      showStatus('Error exporting DOCX: ' + error.message, 'error');
    }
  };

const generateDocxDocument = async (ordersData, date, weekday, totalMealsSum) => {    
    // Convert date from YYYY-MM-DD to DD/MM/YYYY
    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    };

    // Calculate week number in month
    const getWeekInMonth = (dateStr) => {
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const currentDate = new Date(year, month - 1, day);
        
        const firstDayWeekday = firstDay.getDay() || 7; // Convert Sunday (0) to 7
        const offset = ((firstDayWeekday + 6) % 7) - 1; // Adjust for week starting on Monday
        
        const diff = Math.floor((currentDate - firstDay) / (24 * 60 * 60 * 1000));
        return Math.ceil((diff + offset + 1) / 7);
    };

    const formattedDate = formatDate(date);
    const weekInMonth = getWeekInMonth(date);

    // A4 dimensions in DXA (1 inch = 1440 DXA, 1 cm = 567 DXA)
    const A4_HEIGHT_DXA = 16840; // 29.7cm * 567 ≈ 16840 DXA 11880
    const A4_WIDTH_DXA = 11907;  // 21cm * 567 ≈ 11907 DXA
    
    // Default Word margins (1 inch = 1440 DXA each side)
    const MARGIN_TOP = 1016;
    const MARGIN_BOTTOM = 1016;
    const MARGIN_LEFT = 1268;
    const MARGIN_RIGHT = 1268;
  
    // Calculate available inner height for content
    const AVAILABLE_HEIGHT_FIRST_PAGE = A4_HEIGHT_DXA - MARGIN_TOP - MARGIN_BOTTOM - 800; // 800 for header
    const AVAILABLE_HEIGHT_OTHER_PAGES = A4_HEIGHT_DXA - MARGIN_TOP - MARGIN_BOTTOM;

    // Precise table height calculation
    const calculateTableHeight = (order) => {
        // REAL measurements from Word documents:
        const SINGLE_LINE_HEIGHT = 140; // One line of text = 240 DXA
        const TABLE_BORDER = 40; // Top + bottom borders = 40 DXA
        const CELL_PADDING = 80; // Cell padding top + bottom = 80 DXA
        const TABLE_SPACING = 240; // Spacing before/after table = 240 DXA
        
        // Calculate rows:
        // 1 row for customer info (bold, might be slightly taller)
        // 1 row for address
        // X rows for meals
        const headerRows = 2; // Customer + address
        const mealRows = Object.keys(order.meals || {}).length;
        const totalRows = headerRows + mealRows;
        
        // Each row = line height + cell padding
        const rowHeight = SINGLE_LINE_HEIGHT + CELL_PADDING;
        const totalRowHeight = totalRows * rowHeight;
        
        // Total table height
        const totalHeight = TABLE_BORDER + totalRowHeight + TABLE_SPACING;
        
        console.log(`Table "${order.name}": ${headerRows} header rows + ${mealRows} meal rows = ${totalRows} total rows, Height: ${totalHeight} DXA`);
        
        return totalHeight;
    };

    // Group orders into pages based on REAL height calculation
   const distributeOrdersToPages = (orders) => {
        const pages = [];
        let currentPageOrders = [];
        let currentPageHeight = 0;
        let isFirstPage = true;
        
        orders.forEach(order => {
            const tableHeight = calculateTableHeight(order);
            const availableHeight = isFirstPage ? AVAILABLE_HEIGHT_FIRST_PAGE : AVAILABLE_HEIGHT_OTHER_PAGES;
            
            console.log(`Current page height: ${currentPageHeight} DXA, Table height: ${tableHeight} DXA, Available: ${availableHeight} DXA`);
            
            // If adding this table would exceed available height, start new page
            if (currentPageHeight + tableHeight > availableHeight && currentPageOrders.length > 0) {
                console.log(`🚨 Starting new page! Current page has ${currentPageOrders.length} tables, total height: ${currentPageHeight} DXA`);
                pages.push([...currentPageOrders]);
                currentPageOrders = [];
                currentPageHeight = 0;
                isFirstPage = false;
            }
            
            currentPageOrders.push(order);
            currentPageHeight += tableHeight;
        });
        
        // Add the last page
        if (currentPageOrders.length > 0) {
            pages.push(currentPageOrders);
        }
        
        console.log(`📄 Total pages: ${pages.length}`);
        pages.forEach((page, index) => {
            const pageHeight = page.reduce((sum, order) => sum + calculateTableHeight(order), 0);
            console.log(`Page ${index + 1}: ${page.length} tables, total height: ${pageHeight} DXA`);
        });
        
        return pages;
    };

     function findKeyByValue(obj, value) {
      const entry = Object.entries(obj).find(([key, arr]) => arr.includes(value));
      return entry ? entry[0] : null;
  }
  
    // Create order table
    const createOrderTable = (order) => {      
        const gDates = groupedDates[order.name];
        const subscription = gDates ? {
          current: findKeyByValue(gDates, formatDateToDDMMYYYY(selectedDate)),
          total: Math.max(...Object.keys(gDates))
        } : null;
      
        const rows = [
            // Customer info row
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `${order.name} / ${order.totalMeals}X / ${order.target} / ${order.price} ${subscription ? `${subscription.current}/${subscription.total}` : ''} / ${order.size || ''} ${order?.type ? `/ ${order.type}` : ''}`,
                                        bold: true,
                                    }),
                                ],
                            }),
                        ],
                        columnSpan: 2,
                    }),
                ],
            }),
            // Address row
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: order.address || "",
                                    }),
                                ],
                            }),
                        ],
                        columnSpan: 2,
                    }),
                ],
            }),
        ];

        // Add meal rows
        Object.keys(order.meals).forEach(key => {
            const meal = { quantity: order.meals[key], name: key };
            rows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: meal.quantity.toString(),
                                            bold: true,
                                        }),
                                    ],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                            width: {
                                size: 10,
                                type: WidthType.PERCENTAGE,
                            },
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: meal.name,
                                        }),
                                    ],
                                    alignment: AlignmentType.LEFT,
                                }),
                            ],
                            width: {
                                size: 90,
                                type: WidthType.PERCENTAGE,
                            },
                        }),
                    ],
                })
            );
        });

        return new Table({
            width: {
                size: 100,
                type: WidthType.PERCENTAGE,
            },
            columnWidths: [800, 3700],
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: rows,
        });
    };

    // Create content for a single page
    const createPageContent = (pageOrders) => {
        // Split page orders into two columns
        const midIndex = Math.ceil(pageOrders.length / 2);
        const leftColumnOrders = pageOrders.slice(0, midIndex);
        const rightColumnOrders = pageOrders.slice(midIndex);

        const createColumnContent = (orders) => {
            return orders.flatMap((order, index) => {
                const content = [
                    createOrderTable(order),
                ];

                // Add spacing between tables
                if (index < orders.length - 1) {
                    content.push(
                        new Paragraph({
                            children: [new TextRun({ text: "" })],
                            spacing: { after: 200 },
                        })
                    );
                }

                return content;
            });
        };

        const leftColumnContent = createColumnContent(leftColumnOrders);
        const rightColumnContent = createColumnContent(rightColumnOrders);

        return new Table({
            width: {
                size: 100,
                type: WidthType.PERCENTAGE,
            },
            columnWidths: [4500, 4500],
            borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: leftColumnContent,
                            verticalAlign: VerticalAlign.TOP,
                        }),
                        new TableCell({
                            children: rightColumnContent,
                            verticalAlign: VerticalAlign.TOP,
                        }),
                    ],
                }),
            ],
        });
    };

    // Distribute orders to pages based on precise height calculation
    const orderPages = distributeOrdersToPages(ordersData);

    // Create sections for each page
    const sections = orderPages.map((pageOrders, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        
        return {
            properties: {
                page: {
                    margin: {
                        top: isFirstPage ? MARGIN_TOP : 800, // Smaller top margin for subsequent pages
                        right: MARGIN_RIGHT,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_LEFT,
                    },
                },
            },
            children: [
                // Header only on first page
                ...(isFirstPage ? [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${formattedDate} / ${weekday} / W${weekInMonth} / ${totalMealsSum}X`,
                                bold: true,
                                size: 24,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),
                ] : []),
                createPageContent(pageOrders),
            ],
        };
    });

    const doc = new Document({
        sections: sections,
    });

    return doc;
};

  const handlePretplateFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await parsePretplateFile(file);
      showStatus('Pretplate data loaded successfully!');
    } catch (error) {
      showStatus('Error loading pretplate file: ' + error.message, 'error');
    }
  };

   const handleKalkulatorFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setKalkulatorFile(file)
      showStatus('Pretplate data loaded successfully!');
    } catch (error) {
      showStatus('Error loading pretplate file: ' + error.message, 'error');
    }
  };

const handleDodatnoFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    // Read the file content
    const fileContent = await readFileAsText(file);
    
    // Parse JSON data
    const jsonData = JSON.parse(fileContent);
    
    // Extract additionalOrders array from the JSON structure
    // Handle both the expected structure and fallback to direct array
    const additionalOrdersData = jsonData.additionalOrders || jsonData;
    
    if (!Array.isArray(additionalOrdersData)) {
      throw new Error('Invalid file format: expected an array of orders');
    }
    
    // Set the dodatno state with the parsed data
    setDodatno(additionalOrdersData);
    
    showStatus(`Dodatne narudžbe data loaded successfully! Loaded ${additionalOrdersData.length} orders.`);
    
    // Clear the file input to allow selecting the same file again
    e.target.value = '';
  } catch (error) {
    showStatus('Error loading dodatno file: ' + error.message, 'error');
  }
};

  // Helper function to read file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };
  const handleFetchOrders = async () => {
    if (!selectedDate) {
      showStatus('Please select a date first!', 'error');
      return;
    }

    try {
      await fetchOrders(selectedDate, pretplateData);
      showStatus(`Orders fetched for ${selectedDate} successfully!`);
    } catch (error) {
      showStatus('Error fetching orders: ' + error.message, 'error');
    }
  };

  const handleNaziviFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await parseNaziviFile(file);
      showStatus('Nazivi data loaded successfully!');
    } catch (error) {
      showStatus('Error loading nazivi file: ' + error.message, 'error');
    }
  };

  const handleSaveNazivi = (data) => {
    if (naziviModal.editingItem) {
      updateNazivi(naziviModal.editingItem.id, data);
      showStatus('Nazivi updated successfully!');
    } else {
      addNazivi(data);
      showStatus('Nazivi added successfully!');
    }
  };

  const handleSavePretplate = (data) => {
    if (pretplateModal.editingItem) {
      updatePretplate(pretplateModal.editingItem.id, data);
      showStatus('Pretplate updated successfully!');
    } else {
      addPretplate(data);
      showStatus('Pretplate added successfully!');
    }
  };

  // Add this function to your App component
// Update the handleExportAdditionalOrders function
const handleExportAdditionalOrders = () => {
  if (!additionalOrders || additionalOrders.length === 0) {
    showStatus('No additional orders to export!', 'error');
    return;
  }

  try {
    // Get tomorrow's date in DD/MM/YYYY format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = tomorrow.getFullYear();
    const tomorrowDate = `${day}-${month}-${year}`; // Format: DD-MM-YYYY
    
    // Create the JSON data
    const exportData = {
      exportDate: new Date().toISOString(),
      ordersDate: selectedDate,
      additionalOrders: additionalOrders
    };
    
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `dodatno-${tomorrowDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showStatus(`Additional orders exported successfully! File: dodatno-${tomorrowDate}.json`);
  } catch (error) {
    showStatus('Error exporting additional orders: ' + error.message, 'error');
  }
};
  
  return (
    <div className="container">
      <Header />
      
      <Controls
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNaziviFileChange={handleNaziviFileChange}
        onPretplateFileChange={handlePretplateFileChange}
        onDodatnoFileChange={handleDodatnoFileChange}
        onFetchOrders={handleFetchOrders}
        setKalkulatorFile={handleKalkulatorFileChange}
        loading={loading}
      />

        <div className="gemini-ai-container">
          <div style={{ marginBottom: '10px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span>Dodatne narudžbe unutar Osijeka: {additionalOrders.length}</span>
            <span>Naružbe izvan Osijeka: {orders.length}</span>
          </div>
          
      {additionalOrders?.length > 0 && (
          <>
          <div className="gemini-ai-scroll">
            {additionalOrders.map((order, index) => (
              <div key={order.id || index} className="additional-order-card">
                <div><strong>{order.name}</strong></div>
                <div>Meals: {order.totalMeals || 0}</div>
                <div>Address: {order.address}</div>
                {order.price && <div>Price: {order.price}</div>}
                {order.target && <div>Target: {order.target}</div>}
                {order.url && <strong><a target='__blank' href={order.url}>URL</a></strong>}
              </div>
            ))}
          </div>
          
          <button className="export-button" onClick={handleExportAdditionalOrders}>
            Export Narudzbe za sutra
          </button>
          </>
          )}
        </div>

      <StatusMessage
        message={status.message}
        type={status.type}
        onClear={clearStatus}
      />

      <NotFoundMeals meals={notfoundMeals} />
      <MonthlySubs monthlySubs={monthlySubs} />
      
      <div className="main-content">
        <Sidebar
          title="Nazivi"
          count={naziviData.length}
          data={naziviData}
          columns={['JELO', 'WEB NAZIV']}
          onAdd={() => setNaziviModal({ isOpen: true, editingItem: null })}
          onEdit={(id) => setNaziviModal({ 
            isOpen: true, 
            editingItem: naziviData.find(item => item.id === id) 
          })}
          onDelete={deleteNazivi}
          emptyMessage="No nazivi data loaded"
          type="nazivi"
        />
        
        <OrdersTable
          imports={imports}
          groupedDates={groupedDates}
          ordersTableData={ordersTableData}
          tableCounts={tableCounts}
          onRefresh={handleRefresh}
          onExportPdf={handleExportPdf}
          selectedDate={pretplateSelectedDate}
          onAddOrder={addOrderToTable}
          onEditOrder={updateOrderInTable}
          onDeleteOrder={deleteOrderFromTable}
          onCreateOrders={handleCreateOrders}
        /> 

        <Sidebar
          title="Pretplate"
          count={pretplateData.length}
          groupedDates={groupedDates}
          data={pretplateData}
          columns={['Name', 'Size', 'Target', 'Subscription', 'Price']}
          onAdd={() => setPretplateModal({ isOpen: true, editingItem: null })}
          onEdit={(id) => setPretplateModal({ 
            isOpen: true, 
            editingItem: pretplateData.find(item => item.id === id) 
          })}
          
          onDelete={deletePretplate}
          emptyMessage="No pretplate data loaded"
          type="pretplate"
          selectedDate={pretplateSelectedDate}
          onDateChange={setPretplateSelectedDate}
          showDateFilter={true}
        />
      </div>

      {/* Modals */}
      <NaziviModal
        isOpen={naziviModal.isOpen}
        onClose={() => setNaziviModal({ isOpen: false, editingItem: null })}
        onSave={handleSaveNazivi}
        editingItem={naziviModal.editingItem}
      />
      
      <PretplateModal
        isOpen={pretplateModal.isOpen}
        onClose={() => setPretplateModal({ isOpen: false, editingItem: null })}
        onSave={handleSavePretplate}
        editingItem={pretplateModal.editingItem}
      />
    </div>
  );
};

export default App;
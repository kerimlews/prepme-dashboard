import React, { useMemo, useState } from 'react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import Header from './components/Header';
import Controls from './components/Controls';
import Sidebar from './components/Sidebar';
import OrdersTable from './components/OrdersTable';
import { NaziviModal, PretplateModal } from './components/Modal';
import StatusMessage from './components/StatusMessage';
import { useShopify } from './hooks/useShopify';
import { useFileParser } from './hooks/useFileParser';
import './styles/App.css';
import { calculateCombinedPrice, calculateSize, generateId, getTodayDate, hasOrderOnDate, mergeMeals } from './utils/helpers';
import MonthlySubs from './components/MonthlySubs';
import NotFoundMeals from './components/NotFoundMeals';

// Helper function to map meal names
const mapMealNames = (meals, naziviData) => {
  if (!meals) return {};

  // normalize keys
  const keys = naziviData.reduce((acc, a) => ({
    ...acc,
    [a.webNaziv.toLowerCase().trim()]: a.jelo
  }), {});
  
  const values = Object.values(keys).map(k => k.toLowerCase().trim());

  const notfound = {};

  const updatedMeals = {};
  Object.entries(meals).forEach(([mealName, quantity]) => {
    const normalizeMealName = mealName.toLowerCase().trim();
    const mappedName = keys[normalizeMealName] || mealName;
    if (!keys[normalizeMealName] && !values.includes(normalizeMealName)) notfound[mappedName] = 1;
    
    updatedMeals[mappedName] = quantity;
  });
    
  return { meals: updatedMeals, notfound };
};

// Helper function to get weekday in Croatian
const getWeekDayCroatian = (dateString) => {
  const date = new Date(dateString);
  const weekdays = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
  return weekdays[date.getDay()];
};

const App = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [pretplateSelectedDate, setPretplateSelectedDate] = useState();
  const [status, setStatus] = useState({ message: '', type: '' });
  const [naziviModal, setNaziviModal] = useState({ isOpen: false, editingItem: null });
  const [pretplateModal, setPretplateModal] = useState({ isOpen: false, editingItem: null });
  const [ordersTableData, setOrdersTableData] = useState([]);
  const [notfoundMeals, setNotfoundMeals] = useState({});

  const {
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
  } = useFileParser();
  
  const {
    orders,
    loading,
    monthlySubs,
    fetchOrders
  } = useShopify();

  console.log(orders);
  
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
    );

    // Create a map for quick lookup
    const ordersMap = new Map();

    // First, add all pretplate orders to the map
    dateFilteredPretplate.forEach(pretplate => {
      ordersMap.set(pretplate.name.toLowerCase(), {
        ...pretplate,
        pretplata: true
      });
    });

    let notfoundMeals = {};

    // Then process Shopify orders and merge with existing pretplate
    [...orders, ...dateFilteredPretplate].forEach(shopifyOrder => {
      const lowerName = shopifyOrder.name.toLowerCase();
      const existingOrder = ordersMap.get(lowerName);
      const { meals, notfound } = mapMealNames(shopifyOrder.meals, naziviData);
    
      notfoundMeals = { ...notfoundMeals, ...notfound };

      if (existingOrder) {
        // Merge with existing pretplate order
        const mergedMeals = mergeMeals(existingOrder.meals, meals);

        const totalMeals = (existingOrder.totalMeals || 0) + (shopifyOrder.totalMeals || 0);

        ordersMap.set(lowerName, {
          ...existingOrder, // Pretplate data takes precedence
          meals: mergedMeals,
          totalMeals,
          price: calculateCombinedPrice(existingOrder.price, shopifyOrder.price),
          size: calculateSize(totalMeals),
          subscription: {
            ...existingOrder.subscription,
            current: (existingOrder.subscription.current || 0) + 1
          }
        });
      } else {
        // New order from Shopify
        ordersMap.set(lowerName, {
          ...shopifyOrder,
          pretplata: false,
          subscription: shopifyOrder.subscription || { current: 1, total: 1 }
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
      pretplata: false
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
      // Calculate total meals sum
      const totalMealsSum = ordersTableData.reduce((sum, order) => sum + (order.totalMeals || 0), 0);
      
      // Get weekday for selected date in Croatian
      const weekday = getWeekDayCroatian(selectedDate);
      
      // Create DOCX document
      const doc = await generateDocxDocument(ordersTableData, selectedDate, weekday, totalMealsSum);
      
      // Save the document
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `orders_${selectedDate}.docx`);
      
      showStatus(`DOCX exported successfully! Orders: ${tableCounts.totalOrders}, Pretplate: ${tableCounts.totalPretplate}, New: ${tableCounts.newOrders}`);
    } catch (error) {
      showStatus('Error exporting DOCX: ' + error.message, 'error');
    }
  };

  // Helper function to generate DOCX document
  const generateDocxDocument = async (ordersData, date, weekday, totalMealsSum) => {
    // Split orders into two columns for the main layout
    const midIndex = Math.ceil(ordersData.length / 2);
    const leftColumnOrders = ordersData.slice(0, midIndex);
    const rightColumnOrders = ordersData.slice(midIndex);

    // Create content for each column
    const leftColumnContent = leftColumnOrders.flatMap((order, index) => [
      createOrderTable(order),
      index < leftColumnOrders.length - 1 ? 
        new Paragraph({ children: [new TextRun({ text: "" })] }) : // Spacing between tables
        new Paragraph({ children: [] })
    ]);

    const rightColumnContent = rightColumnOrders.flatMap((order, index) => [
      createOrderTable(order),
      index < rightColumnOrders.length - 1 ? 
        new Paragraph({ children: [new TextRun({ text: "" })] }) : // Spacing between tables
        new Paragraph({ children: [] })
    ]);

    // Create a two-column layout using a table with 2 columns
    const twoColumnTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      columnWidths: [4500, 4500], // Equal width for left and right columns
      borders: {
        top: { style: "none" },
        bottom: { style: "none" },
        left: { style: "none" },
        right: { style: "none" },
        insideHorizontal: { style: "none" },
        insideVertical: { style: "none" },
      },
      rows: [
        new TableRow({
          children: [
            // Left column for orders
            new TableCell({
              children: leftColumnContent,
            }),
            // Right column for orders
            new TableCell({
              children: rightColumnContent,
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [
                new TextRun({
                  text: `${date} / ${weekday} / W2 / ${totalMealsSum}X`,
                  bold: true,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            // Two-column content
            twoColumnTable,
          ],
        },
      ],
    });

    return doc;
  };

  // Helper function to create individual order table
// Helper function to create individual order table
const createOrderTable = (order) => {
  // Build header text with conditional fields
  let headerText = `${order.name} / ${order.totalMeals || 0}X / ${order.target || ''}`;
  
  if (order.price) headerText += ` / ${order.price}`;
  if (order.type) headerText += ` ${order.type}`;
  if (order.size) headerText += ` / ${order.size}`;

  // Create meal rows
  const mealRows = [];
  if (order.meals) {
    Object.entries(order.meals).forEach(([meal, quantity]) => {
      mealRows.push(
        new TableRow({
          children: [
            // Left column for numbers - 30px width
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: quantity.toString() })],
                alignment: AlignmentType.LEFT
              })],
            }),
            // Right column for meal names
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: meal })],
                alignment: AlignmentType.LEFT
              })],
            }),
          ],
        })
      );
    });
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: "none" },
      bottom: { style: "none" },
      left: { style: "none" },
      right: { style: "none" },
      insideHorizontal: { style: "none" },
      insideVertical: { style: "none" },
    },
    columnWidths: [500, 8000], // 50px for numbers, rest for meal names
    rows: [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: headerText,
                    bold: true,
                  }),
                ],
              }),
            ],
            columnSpan: 2,
          }),
        ],
      }),
      // Meal rows
      ...mealRows,
    ],
  });
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

  return (
    <div className="container">
      <Header />
      
      <Controls
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNaziviFileChange={handleNaziviFileChange}
        onPretplateFileChange={handlePretplateFileChange}
        onFetchOrders={handleFetchOrders}
        loading={loading}
      />
      
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
          ordersTableData={ordersTableData}
          tableCounts={tableCounts}
          onRefresh={handleRefresh}
          onExportPdf={handleExportPdf}
          selectedDate={selectedDate}
          onAddOrder={addOrderToTable}
          onEditOrder={updateOrderInTable}
          onDeleteOrder={deleteOrderFromTable}
          onCreateOrders={handleCreateOrders}
        />

        <Sidebar
          title="Pretplate"
          count={pretplateData.length}
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
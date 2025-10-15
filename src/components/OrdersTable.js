// src/components/OrdersTable.js
import React, { useState, useMemo } from 'react';
import OrderModal from './OrderModal';

const OrdersTable = ({ 
  ordersTableData,
  tableCounts,
  onRefresh, 
  onExportPdf,
  selectedDate,
  onAddOrder,
  onEditOrder,
  onDeleteOrder,
  onCreateOrders // New prop for creating orders
}) => {
  const [orderModal, setOrderModal] = useState({ isOpen: false, editingItem: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

   // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = ordersTableData;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.size?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.keys(item.meals || {}).some(meal => 
          meal.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [ordersTableData, searchTerm, sortConfig]);
  
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getRowClass = (item) => {
    // Check subscription ending first (highest priority)
    if (item.subscription && item.subscription.total - item.subscription.current === 1) {
      return 'subscription-ending';
    }
    
    // Then check if it's pretplata
    if (item.pretplata) {
      return 'pretplata-row';
    }
    
    // Finally, regular order
    return 'order-row';
  };


  const formatMeals = (meals) => {
    if (!meals) return '';
    return Object.entries(meals)
      .map(([meal, quantity]) => `${quantity} ${meal}`)
      .join('<hr>');
  };

  const handleEdit = (item) => {
    setOrderModal({ isOpen: true, editingItem: item });
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete order for ${name}?`)) {
      onDeleteOrder(id);
    }
  };

  const handleSaveOrder = (orderData) => {
    if (orderModal.editingItem) {
      onEditOrder(orderModal.editingItem.id, orderData);
    } else {
      onAddOrder(orderData);
    }
    setOrderModal({ isOpen: false, editingItem: null });
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
        <div className="table-container">
      {/* Header with counts, legend, search, and actions */}
      <div className="table-header">
        <div className="table-header-left">
          <div className="table-title">Orders Overview</div>
          <div className="header-content">
            <div className="table-counts">
              <div className="count-item">
                <span className="count-label">Total:</span>
                <span className="count-value">{tableCounts.totalOrders}</span>
              </div>
              <div className="count-item">
                <span className="count-label">Pretplate:</span>
                <span className="count-value">{tableCounts.totalPretplate}</span>
              </div>
              <div className="count-item">
                <span className="count-label">New:</span>
                <span className="count-value new-orders">{tableCounts.newOrders}</span>
              </div>
              <div className="count-item">
                <span className="count-label">Showing:</span>
                <span className="count-value">{filteredAndSortedData.length}</span>
              </div>
            </div>
            
            <div className="legend-container">
              <div className="legend-title">Colors:</div>
              <div className="legend">
                <div className="legend-item">
                  <div className="legend-color subscription-ending-color"></div>
                  <span>Ending</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color pretplata-color"></div>
                  <span>Pretplata</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color order-color"></div>
                  <span>Regular</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="table-header-right">
          {/* Search Box */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={clearSearch} title="Clear search">
                ✕
              </button>
            )}
          </div>
          
          <button 
            className="primary create-orders-btn"
            onClick={onCreateOrders}
            title="Create orders from Shopify and filtered Pretplate"
          >
            🚀 Create Orders
          </button>
          <button 
            className="secondary add-order-btn"
            onClick={() => setOrderModal({ isOpen: true, editingItem: null })}
          >
            ➕ Add
          </button>
          <button className="secondary export-btn" onClick={onExportPdf}>
            📄 DOCX
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="table-content">
        {filteredAndSortedData.length === 0 ? (
          <div className="empty-state" id="orders-empty">
            <i>📦</i>
            <p>
              {searchTerm ? 'No orders match your search' : 'No orders loaded'}
            </p>
            <p className="empty-subtitle">
              {searchTerm ? 'Try a different search term' : 'Click "Create Orders" to generate orders from Shopify and Pretplate'}
            </p>
            {searchTerm ? (
              <button className="clear-search-btn" onClick={clearSearch}>
                Clear Search
              </button>
            ) : (
              <button className="create-orders-btn-empty" onClick={onCreateOrders}>
                🚀 Create Orders Now
              </button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  Name <SortIcon columnKey="name" />
                </th>
                <th onClick={() => handleSort('size')} className="sortable">
                  Size <SortIcon columnKey="size" />
                </th>
                <th onClick={() => handleSort('target')} className="sortable">
                  Target <SortIcon columnKey="target" />
                </th>
                <th>Week</th>
                <th onClick={() => handleSort('price')} className="sortable">
                  Price <SortIcon columnKey="price" />
                </th>
                <th>Meals</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.map(item => {
                const isSubscriptionEnding = item.subscription && 
                  item.subscription.total - item.subscription.current === 1;
                
                return (
                  <tr key={item.id} className={getRowClass(item)}>
                    <td>
                      <div className="name-cell">
                        {item.name}
                      </div>
                    </td>
                    <td>{item.size}</td>
                    <td>{item.target}</td>
                    <td>
                      {item.subscription ? 
                        `${item.subscription.current}/${item.subscription.total}` : 
                        'N/A'
                      }
                      {isSubscriptionEnding && (
                        <span className="warning-icon" title="Subscription ending"> ⚠️</span>
                      )}
                    </td>
                    <td>{item.price}</td>
                    <td dangerouslySetInnerHTML={{ 
                      __html: formatMeals(item.meals) 
                    }} />
                    <td>
                      <span className={`type-badge ${item.pretplata ? 'pretplata-badge' : 'order-badge'}`}>
                        {item.pretplata ? 'Pretplata' : 'Order'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {item.url && <button 
                          className="url-btn"
                          onClick={() => window.open(item.url, '_blank')}
                          title="Open URL"
                        >
                          🔗
                        </button>}
                        <button 
                          className="edit-btn"
                          onClick={() => handleEdit(item)}
                          title="Edit order"
                        >
                          ✏️
                        </button>
                        <button 
                          className="danger delete-btn"
                          onClick={() => handleDelete(item.id, item.name)}
                          title="Delete order"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Modal for CRUD operations */}
      <OrderModal
        isOpen={orderModal.isOpen}
        onClose={() => setOrderModal({ isOpen: false, editingItem: null })}
        onSave={handleSaveOrder}
        editingItem={orderModal.editingItem}
      />
    </div>
  );
};

export default OrdersTable;
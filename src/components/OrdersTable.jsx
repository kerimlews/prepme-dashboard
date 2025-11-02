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
  onCreateOrders
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

  const getCardClass = (item) => {
    // Check subscription ending first (highest priority)
    if (item.subscription && item.subscription.total - item.subscription.current === 0) {
      return 'card subscription-ending';
    }
    
    // Then check if it's pretplata
    if (item.pretplata) {
      return 'card pretplata-row';
    }
    
    // Finally, regular order
    return 'card order-row';
  };

  const formatMeals = (meals) => {
    if (!meals) return [];
    return Object.entries(meals).map(([meal, quantity]) => ({
      meal,
      quantity,
      text: `${quantity} ${meal}`
    }));
  };

  const handleEdit = (item) => {
    setOrderModal({ isOpen: true, editingItem: item });
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Jeste li sigurni da želite izbrisati narudžbu za ${name}?`)) {
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

  return (
    <div className="orders-container">
      {/* Header with counts, legend, search, and actions */}
      <div className="orders-header">
        <div className="orders-header-left">
          <div className="orders-title">Pregled Narudžbi</div>
          <div className="header-content">
            <div className="orders-counts">
              <div className="count-item">
                <span className="count-label">Ukupno:</span>
                <span className="count-value">{tableCounts.totalOrders}</span>
              </div>
              <div className="count-item">
                <span className="count-label">Pretplate:</span>
                <span className="count-value">{tableCounts.totalPretplate}</span>
              </div>
              <div className="count-item">
                <span className="count-label">Nove:</span>
                <span className="count-value new-orders">{tableCounts.newOrders}</span>
              </div>
              <div className="count-item">
                <span className="count-label">Prikazano:</span>
                <span className="count-value">{filteredAndSortedData.length}</span>
              </div>
            </div>
            
            <div className="legend-container">
              <div className="legend-title">Boje:</div>
              <div className="legend">
                <div className="legend-item">
                  <div className="legend-color subscription-ending-color"></div>
                  <span>Završava</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color pretplata-color"></div>
                  <span>Pretplata</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color order-color"></div>
                  <span>Obična</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="orders-header-right">
          {/* Search Box */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Traži narudžbe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={clearSearch} title="Očisti pretragu">
                ✕
              </button>
            )}
          </div>
          
          <div className="actions-group">
            <button 
              className="primary create-orders-btn"
              onClick={onCreateOrders}
              title="Kreiraj narudžbe iz Shopifya i filtriranih Pretplata"
            >
              🚀 Kreiraj Narudžbe
            </button>
            <button 
              className="secondary add-order-btn"
              onClick={() => setOrderModal({ isOpen: true, editingItem: null })}
              title="Dodaj novu narudžbu"
            >
              ➕ Dodaj
            </button>
            <button 
              className="secondary export-btn" 
              onClick={onExportPdf}
              title="Izvezi u DOCX format"
            >
              📄 Izvezi DOCX
            </button>
          </div>
        </div>
      </div>

      {/* Orders Cards */}
      <div className="orders-content">
        {filteredAndSortedData.length === 0 ? (
          <div className="empty-state" id="orders-empty">
            <i>📦</i>
            <p>
              {searchTerm ? 'Nema narudžbi koje odgovaraju pretrazi' : 'Nema učitane narudžbe'}
            </p>
            <p className="empty-subtitle">
              {searchTerm ? 'Pokušajte s drugim pojmom za pretragu' : 'Kliknite "Kreiraj Narudžbe" za generiranje narudžbi iz Shopifya i Pretplata'}
            </p>
            {searchTerm ? (
              <button className="clear-search-btn" onClick={clearSearch}>
                Očisti Pretragu
              </button>
            ) : (
              <button className="create-orders-btn-empty" onClick={onCreateOrders}>
                🚀 Kreiraj Narudžbe
              </button>
            )}
          </div>
        ) : (
          <div className="orders-cards-grid">
            {filteredAndSortedData.map(item => {
              const isSubscriptionEnding = item.subscription && 
                item.subscription.total - item.subscription.current === 0;
              const meals = formatMeals(item.meals);
              
              return (
                <div key={item.id} className={getCardClass(item)}>
                  {/* Top Row - Main Info */}
                  <div className="card-top-row">
                    <div className="card-main-info">
                      <div className="card-name">
                        {item?.isCOD && <span className="cash-icon" title="Plaćanje pouzećem">💰</span>}
                        {item.name}
                      </div>
                      <div className="card-details">
                        <span className="card-size">{item.size}</span>
                        <span className="card-target">{item.target}</span>
                        <span className="card-price">{item.price} €</span>
                      </div>
                    </div>
                    
                    {/* Actions in top right corner */}
                    <div className="card-actions">
                      {item.url && (
                        <button 
                          className="icon-btn url-btn"
                          onClick={() => window.open(item.url, '_blank')}
                          title="Otvori URL"
                        >
                          🔗
                        </button>
                      )}
                      <button 
                        className="icon-btn edit-btn"
                        onClick={() => handleEdit(item)}
                        title="Uredi narudžbu"
                      >
                        ✏️
                      </button>
                      <button 
                        className="icon-btn delete-btn"
                        onClick={() => handleDelete(item.id, item.name)}
                        title="Izbriši narudžbu"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Second Row - Subscription and Type */}
                  <div className="card-second-row">
                    <div className="card-subscription">
                      <span className="subscription-label">
                         {item.subscription ? 
                          `Tjedan: :${item.subscription.current}/${item.subscription.total}` : 
                          ''
                        }
                      </span>
                      {isSubscriptionEnding && (
                        <span className="warning-icon" title="Pretplata završava"> ⚠️</span>
                      )}
                    </div>
                    <div className="card-type">
                      <span className={`type-badge ${item.pretplata ? 'pretplata-badge' : 'order-badge'}`}>
                        {item.pretplata ? 'Pretplata' : 'Narudžba'}
                      </span>
                    </div>
                  </div>

                  {/* Third Row - Meals */}
                  {meals.length > 0 && (
                    <div className="card-meals-row">
                      <div className="meals-label">Jela:</div>
                      <div className="meals-list">
                        {meals.map((mealItem, index) => (
                          <div key={index} className="meal-item">
                            {mealItem.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
// src/components/Sidebar.js
import React, { useState, useMemo } from 'react';
import { hasOrderOnDate } from '../utils/helpers';
import CustomDateInput from './CustomDateInput';

const Sidebar = ({
  title,
  count,
  data,
  columns,
  onAdd,
  onEdit,
  onDelete,
  emptyMessage,
  type,
  selectedDate,
  onDateChange,
  showDateFilter = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter data by search term and date
  const filteredData = useMemo(() => {
    let result = data;

    // Apply date filter if enabled
    if (showDateFilter && selectedDate) {
      result = result.filter(item => hasOrderOnDate(item.orderDates, selectedDate));
    }

    // Apply search filter
    if (searchTerm) {
      result = result.filter(item => {
        if (type === 'nazivi') {
          return (
            item.jelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.webNaziv?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        } else {
          return (
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.size?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.price?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.subscription && `${item.subscription.current}/${item.subscription.total}`.includes(searchTerm))
          );
        }
      });
    }

    return result;
  }, [data, searchTerm, selectedDate, showDateFilter, type]);

  const displayCount = filteredData.length;

  const clearSearch = () => {
    setSearchTerm('');
  };

  const renderCardContent = (item) => {
    if (type === 'nazivi') {
      return (
        <div className="card-content">
          <div className="card-field">
            <strong>JELO:</strong> {item.jelo}
          </div>
          <div className="card-field">
            <strong>WEB NAZIV:</strong> {item.webNaziv}
          </div>
        </div>
      );
    } else {
      return (
        <div className="card-content">
          <div className="card-field">
            <strong>Name:</strong> {item.name}
          </div>
          <div className="card-field">
            <strong>Size:</strong> {item.size}
          </div>
          <div className="card-field">
            <strong>Target:</strong> {item.target}
          </div>
          <div className="card-field">
            <strong>Subscription:</strong> {item.subscription?.current}/{item.subscription?.total}
          </div>
          <div className="card-field">
            <strong>Price:</strong> {item.price}
          </div>
          {item.orderDates && (
            <div className="card-field">
              <strong>Order Dates:</strong> {item.orderDates.join(', ')}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">{title} ({displayCount})</div>
        <button className="add-btn" onClick={onAdd} title={`Add ${type}`}>
          <span className="icon">+</span>
        </button>
      </div>

      {/* Date Filter and Search Section */}
      <div className="sidebar-filters">
        {showDateFilter && (
          <div className="sidebar-date-section">
            <CustomDateInput onDateChange={onDateChange} />
            {selectedDate && (
              <div className="sidebar-date-info">
                Showing orders for: {selectedDate}
              </div>
            )}
          </div>
        )}
        
        {/* Search Box */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder={`Search ${type}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sidebar-search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={clearSearch} title="Clear search">
              ✕
            </button>
          )}
        </div>
      </div>
      
      <div className="sidebar-content cards-container">
        {filteredData.length === 0 ? (
          <div className="empty-state">
            <i>{type === 'nazivi' ? '📋' : '📊'}</i>
            <p>
              {searchTerm 
                ? `No ${type} match your search`
                : showDateFilter && selectedDate 
                  ? `No ${type} orders found for ${selectedDate}`
                  : emptyMessage
              }
            </p>
            {searchTerm && (
              <button className="clear-search-btn" onClick={clearSearch}>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="cards-grid">
            {filteredData.map(item => (
              <div key={item.id} className="card">
                <div className="card-actions">
                  <button 
                    className="icon-btn edit-btn"
                    onClick={() => onEdit(item.id)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    className="icon-btn delete-btn"
                    onClick={() => onDelete(item.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
                {renderCardContent(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
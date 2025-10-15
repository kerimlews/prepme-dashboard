// src/components/Sidebar.js
import React, { useState, useMemo } from 'react';
import { hasOrderOnDate } from '../utils/helpers';

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

  const renderRow = (item) => {
    if (type === 'nazivi') {
      return (
        <>
          <td>{item.jelo}</td>
          <td>{item.webNaziv}</td>
        </>
      );
    } else {
      return (
        <>
          <td>{item.name}</td>
          <td>{item.size}</td>
          <td>{item.target}</td>
          <td>{item.subscription.current}/{item.subscription.total}</td>
          <td>{item.price}</td>
        </>
      );
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">{title} ({displayCount})</div>
        <button onClick={onAdd}>Add</button>
      </div>

      {/* Date Filter and Search Section */}
      <div className="sidebar-filters">
        {showDateFilter && (
          <div className="sidebar-date-section">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="sidebar-date-input"
            />
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
      
      <div className="sidebar-content">
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
          <table>
            <thead>
              <tr>
                {columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr key={item.id}>
                  {renderRow(item)}
                  <td>
                    <button 
                      className="edit-btn"
                      onClick={() => onEdit(item.id)}
                    >
                      Edit
                    </button>
                    <button 
                      className="danger delete-btn"
                      onClick={() => onDelete(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
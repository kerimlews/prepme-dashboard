// src/components/Controls.js
import React from 'react';

const Controls = ({
  selectedDate,
  onDateChange,
  onNaziviFileChange,
  onPretplateFileChange,
  onFetchOrders,
  loading
}) => {
  return (
    <div className="controls">
      <div className="control-group">
        <label htmlFor="nazivi-file">Nazivi Excel File</label>
        <input
          type="file"
          id="nazivi-file"
          accept=".xlsx, .xls"
          onChange={onNaziviFileChange}
        />
      </div>
      
      <div className="control-group">
        <label htmlFor="pretplate-file">Pretplate Excel File</label>
        <input
          type="file"
          id="pretplate-file"
          accept=".xlsx, .xls"
          onChange={onPretplateFileChange}
        />
      </div>
      
      <div className="control-group date-fetch-group">
        <div className="date-input-container">
          <label htmlFor="date-select">Select Date</label>
          <input
            type="date"
            id="date-select"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <button 
          id="fetch-orders" 
          onClick={onFetchOrders}
          disabled={loading}
          className="fetch-orders-btn"
        >
          {loading ? 'Importing...' : 'Import from Shopify'}
        </button>
      </div>
    </div>
  );
};

export default Controls;
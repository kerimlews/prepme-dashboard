// src/components/Controls.js
import CustomDateInput from './CustomDateInput';

const Controls = ({
  selectedDate,
  onDateChange,
  onNaziviFileChange,
  onPretplateFileChange,
  onDodatnoFileChange,
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

      <div className="control-group">
        <label htmlFor="pretplate-file">Dodatne narudzbe</label>
        <input
          type="file"
          id="dodatno-file"
          accept=".json"
          onChange={onDodatnoFileChange}
        />
      </div>
      
      <div className="control-group date-fetch-group">
         <CustomDateInput
            onDateChange={onDateChange}
          />
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
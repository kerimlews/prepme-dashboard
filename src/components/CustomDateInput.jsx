import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const CustomDateInput = ({ onDateChange, ...props }) => {
  const [selectedDate, setSelectedDate] = useState();
    
  return (
      <div className="date-input-container">
        <label htmlFor="date-select">Select Date</label>
        <DatePicker
        id={Math.random()}
          selected={selectedDate}
          onChange={(d) => {            
            const date = d?.toISOString();
            onDateChange(date);
            setSelectedDate(date)            
          }}
          dateFormat="dd/MM/yyyy"
          placeholderText="DD/MM/YYYY"
          isClearable
          className="react-datepicker__input"
        />
      </div>
  );
};

export default CustomDateInput;
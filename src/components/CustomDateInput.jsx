import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function dateToLocalISOString(date) {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

const CustomDateInput = ({ onDateChange, ...props }) => {
  const [selectedDate, setSelectedDate] = useState();
    
  return (
      <div className="date-input-container">
        <label htmlFor="date-select">Select Date</label>
        <DatePicker
        id={Math.random()}
          selected={selectedDate}
          onChange={(d) => {
            console.log(dateToLocalISOString(d));
                        
            const date = dateToLocalISOString(d);
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
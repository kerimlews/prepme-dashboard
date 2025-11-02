import React from 'react'

const MonthlySubs = ({ monthlySubs }) => {
  if (!monthlySubs || monthlySubs.length === 0) return null;

  return (
    <div className="monthly-subs-container">
    <div className="monthly-subs-header">
        <h4>📅 Mjesecne pretplate: ({monthlySubs.length})</h4>
    </div>
    <div className="monthly-subs-list">
        {monthlySubs.map((sub, index) => (
        <div key={index} className="monthly-sub-item">
            <span className="sub-name">{sub.name}</span>
            <a 
            href={sub.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="sub-link"
            >
            🔗 Pogledaj
            </a>
        </div>
        ))}
    </div>
    </div>
  )
}

export default MonthlySubs

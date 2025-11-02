import React from 'react'

const NotFoundMeals = ({ meals }) => {
  if (!meals || Object.keys(meals).length === 0) return null;

  const keys = Object.keys(meals);

  return (
    <div className="monthly-subs-container">
      <div className="monthly-subs-header">
          <h4>Not Found Meals ({keys.length})</h4>
      </div>
      <div className="monthly-subs-list">
          {keys.map((key, index) => (
          <div key={index} className="monthly-sub-item">
              <span className="sub-name">{key}</span>
          </div>
          ))}
      </div>
    </div>
  )
}

export default NotFoundMeals

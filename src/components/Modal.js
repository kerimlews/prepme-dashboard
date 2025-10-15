import React, { useState, useEffect } from 'react';

export const NaziviModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({ jelo: '', webNaziv: '' });

  useEffect(() => {
    if (editingItem) {
      setFormData({ jelo: editingItem.jelo, webNaziv: editingItem.webNaziv });
    } else {
      setFormData({ jelo: '', webNaziv: '' });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.jelo.trim() || !formData.webNaziv.trim()) {
      alert('Please fill in all fields!');
      return;
    }
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            {editingItem ? 'Edit Nazivi' : 'Add Nazivi'}
          </div>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nazivi-jelo">JELO</label>
            <input
              type="text"
              id="nazivi-jelo"
              value={formData.jelo}
              onChange={(e) => setFormData(prev => ({ ...prev, jelo: e.target.value }))}
              placeholder="Enter JELO"
            />
          </div>
          <div className="form-group">
            <label htmlFor="nazivi-web-naziv">WEB NAZIV</label>
            <input
              type="text"
              id="nazivi-web-naziv"
              value={formData.webNaziv}
              onChange={(e) => setFormData(prev => ({ ...prev, webNaziv: e.target.value }))}
              placeholder="Enter WEB NAZIV"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="danger" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PretplateModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({
    name: '',
    totalMeals: '',
    price: '',
    target: '',
    current: '1',
    total: '4',
    type: 'PRIV',
    orderDates: [],
    meals: [{ name: '', quantity: 1 }]
  });

  const [newDate, setNewDate] = useState('');

  const typeOptions = ['PRIV', 'AMBASADOR', 'GIVEAWAY', 'MARSA PRIV'];

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name,
        totalMeals: editingItem.totalMeals.toString(),
        price: editingItem.price,
        target: editingItem.target,
        current: editingItem.subscription.current.toString(),
        total: editingItem.subscription.total.toString(),
        type: editingItem.type || 'PRIV',
        orderDates: editingItem.orderDates || [],
        meals: Object.entries(editingItem.meals).map(([name, quantity]) => ({
          name,
          quantity
        }))
      });
    } else {
      setFormData({
        name: '',
        totalMeals: '',
        price: '',
        target: '',
        current: '1',
        total: '4',
        type: 'PRIV',
        orderDates: [],
        meals: [{ name: '', quantity: 1 }]
      });
    }
    setNewDate('');
  }, [editingItem, isOpen]);

  const handleMealChange = (index, field, value) => {
    const newMeals = [...formData.meals];
    newMeals[index] = { ...newMeals[index], [field]: value };
    const totalMeals = newMeals.reduce((acc, a) => a.quantity + acc, 0);
    
    setFormData(prev => ({ ...prev, meals: newMeals, totalMeals  }));
  };

  const addMeal = () => {
    setFormData(prev => ({
      ...prev,
      meals: [...prev.meals, { name: '', quantity: 1 }]
    }));
  };

  const removeMeal = (index) => {
    if (formData.meals.length > 1) {
      setFormData(prev => ({
        ...prev,
        meals: prev.meals.filter((_, i) => i !== index)
      }));
    }
  };

  const addOrderDate = () => {
    if (newDate && !formData.orderDates.includes(newDate)) {
      setFormData(prev => ({
        ...prev,
        orderDates: [...prev.orderDates, newDate]
      }));
      setNewDate('');
    }
  };

  const removeOrderDate = (dateToRemove) => {
    setFormData(prev => ({
      ...prev,
      orderDates: prev.orderDates.filter(date => date !== dateToRemove)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const mealsObj = {};
    formData.meals.forEach(meal => {
      if (meal.name.trim() && meal.quantity > 0) {
        mealsObj[meal.name.trim()] = meal.quantity;
      }
    });

    if (Object.keys(mealsObj).length === 0) {
      alert('Please add at least one meal!');
      return;
    }

    if (!formData.name.trim() || !formData.price.trim() || !formData.target.trim()) {
      alert('Please fill in all required fields!');
      return;
    }

    onSave({
      name: formData.name,
      totalMeals: parseInt(formData.totalMeals) || Object.values(mealsObj).reduce((a, b) => a + b, 0),
      price: formData.price,
      target: formData.target,
      subscription: {
        current: parseInt(formData.current),
        total: parseInt(formData.total)
      },
      type: formData.type,
      orderDates: formData.orderDates,
      meals: mealsObj
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            {editingItem ? 'Edit Pretplate' : 'Add Pretplate'}
          </div>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pretplate-name">Name</label>
            <input
              type="text"
              id="pretplate-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter name"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pretplate-type">Type</label>
            <select
              id="pretplate-type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
            >
              {typeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="pretplate-total-meals">Total Meals</label>
            <input
              type="number"
              id="pretplate-total-meals"
              value={formData.totalMeals}
              onChange={(e) => setFormData(prev => ({ ...prev, totalMeals: e.target.value }))}
              placeholder="Enter total meals"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pretplate-price">Price</label>
            <input
              type="text"
              id="pretplate-price"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="Enter price"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pretplate-target">Target</label>
            <input
              type="text"
              id="pretplate-target"
              value={formData.target}
              onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
              placeholder="Enter target"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pretplate-current">Subscription Current</label>
            <input
              type="number"
              id="pretplate-current"
              value={formData.current}
              onChange={(e) => setFormData(prev => ({ ...prev, current: e.target.value }))}
              placeholder="Enter current"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pretplate-total">Subscription Total</label>
            <input
              type="number"
              id="pretplate-total"
              value={formData.total}
              onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
              placeholder="Enter total"
            />
          </div>

          <div className="form-group">
            <label htmlFor="order-date">Order Dates</label>
            <div className="date-input-container">
              <input
                type="date"
                id="order-date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <button type="button" onClick={addOrderDate} className="secondary">
                Add Date
              </button>
            </div>
            {formData.orderDates.length > 0 && (
              <div className="selected-dates">
                <p>Selected Dates:</p>
                <ul>
                  {formData.orderDates.map(date => (
                    <li key={date} className="date-item">
                      {date}
                      <button 
                        type="button" 
                        onClick={() => removeOrderDate(date)}
                        className="danger small"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label>Meals</label>
            <div id="pretplate-meals-container">
              {formData.meals.map((meal, index) => (
                <div key={index} className="meal-item">
                  <input
                    type="text"
                    className="meal-name"
                    placeholder="Meal name"
                    value={meal.name}
                    onChange={(e) => handleMealChange(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    className="meal-quantity"
                    placeholder="Qty"
                    value={meal.quantity}
                    onChange={(e) => handleMealChange(index, 'quantity', parseInt(e.target.value))}
                  />
                  <button 
                    type="button" 
                    className="danger remove-meal"
                    onClick={() => removeMeal(index)}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
            <div className="add-meal">
              <button type="button" onClick={addMeal}>
                Add Meal
              </button>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="danger" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
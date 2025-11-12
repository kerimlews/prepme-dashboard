// src/components/OrderModal.js
import { useState, useEffect } from 'react';
import { calculateSize } from '../utils/helpers';

const OrderModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({
    name: '',
    totalMeals: '',
    price: '',
    target: 'OS',
    current: '1',
    total: '1',
    meals: [{ name: '', quantity: 1 }]
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || '',
        totalMeals: editingItem.totalMeals?.toString() || '',
        price: editingItem.price || '',
        target: editingItem.target || 'OS',
        address: editingItem.address || '',
        current: editingItem.subscription?.current?.toString() || '0',
        total: editingItem.subscription?.total?.toString() || '0',
        meals: editingItem.meals ? Object.entries(editingItem.meals).map(([name, quantity]) => ({
          name,
          quantity
        })) : [{ name: '', quantity: 1 }]
      });
    } else {
      setFormData({
        name: '',
        totalMeals: '',
        price: '',
        target: 'OS',
        current: '0',
        address: '',
        total: '0',
        meals: [{ name: '', quantity: 1 }]
      });
    }
  }, [editingItem, isOpen]);

  const handleMealChange = (index, field, value) => {
    const newMeals = [...formData.meals];
    newMeals[index] = { ...newMeals[index], [field]: value };
    setFormData(prev => ({ ...prev, meals: newMeals }));
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

    if (!formData.name.trim()) {
      alert('Please enter a name!');
      return;
    }

    const totalMeals = parseInt(formData.totalMeals) || Object.values(mealsObj).reduce((a, b) => a + b, 0);
    const size = calculateSize(totalMeals);

    const data = {
      name: formData.name,
      totalMeals,
      price: formData.price,
      target: formData.target,
      meals: mealsObj,
      size
    };

    if (parseInt(formData.total) > 0) {
      data.subscription = {
        current: parseInt(formData.current),
        total: parseInt(formData.total)
      }
      data.pretplata = true;
    }

    onSave(data);
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            {editingItem ? 'Edit Order' : 'Add New Order'}
          </div>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="order-name">Name *</label>
            <input
              type="text"
              id="order-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter customer name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="order-address">Address *</label>
            <input
              type="text"
              id="order-address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter address"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="order-total-meals">Total Meals</label>
              <input
                type="number"
                id="order-total-meals"
                value={formData.totalMeals}
                onChange={(e) => setFormData(prev => ({ ...prev, totalMeals: e.target.value }))}
                placeholder="Auto-calculated from meals"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="order-price">Price</label>
              <input
                type="text"
                id="order-price"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Enter price"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="order-target">Target</label>
              <select
                id="order-target"
                value={formData.target}
                onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
              >
                <option value="OS">OS</option>
                <option value="HR">HR</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="order-current">Subscription Current</label>
              <input
                type="number"
                id="order-current"
                disabled
                value={formData.current}
                onChange={(e) => setFormData(prev => ({ ...prev, current: e.target.value }))}
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="order-total">Subscription Total</label>
              <input
                type="number"
                disabled
                id="order-total"
                value={formData.total}
                onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Meals *</label>
            <div className="meals-container">
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
                    onChange={(e) => handleMealChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                  />
                  <button 
                    type="button" 
                    className="danger remove-meal"
                    onClick={() => removeMeal(index)}
                    disabled={formData.meals.length === 1}
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
            <button type="submit">
              {editingItem ? 'Update Order' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
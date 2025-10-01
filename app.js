/* ===================================
   GLUCOTRACK - FINAL APP LOGIC
   Complete Tracking Application
   =================================== */

// Firebase Configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyC_4eChrMLYjXCneG2bgIbtmAl6etlivjk",
  authDomain: "glucose-tracker-f27a1.firebaseapp.com",
  projectId: "glucose-tracker-f27a1",
  storageBucket: "glucose-tracker-f27a1.firebasestorage.app",
  messagingSenderId: "504539261661",
  appId: "1:504539261661:web:cee45ce28dfb9740600934"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global State
const AppState = {
    currentUser: 'user1',
    currentIngredients: []
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Hide splash screen
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
    }, 2500);
    
    initializeApp();
});

function initializeApp() {
    displayCurrentDate();
    setDefaultTimestamp();
    setupEventListeners();
    setupMealTypeListener();
    loadTodaySummary();
    loadShoppingList();
    loadRecipes();
}

function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = today.toLocaleDateString('en-US', options);
}

function setDefaultTimestamp() {
    const timestampInput = document.getElementById('entryTime');
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - (offset * 60 * 1000));
    timestampInput.value = localTime.toISOString().slice(0, 16);
}

// ===================================
// EVENT LISTENERS
// ===================================

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchSection(this.dataset.section);
        });
    });
    
    // Meal form
    document.getElementById('mealEntryForm').addEventListener('submit', saveMealEntry);
    
    // Add ingredient button
    document.getElementById('addIngredientBtn').addEventListener('click', addIngredientRow);
    
    // Walk calculator
    setupWalkCalculator();
    
    // Shopping list
    document.getElementById('addShoppingBtn').addEventListener('click', addShoppingItem);
    document.getElementById('newShoppingItem').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addShoppingItem();
    });
    
    // Recipe tabs
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchRecipeTab(this.dataset.meal);
        });
    });
    
    // History filter
    document.getElementById('filterBtn').addEventListener('click', filterHistory);
}

function setupMealTypeListener() {
    // Show fasting glucose field for breakfast
    document.querySelectorAll('input[name="mealCategory"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const fastingSection = document.getElementById('fastingSection');
            if (this.value === 'Breakfast') {
                fastingSection.classList.remove('hidden');
            } else {
                fastingSection.classList.add('hidden');
            }
        });
    });
}

function switchSection(sectionId) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    // Load section data
    if (sectionId === 'history') {
        loadHistoryData();
    }
}

// ===================================
// INGREDIENT MANAGEMENT
// ===================================

function addIngredientRow() {
    const container = document.getElementById('ingredientsList');
    const ingredientId = Date.now();
    
    const ingredientHtml = `
        <div class="ingredient-item" data-id="${ingredientId}">
            <input type="text" placeholder="Ingredient name" class="ingredient-name">
            <input type="text" placeholder="Measurement" class="ingredient-amount">
            <button type="button" class="btn-remove" onclick="removeIngredient(${ingredientId})">
                <i class="lucide-x"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', ingredientHtml);
}

function removeIngredient(id) {
    const element = document.querySelector(`.ingredient-item[data-id="${id}"]`);
    if (element) element.remove();
}

function collectIngredients() {
    const ingredients = [];
    document.querySelectorAll('.ingredient-item').forEach(item => {
        const name = item.querySelector('.ingredient-name').value.trim();
        const amount = item.querySelector('.ingredient-amount').value.trim();
        if (name) {
            ingredients.push({ name, amount });
        }
    });
    return ingredients;
}

// ===================================
// WALK CALCULATOR
// ===================================

function setupWalkCalculator() {
    const distanceInput = document.getElementById('walkDistance');
    const durationInput = document.getElementById('walkDuration');
    const speedInput = document.getElementById('walkSpeed');
    
    function calculateSpeed() {
        const distance = parseFloat(distanceInput.value) || 0;
        const duration = parseFloat(durationInput.value) || 0;
        
        if (distance > 0 && duration > 0) {
            const speed = (distance / (duration / 60)).toFixed(2);
            speedInput.value = speed;
        } else {
            speedInput.value = '';
        }
    }
    
    distanceInput.addEventListener('input', calculateSpeed);
    durationInput.addEventListener('input', calculateSpeed);
}

// ===================================
// MEAL ENTRY
// ===================================

function saveMealEntry(e) {
    e.preventDefault();
    
    const mealCategory = document.querySelector('input[name="mealCategory"]:checked');
    if (!mealCategory) {
        showToast('Please select a meal type', 'error');
        return;
    }
    
    const ingredients = collectIngredients();
    
    const mealData = {
        category: mealCategory.value,
        description: document.getElementById('mealDescription').value,
        ingredients: ingredients.length > 0 ? JSON.stringify(ingredients) : '',
        postMealGlucose: parseFloat(document.getElementById('postMealGlucose').value) || null,
        walkDistance: parseFloat(document.getElementById('walkDistance').value) || 0,
        walkDuration: parseFloat(document.getElementById('walkDuration').value) || 0,
        walkSpeed: parseFloat(document.getElementById('walkSpeed').value) || 0,
        timestamp: new Date(document.getElementById('entryTime').value).toISOString(),
        notes: document.getElementById('entryNotes').value,
        date: getTodayDateString()
    };
    
    // Add fasting glucose if breakfast
    if (mealCategory.value === 'Breakfast') {
        const fastingGlucose = parseFloat(document.getElementById('fastingGlucose').value);
        if (fastingGlucose) {
            mealData.fastingGlucose = fastingGlucose;
            // Also save to separate fasting collection
            const today = getTodayDateString();
            database.ref(`users/${AppState.currentUser}/fasting/${today}`).set({
                glucose: fastingGlucose,
                timestamp: mealData.timestamp,
                date: today
            });
        }
    }
    
    // Generate unique ID
    const mealId = database.ref().child('meals').push().key;
    
    // Save to Firebase
    database.ref(`users/${AppState.currentUser}/meals/${mealId}`).set(mealData)
        .then(() => {
            showToast('Entry saved successfully!', 'success');
            // Clear form
            document.getElementById('mealEntryForm').reset();
            document.getElementById('ingredientsList').innerHTML = '';
            document.getElementById('fastingSection').classList.add('hidden');
            setDefaultTimestamp();
            loadTodaySummary();
        })
        .catch(error => {
            showToast('Error saving entry: ' + error.message, 'error');
        });
}

// ===================================
// TODAY'S SUMMARY
// ===================================

function loadTodaySummary() {
    const today = getTodayDateString();
    
    database.ref(`users/${AppState.currentUser}/meals`)
        .orderByChild('date')
        .equalTo(today)
        .once('value')
        .then(snapshot => {
            let entryCount = 0;
            let glucoseReadings = [];
            let totalWalking = 0;
            
            snapshot.forEach(childSnapshot => {
                const meal = childSnapshot.val();
                entryCount++;
                
                if (meal.postMealGlucose) {
                    glucoseReadings.push(meal.postMealGlucose);
                }
                if (meal.fastingGlucose) {
                    glucoseReadings.push(meal.fastingGlucose);
                }
                if (meal.walkDistance) {
                    totalWalking += meal.walkDistance;
                }
            });
            
            // Update display
            document.getElementById('todayEntries').textContent = entryCount;
            
            if (glucoseReadings.length > 0) {
                const avg = Math.round(glucoseReadings.reduce((a, b) => a + b, 0) / glucoseReadings.length);
                document.getElementById('todayAvgGlucose').textContent = avg + ' mg/dL';
            } else {
                document.getElementById('todayAvgGlucose').textContent = '--';
            }
            
            document.getElementById('todayWalking').textContent = totalWalking.toFixed(1) + ' mi';
        });
}

// ===================================
// HISTORY
// ===================================

function loadHistoryData() {
    const historyContainer = document.getElementById('historyList');
    historyContainer.innerHTML = '<p class="empty-state">Loading history...</p>';
    
    database.ref(`users/${AppState.currentUser}/meals`)
        .orderByChild('timestamp')
        .limitToLast(50)
        .once('value')
        .then(snapshot => {
            const meals = [];
            snapshot.forEach(childSnapshot => {
                meals.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            if (meals.length === 0) {
                historyContainer.innerHTML = '<p class="empty-state">No entries found</p>';
            } else {
                // Sort by date (newest first)
                meals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                displayHistory(meals);
            }
        });
}

function displayHistory(meals) {
    const container = document.getElementById('historyList');
    
    // Group by date
    const groupedByDate = {};
    meals.forEach(meal => {
        const date = meal.date;
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(meal);
    });
    
    let html = '';
    Object.keys(groupedByDate).sort().reverse().forEach(date => {
        html += `<h3 style="margin: 20px 0 10px; color: var(--primary);">${formatDate(date)}</h3>`;
        
        groupedByDate[date].forEach(meal => {
            html += createHistoryCard(meal);
        });
    });
    
    container.innerHTML = html;
}

function createHistoryCard(meal) {
    const time = formatTime(meal.timestamp);
    const details = [];
    
    if (meal.postMealGlucose) {
        details.push(`<span class="history-detail"><i class="lucide-droplet"></i> ${meal.postMealGlucose} mg/dL</span>`);
    }
    if (meal.walkDistance > 0) {
        details.push(`<span class="history-detail"><i class="lucide-footprints"></i> ${meal.walkDistance} mi</span>`);
    }
    
    return `
        <div class="history-item">
            <div class="history-header">
                <span class="history-type">${meal.category}</span>
                <span class="history-time">${time}</span>
            </div>
            <div class="history-description">${meal.description}</div>
            ${details.length > 0 ? `<div class="history-details">${details.join('')}</div>` : ''}
            <div class="history-actions">
                <button class="btn-delete" onclick="deleteMeal('${meal.id}')">Delete</button>
            </div>
        </div>
    `;
}

function deleteMeal(mealId) {
    if (confirm('Are you sure you want to delete this entry?')) {
        database.ref(`users/${AppState.currentUser}/meals/${mealId}`).remove()
            .then(() => {
                showToast('Entry deleted', 'success');
                loadHistoryData();
                loadTodaySummary();
            })
            .catch(error => {
                showToast('Error deleting entry: ' + error.message, 'error');
            });
    }
}

function filterHistory() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    
    database.ref(`users/${AppState.currentUser}/meals`).once('value')
        .then(snapshot => {
            let meals = [];
            snapshot.forEach(childSnapshot => {
                meals.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Apply filters
            if (startDate) {
                meals = meals.filter(meal => meal.date >= startDate);
            }
            if (endDate) {
                meals = meals.filter(meal => meal.date <= endDate);
            }
            
            meals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            displayHistory(meals);
        });
}

// ===================================
// SHOPPING LIST
// ===================================

function loadShoppingList() {
    database.ref(`users/${AppState.currentUser}/shopping`).on('value', snapshot => {
        const items = [];
        snapshot.forEach(childSnapshot => {
            items.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        displayShoppingList(items);
    });
}

function displayShoppingList(items) {
    const container = document.getElementById('shoppingList');
    
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state">Shopping list is empty</p>';
    } else {
        container.innerHTML = items.map(item => `
            <div class="shopping-item ${item.checked ? 'checked' : ''}">
                <input type="checkbox" 
                       class="shopping-checkbox" 
                       ${item.checked ? 'checked' : ''}
                       onchange="toggleShoppingItem('${item.id}', this.checked)">
                <span class="shopping-text">${item.text}</span>
                <button class="shopping-delete" onclick="deleteShoppingItem('${item.id}')">
                    <i class="lucide-trash-2"></i>
                </button>
            </div>
        `).join('');
    }
}

function addShoppingItem() {
    const input = document.getElementById('newShoppingItem');
    const text = input.value.trim();
    
    if (!text) {
        showToast('Please enter an item', 'error');
        return;
    }
    
    const itemId = database.ref().child('shopping').push().key;
    
    database.ref(`users/${AppState.currentUser}/shopping/${itemId}`).set({
        text: text,
        checked: false,
        timestamp: new Date().toISOString()
    })
    .then(() => {
        input.value = '';
        showToast('Item added!', 'success');
    });
}

function toggleShoppingItem(itemId, checked) {
    database.ref(`users/${AppState.currentUser}/shopping/${itemId}/checked`).set(checked);
}

function deleteShoppingItem(itemId) {
    database.ref(`users/${AppState.currentUser}/shopping/${itemId}`).remove()
        .then(() => {
            showToast('Item removed', 'success');
        });
}

// ===================================
// RECIPES
// ===================================

function loadRecipes() {
    const recipeTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    recipeTypes.forEach(type => {
        database.ref(`users/${AppState.currentUser}/recipes/${type}`).on('value', snapshot => {
            const recipes = [];
            snapshot.forEach(childSnapshot => {
                recipes.push({
                    id: childSnapshot.key,
                    text: childSnapshot.val()
                });
            });
            displayRecipes(type, recipes);
        });
    });
}

function displayRecipes(type, recipes) {
    const container = document.getElementById(`${type}List`);
    
    if (recipes.length === 0) {
        container.innerHTML = `<p class="empty-state">No ${type} ideas yet</p>`;
    } else {
        container.innerHTML = recipes.map(recipe => `
            <div class="recipe-item">
                <span>${recipe.text}</span>
                <button onclick="deleteRecipe('${type}', '${recipe.id}')">
                    <i class="lucide-trash-2"></i>
                </button>
            </div>
        `).join('');
    }
}

function addRecipeIdea(type) {
    const input = document.getElementById(`new${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const text = input.value.trim();
    
    if (!text) {
        showToast('Please enter a recipe idea', 'error');
        return;
    }
    
    const recipeId = database.ref().child('recipes').push().key;
    
    database.ref(`users/${AppState.currentUser}/recipes/${type}/${recipeId}`).set(text)
        .then(() => {
            input.value = '';
            showToast('Recipe added!', 'success');
        });
}

function deleteRecipe(type, recipeId) {
    database.ref(`users/${AppState.currentUser}/recipes/${type}/${recipeId}`).remove()
        .then(() => {
            showToast('Recipe deleted', 'success');
        });
}

function switchRecipeTab(mealType) {
    // Update tabs
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-meal="${mealType}"]`).classList.add('active');
    
    // Update sections
    document.querySelectorAll('.recipe-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(mealType).classList.add('active');
}

// ===================================
// UTILITIES
// ===================================

function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'x-circle';
    
    toast.innerHTML = `
        <i class="lucide-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

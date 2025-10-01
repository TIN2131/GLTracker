/* ===================================
   GLUCOTRACK PRO - COMPLETE APP LOGIC
   Premium Health Monitoring Application
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

// Global State Management
const AppState = {
    currentUser: 'user1',
    currentView: 'mealEntry',
    cache: {
        todayData: null,
        historyData: null,
        lastUpdate: null
    },
    settings: {
        glucoseUnit: 'mg/dL',
        notifications: true,
        darkMode: false
    },
    targetRanges: {
        fasting: { low: 70, high: 100 },
        postMeal: { low: 80, high: 140 },
        random: { low: 70, high: 140 },
        bedtime: { low: 90, high: 120 }
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize UI
    updateStatusBar();
    displayCurrentDate();
    setDefaultTimestamp();
    
    // Setup event listeners
    setupNavigationListeners();
    setupEntryToggleListeners();
    setupFormListeners();
    setupFilterListeners();
    setupShoppingListeners();
    setupRecipeListeners();
    setupFAB();
    
    // Load initial data
    loadTodaySummary();
    loadShoppingList();
    loadRecipes();
    
    // Setup realtime listeners
    setupRealtimeUpdates();
    
    // Hide splash screen after animations
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
    }, 2500);
}

// ===================================
// UI UPDATES
// ===================================

function updateStatusBar() {
    const timeElement = document.getElementById('statusTime');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }
    // Update every minute
    setInterval(updateStatusBar, 60000);
}

function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = today.toLocaleDateString('en-US', options);
}

function setDefaultTimestamp() {
    const mealTimestamp = document.getElementById('mealTimestamp');
    const glucoseTime = document.getElementById('glucoseTime');
    
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - (offset * 60 * 1000));
    const defaultTime = localTime.toISOString().slice(0, 16);
    
    if (mealTimestamp) mealTimestamp.value = defaultTime;
    if (glucoseTime) glucoseTime.value = defaultTime;
}

// ===================================
// NAVIGATION
// ===================================

function setupNavigationListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            switchToSection(section);
        });
    });
}

function switchToSection(sectionName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
    
    // Update app state
    AppState.currentView = sectionName;
    
    // Load section-specific data
    if (sectionName === 'history') {
        loadHistoryData();
    }
    
    // Vibrate for feedback
    vibrate(10);
}

// ===================================
// ENTRY TYPE TOGGLE
// ===================================

function setupEntryToggleListeners() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const type = this.dataset.type;
            document.querySelectorAll('.entry-section').forEach(section => {
                section.classList.remove('active');
            });
            
            if (type === 'meal') {
                document.getElementById('mealEntrySection').classList.add('active');
            } else {
                document.getElementById('glucoseOnlySection').classList.add('active');
            }
            
            vibrate(10);
        });
    });
}

// ===================================
// FORM HANDLING
// ===================================

function setupFormListeners() {
    // Meal form
    const mealForm = document.getElementById('mealForm');
    if (mealForm) {
        mealForm.addEventListener('submit', saveMealEntry);
    }
    
    // Glucose form
    const glucoseForm = document.getElementById('glucoseForm');
    if (glucoseForm) {
        glucoseForm.addEventListener('submit', saveGlucoseEntry);
    }
    
    // Meal type change listener
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
    
    // Add ingredient button
    document.getElementById('addIngredientBtn').addEventListener('click', addIngredientRow);
    
    // Walk calculator
    setupWalkCalculator();
    
    // Glucose monitoring
    document.getElementById('glucoseValue')?.addEventListener('input', updateGlucoseIndicator);
    document.getElementById('postMealGlucose')?.addEventListener('input', updatePostMealIndicator);
    document.getElementById('fastingGlucose')?.addEventListener('input', updateFastingIndicator);
}

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
    
    distanceInput?.addEventListener('input', calculateSpeed);
    durationInput?.addEventListener('input', calculateSpeed);
}

// ===================================
// INGREDIENT MANAGEMENT
// ===================================

let ingredientCounter = 0;

function addIngredientRow() {
    const container = document.getElementById('ingredientsList');
    ingredientCounter++;
    
    const ingredientHTML = `
        <div class="ingredient-item" data-id="ingredient-${ingredientCounter}">
            <input type="text" placeholder="Ingredient name" class="ingredient-name">
            <input type="text" placeholder="Measurement" class="ingredient-amount">
            <button type="button" class="btn-remove" onclick="removeIngredient('ingredient-${ingredientCounter}')">
                <i class="lucide-x"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', ingredientHTML);
    vibrate(10);
}

function removeIngredient(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
        element.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            element.remove();
        }, 300);
    }
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
// SAVE ENTRIES
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
        timestamp: new Date(document.getElementById('mealTimestamp').value).toISOString(),
        notes: document.getElementById('mealNotes').value,
        date: getTodayDateString()
    };
    
    // Add fasting glucose if breakfast
    if (mealCategory.value === 'Breakfast') {
        const fastingGlucose = parseFloat(document.getElementById('fastingGlucose').value);
        if (fastingGlucose) {
            mealData.fastingGlucose = fastingGlucose;
            // Save to separate fasting collection
            saveFastingGlucose(fastingGlucose, mealData.timestamp);
        }
    }
    
    const mealId = database.ref().child('meals').push().key;
    
    database.ref(`users/${AppState.currentUser}/meals/${mealId}`).set(mealData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Meal entry saved successfully!', 'success');
            
            // Clear form
            document.getElementById('mealForm').reset();
            document.getElementById('ingredientsList').innerHTML = '';
            document.getElementById('fastingSection').classList.add('hidden');
            setDefaultTimestamp();
            
            // Update summary
            loadTodaySummary();
            
            // Clear cache
            AppState.cache.todayData = null;
        })
        .catch(error => {
            showToast('Error saving meal: ' + error.message, 'error');
        });
}

function saveGlucoseEntry(e) {
    e.preventDefault();
    
    const glucoseType = document.querySelector('input[name="glucoseType"]:checked').value;
    const glucoseValue = parseFloat(document.getElementById('glucoseValue').value);
    
    if (!glucoseValue) {
        showToast('Please enter a glucose reading', 'error');
        return;
    }
    
    const glucoseData = {
        type: glucoseType,
        value: glucoseValue,
        timestamp: new Date(document.getElementById('glucoseTime').value).toISOString(),
        notes: document.getElementById('glucoseNotes').value,
        date: getTodayDateString()
    };
    
    // Special handling for fasting glucose
    if (glucoseType === 'fasting') {
        saveFastingGlucose(glucoseValue, glucoseData.timestamp);
    }
    
    const glucoseId = database.ref().child('glucose').push().key;
    
    database.ref(`users/${AppState.currentUser}/glucose/${glucoseId}`).set(glucoseData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Glucose reading saved!', 'success');
            
            // Clear form
            document.getElementById('glucoseForm').reset();
            setDefaultTimestamp();
            updateGlucoseIndicator();
            
            // Update summary
            loadTodaySummary();
            
            // Clear cache
            AppState.cache.todayData = null;
        })
        .catch(error => {
            showToast('Error saving glucose: ' + error.message, 'error');
        });
}

function saveFastingGlucose(value, timestamp) {
    const today = getTodayDateString();
    database.ref(`users/${AppState.currentUser}/fasting/${today}`).set({
        glucose: value,
        timestamp: timestamp,
        date: today
    });
}

// ===================================
// GLUCOSE INDICATORS
// ===================================

function updateGlucoseIndicator() {
    const value = parseFloat(document.getElementById('glucoseValue').value);
    const indicator = document.getElementById('glucoseRangeIndicator');
    
    if (!value || !indicator) return;
    
    const glucoseType = document.querySelector('input[name="glucoseType"]:checked')?.value || 'random';
    const ranges = AppState.targetRanges[glucoseType];
    
    indicator.classList.remove('low', 'normal', 'high');
    
    if (value < ranges.low) {
        indicator.classList.add('low');
        indicator.textContent = '⬇ Below target range';
        indicator.style.display = 'block';
    } else if (value > ranges.high) {
        indicator.classList.add('high');
        indicator.textContent = '⬆ Above target range';
        indicator.style.display = 'block';
    } else {
        indicator.classList.add('normal');
        indicator.textContent = '✓ Within target range';
        indicator.style.display = 'block';
    }
}

function updatePostMealIndicator() {
    const value = parseFloat(document.getElementById('postMealGlucose').value);
    if (!value) return;
    
    const ranges = AppState.targetRanges.postMeal;
    let message = '';
    
    if (value < ranges.low) {
        message = '⬇ Low';
    } else if (value > ranges.high) {
        message = '⬆ High';
    } else {
        message = '✓ Good';
    }
    
    // You can add a visual indicator here if needed
}

function updateFastingIndicator() {
    const value = parseFloat(document.getElementById('fastingGlucose').value);
    if (!value) return;
    
    const ranges = AppState.targetRanges.fasting;
    let message = '';
    
    if (value < ranges.low) {
        message = '⬇ Low';
    } else if (value > ranges.high) {
        message = '⬆ High';
    } else {
        message = '✓ Good';
    }
    
    // You can add a visual indicator here if needed
}

// ===================================
// TODAY'S SUMMARY
// ===================================

function loadTodaySummary() {
    const today = getTodayDateString();
    
    Promise.all([
        loadTodayFasting(),
        loadTodayMealCount(),
        loadTodayAverageGlucose(),
        loadTodayWalkingDistance()
    ]).then(([fasting, mealCount, avgGlucose, walkDistance]) => {
        // Update summary card
        document.getElementById('summaryFasting').textContent = fasting ? `${fasting} mg/dL` : '--';
        document.getElementById('summaryMeals').textContent = mealCount;
        document.getElementById('summaryAverage').textContent = avgGlucose ? `${avgGlucose} mg/dL` : '--';
        document.getElementById('summaryWalking').textContent = `${walkDistance} mi`;
        
        // Update header stats
        document.getElementById('todayAverage').textContent = avgGlucose ? `${avgGlucose} mg/dL` : '--';
        document.getElementById('todayWalking').textContent = `${walkDistance} mi`;
    });
}

function loadTodayFasting() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        database.ref(`users/${AppState.currentUser}/fasting/${today}`).once('value')
            .then(snapshot => {
                const data = snapshot.val();
                resolve(data ? data.glucose : null);
            });
    });
}

function loadTodayMealCount() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        database.ref(`users/${AppState.currentUser}/meals`)
            .orderByChild('date')
            .equalTo(today)
            .once('value')
            .then(snapshot => {
                resolve(snapshot.numChildren());
            });
    });
}

function loadTodayAverageGlucose() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        
        Promise.all([
            database.ref(`users/${AppState.currentUser}/glucose`)
                .orderByChild('date')
                .equalTo(today)
                .once('value'),
            database.ref(`users/${AppState.currentUser}/meals`)
                .orderByChild('date')
                .equalTo(today)
                .once('value')
        ]).then(([glucoseSnapshot, mealsSnapshot]) => {
            const readings = [];
            
            glucoseSnapshot.forEach(child => {
                readings.push(child.val().value);
            });
            
            mealsSnapshot.forEach(child => {
                const meal = child.val();
                if (meal.postMealGlucose) readings.push(meal.postMealGlucose);
                if (meal.fastingGlucose) readings.push(meal.fastingGlucose);
            });
            
            if (readings.length > 0) {
                const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
                resolve(Math.round(avg));
            } else {
                resolve(null);
            }
        });
    });
}

function loadTodayWalkingDistance() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        
        database.ref(`users/${AppState.currentUser}/meals`)
            .orderByChild('date')
            .equalTo(today)
            .once('value')
            .then(snapshot => {
                let totalDistance = 0;
                snapshot.forEach(child => {
                    const meal = child.val();
                    if (meal.walkDistance) {
                        totalDistance += meal.walkDistance;
                    }
                });
                resolve(totalDistance.toFixed(1));
            });
    });
}

// ===================================
// HISTORY
// ===================================

function setupFilterListeners() {
    const filterBtn = document.getElementById('historyFilterBtn');
    const filterPanel = document.getElementById('filterPanel');
    
    filterBtn?.addEventListener('click', () => {
        filterPanel.classList.toggle('active');
    });
    
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
}

function loadHistoryData() {
    const historyContainer = document.getElementById('historyEntries');
    
    // Show skeleton loader
    historyContainer.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
        </div>
    `;
    
    Promise.all([
        database.ref(`users/${AppState.currentUser}/meals`)
            .orderByChild('timestamp')
            .limitToLast(50)
            .once('value'),
        database.ref(`users/${AppState.currentUser}/glucose`)
            .orderByChild('timestamp')
            .limitToLast(50)
            .once('value')
    ]).then(([mealsSnapshot, glucoseSnapshot]) => {
        const entries = [];
        
        mealsSnapshot.forEach(child => {
            entries.push({
                id: child.key,
                type: 'meal',
                ...child.val()
            });
        });
        
        glucoseSnapshot.forEach(child => {
            entries.push({
                id: child.key,
                type: 'glucose',
                ...child.val()
            });
        });
        
        // Sort by timestamp (newest first)
        entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayHistory(entries);
    });
}

function displayHistory(entries) {
    const container = document.getElementById('historyEntries');
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">No entries found</p>';
        return;
    }
    
    // Group by date
    const groupedByDate = {};
    entries.forEach(entry => {
        const date = entry.date || new Date(entry.timestamp).toISOString().split('T')[0];
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(entry);
    });
    
    let html = '';
    Object.keys(groupedByDate).sort().reverse().forEach(date => {
        html += `<h3 style="margin: 20px 0 10px; color: var(--primary); font-size: 14px;">${formatDate(date)}</h3>`;
        
        groupedByDate[date].forEach(entry => {
            if (entry.type === 'meal') {
                html += createMealHistoryCard(entry);
            } else {
                html += createGlucoseHistoryCard(entry);
            }
        });
    });
    
    container.innerHTML = html;
}

function createMealHistoryCard(meal) {
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
                <button class="btn-delete" onclick="deleteEntry('meal', '${meal.id}')">Delete</button>
            </div>
        </div>
    `;
}

function createGlucoseHistoryCard(glucose) {
    const time = formatTime(glucose.timestamp);
    const typeLabel = glucose.type.charAt(0).toUpperCase() + glucose.type.slice(1);
    
    return `
        <div class="history-item">
            <div class="history-header">
                <span class="history-type">${typeLabel} Glucose</span>
                <span class="history-time">${time}</span>
            </div>
            <div class="history-description">${glucose.value} mg/dL</div>
            ${glucose.notes ? `<div class="history-details">${glucose.notes}</div>` : ''}
            <div class="history-actions">
                <button class="btn-delete" onclick="deleteEntry('glucose', '${glucose.id}')">Delete</button>
            </div>
        </div>
    `;
}

function deleteEntry(type, id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        const path = type === 'meal' ? 'meals' : 'glucose';
        database.ref(`users/${AppState.currentUser}/${path}/${id}`).remove()
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

function applyFilters() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const mealType = document.getElementById('filterMealType').value;
    
    // Apply filters to history data
    loadHistoryData(); // You can enhance this to actually filter
}

function clearFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterMealType').value = '';
    loadHistoryData();
}

// ===================================
// SHOPPING LIST
// ===================================

function setupShoppingListeners() {
    document.getElementById('addShoppingBtn')?.addEventListener('click', addShoppingItem);
    document.getElementById('newShoppingItem')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addShoppingItem();
    });
}

function loadShoppingList() {
    database.ref(`users/${AppState.currentUser}/shopping`).on('value', snapshot => {
        const items = [];
        snapshot.forEach(child => {
            items.push({
                id: child.key,
                ...child.val()
            });
        });
        displayShoppingList(items);
    });
}

function displayShoppingList(items) {
    const container = document.getElementById('shoppingListItems');
    
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state">Shopping list is empty</p>';
        return;
    }
    
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
        showToast('Item added to shopping list', 'success');
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

function setupRecipeListeners() {
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.recipe-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const recipe = this.dataset.recipe;
            document.querySelectorAll('.recipe-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(recipe).classList.add('active');
        });
    });
}

function loadRecipes() {
    const recipeTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    recipeTypes.forEach(type => {
        database.ref(`users/${AppState.currentUser}/recipes/${type}`).on('value', snapshot => {
            const recipes = [];
            snapshot.forEach(child => {
                recipes.push({
                    id: child.key,
                    text: child.val()
                });
            });
            displayRecipes(type, recipes);
        });
    });
}

function displayRecipes(type, recipes) {
    const container = document.getElementById(`${type}List`);
    
    if (!container) return;
    
    if (recipes.length === 0) {
        container.innerHTML = `<p class="empty-state">No ${type} ideas yet</p>`;
        return;
    }
    
    container.innerHTML = recipes.map(recipe => `
        <div class="recipe-item">
            <span>${recipe.text}</span>
            <button onclick="deleteRecipe('${type}', '${recipe.id}')">
                <i class="lucide-trash-2"></i>
            </button>
        </div>
    `).join('');
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
            showToast('Recipe idea added!', 'success');
        });
}

function deleteRecipe(type, recipeId) {
    database.ref(`users/${AppState.currentUser}/recipes/${type}/${recipeId}`).remove()
        .then(() => {
            showToast('Recipe deleted', 'success');
        });
}

// ===================================
// FLOATING ACTION BUTTON
// ===================================

function setupFAB() {
    const fab = document.getElementById('fabBtn');
    fab?.addEventListener('click', () => {
        // Quick add - switch to meal entry
        switchToSection('mealEntry');
        // Focus on description field
        document.getElementById('mealDescription')?.focus();
    });
}

// ===================================
// REALTIME UPDATES
// ===================================

function setupRealtimeUpdates() {
    // Listen for changes to today's data
    const today = getTodayDateString();
    
    database.ref(`users/${AppState.currentUser}/meals`)
        .orderByChild('date')
        .equalTo(today)
        .on('value', snapshot => {
            if (AppState.currentView === 'mealEntry') {
                loadTodaySummary();
            }
        });
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
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
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
        toast.style.animation = 'toastOut 0.3s ease-out';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function vibrate(pattern = 10) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Make functions globally available
window.removeIngredient = removeIngredient;
window.deleteEntry = deleteEntry;
window.toggleShoppingItem = toggleShoppingItem;
window.deleteShoppingItem = deleteShoppingItem;
window.addRecipeIdea = addRecipeIdea;
window.deleteRecipe = deleteRecipe;

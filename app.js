/* ===================================
   GLUCOSE & MEAL TRACKER APP
   Firebase Integration & Logic
   =================================== */

// Firebase Configuration
// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global Variables
let currentUser = 'user1'; // For demo purposes - can be replaced with Firebase Auth

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Display current date
    displayCurrentDate();
    
    // Set default timestamp to now
    setDefaultTimestamp();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load today's data
    loadTodayData();
    
    // Load recipes and shopping list
    loadRecipes();
    loadShoppingList();
    
    // Auto-calculate walk speed
    setupWalkCalculator();
}

// ===================================
// DATE & TIME FUNCTIONS
// ===================================

function displayCurrentDate() {
    const dateDisplay = document.getElementById('currentDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    dateDisplay.textContent = today.toLocaleDateString('en-US', options);
}

function setDefaultTimestamp() {
    const timestampInput = document.getElementById('mealTimestamp');
    const now = new Date();
    // Format for datetime-local input
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - (offset * 60 * 1000));
    timestampInput.value = localTime.toISOString().slice(0, 16);
}

function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDisplayTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

    // Fasting glucose
    document.getElementById('saveFastingBtn').addEventListener('click', saveFastingGlucose);

    // Meal form
    document.getElementById('mealForm').addEventListener('submit', saveMealEntry);

    // Recipe tabs
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchRecipeTab(this.dataset.recipe);
        });
    });

    // Shopping list
    document.getElementById('addShoppingBtn').addEventListener('click', addShoppingItem);
    document.getElementById('newShoppingItem').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addShoppingItem();
        }
    });

    // History filters
    document.getElementById('applyFiltersBtn').addEventListener('click', applyHistoryFilters);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearHistoryFilters);
}

// ===================================
// NAVIGATION
// ===================================

function switchSection(sectionId) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.nav-btn').classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    // Load data for specific sections
    if (sectionId === 'history') {
        loadHistoryData();
    }
}

function switchRecipeTab(recipeType) {
    // Update tabs
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update recipe sections
    document.querySelectorAll('.recipe-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(recipeType).classList.add('active');
}

// ===================================
// FASTING GLUCOSE
// ===================================

function saveFastingGlucose() {
    const glucose = document.getElementById('fastingGlucose').value;
    
    if (!glucose) {
        showToast('Please enter a glucose reading', 'error');
        return;
    }

    const today = getTodayDateString();
    const timestamp = new Date().toISOString();

    const fastingData = {
        glucose: parseFloat(glucose),
        timestamp: timestamp,
        date: today
    };

    // Save to Firebase
    database.ref(`users/${currentUser}/fasting/${today}`).set(fastingData)
        .then(() => {
            showToast('Fasting glucose saved!', 'success');
            displayFastingGlucose(glucose);
            document.getElementById('fastingGlucose').value = '';
        })
        .catch(error => {
            showToast('Error saving data: ' + error.message, 'error');
        });
}

function displayFastingGlucose(value) {
    const display = document.getElementById('fastingDisplay');
    const valueElement = document.getElementById('fastingValue');
    
    valueElement.textContent = value;
    display.classList.remove('hidden');
}

function loadTodayFasting() {
    const today = getTodayDateString();
    
    database.ref(`users/${currentUser}/fasting/${today}`).once('value')
        .then(snapshot => {
            const data = snapshot.val();
            if (data) {
                displayFastingGlucose(data.glucose);
            }
        });
}

// ===================================
// MEAL ENTRIES
// ===================================

function saveMealEntry(e) {
    e.preventDefault();

    const mealData = {
        category: document.getElementById('mealCategory').value,
        description: document.getElementById('mealDescription').value,
        ingredients: document.getElementById('ingredients').value,
        timestamp: new Date(document.getElementById('mealTimestamp').value).toISOString(),
        walkDistance: parseFloat(document.getElementById('walkDistance').value) || 0,
        walkDuration: parseFloat(document.getElementById('walkDuration').value) || 0,
        walkSpeed: parseFloat(document.getElementById('walkSpeed').value) || 0,
        postMealGlucose: parseFloat(document.getElementById('postMealGlucose').value) || null,
        notes: document.getElementById('mealNotes').value,
        date: getTodayDateString()
    };

    // Generate unique ID
    const mealId = database.ref().child('meals').push().key;

    // Save to Firebase
    database.ref(`users/${currentUser}/meals/${mealId}`).set(mealData)
        .then(() => {
            showToast('Meal entry saved!', 'success');
            document.getElementById('mealForm').reset();
            setDefaultTimestamp();
            loadTodayData();
        })
        .catch(error => {
            showToast('Error saving meal: ' + error.message, 'error');
        });
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
// DISPLAY TODAY'S ENTRIES
// ===================================

function loadTodayData() {
    loadTodayFasting();
    loadTodayEntries();
}

function loadTodayEntries() {
    const today = getTodayDateString();
    const entriesContainer = document.getElementById('todayEntries');

    database.ref(`users/${currentUser}/meals`).orderByChild('date').equalTo(today)
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
                entriesContainer.innerHTML = '<p class="empty-state">No entries yet today. Start logging your meals!</p>';
            } else {
                // Sort by timestamp
                meals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                entriesContainer.innerHTML = meals.map(meal => createMealCard(meal)).join('');
            }
        });
}

function createMealCard(meal) {
    const time = formatDisplayTime(meal.timestamp);
    const walkInfo = meal.walkDistance > 0 ? 
        `🚶 ${meal.walkDistance} mi, ${meal.walkDuration} min (${meal.walkSpeed} mph)` : '';
    const glucoseInfo = meal.postMealGlucose ? 
        `📊 ${meal.postMealGlucose} mg/dL` : '';

    return `
        <div class="entry-item">
            <div class="entry-header">
                <span class="entry-type">${meal.category}</span>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-description">${meal.description}</div>
            ${meal.ingredients ? `<div class="entry-detail">📝 ${meal.ingredients}</div>` : ''}
            <div class="entry-details">
                ${walkInfo ? `<div class="entry-detail">${walkInfo}</div>` : ''}
                ${glucoseInfo ? `<div class="entry-detail">${glucoseInfo}</div>` : ''}
            </div>
            ${meal.notes ? `<div class="entry-detail">💭 ${meal.notes}</div>` : ''}
            <div class="entry-actions">
                <button class="btn btn-danger btn-small" onclick="deleteMeal('${meal.id}')">Delete</button>
            </div>
        </div>
    `;
}

function deleteMeal(mealId) {
    if (confirm('Are you sure you want to delete this entry?')) {
        database.ref(`users/${currentUser}/meals/${mealId}`).remove()
            .then(() => {
                showToast('Entry deleted', 'success');
                loadTodayData();
                // Refresh history if on that tab
                if (document.getElementById('history').classList.contains('active')) {
                    loadHistoryData();
                }
            })
            .catch(error => {
                showToast('Error deleting entry: ' + error.message, 'error');
            });
    }
}

// ===================================
// HISTORY
// ===================================

function loadHistoryData() {
    const historyContainer = document.getElementById('historyEntries');
    historyContainer.innerHTML = '<p class="empty-state">Loading history...</p>';

    database.ref(`users/${currentUser}/meals`).once('value')
        .then(snapshot => {
            const meals = [];
            snapshot.forEach(childSnapshot => {
                meals.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });

            if (meals.length === 0) {
                historyContainer.innerHTML = '<p class="empty-state">No meal entries found.</p>';
            } else {
                // Sort by timestamp (newest first)
                meals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                displayHistoryEntries(meals);
            }
        });

    // Also load fasting glucose history
    loadFastingHistory();
}

function displayHistoryEntries(meals) {
    const historyContainer = document.getElementById('historyEntries');
    
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
        html += `<div class="history-date-group">
            <h3 style="color: var(--primary-color); margin: 20px 0 10px 0; font-size: 1.1rem;">
                ${formatDisplayDate(date)}
            </h3>`;
        groupedByDate[date].forEach(meal => {
            html += createMealCard(meal);
        });
        html += '</div>';
    });

    historyContainer.innerHTML = html;
}

function loadFastingHistory() {
    // This could be enhanced to show fasting glucose alongside meal history
    // For now, keeping it separate for simplicity
}

function applyHistoryFilters() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const mealType = document.getElementById('filterMealType').value;

    database.ref(`users/${currentUser}/meals`).once('value')
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
            if (mealType) {
                meals = meals.filter(meal => meal.category === mealType);
            }

            meals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (meals.length === 0) {
                document.getElementById('historyEntries').innerHTML = 
                    '<p class="empty-state">No entries match your filters.</p>';
            } else {
                displayHistoryEntries(meals);
            }
        });
}

function clearHistoryFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterMealType').value = '';
    loadHistoryData();
}

// ===================================
// RECIPES & MEAL IDEAS
// ===================================

function loadRecipes() {
    const recipeTypes = ['breakfast', 'lunch', 'dinner', 'snacks', 'general'];
    
    recipeTypes.forEach(type => {
        database.ref(`users/${currentUser}/recipes/${type}`).on('value', snapshot => {
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
    const listElement = document.getElementById(`${type}List`);
    
    if (recipes.length === 0) {
        listElement.innerHTML = `<p class="empty-state">Add your ${type} ideas here!</p>`;
    } else {
        listElement.innerHTML = recipes.map(recipe => `
            <div class="recipe-item">
                <span>${recipe.text}</span>
                <button class="delete-btn" onclick="deleteRecipe('${type}', '${recipe.id}')">🗑️</button>
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
    
    database.ref(`users/${currentUser}/recipes/${type}/${recipeId}`).set(text)
        .then(() => {
            input.value = '';
            showToast('Recipe idea added!', 'success');
        })
        .catch(error => {
            showToast('Error adding recipe: ' + error.message, 'error');
        });
}

function deleteRecipe(type, recipeId) {
    database.ref(`users/${currentUser}/recipes/${type}/${recipeId}`).remove()
        .then(() => {
            showToast('Recipe deleted', 'success');
        })
        .catch(error => {
            showToast('Error deleting recipe: ' + error.message, 'error');
        });
}

// ===================================
// SHOPPING LIST
// ===================================

function loadShoppingList() {
    database.ref(`users/${currentUser}/shopping`).on('value', snapshot => {
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
    const listElement = document.getElementById('shoppingList');
    
    if (items.length === 0) {
        listElement.innerHTML = '<p class="empty-state">Your shopping list is empty.</p>';
    } else {
        listElement.innerHTML = items.map(item => `
            <div class="shopping-item ${item.checked ? 'checked' : ''}">
                <input type="checkbox" 
                       class="shopping-checkbox" 
                       ${item.checked ? 'checked' : ''}
                       onchange="toggleShoppingItem('${item.id}', this.checked)">
                <span class="shopping-text">${item.text}</span>
                <button class="delete-btn" onclick="deleteShoppingItem('${item.id}')">🗑️</button>
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
    
    database.ref(`users/${currentUser}/shopping/${itemId}`).set({
        text: text,
        checked: false,
        timestamp: new Date().toISOString()
    })
    .then(() => {
        input.value = '';
        showToast('Item added to shopping list!', 'success');
    })
    .catch(error => {
        showToast('Error adding item: ' + error.message, 'error');
    });
}

function toggleShoppingItem(itemId, checked) {
    database.ref(`users/${currentUser}/shopping/${itemId}/checked`).set(checked);
}

function deleteShoppingItem(itemId) {
    database.ref(`users/${currentUser}/shopping/${itemId}`).remove()
        .then(() => {
            showToast('Item removed', 'success');
        })
        .catch(error => {
            showToast('Error removing item: ' + error.message, 'error');
        });
}

// ===================================
// TOAST NOTIFICATIONS
// ===================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Export data function (could be added as a feature)
function exportData() {
    database.ref(`users/${currentUser}`).once('value')
        .then(snapshot => {
            const data = snapshot.val();
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `health-tracker-export-${getTodayDateString()}.json`;
            link.click();
            
            showToast('Data exported successfully!', 'success');
        });
}

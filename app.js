/* ===================================
   GLUCOTRACK PRO - ENHANCED APP LOGIC
   Premium Mobile Health Tracker
   =================================== */

// Firebase Configuration
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
    currentIngredients: [],
    currentTimeRange: 7,
    darkMode: false,
    reminders: true,
    targetRanges: {
        fasting: { low: 70, high: 100 },
        postMeal: { low: 80, high: 140 },
        random: { low: 70, high: 140 }
    },
    cache: {
        todayData: null,
        lastUpdate: null
    }
};

// Vibration API for haptic feedback
const vibrate = (pattern = [10]) => {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.style.display = 'none';
    }, 2500);
    
    initializeApp();
});

function initializeApp() {
    // Initialize UI
    updateStatusBar();
    displayCurrentDate();
    document.getElementById('entryDate').textContent = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
    setDefaultTimestamp();
    
    // Setup event listeners
    setupUnifiedForm();
    setupNavigation();
    setupQuickActions();
    
    // Load initial data
    loadTodayStats();
    loadDashboardData();
    loadHistoryData();
    
    // Setup settings
    loadUserSettings();
    
    // Setup walk calculator
    setupWalkCheckbox();
}

// ===================================
// UI UPDATES
// ===================================

function updateStatusBar() {
    const updateTime = () => {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const element = document.getElementById('statusTime');
        if (element) element.textContent = time;
    };
    
    updateTime();
    setInterval(updateTime, 60000);
}

function displayCurrentDate() {
    const dateElements = ['currentDate', 'dashboardDate'];
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', options);
    
    dateElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = dateString;
    });
}

function setDefaultTimestamp() {
    const timestampInputs = ['mealTimestamp', 'glucoseTime', 'exerciseTime'];
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - (offset * 60 * 1000));
    const timeValue = localTime.toISOString().slice(0, 16);
    
    timestampInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = timeValue;
    });
}

// ===================================
// UNIFIED FORM HANDLING
// ===================================

function setupUnifiedForm() {
    // Entry type tabs
    document.querySelectorAll('.tab-option').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab-option').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.entry-section').forEach(section => {
                section.classList.remove('active');
            });
            
            if (this.dataset.type === 'meal') {
                document.getElementById('mealEntrySection').classList.add('active');
            } else {
                document.getElementById('glucoseOnlySection').classList.add('active');
            }
        });
    });
    
    // Unified form submission
    const unifiedForm = document.getElementById('unifiedEntryForm');
    if (unifiedForm) {
        unifiedForm.addEventListener('submit', saveUnifiedEntry);
    }
    
    // Walk checkbox
    setupWalkCheckbox();
    
    // Glucose value monitoring
    document.getElementById('glucoseOnlyValue')?.addEventListener('input', updateGlucoseIndicator);
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            vibrate();
            switchToSection(this.dataset.section);
        });
    });
}

function switchToSection(sectionId) {
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
    
    // Load section-specific data
    switch(sectionId) {
        case 'tracking':
            loadTodayStats();
            break;
        case 'dashboard':
            loadDashboardData();
            break;
        case 'history':
            loadHistoryData();
            break;
        case 'insights':
            loadInsightsData();
            break;
    }
}

function setupWalkCheckbox() {
    const walkCheckbox = document.getElementById('didWalk');
    const walkDetails = document.getElementById('walkDetails');
    
    if (walkCheckbox && walkDetails) {
        walkCheckbox.addEventListener('change', function() {
            if (this.checked) {
                walkDetails.classList.remove('hidden');
            } else {
                walkDetails.classList.add('hidden');
            }
        });
    }
}

function saveUnifiedEntry(e) {
    e.preventDefault();
    
    const activeTab = document.querySelector('.tab-option.active');
    const entryType = activeTab?.dataset.type;
    
    if (entryType === 'meal') {
        saveMealFromUnifiedForm();
    } else {
        saveGlucoseFromUnifiedForm();
    }
}

function saveMealFromUnifiedForm() {
    const mealCategory = document.querySelector('input[name="mealCategory"]:checked');
    if (!mealCategory) {
        showToast('Please select a meal type', 'error');
        return;
    }
    
    // Collect ingredients from quick inputs
    const ingredients = [];
    document.querySelectorAll('.ingredient-quick-input').forEach(input => {
        const value = input.value.trim();
        if (value) {
            const parts = value.split(' - ');
            ingredients.push({
                name: parts[0] || value,
                amount: parts[1] || ''
            });
        }
    });
    
    // Get walk data if checkbox is checked
    const didWalk = document.getElementById('didWalk').checked;
    const walkDistance = didWalk ? parseFloat(document.getElementById('walkDist').value) || 0 : 0;
    const walkDuration = didWalk ? parseFloat(document.getElementById('walkTime').value) || 0 : 0;
    const walkSpeed = walkDistance && walkDuration ? (walkDistance / (walkDuration / 60)).toFixed(2) : 0;
    
    const mealData = {
        category: mealCategory.value,
        description: document.getElementById('mealDesc').value,
        ingredients: ingredients.length > 0 ? JSON.stringify(ingredients) : '',
        preMealGlucose: parseFloat(document.getElementById('preMealGlucose').value) || null,
        postMealGlucose: parseFloat(document.getElementById('postMealGlucoseUnified').value) || null,
        walkDistance: walkDistance,
        walkDuration: walkDuration,
        walkSpeed: parseFloat(walkSpeed),
        timestamp: new Date(document.getElementById('entryTime').value).toISOString(),
        notes: document.getElementById('entryNotes').value,
        date: getTodayDateString()
    };
    
    const mealId = database.ref().child('meals').push().key;
    
    database.ref(`users/${AppState.currentUser}/meals/${mealId}`).set(mealData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Entry saved successfully!', 'success');
            
            // Clear form
            document.getElementById('unifiedEntryForm').reset();
            document.getElementById('walkDetails').classList.add('hidden');
            setDefaultTimestamp();
            
            // Update stats
            loadTodayStats();
            
            // Clear cache
            AppState.cache.todayData = null;
        })
        .catch(error => {
            showToast('Error saving entry: ' + error.message, 'error');
        });
}

function saveGlucoseFromUnifiedForm() {
    const glucoseType = document.querySelector('input[name="glucoseOnlyType"]:checked');
    const glucoseValue = document.getElementById('glucoseOnlyValue').value;
    
    if (!glucoseValue) {
        showToast('Please enter a glucose reading', 'error');
        return;
    }
    
    const glucoseData = {
        type: glucoseType.value,
        value: parseFloat(glucoseValue),
        timestamp: new Date(document.getElementById('entryTime').value).toISOString(),
        notes: document.getElementById('entryNotes').value,
        date: getTodayDateString()
    };
    
    // Special handling for fasting glucose
    if (glucoseType.value === 'fasting') {
        const today = getTodayDateString();
        database.ref(`users/${AppState.currentUser}/fasting/${today}`).set({
            glucose: glucoseData.value,
            timestamp: glucoseData.timestamp,
            date: today
        });
    }
    
    const readingId = database.ref().child('glucose').push().key;
    
    database.ref(`users/${AppState.currentUser}/glucose/${readingId}`).set(glucoseData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Glucose reading saved!', 'success');
            
            // Clear form
            document.getElementById('glucoseOnlyValue').value = '';
            document.getElementById('entryNotes').value = '';
            setDefaultTimestamp();
            updateGlucoseIndicator();
            
            // Update stats
            loadTodayStats();
            
            // Clear cache
            AppState.cache.todayData = null;
        })
        .catch(error => {
            showToast('Error saving reading: ' + error.message, 'error');
        });
}

function updateGlucoseIndicator() {
    const value = parseFloat(document.getElementById('glucoseOnlyValue').value);
    const indicator = document.getElementById('glucoseIndicator');
    
    if (!value || !indicator) {
        if (indicator) indicator.style.display = 'none';
        return;
    }
    
    const glucoseType = document.querySelector('input[name="glucoseOnlyType"]:checked')?.value || 'random';
    const ranges = AppState.targetRanges[glucoseType === 'bedtime' ? 'random' : glucoseType] || AppState.targetRanges.random;
    
    indicator.classList.remove('low', 'normal', 'high');
    
    if (value < ranges.low) {
        indicator.classList.add('low');
        indicator.textContent = '⬇ Below target range';
    } else if (value > ranges.high) {
        indicator.classList.add('high');
        indicator.textContent = '⬆ Above target range';
    } else {
        indicator.classList.add('normal');
        indicator.textContent = '✓ Within target range';
    }
}

function loadTodayStats() {
    const today = getTodayDateString();
    
    Promise.all([
        loadTodayFasting(),
        loadTodayGlucoseAverage(),
        loadTodayMealCount(),
        loadTodayWalkingDistance()
    ]).then(([fasting, avgGlucose, mealCount, walkDistance]) => {
        // Update stat displays
        const fastingEl = document.getElementById('todayFasting');
        if (fastingEl) fastingEl.textContent = fasting ? `${fasting} mg/dL` : '--';
        
        const avgEl = document.getElementById('todayAvg');
        if (avgEl) avgEl.textContent = avgGlucose ? `${avgGlucose} mg/dL` : '--';
        
        const mealsEl = document.getElementById('todayMealsCount');
        if (mealsEl) mealsEl.textContent = mealCount;
        
        const walkEl = document.getElementById('todayWalk');
        if (walkEl) walkEl.textContent = `${walkDistance} mi`;
    });
}

function loadTodayGlucoseAverage() {
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
                if (meal.preMealGlucose) readings.push(meal.preMealGlucose);
                if (meal.postMealGlucose) readings.push(meal.postMealGlucose);
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

function loadInsightsData() {
    // Load analytics and insights for the insights section
    const insightsContainer = document.getElementById('insights');
    if (!insightsContainer) return;
    
    // This would load charts, patterns, and analytics
    // For now, we'll use the existing analytics functions
    updateAnalytics();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            vibrate();
            switchSection(this.dataset.section);
        });
    });
    
    // Forms
    const glucoseBtn = document.getElementById('saveGlucoseBtn');
    if (glucoseBtn) glucoseBtn.addEventListener('click', saveGlucoseReading);
    
    const mealForm = document.getElementById('mealForm');
    if (mealForm) mealForm.addEventListener('submit', saveMealEntry);
    
    const exerciseForm = document.getElementById('exerciseForm');
    if (exerciseForm) exerciseForm.addEventListener('submit', saveExerciseEntry);
    
    // Ingredients
    const addIngBtn = document.getElementById('addIngredientBtn');
    if (addIngBtn) addIngBtn.addEventListener('click', addIngredient);
    setupIngredientInputs();
    
    // Recipe tabs
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchRecipeTab(this.dataset.recipe);
        });
    });
    
    // Shopping list
    const addShopBtn = document.getElementById('addShoppingBtn');
    if (addShopBtn) addShopBtn.addEventListener('click', addShoppingItem);
    
    const shopInput = document.getElementById('newShoppingItem');
    if (shopInput) {
        shopInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addShoppingItem();
        });
    }
    
    // History filters
    const filterBtn = document.getElementById('historyFilterBtn');
    if (filterBtn) filterBtn.addEventListener('click', toggleFilterPanel);
    
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyHistoryFilters);
    
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearHistoryFilters);
    
    const searchInput = document.getElementById('historySearch');
    if (searchInput) searchInput.addEventListener('input', searchHistory);
    
    // Settings
    const remindersToggle = document.getElementById('remindersToggle');
    if (remindersToggle) remindersToggle.addEventListener('change', toggleReminders);
    
    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) darkToggle.addEventListener('change', toggleDarkMode);
    
    const rangesBtn = document.getElementById('targetRangesBtn');
    if (rangesBtn) rangesBtn.addEventListener('click', openTargetRangesModal);
    
    // Collapsibles
    const postMealToggle = document.getElementById('postMealToggle');
    if (postMealToggle) postMealToggle.addEventListener('click', togglePostMealSection);
    
    // Profile
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) profileBtn.addEventListener('click', openProfileModal);
    
    // Glucose input
    const glucoseInput = document.getElementById('glucoseValue');
    if (glucoseInput) glucoseInput.addEventListener('input', updateGlucoseRangeIndicator);
    
    // Analytics
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            updateAnalyticsRange(this.dataset.range);
        });
    });
}

function setupEntryTypeListeners() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            vibrate();
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.entry-form').forEach(form => {
                form.classList.remove('active');
            });
            
            const formId = this.dataset.entry + 'Entry';
            const form = document.getElementById(formId);
            if (form) form.classList.add('active');
        });
    });
}

function setupIngredientInputs() {
    ['newIngredientName', 'newIngredientAmount'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addIngredient();
                }
            });
        }
    });
}

function setupQuickActions() {
    const quickGlucose = document.getElementById('quickGlucoseBtn');
    if (quickGlucose) {
        quickGlucose.addEventListener('click', () => {
            vibrate();
            switchSection('tracking');
            const btn = document.querySelector('[data-entry="glucose"]');
            if (btn) btn.click();
        });
    }
    
    const quickMeal = document.getElementById('quickMealBtn');
    if (quickMeal) {
        quickMeal.addEventListener('click', () => {
            vibrate();
            switchSection('tracking');
            const btn = document.querySelector('[data-entry="meal"]');
            if (btn) btn.click();
        });
    }
    
    const quickWalk = document.getElementById('quickWalkBtn');
    if (quickWalk) {
        quickWalk.addEventListener('click', () => {
            vibrate();
            switchSection('tracking');
            const btn = document.querySelector('[data-entry="exercise"]');
            if (btn) btn.click();
        });
    }
    
    const quickExport = document.getElementById('quickExportBtn');
    if (quickExport) {
        quickExport.addEventListener('click', () => {
            vibrate();
            exportData();
        });
    }
}

function setupFAB() {
    const fab = document.getElementById('fabBtn');
    if (!fab) return;
    
    let fabExpanded = false;
    
    fab.addEventListener('click', () => {
        vibrate([10, 20, 10]);
        fabExpanded = !fabExpanded;
        
        if (fabExpanded) {
            fab.innerHTML = '<i class="lucide-x"></i>';
            switchSection('tracking');
        } else {
            fab.innerHTML = '<i class="lucide-plus"></i>';
        }
    });
}

// ===================================
// NAVIGATION
// ===================================

function switchSection(sectionId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active');
    
    switch(sectionId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'history':
            loadHistoryData();
            break;
        case 'analytics':
            updateAnalytics();
            break;
    }
}

function switchRecipeTab(recipeType) {
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`[data-recipe="${recipeType}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    document.querySelectorAll('.recipe-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const activeSection = document.getElementById(recipeType);
    if (activeSection) activeSection.classList.add('active');
}

// ===================================
// DASHBOARD
// ===================================

function loadDashboardData() {
    if (AppState.cache.todayData && 
        Date.now() - AppState.cache.lastUpdate < 60000) {
        displayDashboardData(AppState.cache.todayData);
        return;
    }
    
    Promise.all([
        loadTodayFasting(),
        loadTodayMeals(),
        loadTodayExercise(),
        calculateTodayStats()
    ]).then(results => {
        const [fasting, meals, exercise, stats] = results;
        
        const dashboardData = {
            fasting,
            meals,
            exercise,
            stats
        };
        
        AppState.cache.todayData = dashboardData;
        AppState.cache.lastUpdate = Date.now();
        
        displayDashboardData(dashboardData);
        loadRecentEntries();
        generateInsights(dashboardData);
    });
}

function displayDashboardData(data) {
    const fastingEl = document.getElementById('summaryFasting');
    if (fastingEl) fastingEl.textContent = data.fasting ? `${data.fasting} mg/dL` : '--';
    
    const mealsEl = document.getElementById('summaryMeals');
    if (mealsEl) mealsEl.textContent = data.meals ? data.meals.length : '0';
    
    const avgEl = document.getElementById('summaryAverage');
    if (avgEl) avgEl.textContent = data.stats.avgGlucose ? `${data.stats.avgGlucose} mg/dL` : '--';
    
    const walkEl = document.getElementById('summaryWalking');
    if (walkEl) walkEl.textContent = data.stats.totalWalking ? `${data.stats.totalWalking} mi` : '0 mi';
    
    const todayAvg = document.getElementById('todayAverage');
    if (todayAvg) todayAvg.textContent = data.stats.avgGlucose || '--';
    
    const trendEl = document.getElementById('weekTrend');
    if (trendEl) trendEl.textContent = data.stats.trend || '--';
}

function loadRecentEntries() {
    const entriesContainer = document.getElementById('recentEntries');
    if (!entriesContainer) return;
    
    database.ref(`users/${AppState.currentUser}/meals`)
        .orderByChild('timestamp')
        .limitToLast(5)
        .once('value')
        .then(snapshot => {
            const entries = [];
            snapshot.forEach(childSnapshot => {
                entries.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            if (entries.length === 0) {
                entriesContainer.innerHTML = '<p class="empty-state">No recent entries</p>';
            } else {
                entries.reverse();
                entriesContainer.innerHTML = entries.slice(0, 3).map(entry => 
                    createCompactEntryCard(entry)
                ).join('');
            }
        });
}

function generateInsights(data) {
    const insightsList = document.getElementById('insightsList');
    if (!insightsList) return;
    
    const insights = [];
    
    if (data.stats.avgGlucose) {
        if (data.stats.avgGlucose < 100) {
            insights.push({
                icon: 'check-circle',
                text: 'Your average glucose is in a healthy range today!'
            });
        } else if (data.stats.avgGlucose > 140) {
            insights.push({
                icon: 'alert-circle',
                text: 'Consider monitoring portion sizes and carb intake'
            });
        }
    }
    
    if (data.stats.totalWalking > 2) {
        insights.push({
            icon: 'footprints',
            text: `Great job! You've walked ${data.stats.totalWalking} miles today`
        });
    }
    
    if (data.meals && data.meals.length >= 3) {
        insights.push({
            icon: 'check',
            text: 'Good meal tracking consistency today'
        });
    }
    
    if (insights.length > 0) {
        insightsList.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <i class="lucide-${insight.icon}"></i>
                <span>${insight.text}</span>
            </div>
        `).join('');
    }
}

// ===================================
// GLUCOSE TRACKING
// ===================================

function saveGlucoseReading() {
    const typeInput = document.querySelector('input[name="glucoseType"]:checked');
    if (!typeInput) {
        showToast('Please select glucose type', 'error');
        return;
    }
    
    const glucoseValue = document.getElementById('glucoseValue').value;
    if (!glucoseValue) {
        showToast('Please enter a glucose reading', 'error');
        return;
    }
    
    const glucoseData = {
        type: typeInput.value,
        value: parseFloat(glucoseValue),
        timestamp: new Date(document.getElementById('glucoseTime').value).toISOString(),
        notes: document.getElementById('glucoseNotes').value,
        date: getTodayDateString()
    };
    
    if (typeInput.value === 'fasting') {
        const today = getTodayDateString();
        database.ref(`users/${AppState.currentUser}/fasting/${today}`).set({
            glucose: glucoseData.value,
            timestamp: glucoseData.timestamp,
            date: today
        });
    }
    
    const readingId = database.ref().child('glucose').push().key;
    
    database.ref(`users/${AppState.currentUser}/glucose/${readingId}`).set(glucoseData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Glucose reading saved!', 'success');
            document.getElementById('glucoseValue').value = '';
            document.getElementById('glucoseNotes').value = '';
            setDefaultTimestamp();
            updateGlucoseRangeIndicator();
            
            if (document.getElementById('dashboard').classList.contains('active')) {
                loadDashboardData();
            }
        })
        .catch(error => {
            showToast('Error saving reading', 'error');
        });
}

function updateGlucoseRangeIndicator() {
    const valueInput = document.getElementById('glucoseValue');
    const indicator = document.getElementById('glucoseRangeIndicator');
    
    if (!valueInput || !indicator) return;
    
    const value = parseFloat(valueInput.value);
    if (!value) {
        indicator.style.display = 'none';
        return;
    }
    
    const typeInput = document.querySelector('input[name="glucoseType"]:checked');
    const glucoseType = typeInput ? typeInput.value : 'random';
    const ranges = AppState.targetRanges[glucoseType] || AppState.targetRanges.random;
    
    indicator.classList.remove('low', 'normal', 'high');
    
    if (value < ranges.low) {
        indicator.classList.add('low');
        indicator.textContent = '⬇ Below target range';
    } else if (value > ranges.high) {
        indicator.classList.add('high');
        indicator.textContent = '⬆ Above target range';
    } else {
        indicator.classList.add('normal');
        indicator.textContent = '✓ Within target range';
    }
}

// ===================================
// MEAL TRACKING
// ===================================

function saveMealEntry(e) {
    e.preventDefault();
    
    const mealType = document.querySelector('input[name="mealType"]:checked');
    if (!mealType) {
        showToast('Please select a meal type', 'error');
        return;
    }
    
    const mealData = {
        category: mealType.value,
        description: document.getElementById('mealDescription').value,
        ingredients: AppState.currentIngredients.length > 0 ? 
            JSON.stringify(AppState.currentIngredients) : '',
        timestamp: new Date(document.getElementById('mealTimestamp').value).toISOString(),
        walkDistance: parseFloat(document.getElementById('walkDistance').value) || 0,
        walkDuration: parseFloat(document.getElementById('walkDuration').value) || 0,
        walkSpeed: parseFloat(document.getElementById('walkSpeed').value) || 0,
        postMealGlucose: parseFloat(document.getElementById('postMealGlucose').value) || null,
        notes: document.getElementById('mealNotes').value,
        date: getTodayDateString()
    };
    
    const mealId = database.ref().child('meals').push().key;
    
    database.ref(`users/${AppState.currentUser}/meals/${mealId}`).set(mealData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Meal entry saved!', 'success');
            document.getElementById('mealForm').reset();
            clearIngredients();
            setDefaultTimestamp();
            
            const postMealContent = document.getElementById('postMealContent');
            if (postMealContent) postMealContent.classList.remove('active');
            
            const postMealToggle = document.getElementById('postMealToggle');
            if (postMealToggle) postMealToggle.classList.remove('active');
            
            if (document.getElementById('dashboard').classList.contains('active')) {
                loadDashboardData();
            }
        })
        .catch(error => {
            showToast('Error saving meal', 'error');
        });
}

// ===================================
// EXERCISE TRACKING
// ===================================

function saveExerciseEntry(e) {
    e.preventDefault();
    
    const exerciseType = document.querySelector('input[name="exerciseType"]:checked').value;
    const duration = parseFloat(document.getElementById('exerciseDuration').value);
    const distance = parseFloat(document.getElementById('exerciseDistance').value) || 0;
    
    const caloriesPerMinute = {
        'Walking': 4.5,
        'Running': 11,
        'Cycling': 7,
        'Other': 6
    };
    
    const calories = document.getElementById('exerciseCalories').value || 
                     Math.round(duration * caloriesPerMinute[exerciseType]);
    
    const exerciseData = {
        type: exerciseType,
        duration: duration,
        distance: distance,
        calories: calories,
        intensity: document.getElementById('exerciseIntensity').value,
        timestamp: new Date(document.getElementById('exerciseTime').value).toISOString(),
        notes: document.getElementById('exerciseNotes').value,
        date: getTodayDateString()
    };
    
    const exerciseId = database.ref().child('exercise').push().key;
    
    database.ref(`users/${AppState.currentUser}/exercise/${exerciseId}`).set(exerciseData)
        .then(() => {
            vibrate([10, 30, 10]);
            showToast('Exercise logged!', 'success');
            document.getElementById('exerciseForm').reset();
            setDefaultTimestamp();
            
            if (document.getElementById('dashboard').classList.contains('active')) {
                loadDashboardData();
            }
        })
        .catch(error => {
            showToast('Error saving exercise', 'error');
        });
}

// ===================================
// INGREDIENT MANAGEMENT
// ===================================

function addIngredient() {
    const nameInput = document.getElementById('newIngredientName');
    const amountInput = document.getElementById('newIngredientAmount');
    
    if (!nameInput || !amountInput) return;
    
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    
    if (!name || !amount) {
        showToast('Please enter both ingredient and amount', 'error');
        return;
    }
    
    AppState.currentIngredients.push({ name, amount });
    
    nameInput.value = '';
    amountInput.value = '';
    
    displayIngredients();
    nameInput.focus();
    
    vibrate();
}

function removeIngredient(index) {
    AppState.currentIngredients.splice(index, 1);
    displayIngredients();
    vibrate();
}

function displayIngredients() {
    const container = document.getElementById('ingredientsList');
    if (!container) return;
    
    if (AppState.currentIngredients.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = AppState.currentIngredients.map((ingredient, index) => `
        <div class="ingredient-item-modern">
            <span class="ingredient-name">${ingredient.name}</span>
            <span class="ingredient-amount">${ingredient.amount}</span>
            <button type="button" class="ingredient-remove" onclick="removeIngredient(${index})">
                <i class="lucide-x"></i>
            </button>
        </div>
    `).join('');
}

function clearIngredients() {
    AppState.currentIngredients = [];
    displayIngredients();
}

// ===================================
// ANALYTICS
// ===================================

function setupAnalytics() {
    if (typeof Chart !== 'undefined') {
        createGlucoseChart();
    }
}

function updateAnalytics() {
    const range = AppState.currentTimeRange;
    
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range == range) {
            btn.classList.add('active');
        }
    });
    
    loadAnalyticsData(range);
}

function updateAnalyticsRange(range) {
    AppState.currentTimeRange = parseInt(range);
    updateAnalytics();
}

function loadAnalyticsData(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    Promise.all([
        loadGlucoseDataForRange(startDate, endDate),
        loadMealDataForRange(startDate, endDate),
        loadExerciseDataForRange(startDate, endDate)
    ]).then(([glucoseData, mealData, exerciseData]) => {
        updateAnalyticsDisplay(glucoseData, mealData, exerciseData);
        updateGlucoseChart(glucoseData);
        generatePatterns(glucoseData, mealData, exerciseData);
    });
}

function updateAnalyticsDisplay(glucoseData, mealData, exerciseData) {
    const avgGlucose = calculateAverage(glucoseData.map(d => d.value));
    const inRangePercentage = calculateInRangePercentage(glucoseData);
    const totalDistance = exerciseData.reduce((sum, e) => sum + (e.distance || 0), 0);
    const mealsLogged = mealData.length;
    
    const avgEl = document.getElementById('avgGlucose');
    if (avgEl) avgEl.textContent = avgGlucose ? `${avgGlucose.toFixed(0)}` : '--';
    
    const rangeEl = document.getElementById('inRange');
    if (rangeEl) rangeEl.textContent = `${inRangePercentage.toFixed(0)}%`;
    
    const distEl = document.getElementById('totalDistance');
    if (distEl) distEl.textContent = `${totalDistance.toFixed(1)} mi`;
    
    const mealsEl = document.getElementById('mealsLogged');
    if (mealsEl) mealsEl.textContent = mealsLogged;
}

function createGlucoseChart() {
    const ctx = document.getElementById('glucoseChart');
    if (!ctx) return;
    
    window.glucoseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Glucose Levels',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    suggestedMin: 60,
                    suggestedMax: 180
                }
            }
        }
    });
}

function updateGlucoseChart(data) {
    if (!window.glucoseChart) return;
    
    const sortedData = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    window.glucoseChart.data.labels = sortedData.map(d => 
        new Date(d.timestamp).toLocaleDateString()
    );
    
    window.glucoseChart.data.datasets[0].data = sortedData.map(d => d.value);
    
    window.glucoseChart.update();
}

function generatePatterns(glucoseData, mealData, exerciseData) {
    const patternsList = document.getElementById('patternsList');
    if (!patternsList) return;
    
    const patterns = [];
    
    const morningReadings = glucoseData.filter(d => {
        const hour = new Date(d.timestamp).getHours();
        return hour >= 5 && hour <= 9;
    });
    
    if (morningReadings.length > 3) {
        const avgMorning = calculateAverage(morningReadings.map(d => d.value));
        patterns.push({
            icon: 'sunrise',
            title: 'Morning Readings',
            desc: `Average fasting glucose: ${avgMorning.toFixed(0)} mg/dL`
        });
    }
    
    const postMealReadings = glucoseData.filter(d => d.type === 'postmeal');
    if (postMealReadings.length > 3) {
        const avgPostMeal = calculateAverage(postMealReadings.map(d => d.value));
        patterns.push({
            icon: 'utensils',
            title: 'Post-Meal Response',
            desc: `Average post-meal: ${avgPostMeal.toFixed(0)} mg/dL`
        });
    }
    
    if (patterns.length > 0) {
        patternsList.innerHTML = patterns.map(pattern => `
            <div class="pattern-item">
                <i class="lucide-${pattern.icon}"></i>
                <div class="pattern-content">
                    <span class="pattern-title">${pattern.title}</span>
                    <span class="pattern-desc">${pattern.desc}</span>
                </div>
            </div>
        `).join('');
    }
}

// ===================================
// HISTORY
// ===================================

function loadHistoryData() {
    const historyContainer = document.getElementById('historyEntries');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
        </div>
    `;
    
    Promise.all([
        loadAllMeals(),
        loadAllGlucose(),
        loadAllExercise()
    ]).then(([meals, glucose, exercise]) => {
        const allEntries = [
            ...meals.map(m => ({...m, entryType: 'meal'})),
            ...glucose.map(g => ({...g, entryType: 'glucose'})),
            ...exercise.map(e => ({...e, entryType: 'exercise'}))
        ];
        
        allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayHistoryEntries(allEntries);
    });
}

function displayHistoryEntries(entries) {
    const historyContainer = document.getElementById('historyEntries');
    if (!historyContainer) return;
    
    if (entries.length === 0) {
        historyContainer.innerHTML = '<p class="empty-state">No entries found</p>';
        return;
    }
    
    const groupedByDate = {};
    entries.forEach(entry => {
        const date = entry.date || getTodayDateString();
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(entry);
    });
    
    let html = '';
    Object.keys(groupedByDate).sort().reverse().forEach(date => {
        html += `
            <div class="history-date-group">
                <h3 style="color: var(--primary); margin: 20px 0 10px 0; font-size: 16px;">
                    ${formatDisplayDate(date)}
                </h3>
        `;
        
        groupedByDate[date].forEach(entry => {
            html += createEntryCard(entry);
        });
        
        html += '</div>';
    });
    
    historyContainer.innerHTML = html;
}

function createEntryCard(entry) {
    const time = formatDisplayTime(entry.timestamp);
    let icon, title, details = [];
    
    switch(entry.entryType) {
        case 'glucose':
            icon = 'droplet';
            title = `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Glucose`;
            details.push(`<i class="lucide-activity"></i> ${entry.value} mg/dL`);
            break;
            
        case 'meal':
            icon = 'utensils';
            title = entry.category;
            if (entry.postMealGlucose) {
                details.push(`<i class="lucide-droplet"></i> ${entry.postMealGlucose} mg/dL`);
            }
            if (entry.walkDistance > 0) {
                details.push(`<i class="lucide-footprints"></i> ${entry.walkDistance} mi`);
            }
            break;
            
        case 'exercise':
            icon = 'footprints';
            title = `${entry.type} Exercise`;
            details.push(`<i class="lucide-clock"></i> ${entry.duration} min`);
            if (entry.distance) {
                details.push(`<i class="lucide-map-pin"></i> ${entry.distance} mi`);
            }
            if (entry.calories) {
                details.push(`<i class="lucide-flame"></i> ${entry.calories} cal`);
            }
            break;
    }
    
    return `
        <div class="entry-item" data-id="${entry.id}">
            <div class="entry-header">
                <div class="entry-type">
                    <i class="lucide-${icon}"></i>
                    <span>${title}</span>
                </div>
                <span class="entry-time">${time}</span>
            </div>
            ${entry.description ? `<div class="entry-description">${entry.description}</div>` : ''}
            ${entry.notes ? `<div class="entry-description">${entry.notes}</div>` : ''}
            <div class="entry-details">
                ${details.join('')}
            </div>
            <div class="entry-actions">
                <button class="btn btn-danger" onclick="deleteEntry('${entry.entryType}', '${entry.id}')">
                    Delete
                </button>
            </div>
        </div>
    `;
}

function createCompactEntryCard(entry) {
    const time = formatDisplayTime(entry.timestamp);
    const icon = entry.category === 'Breakfast' ? 'sunrise' :
                 entry.category === 'Lunch' ? 'sun' :
                 entry.category === 'Dinner' ? 'moon' : 'cookie';
    
    return `
        <div class="entry-item">
            <div class="entry-header">
                <div class="entry-type">
                    <i class="lucide-${icon}"></i>
                    <span>${entry.category}</span>
                </div>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-description">${entry.description.substring(0, 50)}...</div>
        </div>
    `;
}

function deleteEntry(type, id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    let path;
    switch(type) {
        case 'meal':
            path = `users/${AppState.currentUser}/meals/${id}`;
            break;
        case 'glucose':
            path = `users/${AppState.currentUser}/glucose/${id}`;
            break;
        case 'exercise':
            path = `users/${AppState.currentUser}/exercise/${id}`;
            break;
    }
    
    database.ref(path).remove()
        .then(() => {
            vibrate();
            showToast('Entry deleted', 'success');
            loadHistoryData();
            
            AppState.cache.todayData = null;
            
            if (document.getElementById('dashboard').classList.contains('active')) {
                loadDashboardData();
            }
        })
        .catch(error => {
            showToast('Error deleting entry', 'error');
        });
}

function toggleFilterPanel() {
    const panel = document.getElementById('filterPanel');
    if (panel) {
        panel.classList.toggle('active');
        vibrate();
    }
}

function applyHistoryFilters() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const filterType = document.getElementById('filterType').value;
    const mealType = document.getElementById('filterMealType').value;
    
    Promise.all([
        loadAllMeals(),
        loadAllGlucose(),
        loadAllExercise()
    ]).then(([meals, glucose, exercise]) => {
        let allEntries = [
            ...meals.map(m => ({...m, entryType: 'meal'})),
            ...glucose.map(g => ({...g, entryType: 'glucose'})),
            ...exercise.map(e => ({...e, entryType: 'exercise'}))
        ];
        
        if (startDate) {
            allEntries = allEntries.filter(e => e.date >= startDate);
        }
        if (endDate) {
            allEntries = allEntries.filter(e => e.date <= endDate);
        }
        if (filterType) {
            allEntries = allEntries.filter(e => e.entryType === filterType);
        }
        if (mealType && filterType === 'meal') {
            allEntries = allEntries.filter(e => e.category === mealType);
        }
        
        allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        displayHistoryEntries(allEntries);
        
        const panel = document.getElementById('filterPanel');
        if (panel) panel.classList.remove('active');
    });
}

function clearHistoryFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterMealType').value = '';
    loadHistoryData();
    
    const panel = document.getElementById('filterPanel');
    if (panel) panel.classList.remove('active');
}

function searchHistory() {
    const searchInput = document.getElementById('historySearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        loadHistoryData();
        return;
    }
    
    Promise.all([
        loadAllMeals(),
        loadAllGlucose(),
        loadAllExercise()
    ]).then(([meals, glucose, exercise]) => {
        let allEntries = [
            ...meals.map(m => ({...m, entryType: 'meal'})),
            ...glucose.map(g => ({...g, entryType: 'glucose'})),
            ...exercise.map(e => ({...e, entryType: 'exercise'}))
        ];
        
        allEntries = allEntries.filter(entry => {
            const searchableText = [
                entry.description,
                entry.notes,
                entry.category,
                entry.type
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        displayHistoryEntries(allEntries);
    });
}

// ===================================
// RECIPES & SHOPPING LIST
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
    const listElement = document.getElementById(`${type}List`);
    if (!listElement) return;
    
    if (recipes.length === 0) {
        listElement.innerHTML = `<p class="empty-state">No ${type} ideas yet</p>`;
    } else {
        listElement.innerHTML = recipes.map(recipe => `
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
    const capitalType = type.charAt(0).toUpperCase() + type.slice(1);
    const input = document.getElementById(`new${capitalType}`);
    if (!input) return;
    
    const text = input.value.trim();
    
    if (!text) {
        showToast('Please enter a recipe idea', 'error');
        return;
    }
    
    const recipeId = database.ref().child('recipes').push().key;
    
    database.ref(`users/${AppState.currentUser}/recipes/${type}/${recipeId}`).set(text)
        .then(() => {
            input.value = '';
            vibrate();
            showToast('Recipe idea added!', 'success');
        })
        .catch(error => {
            showToast('Error adding recipe', 'error');
        });
}

function deleteRecipe(type, recipeId) {
    database.ref(`users/${AppState.currentUser}/recipes/${type}/${recipeId}`).remove()
        .then(() => {
            vibrate();
            showToast('Recipe deleted', 'success');
        });
}

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
    const listElement = document.getElementById('shoppingList');
    if (!listElement) return;
    
    if (items.length === 0) {
        listElement.innerHTML = '<p class="empty-state">Shopping list is empty</p>';
    } else {
        listElement.innerHTML = items.map(item => `
            <div class="shopping-item ${item.checked ? 'checked' : ''}">
                <input type="checkbox" 
                       class="shopping-checkbox" 
                       ${item.checked ? 'checked' : ''}
                       onchange="toggleShoppingItem('${item.id}', this.checked)">
                <span class="shopping-text">${item.text}</span>
                <button onclick="deleteShoppingItem('${item.id}')">
                    <i class="lucide-trash-2"></i>
                </button>
            </div>
        `).join('');
    }
}

function addShoppingItem() {
    const input = document.getElementById('newShoppingItem');
    if (!input) return;
    
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
        vibrate();
        showToast('Item added!', 'success');
    });
}

function toggleShoppingItem(itemId, checked) {
    database.ref(`users/${AppState.currentUser}/shopping/${itemId}/checked`).set(checked);
    vibrate();
}

function deleteShoppingItem(itemId) {
    database.ref(`users/${AppState.currentUser}/shopping/${itemId}`).remove()
        .then(() => {
            vibrate();
            showToast('Item removed', 'success');
        });
}

// ===================================
// SETTINGS & UI
// ===================================

function loadUserSettings() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    const reminders = localStorage.getItem('reminders') !== 'false';
    
    AppState.darkMode = darkMode;
    AppState.reminders = reminders;
    
    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) darkToggle.checked = darkMode;
    
    const remindToggle = document.getElementById('remindersToggle');
    if (remindToggle) remindToggle.checked = reminders;
    
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
}

function toggleDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;
    
    const isDark = toggle.checked;
    AppState.darkMode = isDark;
    localStorage.setItem('darkMode', isDark);
    
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    vibrate();
}

function toggleReminders() {
    const toggle = document.getElementById('remindersToggle');
    if (!toggle) return;
    
    const enabled = toggle.checked;
    AppState.reminders = enabled;
    localStorage.setItem('reminders', enabled);
    
    showToast(enabled ? 'Reminders enabled' : 'Reminders disabled', 'success');
    vibrate();
}

function openTargetRangesModal() {
    showModal('Target Ranges', `
        <div class="target-ranges-form">
            <h4>Fasting Glucose</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="number" id="fastingLow" value="${AppState.targetRanges.fasting.low}" style="flex: 1;">
                <span style="padding: 10px;">-</span>
                <input type="number" id="fastingHigh" value="${AppState.targetRanges.fasting.high}" style="flex: 1;">
            </div>
            
            <h4>Post-Meal Glucose</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="number" id="postMealLow" value="${AppState.targetRanges.postMeal.low}" style="flex: 1;">
                <span style="padding: 10px;">-</span>
                <input type="number" id="postMealHigh" value="${AppState.targetRanges.postMeal.high}" style="flex: 1;">
            </div>
            
            <h4>Random Glucose</h4>
            <div style="display: flex; gap: 10px;">
                <input type="number" id="randomLow" value="${AppState.targetRanges.random.low}" style="flex: 1;">
                <span style="padding: 10px;">-</span>
                <input type="number" id="randomHigh" value="${AppState.targetRanges.random.high}" style="flex: 1;">
            </div>
        </div>
    `, () => {
        AppState.targetRanges.fasting.low = parseInt(document.getElementById('fastingLow').value);
        AppState.targetRanges.fasting.high = parseInt(document.getElementById('fastingHigh').value);
        AppState.targetRanges.postMeal.low = parseInt(document.getElementById('postMealLow').value);
        AppState.targetRanges.postMeal.high = parseInt(document.getElementById('postMealHigh').value);
        AppState.targetRanges.random.low = parseInt(document.getElementById('randomLow').value);
        AppState.targetRanges.random.high = parseInt(document.getElementById('randomHigh').value);
        
        localStorage.setItem('targetRanges', JSON.stringify(AppState.targetRanges));
        showToast('Target ranges updated', 'success');
        closeModal();
    });
}

function togglePostMealSection() {
    const toggle = document.getElementById('postMealToggle');
    const content = document.getElementById('postMealContent');
    
    if (toggle && content) {
        toggle.classList.toggle('active');
        content.classList.toggle('active');
        vibrate();
    }
}

function openProfileModal() {
    showModal('Profile', `
        <div style="text-align: center; padding: 20px;">
            <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: var(--primary-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="lucide-user-circle" style="font-size: 40px; color: white;"></i>
            </div>
            <h3>User Profile</h3>
            <p style="color: var(--text-secondary); margin: 10px 0;">GlucoTrack Pro v1.0</p>
            <button class="btn btn-primary" onclick="exportData()" style="margin-top: 20px;">
                <i class="lucide-download"></i> Export Data
            </button>
        </div>
    `);
}

function showModal(title, content, onSave) {
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;
    
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal()">
                    <i class="lucide-x"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${onSave ? `
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="modalSaveBtn">Save</button>
                </div>
            ` : ''}
        </div>
    `;
    
    modalContainer.classList.add('active');
    
    if (onSave) {
        const saveBtn = document.getElementById('modalSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', onSave);
    }
}

function closeModal() {
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
        modalContainer.classList.remove('active');
        modalContainer.innerHTML = '';
    }
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'x-circle' :
                 type === 'warning' ? 'alert-circle' : 'info';
    
    toast.innerHTML = `
        <i class="lucide-${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
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

function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
}

function calculateInRangePercentage(glucoseData) {
    if (glucoseData.length === 0) return 0;
    
    const inRange = glucoseData.filter(d => {
        const ranges = AppState.targetRanges[d.type] || AppState.targetRanges.random;
        return d.value >= ranges.low && d.value <= ranges.high;
    });
    
    return (inRange.length / glucoseData.length) * 100;
}

function calculateTodayStats() {
    return new Promise(resolve => {
        Promise.all([
            loadTodayGlucoseReadings(),
            loadTodayMeals(),
            loadTodayExercise()
        ]).then(([glucose, meals, exercise]) => {
            const avgGlucose = glucose.length > 0 ? 
                Math.round(calculateAverage(glucose.map(g => g.value))) : null;
            
            const totalWalking = meals.reduce((sum, m) => sum + (m.walkDistance || 0), 0) +
                                exercise.reduce((sum, e) => sum + (e.distance || 0), 0);
            
            const trend = avgGlucose && avgGlucose < 120 ? '↓ Good' : 
                         avgGlucose && avgGlucose > 150 ? '↑ High' : '→ Stable';
            
            resolve({
                avgGlucose,
                totalWalking: totalWalking.toFixed(1),
                trend
            });
        });
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

function loadTodayMeals() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        
        database.ref(`users/${AppState.currentUser}/meals`)
            .orderByChild('date')
            .equalTo(today)
            .once('value')
            .then(snapshot => {
                const meals = [];
                snapshot.forEach(childSnapshot => {
                    meals.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                resolve(meals);
            });
    });
}

function loadTodayExercise() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        
        database.ref(`users/${AppState.currentUser}/exercise`)
            .orderByChild('date')
            .equalTo(today)
            .once('value')
            .then(snapshot => {
                const exercises = [];
                snapshot.forEach(childSnapshot => {
                    exercises.push(childSnapshot.val());
                });
                resolve(exercises);
            });
    });
}

function loadTodayGlucoseReadings() {
    return new Promise(resolve => {
        const today = getTodayDateString();
        
        database.ref(`users/${AppState.currentUser}/glucose`)
            .orderByChild('date')
            .equalTo(today)
            .once('value')
            .then(snapshot => {
                const readings = [];
                snapshot.forEach(childSnapshot => {
                    readings.push(childSnapshot.val());
                });
                resolve(readings);
            });
    });
}

function loadAllMeals() {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/meals`).once('value')
            .then(snapshot => {
                const meals = [];
                snapshot.forEach(childSnapshot => {
                    meals.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                resolve(meals);
            });
    });
}

function loadAllGlucose() {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/glucose`).once('value')
            .then(snapshot => {
                const readings = [];
                snapshot.forEach(childSnapshot => {
                    readings.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                resolve(readings);
            });
    });
}

function loadAllExercise() {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/exercise`).once('value')
            .then(snapshot => {
                const exercises = [];
                snapshot.forEach(childSnapshot => {
                    exercises.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                resolve(exercises);
            });
    });
}

function loadGlucoseDataForRange(startDate, endDate) {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/glucose`).once('value')
            .then(snapshot => {
                const readings = [];
                snapshot.forEach(childSnapshot => {
                    const data = childSnapshot.val();
                    const date = new Date(data.timestamp);
                    if (date >= startDate && date <= endDate) {
                        readings.push(data);
                    }
                });
                resolve(readings);
            });
    });
}

function loadMealDataForRange(startDate, endDate) {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/meals`).once('value')
            .then(snapshot => {
                const meals = [];
                snapshot.forEach(childSnapshot => {
                    const data = childSnapshot.val();
                    const date = new Date(data.timestamp);
                    if (date >= startDate && date <= endDate) {
                        meals.push(data);
                    }
                });
                resolve(meals);
            });
    });
}

function loadExerciseDataForRange(startDate, endDate) {
    return new Promise(resolve => {
        database.ref(`users/${AppState.currentUser}/exercise`).once('value')
            .then(snapshot => {
                const exercises = [];
                snapshot.forEach(childSnapshot => {
                    const data = childSnapshot.val();
                    const date = new Date(data.timestamp);
                    if (date >= startDate && date <= endDate) {
                        exercises.push(data);
                    }
                });
                resolve(exercises);
            });
    });
}

function setupWalkCalculator() {
    const distanceInput = document.getElementById('walkDistance');
    const durationInput = document.getElementById('walkDuration');
    const speedInput = document.getElementById('walkSpeed');
    
    if (!distanceInput || !durationInput || !speedInput) return;
    
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

function setupRealtimeUpdates() {
    const userId = AppState.currentUser;
    
    database.ref(`users/${userId}/meals`).on('child_added', snapshot => {
        if (document.getElementById('dashboard').classList.contains('active')) {
            AppState.cache.todayData = null;
            loadDashboardData();
        }
    });
}

function exportData() {
    database.ref(`users/${AppState.currentUser}`).once('value')
        .then(snapshot => {
            const data = snapshot.val();
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `glucotrack-export-${getTodayDateString()}.json`;
            link.click();
            
            vibrate([10, 30, 10]);
            showToast('Data exported successfully!', 'success');
        });
}

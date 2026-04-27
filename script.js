// Ініціалізація Supabase (Ваші дані)
const SUPABASE_URL = 'https://xezhbqcteaihrlrykbkr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qNcUyFxMlWAWAry3uSHndg_ADVMCE3a';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM елементи
const appContent = document.getElementById('app-content');
const authButton = document.getElementById('authButton');
const logoutButton = document.getElementById('logoutButton');
const authModal = document.getElementById('authModal');
const closeAuthModal = authModal.querySelector('.close-button');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const signInButton = document.getElementById('signInButton');
const signUpButton = document.getElementById('signUpButton');
const authMessage = document.getElementById('authMessage');

const totalIncomeSpan = document.getElementById('totalIncome');
const totalExpenseSpan = document.getElementById('totalExpense');
const totalBalanceSpan = document.getElementById('totalBalance');

const userSplitContainer = document.getElementById('userSplitContainer');
const dailyChartCanvas = document.getElementById('dailyChart');
const graphPeriodSelect = document.getElementById('graphPeriodSelect');
let dailyChartInstance; // Змінна для зберігання екземпляра Chart.js

const newNoteInput = document.getElementById('newNoteInput');
const addNoteButton = document.getElementById('addNoteButton');
const notesList = document.getElementById('notesList');

const newTaskInput = document.getElementById('newTaskInput');
const addTaskButton = document.getElementById('addTaskButton');
const tasksList = document.getElementById('tasksList');

const filterStartDate = document.getElementById('filterStartDate');
const filterEndDate = document.getElementById('filterEndDate');
const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const applyFiltersButton = document.getElementById('applyFiltersButton');
const searchTransactionsInput = document.getElementById('searchTransactions');
const transactionsTableBody = document.getElementById('transactionsTableBody');

const newTransactionAmount = document.getElementById('newTransactionAmount');
const newTransactionType = document.getElementById('newTransactionType');
const newTransactionCategory = document.getElementById('newTransactionCategory');
const newTransactionDescription = document.getElementById('newTransactionDescription');
const newTransactionDate = document.getElementById('newTransactionDate');
const addTransactionButton = document.getElementById('addTransactionButton');

// Глобальні змінні
let currentUserId = null;
let currentUserName = "Ви"; // Для відображення "Ви" замість "Мій друг"

// --- Функції авторизації ---
async function handleAuthStateChange(event, session) {
    if (session) {
        currentUserId = session.user.id;
        console.log('User logged in:', session.user);
        appContent.style.display = 'block';
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
        authModal.style.display = 'none';
        await loadAllData(); // Завантажуємо всі дані після входу
        await createUserProfileIfNotExists(session.user);
    } else {
        currentUserId = null;
        console.log('User logged out');
        appContent.style.display = 'none';
        authButton.style.display = 'block';
        logoutButton.style.display = 'none';
    }
}

async function signIn() {
    const email = authEmail.value;
    const password = authPassword.value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        authMessage.textContent = error.message;
    } else {
        authMessage.textContent = '';
        authEmail.value = '';
        authPassword.value = '';
    }
}

async function signUp() {
    const email = authEmail.value;
    const password = authPassword.value;
    const { error, data } = await sb.auth.signUp({ email, password });
    if (error) {
        authMessage.textContent = error.message;
    } else {
        authMessage.textContent = 'Перевірте свою пошту для підтвердження.';
        console.log('Sign up successful, user:', data.user);
        authEmail.value = '';
        authPassword.value = '';
    }
}

async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) {
        console.error('Logout error:', error.message);
    }
}

async function createUserProfileIfNotExists(user) {
    const { data, error } = await sb
        .from('user_profiles')
        .select('id')
        .eq('id', user.id);

    if (error) {
        console.error('Error checking user profile:', error.message);
        return;
    }

    if (data && data.length === 0) {
        // Профіль не існує, створюємо
        const { error: insertError } = await sb
            .from('user_profiles')
            .insert([
                { id: user.id, display_name: user.email.split('@')[0], avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}` }
            ]);
        if (insertError) {
            console.error('Error creating user profile:', insertError.message);
        } else {
            console.log('User profile created successfully for:', user.email);
        }
    }
}


// --- Завантаження та відображення даних ---

async function loadAllData() {
    if (!currentUserId) return;
    await updateOverviewTotals();
    await displayUserSplit();
    await loadDailyChartData();
    await loadNotes();
    await loadTasks();
    await loadTransactions();

    // Встановлюємо сьогоднішню дату для нового запису транзакції
    newTransactionDate.valueAsDate = new Date();
}

// Завантаження профілів користувачів (для відображення імен)
async function fetchUserProfiles() {
    const { data, error } = await sb.from('user_profiles').select('*');
    if (error) {
        console.error('Error fetching user profiles:', error.message);
        return [];
    }
    return data;
}

async function getDisplayName(userId) {
    const profiles = await fetchUserProfiles();
    const profile = profiles.find(p => p.id === userId);
    if (profile) {
        return profile.display_name;
    }
    return userId === currentUserId ? "Я (Ви)" : "Інший користувач"; // Fallback
}


// Оновлення загальних показників
async function updateOverviewTotals() {
    const { data: incomeData, error: incomeError } = await sb
        .from('transactions')
        .select('amount')
        .eq('type', 'income')
        .eq('user_id', currentUserId); // Тільки для поточного користувача

    const { data: expenseData, error: expenseError } = await sb
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('user_id', currentUserId);

    if (incomeError || expenseError) {
        console.error('Error fetching totals:', incomeError || expenseError);
        return;
    }

    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBalance = totalIncome - totalExpense;

    totalIncomeSpan.textContent = `${totalIncome.toFixed(2)}₴`;
    totalExpenseSpan.textContent = `${totalExpense.toFixed(2)}₴`;
    totalBalanceSpan.textContent = `${totalBalance.toFixed(2)}₴`;
    totalBalanceSpan.className = totalBalance >= 0 ? 'positive' : 'negative';
}


// Відображення розподілу за користувачами
async function displayUserSplit(period = 'all') {
    userSplitContainer.innerHTML = '';
    const profiles = await fetchUserProfiles(); // Отримаємо всі профілі

    // Отримаємо всі транзакції, якщо це адмін чи потрібно бачити транзакції друзів
    // Для початку MVP - кожен бачить тільки свої транзакції.
    // Якщо ви хочете спільний бюджет, RLS політики треба змінити, щоб дозволити бачити транзакції друзів
    // і тоді тут треба fetch всіх транзакцій групи.
    // Наразі fetch тільки для поточного користувача.
    const { data: transactions, error } = await sb
        .from('transactions')
        .select('*'); // Цей запит поверне тільки транзакції поточного користувача через RLS

    if (error) {
        console.error('Error fetching transactions for user split:', error.message);
        return;
    }

    const userStats = {};
    profiles.forEach(profile => {
        userStats[profile.id] = {
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            income: 0,
            expense: 0,
            balance: 0
        };
    });

    transactions.forEach(t => {
        if (userStats[t.user_id]) {
            if (t.type === 'income') {
                userStats[t.user_id].income += t.amount;
            } else {
                userStats[t.user_id].expense += t.amount;
            }
            userStats[t.user_id].balance = userStats[t.user_id].income - userStats[t.user_id].expense;
        }
    });

    for (const userId in userStats) {
        const stats = userStats[userId];
        const card = document.createElement('div');
        card.className = 'user-card glassmorphism';
        card.innerHTML = `
            <img src="${stats.avatarUrl}" alt="${stats.displayName}" class="user-avatar">
            <div class="user-name">${stats.displayName}</div>
            <div class="user-detail">Витрачено: <span class="expense-value">${stats.expense.toFixed(2)}₴</span></div>
            <div class="user-detail">Внесено: <span class="income-value">${stats.income.toFixed(2)}₴</span></div>
            <div class="user-balance">Баланс: <span class="balance-value ${stats.balance >= 0 ? 'positive' : 'negative'}">${stats.balance.toFixed(2)}₴</span></div>
        `;
        userSplitContainer.appendChild(card);
    }
}


// Завантаження даних для денного графіка
async function loadDailyChartData() {
    const days = parseInt(graphPeriodSelect.value);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const { data: transactions, error } = await sb
        .from('transactions')
        .select('amount, type, transaction_date')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true });

    if (error) {
        console.error('Error fetching chart data:', error.message);
        return;
    }

    const dailyData = {};
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyData[dateStr] = { income: 0, expense: 0 };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    transactions.forEach(t => {
        const dateStr = t.transaction_date;
        if (dailyData[dateStr]) {
            if (t.type === 'income') {
                dailyData[dateStr].income += t.amount;
            } else {
                dailyData[dateStr].expense += t.amount;
            }
        }
    });

    const labels = Object.keys(dailyData);
    const incomes = labels.map(date => dailyData[date].income);
    const expenses = labels.map(date => dailyData[date].expense);

    renderDailyChart(labels, incomes, expenses);
}


// Рендеринг денного графіка
function renderDailyChart(labels, incomes, expenses) {
    if (dailyChartInstance) {
        dailyChartInstance.destroy(); // Знищуємо попередній екземпляр
    }

    const ctx = dailyChartCanvas.getContext('2d');
    dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Доходи',
                    data: incomes,
                    borderColor: varToRgb('--success-green'),
                    backgroundColor: 'rgba(105, 240, 174, 0.2)',
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Витрати',
                    data: expenses,
                    borderColor: varToRgb('--danger-red'),
                    backgroundColor: 'rgba(255, 138, 128, 0.2)',
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: varToRgb('--text-light')
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: varToRgb('--text-secondary')
                    },
                    grid: {
                        color: varToRgb('--glass-border')
                    }
                },
                y: {
                    ticks: {
                        color: varToRgb('--text-secondary')
                    },
                    grid: {
                        color: varToRgb('--glass-border')
                    }
                }
            }
        }
    });
}

// Допоміжна функція для отримання CSS змінних в RGB форматі
function varToRgb(variable) {
    const style = getComputedStyle(document.body);
    return style.getPropertyValue(variable);
}


// Завантаження нотаток
async function loadNotes() {
    notesList.innerHTML = '';
    const { data, error } = await sb
        .from('notes')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notes:', error.message);
        return;
    }

    data.forEach(note => {
        const li = document.createElement('li');
        li.dataset.id = note.id;
        li.className = note.is_completed ? 'completed' : '';
        li.innerHTML = `
            <span>${note.content}</span>
            <div class="actions">
                <input type="checkbox" ${note.is_completed ? 'checked' : ''} onchange="toggleNoteCompletion('${note.id}', this.checked)">
                <button class="btn-icon" onclick="deleteNote('${note.id}')"><img src="path/to/delete-icon.svg" alt="Видалити"></button>
            </div>
        `;
        notesList.appendChild(li);
    });
}

// Додавання нотатки
async function addNote() {
    const content = newNoteInput.value.trim();
    if (!content || !currentUserId) return;

    const { error } = await sb
        .from('notes')
        .insert([{ user_id: currentUserId, content: content }]);

    if (error) {
        console.error('Error adding note:', error.message);
    } else {
        newNoteInput.value = '';
        await loadNotes();
    }
}

// Зміна статусу нотатки
async function toggleNoteCompletion(noteId, isCompleted) {
    const { error } = await sb
        .from('notes')
        .update({ is_completed: isCompleted })
        .eq('id', noteId)
        .eq('user_id', currentUserId); // Перевірка user_id для RLS

    if (error) {
        console.error('Error updating note:', error.message);
    } else {
        await loadNotes();
    }
}

// Видалення нотатки
async function deleteNote(noteId) {
    const { error } = await sb
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', currentUserId); // Перевірка user_id для RLS

    if (error) {
        console.error('Error deleting note:', error.message);
    } else {
        await loadNotes();
    }
}


// Завантаження завдань
async function loadTasks() {
    tasksList.innerHTML = '';
    const { data, error } = await sb
        .from('tasks')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tasks:', error.message);
        return;
    }

    data.forEach(task => {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.className = task.is_completed ? 'completed' : '';
        li.innerHTML = `
            <span>${task.description}</span>
            <div class="actions">
                <input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTaskCompletion('${task.id}', this.checked)">
                <button class="btn-icon" onclick="deleteTask('${task.id}')"><img src="path/to/delete-icon.svg" alt="Видалити"></button>
            </div>
        `;
        tasksList.appendChild(li);
    });
}

// Додавання завдання
async function addTask() {
    const description = newTaskInput.value.trim();
    if (!description || !currentUserId) return;

    const { error } = await sb
        .from('tasks')
        .insert([{ user_id: currentUserId, description: description }]);

    if (error) {
        console.error('Error adding task:', error.message);
    } else {
        newTaskInput.value = '';
        await loadTasks();
    }
}

// Зміна статусу завдання
async function toggleTaskCompletion(taskId, isCompleted) {
    const { error } = await sb
        .from('tasks')
        .update({ is_completed: isCompleted })
        .eq('id', taskId)
        .eq('user_id', currentUserId);

    if (error) {
        console.error('Error updating task:', error.message);
    } else {
        await loadTasks();
    }
}

// Видалення завдання
async function deleteTask(taskId) {
    const { error } = await sb
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', currentUserId);

    if (error) {
        console.error('Error deleting task:', error.message);
    } else {
        await loadTasks();
    }
}


// Завантаження та відображення транзакцій
async function loadTransactions() {
    transactionsTableBody.innerHTML = '';
    let query = sb.from('transactions').select('*');

    // Фільтри
    const start = filterStartDate.value;
    const end = filterEndDate.value;
    const type = filterType.value;
    const category = filterCategory.value.trim();
    const search = searchTransactionsInput.value.trim().toLowerCase();

    if (start) query = query.gte('transaction_date', start);
    if (end) query = query.lte('transaction_date', end);
    if (type) query = query.eq('type', type);
    if (category) query = query.ilike('category', `%${category}%`); // Case-insensitive LIKE

    // Запит буде автоматично фільтрувати по user_id завдяки RLS

    const { data: transactions, error } = await query.order('transaction_date', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error.message);
        return;
    }

    const profiles = await fetchUserProfiles(); // Для відображення імен користувачів
    const userMap = new Map(profiles.map(p => [p.id, p.display_name]));

    transactions.forEach(t => {
        // Пошук за описом або категорією
        if (search && !(t.description && t.description.toLowerCase().includes(search)) && !(t.category && t.category.toLowerCase().includes(search))) {
            return; // Пропускаємо, якщо не відповідає пошуку
        }

        const tr = document.createElement('tr');
        const userName = userMap.get(t.user_id) || "Невідомий";
        tr.innerHTML = `
            <td>${t.transaction_date}</td>
            <td class="${t.type === 'income' ? 'income-text' : 'expense-text'}">${t.type === 'income' ? 'Дохід' : 'Витрата'}</td>
            <td>${t.category}</td>
            <td>${t.description || ''}</td>
            <td class="${t.type === 'income' ? 'income-text' : 'expense-text'}">${t.amount.toFixed(2)}₴</td>
            <td>${userName}</td>
            <td>
                <button class="btn-icon" onclick="editTransaction('${t.id}')"><img src="path/to/edit-icon.svg" alt="Редагувати"></button>
                <button class="btn-icon" onclick="deleteTransaction('${t.id}')"><img src="path/to/delete-icon.svg" alt="Видалити"></button>
            </td>
        `;
        transactionsTableBody.appendChild(tr);
    });
}

// Додавання транзакції
async function addTransaction() {
    const amount = parseFloat(newTransactionAmount.value);
    const type = newTransactionType.value;
    const category = newTransactionCategory.value.trim();
    const description = newTransactionDescription.value.trim();
    const transaction_date = newTransactionDate.value;

    if (isNaN(amount) || amount <= 0 || !type || !category || !transaction_date || !currentUserId) {
        alert('Будь ласка, заповніть всі обов\'язкові поля для транзакції (сума, тип, категорія, дата).');
        return;
    }

    const { error } = await sb
        .from('transactions')
        .insert([{
            user_id: currentUserId,
            amount,
            type,
            category,
            description,
            transaction_date
        }]);

    if (error) {
        console.error('Error adding transaction:', error.message);
    } else {
        // Очистити форму та оновити дані
        newTransactionAmount.value = '';
        newTransactionCategory.value = '';
        newTransactionDescription.value = '';
        newTransactionDate.valueAsDate = new Date(); // Скинути на сьогодні
        await loadAllData(); // Оновити всі блоки
    }
}

// Редагування транзакції (потрібен модальний діалог або inline редагування)
async function editTransaction(transactionId) {
    alert(`Редагувати транзакцію з ID: ${transactionId} - ця функція потребує реалізації модального вікна.`);
    // Тут потрібно буде відкрити модальне вікно з формою, заповненою даними транзакції,
    // дозволити користувачу змінити їх і потім оновити в Supabase.
}

// Видалення транзакції
async function deleteTransaction(transactionId) {
    if (!confirm('Ви впевнені, що хочете видалити цю транзакцію?')) return;

    const { error } = await sb
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', currentUserId); // Перевірка user_id для RLS

    if (error) {
        console.error('Error deleting transaction:', error.message);
    } else {
        await loadAllData(); // Оновити всі блоки
    }
}


// --- Слухачі подій ---
document.addEventListener('DOMContentLoaded', async () => {
    // Перевіряємо сесію при завантаженні сторінки
    const { data: { session } } = await sb.auth.getSession();
    handleAuthStateChange(null, session); // Ініціалізуємо стан UI

    // Слухач для зміни стану авторизації (вхід/вихід)
    sb.auth.onAuthStateChange(handleAuthStateChange);

    // Встановлюємо сьогоднішню дату для фільтрів
    const today = new Date().toISOString().split('T')[0];
    filterEndDate.value = today;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Останні 30 днів
    filterStartDate.value = thirtyDaysAgo.toISOString().split('T')[0];
});

authButton.addEventListener('click', () => {
    authModal.style.display = 'flex';
    authMessage.textContent = '';
});
closeAuthModal.addEventListener('click', () => authModal.style.display = 'none');
window.addEventListener('click', (event) => {
    if (event.target == authModal) {
        authModal.style.display = 'none';
    }
});

signInButton.addEventListener('click', signIn);
signUpButton.addEventListener('click', signUp);
logoutButton.addEventListener('click', signOut);

addNoteButton.addEventListener('click', addNote);
newNoteInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNote(); });

addTaskButton.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

graphPeriodSelect.addEventListener('change', loadDailyChartData);

applyFiltersButton.addEventListener('click', loadTransactions);
searchTransactionsInput.addEventListener('input', loadTransactions);

addTransactionButton.addEventListener('click', addTransaction);

// Експортуємо функції для доступу з HTML (onclick)
window.toggleNoteCompletion = toggleNoteCompletion;
window.deleteNote = deleteNote;
window.toggleTaskCompletion = toggleTaskCompletion;
window.deleteTask = deleteTask;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;

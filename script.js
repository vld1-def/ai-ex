// Ініціалізація Supabase (Ваші дані)
const SUPABASE_URL = 'https://xezhbqcteaihrlrykbkr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qNcUyFxMlWAWAry3uSHndg_ADVMCE3a';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM елементи (залишаються без змін від попередньої версії)
const appContent = document.getElementById('app-content');
const authButton = document.getElementById('authButton');
const logoutButton = document.getElementById('logoutButton');
const authModal = document.getElementById('authModal');
const closeAuthModal = authModal.querySelector('.close-button');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const signInButton = document.getElementById('signInButton');
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
let userProfilesCache = []; // Кеш для профілів користувачів

// --- Функції авторизації (залишаються без змін) ---
async function handleAuthStateChange(event, session) {
    if (session) {
        currentUserId = session.user.id;
        console.log('User logged in:', session.user);
        appContent.style.display = 'block';
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
        authModal.style.display = 'none';
        await createUserProfileIfNotExists(session.user); // Створити профіль, якщо його немає
        await loadAllData(); // Завантажуємо всі дані після входу
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
    userProfilesCache = await fetchUserProfiles(); // Оновлюємо кеш профілів
    await updateOverviewTotals();
    await displayUserSplit();
    await loadDailyChartData();
    await loadNotes();
    await loadTasks();
    await loadTransactions();

    newTransactionDate.valueAsDate = new Date();
}

// Завантаження профілів користувачів (для відображення імен)
async function fetchUserProfiles() {
    // Змінено: тепер ми хочемо бачити профілі всіх користувачів, які є друзями
    // або свій власний. RLS-політики це дозволять.
    const { data, error } = await sb.from('user_profiles').select('*');
    if (error) {
        console.error('Error fetching user profiles:', error.message);
        return [];
    }
    return data;
}

// Функція для отримання відображуваного імені користувача за ID
function getDisplayName(userId) {
    const profile = userProfilesCache.find(p => p.id === userId);
    if (profile) {
        return profile.display_name;
    }
    return userId === currentUserId ? "Я (Ви)" : "Невідомий користувач"; // Fallback
}


// Оновлення загальних показників (Сума транзакцій поточного користувача + транзакції друзів)
async function updateOverviewTotals() {
    const { data: transactions, error } = await sb
        .from('transactions')
        .select('amount, type'); // Завдяки RLS, цей запит поверне транзакції поточного користувача та його друзів

    if (error) {
        console.error('Error fetching totals for overview:', error.message);
        return;
    }

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(item => {
        if (item.type === 'income') {
            totalIncome += item.amount;
        } else {
            totalExpense += item.amount;
        }
    });

    const totalBalance = totalIncome - totalExpense;

    totalIncomeSpan.textContent = `${totalIncome.toFixed(2)}₴`;
    totalExpenseSpan.textContent = `${totalExpense.toFixed(2)}₴`;
    totalBalanceSpan.textContent = `${totalBalance.toFixed(2)}₴`;
    totalBalanceSpan.className = totalBalance >= 0 ? 'positive' : 'negative';
}


// Відображення розподілу за користувачами
async function displayUserSplit(period = 'all') {
    userSplitContainer.innerHTML = '';
    
    // Завдяки RLS, цей запит поверне транзакції поточного користувача та його друзів
    const { data: transactions, error } = await sb
        .from('transactions')
        .select('amount, type, user_id, transaction_date');

    if (error) {
        console.error('Error fetching transactions for user split:', error.message);
        return;
    }

    const userStats = {};
    // Ініціалізуємо статистику для всіх, кого ми можемо бачити (поточний користувач + друзі)
    userProfilesCache.forEach(profile => {
        userStats[profile.id] = {
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            income: 0,
            expense: 0,
            balance: 0
        };
    });

    // Фільтруємо транзакції за періодом, якщо потрібно
    let filteredTransactions = transactions;
    // Логіка фільтрації за періодом (тиждень, місяць) тут буде більш складною
    // Для простоти, поки що "all" або можна додати реальну фільтрацію

    filteredTransactions.forEach(t => {
        if (userStats[t.user_id]) { // Перевіряємо, чи є цей user_id серед профілів, які ми можемо бачити
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


// Завантаження даних для денного графіка (для поточного користувача та друзів)
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


// Рендеринг денного графіка (без змін)
function renderDailyChart(labels, incomes, expenses) {
    if (dailyChartInstance) {
        dailyChartInstance.destroy();
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
                    borderColor: getComputedStyle(document.body).getPropertyValue('--success-green'),
                    backgroundColor: 'rgba(105, 240, 174, 0.2)',
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Витрати',
                    data: expenses,
                    borderColor: getComputedStyle(document.body).getPropertyValue('--danger-red'),
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
                        color: getComputedStyle(document.body).getPropertyValue('--text-light')
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
                        color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                    },
                    grid: {
                        color: getComputedStyle(document.body).getPropertyValue('--glass-border')
                    }
                },
                y: {
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                    },
                    grid: {
                        color: getComputedStyle(document.body).getPropertyValue('--glass-border')
                    }
                }
            }
        }
    });
}


// Завантаження нотаток (тепер також бачить нотатки друзів)
async function loadNotes() {
    notesList.innerHTML = '';
    const { data, error } = await sb
        .from('notes')
        .select('*') // RLS дозволить побачити нотатки друзів
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
                <input type="checkbox" ${note.is_completed ? 'checked' : ''} onchange="toggleNoteCompletion('${note.id}', this.checked, '${note.user_id}')">
                <button class="btn-icon" onclick="deleteNote('${note.id}', '${note.user_id}')"><img src="https://api.iconify.design/ic:round-delete.svg?color=%23e0e0e0" alt="Видалити"></button>
            </div>
        `;
        notesList.appendChild(li);
    });
}

// Додавання нотатки (без змін)
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

// Зміна статусу нотатки (тепер перевіряє, чи ви власник або друг, щоб дозволити зміну)
async function toggleNoteCompletion(noteId, isCompleted, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете змінювати статус лише своїх нотаток.'); // Або дозволити, якщо це спільний простір
        return;
    }
    const { error } = await sb
        .from('notes')
        .update({ is_completed: isCompleted })
        .eq('id', noteId)
        .eq('user_id', currentUserId); // RLS перевірить власника

    if (error) {
        console.error('Error updating note:', error.message);
    } else {
        await loadNotes();
    }
}

// Видалення нотатки (тепер перевіряє, чи ви власник)
async function deleteNote(noteId, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете видаляти лише свої нотатки.');
        return;
    }
    if (!confirm('Ви впевнені, що хочете видалити цю нотатку?')) return;

    const { error } = await sb
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', currentUserId); // RLS перевірить власника

    if (error) {
        console.error('Error deleting note:', error.message);
    } else {
        await loadNotes();
    }
}


// Завантаження завдань (тепер також бачить завдання друзів)
async function loadTasks() {
    tasksList.innerHTML = '';
    const { data, error } = await sb
        .from('tasks')
        .select('*') // RLS дозволить побачити завдання друзів
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
            <span>${task.description} (${getDisplayName(task.user_id)})</span>
            <div class="actions">
                <input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTaskCompletion('${task.id}', this.checked, '${task.user_id}')">
                <button class="btn-icon" onclick="deleteTask('${task.id}', '${task.user_id}')"><img src="https://api.iconify.design/ic:round-delete.svg?color=%23e0e0e0" alt="Видалити"></button>
            </div>
        `;
        tasksList.appendChild(li);
    });
}

// Додавання завдання (без змін)
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

// Зміна статусу завдання (перевіряє, чи ви власник)
async function toggleTaskCompletion(taskId, isCompleted, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете змінювати статус лише своїх завдань.');
        return;
    }
    const { error } = await sb
        .from('tasks')
        .update({ is_completed: isCompleted })
        .eq('id', taskId)
        .eq('user_id', currentUserId); // RLS перевірить власника

    if (error) {
        console.error('Error updating task:', error.message);
    } else {
        await loadTasks();
    }
}

// Видалення завдання (перевіряє, чи ви власник)
async function deleteTask(taskId, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете видаляти лише свої завдання.');
        return;
    }
    if (!confirm('Ви впевнені, що хочете видалити це завдання?')) return;

    const { error } = await sb
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', currentUserId); // RLS перевірить власника

    if (error) {
        console.error('Error deleting task:', error.message);
    } else {
        await loadTasks();
    }
}


// Завантаження та відображення транзакцій (тепер також бачить транзакції друзів)
async function loadTransactions() {
    transactionsTableBody.innerHTML = '';
    let query = sb.from('transactions').select('*'); // RLS дозволить побачити транзакції друзів

    // Фільтри
    const start = filterStartDate.value;
    const end = filterEndDate.value;
    const type = filterType.value;
    const category = filterCategory.value.trim();
    const search = searchTransactionsInput.value.trim().toLowerCase();

    if (start) query = query.gte('transaction_date', start);
    if (end) query = query.lte('transaction_date', end);
    if (type) query = query.eq('type', type);
    if (category) query = query.ilike('category', `%${category}%`);

    const { data: transactions, error } = await query.order('transaction_date', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error.message);
        return;
    }

    transactions.forEach(t => {
        if (search && !(t.description && t.description.toLowerCase().includes(search)) && !(t.category && t.category.toLowerCase().includes(search))) {
            return;
        }

        const tr = document.createElement('tr');
        const userName = getDisplayName(t.user_id);
        tr.innerHTML = `
            <td>${t.transaction_date}</td>
            <td class="${t.type === 'income' ? 'income-text' : 'expense-text'}">${t.type === 'income' ? 'Дохід' : 'Витрата'}</td>
            <td>${t.category}</td>
            <td>${t.description || ''}</td>
            <td class="${t.type === 'income' ? 'income-text' : 'expense-text'}">${t.amount.toFixed(2)}₴</td>
            <td>${userName}</td>
            <td>
                <button class="btn-icon" onclick="editTransaction('${t.id}', '${t.user_id}')"><img src="https://api.iconify.design/ic:round-edit.svg?color=%23e0e0e0" alt="Редагувати"></button>
                <button class="btn-icon" onclick="deleteTransaction('${t.id}', '${t.user_id}')"><img src="https://api.iconify.design/ic:round-delete.svg?color=%23e0e0e0" alt="Видалити"></button>
            </td>
        `;
        transactionsTableBody.appendChild(tr);
    });
}

// Додавання транзакції (без змін)
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
        newTransactionAmount.value = '';
        newTransactionCategory.value = '';
        newTransactionDescription.value = '';
        newTransactionDate.valueAsDate = new Date();
        await loadAllData();
    }
}

// Редагування транзакції (тепер перевіряє, чи ви власник)
async function editTransaction(transactionId, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете редагувати лише свої транзакції.');
        return;
    }
    alert(`Редагувати транзакцію з ID: ${transactionId} - ця функція потребує реалізації модального вікна.`);
}

// Видалення транзакції (тепер перевіряє, чи ви власник)
async function deleteTransaction(transactionId, ownerUserId) {
    if (ownerUserId !== currentUserId) {
        alert('Ви можете видаляти лише свої транзакції.');
        return;
    }
    if (!confirm('Ви впевнені, що хочете видалити цю транзакцію?')) return;

    const { error } = await sb
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', currentUserId); // RLS перевірить власника

    if (error) {
        console.error('Error deleting transaction:', error.message);
    } else {
        await loadAllData();
    }
}

// --- Функції для керування друзями (Placeholder) ---
// Ці функції потрібно буде реалізувати на сторінці "Налаштування" або окремому вікні
// для відправки та прийняття запитів на дружбу.
async function sendFriendRequest(targetEmail) {
    alert(`Надіслати запит на дружбу користувачу: ${targetEmail}`);
    // 1. Знайти user_id за targetEmail (з user_profiles)
    // 2. Створити запис у таблиці 'friendships' зі статусом 'pending'
}

async function acceptFriendRequest(friendshipId) {
    alert(`Прийняти запит на дружбу з ID: ${friendshipId}`);
    // Оновити статус у таблиці 'friendships' на 'accepted'
}


// --- Слухачі подій (без змін, окрім експорту функцій з ownerUserId) ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    handleAuthStateChange(null, session);
    sb.auth.onAuthStateChange(handleAuthStateChange);

    const today = new Date().toISOString().split('T')[0];
    filterEndDate.value = today;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
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

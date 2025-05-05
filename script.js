// Firebase config (replace with yours)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const firebaseConfig = window.FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const expenseCol = collection(db, "item");

let editingId = null;
let thisMonth = new Date().toISOString().slice(0, 7); // Get current month in YYYY-MM format

// Navigation logic
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Remove active class from all items
    document.querySelectorAll('.nav-item').forEach(navItem => {
      navItem.classList.remove('active');
    });
    
    // Add active class to clicked item
    this.classList.add('active');
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });
    
    // Show selected page
    const pageId = this.getAttribute('data-page');
    document.getElementById(pageId).style.display = 'block';
    
    // Load data if needed
    if (pageId === 'expense-history-page' || pageId === 'monthly-summary-page') {
      loadExpenses();
      loadLastFiveMonthExpenses();
    }
  });
});

// Handle Form Submit
document.getElementById("expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amountInput = document.getElementById("amount");
    const rawAmount = amountInput.value.trim();
    const validAmountRegex = /^\d+(\.\d{1,2})?$/;

    // Validate amount input
    if (!validAmountRegex.test(rawAmount)) {
        alert("Enter a valid amount (max two decimal places). E.g., 12, 12.5, 12.99");
        return;
    }

    const amount = parseFloat(rawAmount);
    const category = document.getElementById("category").value;
    let dateInput = document.getElementById("date").value;
    const date = dateInput || new Date().toISOString().split("T")[0];
    const note = document.getElementById("note").value;

    // Ensure all required fields are filled
    if (!amount || !category || !date) return alert("Fill all required fields");

    const submitBtn = document.querySelector("#expense-form button[type='submit']");
    
    // If we are in edit mode
    if (editingId) {
        const docRef = doc(db, "item", editingId);
        await updateDoc(docRef, { amount, category, date, note });
        editingId = null; // Reset the editingId after update
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
        submitBtn.classList.remove("btn-secondary");
        submitBtn.classList.add("btn-primary");
    } else {
        // If we are adding a new expense
        await addDoc(expenseCol, { amount, category, date, note });
    }

    e.target.reset(); // Reset the form fields after submission
    loadExpenses(); // Reload the expenses after adding/updating
});

// Load and Display
async function loadExpenses() {
    
    const q = query(expenseCol, where("date", ">=", `${thisMonth}-01`), where("date", "<", `${thisMonth}-31`), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tbody = document.getElementById("expense-table-body");
    const monthYear = document.getElementById("month-year");
    monthYear.innerText = `${thisMonth}`;
    tbody.innerHTML = ""; // Clear existing table rows

    expenses.forEach(exp => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${exp.date}</td>
            <td>£${exp.amount.toFixed(2)}</td>
            <td>${exp.category}</td>
            <td>${exp.note || "-"}</td>
            <td class="action-cell">
                <button class="edit-btn btn btn-warning btn-icon" data-id="${exp.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn btn btn-error btn-icon" data-id="${exp.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    attachRowHandlers(); // Attach edit/delete handlers
}

async function loadLastFiveMonthExpenses() {
    const today = new Date();
    const lastFiveMonthDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const q = query(expenseCol, where("date", ">=", `${lastFiveMonthDate.toISOString().slice(0, 7)}-01`), where("date", "<=", `${today.toISOString().slice(0, 10)}`), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const monthlyTotal = {};

    expenses.forEach(exp => {
        const month = exp.date.slice(0, 7);
        monthlyTotal[month] = (monthlyTotal[month] || 0) + exp.amount;
    });

    renderChart(monthlyTotal); // Update chart with new data
}

// Edit/Delete Handlers
function attachRowHandlers() {
    document.querySelectorAll(".edit-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const snapshot = await getDocs(query(expenseCol));
            const docData = snapshot.docs.find(d => d.id === id)?.data();
            if (docData) {
                // Fill the form with data from the clicked expense
                document.getElementById("amount").value = docData.amount;
                document.getElementById("category").value = docData.category;
                document.getElementById("note").value = docData.note || "";
                document.getElementById("date").value = docData.date;
                
                editingId = id; // Store the id for editing
                
                const submitBtn = document.querySelector("#expense-form button[type='submit']");
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';
                submitBtn.classList.remove("btn-primary");
                submitBtn.classList.add("btn-secondary");
                
                // Switch to add expense page
                document.querySelectorAll('.nav-item').forEach(navItem => {
                  navItem.classList.remove('active');
                });
                document.querySelector('.nav-item[data-page="add-expense-page"]').classList.add('active');
                document.querySelectorAll('.page').forEach(page => {
                  page.style.display = 'none';
                });
                document.getElementById('add-expense-page').style.display = 'block';
            }
        })
    );

    document.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            if (confirm("Are you sure you want to delete this expense?")) {
                await deleteDoc(doc(db, "item", id));
                loadExpenses(); // Reload expenses after delete
            }
        })
    );
}

// Chart.js logic
let chart;
function renderChart(data) {
    const labels = Object.keys(data).sort();
    const values = labels.map(label => data[label]);

    // Generate a color for each month based on the index
    const backgroundColors = labels.map((_, i) => 
        `hsl(${(i * 360 / labels.length)}, 70%, 60%)`
    );

    if (chart) chart.destroy(); // Destroy the previous chart if exists
    const ctx = document.getElementById("expense-chart").getContext("2d");

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Monthly Expenses",
                data: values,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('60%)', '40%)')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `£${context.raw.toFixed(2)}`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => `£${value.toFixed(2)}`,
                    font: {
                        weight: 'bold'
                    },
                    color: '#333'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '£' + value;
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Refresh button logic
document.getElementById("refresh-btn").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-btn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    await loadExpenses();
    btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
});
document.getElementById("previous-btn").addEventListener("click", async () => {
    thisMonth = shiftMonth(thisMonth, -1);
    await loadExpenses();
});
document.getElementById("next-btn").addEventListener("click", async () => {
    thisMonth = shiftMonth(thisMonth, 1);
    await loadExpenses();
});

function shiftMonth(ym, offset) {
    const [year, month] = ym.split("-").map(Number);
    const newDate = new Date(year, month + offset); // safe month shifting
    const newYM = newDate.toISOString().slice(0, 7);
    return newYM;
}

// Initial load (show add expense page by default)
document.getElementById('add-expense-page').style.display = 'block';
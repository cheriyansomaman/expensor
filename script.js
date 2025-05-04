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
    orderBy
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const firebaseConfig = window.FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const expenseCol = collection(db, "item");

let editingId = null;

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

    // If we are in edit mode
    if (editingId) {
        const docRef = doc(db, "item", editingId);
        await updateDoc(docRef, { amount, category, date, note });
        editingId = null; // Reset the editingId after update
        e.target.querySelector("button[type='submit']").textContent = "Add Expense"; // Reset button text to "Add Expense"
    } else {
        // If we are adding a new expense
        await addDoc(expenseCol, { amount, category, date, note });
    }

    e.target.reset(); // Reset the form fields after submission
    loadExpenses(); // Reload the expenses after adding/updating
});

// Load and Display
async function loadExpenses() {
    const q = query(expenseCol, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tbody = document.getElementById("expense-table-body");
    tbody.innerHTML = ""; // Clear existing table rows

    const monthlyTotal = {};

    expenses.forEach(exp => {
        const row = `
        <tr>
            <td class="p-2">${exp.date}</td>
            <td class="p-2">£${exp.amount.toFixed(2)}</td>
            <td class="p-2">${exp.category}</td>
            <td class="p-2">${exp.note || ""}</td>
            <td class="p-2">
                <div class="flex flex-col sm:flex-row gap-2">
                    <!-- Edit Button -->
                    <button class="edit-btn bg-yellow-400 p-2 rounded text-xs sm:text-sm flex items-center justify-center" data-id="${exp.id}">
                    <i class="fas fa-edit"></i>
                    </button>
                    
                    <!-- Delete Button -->
                    <button class="delete-btn bg-red-500 text-white p-2 rounded text-xs sm:text-sm flex items-center justify-center" data-id="${exp.id}">
                    <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
        tbody.innerHTML += row;

        const month = exp.date.slice(0, 7);
        monthlyTotal[month] = (monthlyTotal[month] || 0) + exp.amount;
    });

    attachRowHandlers(); // Attach edit/delete handlers
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
                document.getElementById("note").value = docData.note;
                editingId = id; // Store the id for editing
                document.querySelector("button[type='submit']").textContent = "Update Expense"; // Change button text to "Update Expense"
            }
        })
    );

    document.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            if (confirm("Delete this expense?")) {
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
                backgroundColor: backgroundColors // Apply dynamic color array
            }]
        },
        options: {
            plugins: {
                datalabels: {
                    // Display the total amount below each label
                    anchor: 'start', // Position the label below the bar
                    align: 'top', // Align the label to the top of the bar
                    formatter: (value, context) => `$${value.toFixed(2)}`,
                    font: {
                        weight: 'bold'
                    },
                    // Adjust the label positioning to be below the bars
                    offset: 5,
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Refresh button logic
document.getElementById("refresh-btn").addEventListener("click", async () => {
    loadExpenses();
});

loadExpenses();

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
    const amount = parseFloat(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const date = document.getElementById("date").value;
    const note = document.getElementById("note").value;

    if (!amount || !category || !date) return alert("Fill all required fields");

    if (editingId) {
        const docRef = doc(db, "item", editingId);
        await updateDoc(docRef, { amount, category, date, note });
        editingId = null;
        e.target.querySelector("button[type='submit']").textContent = "Add Expense";
    } else {
        await addDoc(expenseCol, { amount, category, date, note });
    }

    e.target.reset();
    loadExpenses();
});

// Load and Display
async function loadExpenses() {
    const q = query(expenseCol, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tbody = document.getElementById("expense-table-body");
    tbody.innerHTML = "";

    const monthlyTotal = {};

    expenses.forEach(exp => {
        const row = `
        <tr>
          <td class="p-2">${exp.date}</td>
          <td class="p-2">$${exp.amount.toFixed(2)}</td>
          <td class="p-2">${exp.category}</td>
          <td class="p-2">${exp.note || ""}</td>
          <td class="p-2 space-x-2">
            <button class="edit-btn bg-yellow-400 px-2 py-1 rounded text-sm" data-id="${exp.id}">Edit</button>
            <button class="delete-btn bg-red-500 text-white px-2 py-1 rounded text-sm" data-id="${exp.id}">Delete</button>
          </td>
        </tr>`;
        tbody.innerHTML += row;

        const month = exp.date.slice(0, 7);
        monthlyTotal[month] = (monthlyTotal[month] || 0) + exp.amount;
    });

    attachRowHandlers();
    renderChart(monthlyTotal);
}

// Edit/Delete Handlers
function attachRowHandlers() {
    document.querySelectorAll(".edit-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const snapshot = await getDocs(query(expenseCol));
            const docData = snapshot.docs.find(d => d.id === id)?.data();
            if (docData) {
                document.getElementById("amount").value = docData.amount;
                document.getElementById("category").value = docData.category;
                document.getElementById("date").value = docData.date;
                document.getElementById("note").value = docData.note;
                editingId = id;
                document.querySelector("button[type='submit']").textContent = "Update Expense";
            }
        })
    );

    document.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            if (confirm("Delete this expense?")) {
                await deleteDoc(doc(db, "item", id));
                loadExpenses();
            }
        })
    );
}

// Chart.js logic
let chart;
function renderChart(data) {
    const labels = Object.keys(data).sort();
    const values = labels.map(label => data[label]);

    if (chart) chart.destroy();
    const ctx = document.getElementById("expense-chart").getContext("2d");
    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Monthly Expenses",
                data: values,
                backgroundColor: "#3B82F6"
            }]
        }
    });
}

loadExpenses();

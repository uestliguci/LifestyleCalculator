import { indexedDBStorage } from './indexed-db-storage.js';

export function viewTransaction(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const oldContent = tr.innerHTML;
    window.editTransaction = editTransaction;
    window.deleteTransaction = deleteTransaction;
    const transaction = {
        date: tr.cells[0].textContent,
        time: tr.cells[1].textContent,
        type: tr.cells[2].textContent,
        category: tr.cells[3].textContent,
        amount: tr.cells[4].textContent,
        description: tr.cells[5].textContent
    };

    tr.innerHTML = `
        <td colspan="7">
            <div class="transaction-details">
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${transaction.date}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${transaction.time}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value transaction-type-${transaction.type.toLowerCase()}">${transaction.type}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">${transaction.category}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${transaction.amount}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${transaction.description}</span>
                </div>
                <div class="action-buttons">
                    <button type="button" class="btn-edit" onclick="editTransaction('${id}')">Edit</button>
                    <button type="button" class="btn-delete" onclick="deleteTransaction('${id}')">Delete</button>
                    <button type="button" class="btn-secondary" onclick="this.closest('tr').innerHTML = '${oldContent.replace(/'/g, "\\'")}')">Close</button>
                </div>
            </div>
        </td>
    `;
}

export async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            const result = await indexedDBStorage.deleteTransaction(id);
            if (result.success) {
                const tr = document.querySelector(`tr[data-id="${id}"]`);
                if (tr) tr.remove();
            } else {
                alert('Failed to delete transaction: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Failed to delete transaction');
        }
    }
}

export async function editTransaction(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const transaction = {
        date: tr.cells[0].textContent,
        time: tr.cells[1].textContent,
        type: tr.cells[2].textContent,
        category: tr.cells[3].textContent,
        amount: tr.cells[4].textContent.replace(/[^0-9.-]+/g, ''),
        description: tr.cells[5].textContent
    };

    const formHtml = `
        <td colspan="7">
            <form class="edit-transaction-form" onsubmit="return false;">
                <div class="form-group">
                    <label for="edit-date">Date:</label>
                    <input type="date" id="edit-date" value="${transaction.date}" required>
                </div>
                <div class="form-group">
                    <label for="edit-time">Time:</label>
                    <input type="time" id="edit-time" value="${transaction.time}" required>
                </div>
                <div class="form-group">
                    <label for="edit-type">Type:</label>
                    <select id="edit-type" required>
                        <option value="Income" ${transaction.type === 'Income' ? 'selected' : ''}>Income</option>
                        <option value="Expense" ${transaction.type === 'Expense' ? 'selected' : ''}>Expense</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-category">Category:</label>
                    <input type="text" id="edit-category" value="${transaction.category}" required>
                </div>
                <div class="form-group">
                    <label for="edit-amount">Amount:</label>
                    <input type="number" id="edit-amount" value="${transaction.amount}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="edit-description">Description:</label>
                    <input type="text" id="edit-description" value="${transaction.description}" required>
                </div>
                <div class="action-buttons">
                    <button type="button" class="btn-primary" onclick="saveEdit('${id}')">Save</button>
                    <button type="button" class="btn-secondary" onclick="this.closest('tr').innerHTML = '${tr.innerHTML.replace(/'/g, "\\'")}')">Cancel</button>
                </div>
            </form>
        </td>
    `;

    tr.innerHTML = formHtml;
}

export async function saveEdit(id) {
    const form = document.querySelector('.edit-transaction-form');
    if (!form) return;

    const updatedTransaction = {
        id: id,
        date: form.querySelector('#edit-date').value,
        time: form.querySelector('#edit-time').value,
        type: form.querySelector('#edit-type').value,
        category: form.querySelector('#edit-category').value,
        amount: parseFloat(form.querySelector('#edit-amount').value),
        description: form.querySelector('#edit-description').value
    };

    try {
        const result = await indexedDBStorage.updateTransaction(id, updatedTransaction);
        if (result.success) {
            location.reload(); // Refresh to show updated data
        } else {
            alert('Failed to update transaction: ' + result.message);
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        alert('Failed to update transaction');
    }
}

// Expose functions to window object
Object.assign(window, {
    viewTransaction,
    editTransaction,
    deleteTransaction,
    saveEdit
});

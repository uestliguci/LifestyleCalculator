export function viewTransaction(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const oldContent = tr.innerHTML;
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
                    <button type="button" class="btn-secondary" onclick="this.closest('tr').innerHTML = '${oldContent.replace(/'/g, "\\'")}')">Close</button>
                </div>
            </div>
        </td>
    `;
}

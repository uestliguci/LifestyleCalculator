import { localStorageManager } from './local-storage-manager.js';

/**
 * View transaction details
 */
export async function viewTransaction(id) {
    try {
        const transaction = await localStorageManager.getTransaction(id);
        if (!transaction) {
            console.error('Transaction not found:', id);
            return;
        }

        // Format date
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Format amount
        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'ALL',
            currencyDisplay: 'symbol'
        }).format(transaction.amount).replace('ALL', 'Lek');

        // Show transaction details
        const details = `
            <div class="transaction-details ios-style">
                <div class="detail-row">
                    <span class="label">Date & Time:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Transaction Type:</span>
                    <span class="value ${transaction.type.toLowerCase()}">${transaction.type}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Category:</span>
                    <span class="value category-tag">${transaction.category}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Amount:</span>
                    <span class="value amount-tag ${transaction.type.toLowerCase()}">${formattedAmount}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Description:</span>
                    <span class="value">${transaction.description || 'No description provided'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Transaction ID:</span>
                    <span class="value monospace">${transaction.id}</span>
                </div>
            </div>
        `;

        // Show in modal
        const modal = document.getElementById('add-transaction-modal');
        if (modal) {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="modal-header">
                        <h3>Transaction Details</h3>
                        <button class="btn-close" onclick="this.closest('.modal').style.display='none'">×</button>
                    </div>
                    ${details}
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal').style.display='none'">Close</button>
                    </div>
                `;
                modal.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Failed to view transaction:', error);
    }
}

import { postgresStorage } from './postgres-storage.js';

export async function exportToPDF() {
    // Create a temporary div to render the statement
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.background = 'white';
    container.style.padding = '20px';
    document.body.appendChild(container);

    try {
        const transactions = await postgresStorage.getAllTransactions();
        if (!transactions || transactions.length === 0) {
            alert('No transactions available for export');
            return;
        }

        // Sort transactions by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get statement period
        const startDate = new Date(transactions[0].date);
        const endDate = new Date(transactions[transactions.length - 1].date);
        
        // Format amounts with Lek currency
        const formatAmount = (amount) => `${amount.toFixed(2)} Lek`;

        // Calculate totals
        const totals = transactions.reduce((acc, t) => {
            const amount = parseFloat(t.amount);
            if (t.type.toLowerCase() === 'income') {
                acc.totalCredits += amount;
            } else {
                acc.totalDebits += amount;
            }
            return acc;
        }, { totalCredits: 0, totalDebits: 0 });

        // Generate statement HTML
        container.innerHTML = `
            <div style="font-family: Arial, sans-serif; color: #000;">
                <div style="background: #002B7F; color: white; padding: 40px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 36px; font-weight: bold;">LIFESTYLE BANK</div>
                    <div style="font-size: 28px;">Account Statement</div>
                </div>

                <div style="margin-bottom: 40px;">
                    <div style="display: flex; justify-content: space-between; line-height: 2;">
                        <span>Bank Information:</span>
                        <span>Statement Period:</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; line-height: 2;">
                        <span>Lifestyle Bank</span>
                        <span>${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; line-height: 2;">
                        <span>Branch: Main Office</span>
                        <span>Statement Number:</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; line-height: 2;">
                        <span>SWIFT: LIFEAL22</span>
                        <span>${Math.floor(Math.random() * 900000) + 100000}</span>
                    </div>
                </div>

                <div style="background: #f0f0f0; padding: 15px; margin-bottom: 40px;">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>Opening Balance</strong><br>
                            ${formatAmount(0)}
                        </div>
                        <div>
                            <strong>Total Credits</strong><br>
                            ${formatAmount(totals.totalCredits)}
                        </div>
                        <div>
                            <strong>Total Debits</strong><br>
                            ${formatAmount(totals.totalDebits)}
                        </div>
                        <div>
                            <strong>Closing Balance</strong><br>
                            ${formatAmount(totals.totalCredits - totals.totalDebits)}
                        </div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                    <thead>
                        <tr style="background: #002B7F; color: white;">
                            <th style="padding: 10px; text-align: left; font-weight: normal; width: 15%;">Date</th>
                            <th style="padding: 10px; text-align: left; font-weight: normal; width: 15%;">Type</th>
                            <th style="padding: 10px; text-align: left; font-weight: normal; width: 20%;">Category</th>
                            <th style="padding: 10px; text-align: right; font-weight: normal; width: 15%;">Amount</th>
                            <th style="padding: 10px; text-align: left; font-weight: normal; width: 35%;">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map((t, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'};">
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(t.date).toLocaleDateString()}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${t.type}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${t.category}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatAmount(parseFloat(t.amount))}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${t.description || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="color: #666; font-size: 12px; font-style: italic; border-top: 1px solid #ddd; padding-top: 20px;">
                    <p>This is an official bank statement from Lifestyle Bank. All amounts are in Albanian Lek (ALL).</p>
                    <p>For any discrepancies, please contact your branch within 15 days of statement generation.</p>
                    <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                        <span>Page 1 of 1</span>
                        <span>Generated: ${new Date().toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;

        // Convert to canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Convert canvas to PNG and force download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `bank-statement-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        document.body.removeChild(container);
    } catch (error) {
        console.error('Failed to generate statement:', error);
        alert('Failed to generate bank statement. Please try again.');
    }
}

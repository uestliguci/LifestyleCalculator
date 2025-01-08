import { storageManager } from './storage-manager.js';
import { jsPDF } from '../lib/jspdf.umd.min.js';
import '../lib/jspdf.plugin.autotable.js';

/**
 * Exports transaction data to a professionally formatted PDF document
 * Optimized for iOS display and printing
 */
export async function exportToPDF() {
    try {
        const transactions = await storageManager.getTransactions();
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

        // Create PDF document
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add header
        doc.setFillColor(0, 43, 127); // #002B7F
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text('LIFESTYLE BANK', 15, 25);
        doc.setFontSize(18);
        doc.text('Account Statement', 120, 25);

        // Add bank information
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        const bankInfo = [
            ['Bank Information:', 'Statement Period:'],
            ['Lifestyle Bank', `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`],
            ['Branch: Main Office', 'Statement Number:'],
            ['SWIFT: LIFEAL22', `${Math.floor(Math.random() * 900000) + 100000}`]
        ];

        doc.autoTable({
            startY: 45,
            head: [],
            body: bankInfo,
            theme: 'plain',
            styles: {
                fontSize: 10,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 90 }
            }
        });

        // Add summary
        const summaryData = [
            ['Opening Balance', 'Total Credits', 'Total Debits', 'Closing Balance'],
            [
                formatAmount(0),
                formatAmount(totals.totalCredits),
                formatAmount(totals.totalDebits),
                formatAmount(totals.totalCredits - totals.totalDebits)
            ]
        ];

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [],
            body: summaryData,
            theme: 'striped',
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            columnStyles: {
                0: { cellWidth: 47.5 },
                1: { cellWidth: 47.5 },
                2: { cellWidth: 47.5 },
                3: { cellWidth: 47.5 }
            }
        });

        // Add transactions
        const transactionData = transactions.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.type,
            t.category,
            formatAmount(parseFloat(t.amount)),
            t.description || ''
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Date', 'Type', 'Category', 'Amount', 'Description']],
            body: transactionData,
            theme: 'striped',
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 75 }
            },
            headStyles: {
                fillColor: [0, 43, 127],
                textColor: [255, 255, 255],
                fontSize: 10
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('This is an official bank statement from Lifestyle Bank. All amounts are in Albanian Lek (ALL).', 15, 280);
        doc.text('For any discrepancies, please contact your branch within 15 days of statement generation.', 15, 285);
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Page ${i} of ${pageCount}`, 15, 290);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 120, 290);
        }

        // Save PDF with iOS-friendly filename
        const filename = `bank-statement-${new Date().toISOString().split('T')[0]}.pdf`;
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            // For iOS devices, use a data URL to trigger download
            const pdfOutput = doc.output('datauristring');
            window.location.href = pdfOutput;
        } else {
            doc.save(filename);
        }
    } catch (error) {
        console.error('Failed to generate statement:', error);
        alert('Failed to generate bank statement. Please try again.');
    }
}

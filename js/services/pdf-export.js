import { indexedDBStorage } from './indexed-db-storage.js';

export class PDFExportService {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF;
    }

    async generateBankStatement() {
        try {
            const doc = new this.jsPDF();
            const transactions = await indexedDBStorage.getAllTransactions();
            
            // Add header
            this.addHeader(doc);
            
            // Add statement summary
            this.addSummary(doc, transactions);
            
            // Add transactions table
            this.addTransactionsTable(doc, transactions);
            
            // Add footer
            this.addFooter(doc);
            
            // Save the PDF
            doc.save('bank-statement.pdf');
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }

    addHeader(doc) {
        // Add logo placeholder (could be replaced with actual logo)
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Lifestyle Calculator', 20, 20);

        // Add statement details
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text('Statement Date: ' + currentDate, 20, 30);
        
        // Add divider line
        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);
    }

    addSummary(doc, transactions) {
        let totalIncome = 0;
        let totalExpenses = 0;

        transactions.forEach(transaction => {
            if (transaction.type.toLowerCase() === 'income') {
                totalIncome += parseFloat(transaction.amount);
            } else {
                totalExpenses += parseFloat(transaction.amount);
            }
        });

        const balance = totalIncome - totalExpenses;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Summary', 20, 45);
        
        doc.setFont('helvetica', 'normal');
        doc.text('Total Income: ' + totalIncome.toFixed(2), 30, 55);
        doc.text('Total Expenses: ' + totalExpenses.toFixed(2), 30, 62);
        doc.text('Current Balance: ' + balance.toFixed(2), 30, 69);

        // Add another divider
        doc.line(20, 75, 190, 75);
    }

    addTransactionsTable(doc, transactions) {
        // Prepare table data
        const tableData = transactions.map(t => [
            t.date,
            t.time,
            t.type,
            t.category,
            t.amount.toFixed(2),
            t.currency,
            t.description
        ]);

        // Define table headers
        const headers = [
            ['Date', 'Time', 'Type', 'Category', 'Amount', 'Currency', 'Description']
        ];

        // Add table using autoTable plugin
        doc.autoTable({
            startY: 80,
            head: headers,
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 10,
                cellPadding: 5,
                overflow: 'linebreak',
                halign: 'left'
            },
            headStyles: {
                fillColor: [0, 122, 255],
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                4: { halign: 'right' } // Align amount to right
            }
        });
    }

    addFooter(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Add page number
            doc.setFontSize(10);
            doc.text('Page ' + i + ' of ' + pageCount, 20, doc.internal.pageSize.height - 10);
            
            // Add timestamp
            const timestamp = new Date().toLocaleString();
            doc.text('Generated on: ' + timestamp, 100, doc.internal.pageSize.height - 10);
        }
    }
}

// Initialize and export instance
export const pdfExport = new PDFExportService();

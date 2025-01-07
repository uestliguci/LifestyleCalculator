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
        // Add iOS-style header with logo
        doc.setFillColor(0, 122, 255); // iOS blue
        doc.rect(0, 0, doc.internal.pageSize.width, 60, 'F');
        
        // Add white text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Lifestyle Calculator', 20, 30);

        // Add statement details
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text('Statement Date: ' + currentDate, 20, 45);
        
        // Reset text color for rest of document
        doc.setTextColor(0, 0, 0);
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

        // Add summary cards in iOS style
        const startY = 80;
        const cardWidth = 50;
        const margin = 20;

        // Income Card
        doc.setFillColor(52, 199, 89); // iOS green
        doc.roundedRect(margin, startY, cardWidth, 40, 5, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('Income', margin + 5, startY + 15);
        doc.setFontSize(12);
        doc.text(totalIncome.toFixed(2), margin + 5, startY + 30);

        // Expenses Card
        doc.setFillColor(255, 59, 48); // iOS red
        doc.roundedRect(margin + cardWidth + 10, startY, cardWidth, 40, 5, 5, 'F');
        doc.text('Expenses', margin + cardWidth + 15, startY + 15);
        doc.text(totalExpenses.toFixed(2), margin + cardWidth + 15, startY + 30);

        // Balance Card
        doc.setFillColor(0, 122, 255); // iOS blue
        doc.roundedRect(margin + (cardWidth + 10) * 2, startY, cardWidth, 40, 5, 5, 'F');
        doc.text('Balance', margin + (cardWidth + 10) * 2 + 5, startY + 15);
        doc.text(balance.toFixed(2), margin + (cardWidth + 10) * 2 + 5, startY + 30);

        // Reset text color
        doc.setTextColor(0, 0, 0);
    }

    addTransactionsTable(doc, transactions) {
        // Prepare table data
        const tableData = transactions.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.type,
            t.category,
            t.amount.toFixed(2),
            t.description
        ]);

        // Define table headers
        const headers = [
            ['Date', 'Type', 'Category', 'Amount', 'Description']
        ];

        // Add table using autoTable plugin with iOS styling
        doc.autoTable({
            startY: 140,
            head: headers,
            body: tableData,
            theme: 'plain',
            styles: {
                fontSize: 10,
                cellPadding: 8,
                overflow: 'linebreak',
                halign: 'left',
                font: 'helvetica'
            },
            headStyles: {
                fillColor: [247, 247, 247], // iOS light gray
                textColor: [142, 142, 147], // iOS secondary text
                fontSize: 10,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 'auto' }
            },
            didParseCell: function(data) {
                // Add iOS-style cell styling
                if (data.row.index === -1) return; // Skip header
                
                const type = tableData[data.row.index][1];
                if (data.column.index === 3) { // Amount column
                    data.cell.styles.textColor = type.toLowerCase() === 'income' ? 
                        [52, 199, 89] : // iOS green
                        [255, 59, 48];  // iOS red
                }
            },
            didDrawCell: function(data) {
                // Add subtle border
                if (data.row.index === -1) return; // Skip header
                
                const x = data.cell.x;
                const y = data.cell.y;
                const w = data.cell.width;
                const h = data.cell.height;
                
                doc.setDrawColor(229, 229, 234); // iOS separator color
                doc.setLineWidth(0.1);
                doc.line(x, y + h, x + w, y + h);
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

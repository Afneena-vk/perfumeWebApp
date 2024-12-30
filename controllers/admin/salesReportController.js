const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema")

const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")



const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');

const renderSalesReport = (req, res) => {
    res.render('sales-report'); 
};



const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        console.log("Received params:", { reportType, startDate, endDate });

        let dateFilter = {};

        switch (reportType) {
            case 'daily':
                dateFilter = {
                    date: {
                        $gte: moment().startOf('day').toDate(),
                        $lte: moment().endOf('day').toDate()
                    }
                };
                break;
            case 'weekly':
                dateFilter = {
                    date: {
                        $gte: moment().startOf('week').toDate(),
                        $lte: moment().endOf('week').toDate()
                    }
                };
                break;
            case 'yearly':
                dateFilter = {
                    date: {
                        $gte: moment().startOf('year').toDate(),
                        $lte: moment().endOf('year').toDate()
                    }
                };
                break;
            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ message: 'Start date and end date are required for custom range' });
                }
                dateFilter = {
                    date: {
                        $gte: moment(startDate).startOf('day').toDate(),
                        $lte: moment(endDate).endOf('day').toDate()
                    }
                };
                break;
            default:
                return res.status(400).json({ message: 'Invalid report type' });
        }

        
        const orders = await Order.find(dateFilter).populate('orderedItems.product');

       
        const deliveredItems = [];
        let totalSales = 0;
        let totalDiscount = 0;

        

        for (const order of orders) {
            for (const item of order.orderedItems) {
                if (item.status === 'Delivered') {
                    const product = item.product; 
                    const discount = product.regularPrice - item.finalPrice; 

                    deliveredItems.push({
                        orderId: order.orderId,
                        date: order.date,
                        finalAmount: item.finalPrice * item.quantity, 
                        discount: discount * item.quantity 
                    });

                    totalSales += item.finalPrice * item.quantity; 
                    totalDiscount += discount * item.quantity; 
                }
            }
        }


        const totalOrders = deliveredItems.length;

        req.session.reportData = {
            orders: deliveredItems,
            totalOrders,
            totalSales,
            totalDiscount
        };

        res.json({
            totalOrders,
            totalSales,
            totalDiscount,
            orders: req.session.reportData.orders
        });

    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
};

const generateAndDownloadPDF = async (req, res) => {
    try {
        if (!req.session.reportData) {
            return res.status(400).json({ message: 'No report data available. Please generate a report first.' });
        }

        const { orders, totalOrders, totalSales, totalDiscount } = req.session.reportData;
        const doc = new PDFDocument();
        const fileName = 'sales-report.pdf';

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, { align: 'center' });
        doc.moveDown();

    
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(12);
        doc.text(`Total Orders: ${totalOrders}`);
        doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
        doc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
        doc.moveDown();

        const tableTop = doc.y + 20;
        const columnSpacing = 150;
        
        doc.font('Helvetica-Bold');
        doc.text('Order ID', 50, tableTop);
        doc.text('Date', 200, tableTop);
        doc.text('Amount', 350, tableTop);
        doc.text('Discount', 500, tableTop);

        let yPosition = tableTop + 20;
        doc.font('Helvetica');

        orders.forEach(order => {
            if (yPosition > 700) { 
                doc.addPage();
                yPosition = 50;
            }

            doc.text(order.orderId, 50, yPosition);
            doc.text(moment(order.date).format('DD/MM/YYYY'), 200, yPosition);
            doc.text(`₹${order.finalAmount.toFixed(2)}`, 350, yPosition);
            doc.text(`₹${order.discount.toFixed(2)}`, 500, yPosition);

            yPosition += 20;
        });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Error generating PDF' });
    }
};

const generateAndDownloadExcel = async (req, res) => {
    try {
        if (!req.session.reportData) {
            return res.status(400).json({ message: 'No report data available. Please generate a report first.' });
        }

        const { orders, totalOrders, totalSales, totalDiscount } = req.session.reportData;
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.mergeCells('A1:D1');
        worksheet.getCell('A1').value = 'Sales Report';
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
        worksheet.getCell('A1').font = { bold: true, size: 16 };

        worksheet.addRow([]);
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders', totalOrders]);
        worksheet.addRow(['Total Sales', `₹${totalSales.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `₹${totalDiscount.toFixed(2)}`]);
        worksheet.addRow([]);

        worksheet.addRow(['Order ID', 'Date', 'Total Amount', 'Discount']);
        worksheet.getRow(7).font = { bold: true };

        orders.forEach(order => {
            worksheet.addRow([
                order.orderId,
                moment(order.date).format('DD/MM/YYYY'),
                `₹${order.finalAmount.toFixed(2)}`,
                `₹${order.discount.toFixed(2)}`
            ]);
        });

        worksheet.columns.forEach(column => {
            column.width = 20;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ message: 'Error generating Excel' });
    }
};


  
  module.exports = {
    renderSalesReport,
    generateSalesReport,
    generateAndDownloadPDF,
    generateAndDownloadExcel,
  };
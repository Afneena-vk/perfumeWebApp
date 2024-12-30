const mongoose = require('mongoose');
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");


const getOrderManagementPage = async (req, res) => {
    try {

        const perPage = 10; 
        const page = parseInt(req.query.page) || 1;

        const totalOrders = await Order.countDocuments();

        const totalPages = Math.ceil(totalOrders / perPage);

        const orders = await Order.find({})
        .select('orderId userId orderedItems finalAmount payment createdAt status')
        .populate('userId', 'name email') 
        .populate('orderedItems.product', 'productName salePrice') 
        .skip((page - 1) * perPage) 
        .limit(perPage);
      

        res.render('order-management', 
            {   orders,
                totalPages, 
                currentPage: page 

            });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).send('Internal Server Error');
    }
}; 



const getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate("userId", "name")
            .populate("orderedItems.product", "productName");
        
        console.log("order is: ",order);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("orderDetails", { order });
    } catch (err) {
        console.error(err);
       
       res.redirect("/pageerror");
    }
};




const checkAllItemsCancelledOrReturned = (orderedItems) => {
    if (!orderedItems || orderedItems.length === 0) return false;
    
    return orderedItems.every(item => 
        item.status === 'Cancelled' || item.status === 'Returned'
    ) && orderedItems.some(item => 
        item.status === 'Cancelled'
    ) && orderedItems.some(item => 
        item.status === 'Returned'
    );
};


const updatePaymentStatus = async (order) => {
    const allItemsCancelled = order.orderedItems.every(item => item.status === 'Cancelled');
    const allItemsReturned = order.orderedItems.every(item => item.status === 'Returned');
    const mixedCancelledAndReturned = checkAllItemsCancelledOrReturned(order.orderedItems);

    if ((allItemsCancelled || allItemsReturned || mixedCancelledAndReturned) &&
        order.payment && 
        order.payment.length > 0 && 
        (order.payment[0].method === "Online Payment" || order.payment[0].method === "Wallet Payment")) {
        order.payment[0].status = 'Refunded';
    }
};


const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params; // Get both orderId and itemId from params
        const { status } = req.body; 

        console.log('Order ID:', orderId);
        console.log('Item ID:', itemId);
        console.log('Status:', status);

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', "Return Requested", "Return Approved", "Return Rejected", 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send('Invalid status value');
        }

        
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }

     
        item.status = status;

      
        
        if (status === 'Returned') {
       
            const refundAmount = item.finalPrice * item.quantity;


            let wallet = await Wallet.findOne({ userId: order.userId });

            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                });
            }

            wallet.balance += refundAmount;


            wallet.transactions.push({
                type: 'CREDIT',
                amount: refundAmount,
                description: `Refund for item ${item.product} in order ${orderId}`,
                orderId: order._id,
                date: new Date()
            });

            await wallet.save();

            
            const product = await Product.findById(item.product);
            if (product) {
                const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].quantity += item.quantity;
                }
                await product.save();
            }

            const allItemsReturned = order.orderedItems.every(item => item.status === 'Returned');
            if (allItemsReturned && order.payment && order.payment.length > 0) {
                order.payment[0].status = 'Refunded';
            }



        } else if (status === 'Delivered') {
            if (order.payment && order.payment.length > 0) {
                order.payment[0].status = 'completed';
            }
        }


        
        await updatePaymentStatus(order);
        await order.save();

        
        res.status(200).json({ 
            success: true, 
            message: 'Status updated successfully'
        });

    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).send('Internal Server Error');
    }
};



module.exports = {
    getOrderManagementPage,
    getOrderDetails,
  
    updateItemStatus,
   
};

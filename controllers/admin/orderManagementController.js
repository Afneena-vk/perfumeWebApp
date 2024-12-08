const mongoose = require('mongoose');
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");

const getOrderManagementPage = async (req, res) => {
    try {

        const perPage = 10; 
        const page = parseInt(req.query.page) || 1;

        const totalOrders = await Order.countDocuments();

        const totalPages = Math.ceil(totalOrders / perPage);

        const orders = await Order.find({})
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
        
        // const order = await Order.findById(req.params.orderId)
        // .populate("userId", "name")
        // .populate({
        //     path: "orderedItems.product",
        //     select: "productName productImage" 
        // });

        console.log("order is: ",order);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("orderDetails", { order });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};


const updateStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body; 

        console.log('Order ID:', orderId);
        console.log('Status:', status);

       
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send('Invalid status value');
        }

        
        const order = await Order.findOneAndUpdate(
            { orderId }, 
            { status }, 
            { new: true } 
        );

        console.log("the order is:::",order);
        if (!order) {
            return res.status(404).send('Order not found');
        }

    
        res.redirect('/admin/order');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Internal Server Error');
    }
    
};


module.exports = {
    getOrderManagementPage,
    getOrderDetails,
    updateStatus,
   
};

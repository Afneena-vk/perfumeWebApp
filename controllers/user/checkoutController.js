const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");



const getCheckoutPage = async (req, res) => {
    const userSession = req.session.user || req.user;
    if (!userSession) {
        return res.redirect('/login');
    }
   
    try {
        
        const userAddresses = await Address.findOne({ userId: userSession._id });
        
        const addresses = userAddresses ? userAddresses.address : []; 

        const cart = await Cart.findOne({ userId: userSession._id }).populate('items.productId');
        
        const cartItems = cart ? cart.items : []; 

        const userData = await User.findOne({ _id: userSession._id  });
        
        res.locals.user = userData;

        console.log("user data is providing:::",userData);

        res.render('checkout', {  addresses, cartItems });

    } catch (error) {
        console.error('Error in getCheckoutPage:', error);
        res.status(500).send('Server Error');
    }
};



module.exports = {
   getCheckoutPage,
};
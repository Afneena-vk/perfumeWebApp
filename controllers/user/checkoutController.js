const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");

const getCheckoutPage = async (req, res) => {
    const userSession = req.session.user || req.user;
    if (!userSession) {
        return res.redirect('/login');
    }
   
    try {
        const userAddresses = await Address.findOne({ userId: userSession._id });
        const addresses = userAddresses ? userAddresses.address : [];

        const cart = await Cart.findOne({ userId: userSession._id }).populate('items.productId');
        const cartItems = cart ? cart.items.map(item => {
            const product = item.productId;
            const selectedSize = product.sizes.find(size => size.size === item.size);

            const regularPrice = product.regularPrice * item.quantity;
            const salesPrice = product.salePrice * item.quantity;
            const discount = regularPrice - salesPrice;

            return {
                ...item.toObject(),
                product,
                regularPrice,
                salesPrice,
                discount,
                size: item.size,
            };
        }) : [];

        const userData = await User.findOne({ _id: userSession._id });
        const coupons = await Coupon.find({ status: "Active" });
         
        res.locals.user = userData;
        res.render('checkout', { addresses, cartItems , coupons, userData});

    } catch (error) {
        console.error('Error in getCheckoutPage:', error);
        res.status(500).send('Server Error');
    }
};


const applyCoupon = async (req, res) => {
    const { couponId } = req.body;
    console.log("coupon id is", couponId);
    const userSession = req.session.user || req.user;

    try {
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            console.error('Coupon not found:', couponId);
            return res.status(400).json({ message: 'Coupon not found.' });
        }

        if (coupon.status !== 'Active') {
            console.error('Coupon is not active:', coupon);
            return res.status(400).json({ message: 'Invalid or inactive coupon.' });
        }

        const cart = await Cart.findOne({ userId: userSession._id }).populate('items.productId');
        if (!cart) {
            console.error('Cart not found for user:', userSession._id);
            return res.status(400).json({ message: 'Cart not found.' });
        }

        const totalPrice = cart.items.reduce((total, item) => {
            const product = item.productId;
            if (product && product.salePrice) {
                return total + (product.salePrice * item.quantity);
            } else {
                console.error('Product not found or salePrice is missing for item:', item);
                return total;
            }
        }, 0);

        console.log('Total price before discount:', totalPrice);

        if (totalPrice < coupon.minPurchaseAmount) {
            console.error('Minimum purchase amount not met. Required:', coupon.minPurchaseAmount, 'Actual:', totalPrice);
            return res.status(400).json({ message: 'Minimum purchase amount not met.' });
        }

        let discount = 0;

        
        if (coupon.discountType === 'fixed') {
            discount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
            discount = (totalPrice * coupon.discountValue) / 100; 
        }

        discount = Math.min(discount, totalPrice);
        const finalTotal = totalPrice - discount;
        const adjustedFinalTotal = finalTotal < 0 ? 0 : finalTotal;

        req.session.couponId = couponId;

        return res.json({ finalTotal: adjustedFinalTotal, discount, couponId });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const removeCoupon = async (req, res) => {
    const userSession = req.session.user || req.user;

    try {
        
        const cart = await Cart.findOne({ userId: userSession._id }).populate('items.productId');
        
        if (!cart) {
            return res.status(400).json({ message: 'Cart not found.' });
        }

        req.session.couponId = null;
        const totalPrice = cart.items.reduce((total, item) => {
            const product = item.productId;
            if (product && product.salePrice) {
                return total + (product.salePrice * item.quantity);
            }
            return total;
        }, 0);

        return res.json({ 
            finalTotal: totalPrice, 
            message: 'Coupon removed successfully.'
        });

    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({ message: 'Server error while removing coupon.' });
    }
};

module.exports = {
   getCheckoutPage,
   applyCoupon,
   removeCoupon,
   
};
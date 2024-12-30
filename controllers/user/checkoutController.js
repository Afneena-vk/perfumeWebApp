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

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart'); 
        }

        
        const cartItems = cart.items.map(item => {
            const product = item.productId;
            
           
            const regularPrice = product.regularPrice * item.quantity;
            const salesPrice = product.salePrice * item.quantity;
            const baseDiscount = regularPrice - salesPrice;

            return {
                ...item.toObject(),
                product,
                regularPrice,
                salesPrice,
                discount: baseDiscount, 
                size: item.size,
            };
        });

        const userData = await User.findOne({ _id: userSession._id });
        const coupons = await Coupon.find({ status: "Active" });
         
        
        const subtotal = cartItems.reduce((sum, item) => sum + item.salesPrice, 0);
        const totalDiscount = cartItems.reduce((sum, item) => sum + item.discount, 0);

        res.locals.user = userData;
        res.render('checkout', { 
            addresses, 
            cartItems, 
            coupons, 
            userData,
            subtotal,
            totalDiscount,
            appliedCouponId: req.session.couponId || null
        });

    } catch (error) {
        console.error('Error in getCheckoutPage:', error);
        res.status(500).send('Server Error');
    }
};




const applyCoupon = async (req, res) => {
    const { couponId } = req.body;
    const userSession = req.session.user || req.user;

    try {
        
        if (req.session.couponId && req.session.couponId === couponId) {
            return res.status(400).json({ 
                message: 'This coupon is already applied.',
                success: false 
            });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon || coupon.status !== 'Active') {
            return res.status(400).json({ 
                message: 'Invalid or inactive coupon.',
                success: false 
            });
        }

        const cart = await Cart.findOne({ userId: userSession._id })
            .populate('items.productId');
            
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({ 
                message: 'Cart is empty or not found.',
                success: false 
            });
        }

        
        const cartTotal = cart.items.reduce((total, item) => {
            return total + (item.productId.salePrice * item.quantity);
        }, 0);

        if (cartTotal < coupon.minPurchaseAmount) {
            return res.status(400).json({ 
                message: `Minimum purchase amount of Rs. ${coupon.minPurchaseAmount} required.`,
                success: false 
            });
        }

       
        let couponDiscount = 0;
        if (coupon.discountType === 'fixed') {
            couponDiscount = Math.min(coupon.discountValue, cartTotal);
        } else {
            couponDiscount = Math.min((cartTotal * coupon.discountValue) / 100, cartTotal);
        }

        
        const baseDiscount = cart.items.reduce((total, item) => {
            return total + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity);
        }, 0);

        const finalTotal = Math.max(0, cartTotal - couponDiscount);

        
        req.session.couponId = null;
        
        req.session.couponId = couponId;
        
        return res.json({ 
            success: true,
            finalTotal,
            baseDiscount,
            couponDiscount,
            originalTotal: cartTotal,
            couponApplied: true
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ 
            message: 'Server error',
            success: false 
        });
    }
};

const removeCoupon = async (req, res) => {
    const userSession = req.session.user || req.user;

    try {
        
        if (!req.session.couponId) {
            return res.status(400).json({ 
                message: 'No coupon is currently applied.',
                success: false 
            });
        }

        const cart = await Cart.findOne({ userId: userSession._id })
            .populate('items.productId');
        
        if (!cart) {
            return res.status(400).json({ 
                message: 'Cart not found.',
                success: false 
            });
        }

        
        const totalPrice = cart.items.reduce((total, item) => {
            return total + (item.productId.salePrice * item.quantity);
        }, 0);

        const baseDiscount = cart.items.reduce((total, item) => {
            return total + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity);
        }, 0);

        
        req.session.couponId = null;
        await req.session.save();

        return res.json({ 
            success: true,
            finalTotal: totalPrice,
            baseDiscount: baseDiscount,
            couponDiscount: 0,
            couponApplied: false,
            message: 'Coupon removed successfully.'
        });

    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({ 
            message: 'Server error while removing coupon.',
            success: false 
        });
    }
};


const checkCouponStatus = async (req, res) => {
    const userSession = req.session.user || req.user;
    
    try {
        if (!req.session.couponId) {
            return res.json({
                couponApplied: false,
                success: true
            });
        }

        const cart = await Cart.findOne({ userId: userSession._id })
            .populate('items.productId');

        const totalPrice = cart.items.reduce((total, item) => {
            return total + (item.productId.salePrice * item.quantity);
        }, 0);

        return res.json({
            couponApplied: true,
            success: true,
            finalTotal: totalPrice
        });

    } catch (error) {
        console.error('Error checking coupon status:', error);
        return res.status(500).json({ 
            message: 'Error checking coupon status',
            success: false 
        });
    }
};




module.exports = {
   getCheckoutPage,
   applyCoupon,
   removeCoupon,
   checkCouponStatus,
   
};
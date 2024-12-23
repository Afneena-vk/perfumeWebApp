const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");

const getCart = async (req, res) => {
    try {
        const userSession = req.session?.user || req.user;

        if (!userSession || !userSession._id) {
            return res.status(401).send('Unauthorized: No user session found');
        }

        
        const cart = await Cart.findOne({ userId: userSession._id })
            .populate('items.productId', 'productName productImage salePrice sizes isBlocked isDeleted status')
            .lean();

        const user = await User.findById(userSession._id).lean();

        if (!user) {
            return res.status(404).send('User not found');
        }

        if (!cart || cart.items.length === 0) {
            return res.render('cart', {
                cartItems: [],
                cartTotalPrice: 0,
                subtotal: 0,
                user,
            });
        }

        
        const cartItems = cart.items
            .filter(item => {
                const product = item.productId;
                const sizeDetails = product.sizes.find(size => size.size === item.size);
                return (
                    product &&
                    !product.isDeleted &&
                    !product.isBlocked &&
                    product.status === 'Available' &&
                    sizeDetails &&
                    sizeDetails.quantity > 0 
                );
            })
            .map(item => {
                const product = item.productId;
                const sizeDetails = product.sizes.find(size => size.size === item.size);

                return {
                    name: product.productName,
                    price: product.salePrice,
                    image: product.productImage[0], 
                    size: item.size, 
                    quantity: item.quantity,
                    availableQuantity: sizeDetails.quantity, 
                    totalPrice: item.quantity * product.salePrice,
                    productId: product._id,
                };
            });

        const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

        res.render('cart', {
            cartItems,
            cartTotalPrice: subtotal,
            subtotal,
            user,
        });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
};



const addToCart = async (req, res) => {
    try {
        const userSession = req.session?.user || req.user;
        
        if (!userSession) {
            return res.status(401).json({ message: "Please login to add items to cart" });
        }
        
        const { productId, selectedSize, quantity } = req.body;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        
        const sizeData = product.sizes.find(size => size.size === selectedSize);
        
        if (!sizeData) {
            return res.status(400).json({ message: "Please select a size" });
        }
        
        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: "Please select a valid quantity" });
        }
        
        if (sizeData.quantity < quantity) {
            return res.status(400).json({
                message: `Only ${sizeData.quantity} items available in stock`
            });
        }

        const totalPrice = product.salePrice * quantity;
        const cart = await Cart.findOne({ userId: userSession._id });
        
        const existingItem = cart?.items.find(item =>
            item.productId.toString() === productId && item.size === selectedSize
        );

        if (existingItem) {
            return res.status(400).json({ message: "This product with the selected size is already in the cart" });
        }

        
        await Wishlist.updateOne(
            { userId: userSession._id },
            { 
                $pull: { 
                    products: {
                        productId: productId,
                       
                    }
                } 
            }
        );

        const cartItem = {
            productId,
            size: selectedSize,
            quantity,
            price: product.salePrice,
            totalPrice,
        };

        if (cart) {
            await Cart.updateOne(
                { userId: userSession._id },
                { $push: { items: cartItem } }
            );
        } else {
            const newCart = new Cart({
                userId: userSession._id,
                items: [cartItem],
            });
            await newCart.save();
        }

        return res.status(200).json({ 
            message: "Product added to cart successfully and removed from wishlist if it existed" 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred while adding to cart" });
    }
};


const removeFromCart = async (req, res) => {
    const { productId, size } = req.query;  
    const userSession = req.session.user || req.user;  
    const userId = userSession._id;  

    if (!productId || !size || !userId) {
        return res.status(400).send('Invalid request');  
    }

    try {
      
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).send('Cart not found');  
        }

        
        const updateResult = await Cart.updateOne(
            { userId },
            { $pull: { items: { productId, size } } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).send('Item not found in cart');
        }

        
        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');  
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const userSession = req.session?.user || req.user;

        if (!userSession) {
            return res.status(401).json({ message: "Please login to update cart items" });
        }

        const { productId, selectedSize, quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1" });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const sizeData = product.sizes.find(size => size.size === selectedSize);

        if (!sizeData) {
            return res.status(400).json({ message: "Invalid size selected" });
        }

        if (sizeData.quantity < quantity) {
            return res.status(400).json({
                message: `Only ${sizeData.quantity} items available in stock`,
            });
        }

      
        const cart = await Cart.findOne({ userId: userSession._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const cartItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId && item.size === selectedSize
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({ message: "Item not found in cart" });
        }

        cart.items[cartItemIndex].quantity = quantity;
        cart.items[cartItemIndex].totalPrice = product.salePrice * quantity;

        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        const total = subtotal ;

        console.log("sub total is...",subtotal);
        console.log(" total is...",total);

        await cart.save();

      

        return res.status(200).json({
            message: "Cart updated successfully",
            cart: {
                items: cart.items.map(item => ({
                    productId: item.productId.toString(),
                    size: item.size,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                })),
                subtotal,
                total,
            },
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred while updating cart" });
    }
};

const validateCartStock = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'productName sizes isBlocked'
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                valid: false,
                message: 'Cart is empty'
            });
        }

        const invalidItems = [];

        
        for (const cartItem of cart.items) {
            const product = cartItem.productId;
            
            
            if (product.isBlocked) {
                invalidItems.push({
                    name: product.productName,
                    size: cartItem.size,
                    cartQuantity: cartItem.quantity,
                    availableStock: 0,
                    reason: 'Product is no longer available'
                });
                continue;
            }

            
            const sizeInfo = product.sizes.find(s => s.size === cartItem.size);
            
            if (!sizeInfo || sizeInfo.quantity < cartItem.quantity) {
                invalidItems.push({
                    name: product.productName,
                    size: cartItem.size,
                    cartQuantity: cartItem.quantity,
                    availableStock: sizeInfo ? sizeInfo.quantity : 0
                });
            }
        }

        if (invalidItems.length > 0) {
            return res.status(400).json({
                valid: false,
                invalidItems: invalidItems,
                message: 'Some items have insufficient stock'
            });
        }

        return res.json({
            valid: true,
            message: 'All items are in stock'
        });

    } catch (error) {
        console.error('Error validating cart stock:', error);
        return res.status(500).json({
            valid: false,
            message: 'Error validating cart stock'
        });
    }
};



module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    validateCartStock,
}
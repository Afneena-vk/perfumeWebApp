const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const getCart = async (req, res) => {
    try {
       
        const userSession = req.session?.user || req.user;

        if (!userSession || !userSession._id) {
            return res.status(401).send('Unauthorized: No user session found');
        }

       
        const cart = await Cart.findOne({ userId: userSession._id })
            .populate('items.productId', 'productName productImage salePrice isBlocked isDeleted status') // Populate necessary fields from Product schema
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
            .filter(item => !item.productId.isDeleted && !item.productId.isBlocked && item.productId.status === 'Available') // Only include valid products
            .map(item => ({
                name: item.productId.productName,
                price: item.productId.salePrice,
                image: item.productId.productImage[0], // Assuming the first image is displayed
                quantity: item.quantity,
                totalPrice: item.quantity * item.productId.salePrice,
                productId: item.productId._id,
            }));

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
        
        const userSession = req.session.user || req.user;

        console.log('Session user:', req.session.user);
        console.log('Req user:', req.user);

        
        if (!userSession) {
            return res.status(401).send('Unauthorized: User not logged in');
        }

        
        const userId = userSession._id;

        
        const { productId, quantity } = req.body;
        console.log('Request Body:', req.body);
     

        if (!productId || !quantity || quantity < 1) {
            return res.status(400).send('Invalid quantity');
        }


        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        if (product.quantity < quantity) {
            // If requested quantity exceeds stock, set it to the available stock
            return res.status(400).send(`Only ${product.quantity} items are in stock`);
          }

        let cart = await Cart.findOne({ userId });
        // if (!cart) {
        //     return res.status(404).send('Cart not found');
        // }

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }
        const itemIndex = cart.items.findIndex(item => item.productId.equals(productId));

        if (itemIndex > -1) {
           
            cart.items[itemIndex].quantity += parseInt(quantity, 10);
            cart.items[itemIndex].totalPrice += product.salePrice * quantity;
        
        } else {
            
            

            cart.items.push({
                productId,
                quantity:  parseInt(quantity, 10),
                price: product.salePrice,
                totalPrice: product.salePrice * quantity
            });
        }

        
        await cart.save();
        res.redirect("/cart");
       
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating the cart.' });
    }
};

// const addToCart = async (req, res) => {
//     try {
        
//         const userSession = req.session.user || req.user;

//         console.log('Session user:', req.session.user);
//         console.log('Req user:', req.user);

        
//         if (!userSession) {
//             return res.status(401).send('Unauthorized: User not logged in');
//         }

        
//         const userId = userSession._id;

        
//         const { productId, quantity } = req.body;
//         console.log('Request Body:', req.body);
     

//         // if (!productId || !quantity || quantity < 1) {
//         //     return res.status(400).send('Invalid quantity');
//         // }


//         const product = await Product.findById(productId);
//         if (!product) {
//             return res.status(404).send("Product not found");
//         }

//         if (product.quantity < quantity) {
//             // If requested quantity exceeds stock, set it to the available stock
//             return res.status(400).send(`Only ${product.quantity} items are in stock`);
//           }

//         let cart = await Cart.findOne({ userId });
//         // if (!cart) {
//         //     return res.status(404).send('Cart not found');
//         // }

//         if (!cart) {
//             cart = new Cart({ userId, items: [] });
//         }
        
//         const existingItem = cart.items.find(item => item.productId.toString() === productId);
//         if (existingItem) {
//             // Check if adding the requested quantity exceeds stock
//             if (existingItem.quantity + parseInt(quantity) > product.quantity) {
//                 return res.status(400).json({
//                     message: `You cannot add more than the available stock (${product.quantity})`
//                 });
//             }

//             // Update the quantity and total price
//             existingItem.quantity += parseInt(quantity);
//             existingItem.totalPrice = existingItem.quantity * existingItem.price;
//         } else {
//             // Add new item to the cart
//             cart.items.push({
//                 productId: product._id,
//                 quantity: parseInt(quantity),
//                 price: product.salePrice,
//                 totalPrice: product.salePrice * parseInt(quantity)
//             });
//         }

        
//         await cart.save();
//         res.redirect("/cart");
       
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'An error occurred while updating the cart.' });
//     }
// };




const removeFromCart = async (req, res) => {
    const { productId } = req.query;  
    const userSession = req.session.user || req.user;  
    const userId = userSession._id;  
    if (!productId || !userId) {
        return res.status(400).send('Invalid request');  
    }

    try {
        
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).send('Cart not found');  
        }

        
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId } } }  
        );

        
        res.redirect('/cart');  
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');  
    }
};

module.exports = { removeFromCart };


module.exports = {
    getCart,
    addToCart,
    removeFromCart,
}
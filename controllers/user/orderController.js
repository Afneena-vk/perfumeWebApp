const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");


const placeOrder = async (req,res)=>{
    
    try {
        const userSession = req.session?.user || req.user;
        
    if (!userSession) {
        return res.status(401).json({ message: "Please login" });
    }

    const userId = userSession._id;

    const { selectedAddress, paymentMethod } = req.body;

    if (!selectedAddress || !paymentMethod) {
        return res.status(400).json({ error: "Address and payment method are required!" });
    }
    const userAddress = await Address.findOne({ "address._id": selectedAddress }, { "address.$": 1 });
    if (!userAddress) {
        return res.status(404).json({ error: "Address not found!" });
    }
    const address = userAddress.address[0];

    const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: "Cart is empty!" });
        }
        const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

     for (const item of cart.items) {
            const productId = item.productId._id;
            const size = item.size;
            const quantityToDeduct = item.quantity;
            const updatedProduct = await Product.findOneAndUpdate(
                {
                  _id: productId,
                  "sizes.size": size,
                },
                {
                  $inc: { "sizes.$.quantity": -quantityToDeduct },
                },
                { new: true }
              );

              if (!updatedProduct) {
                return res.status(400).json({ error: `Failed to update stock for product: ${item.productId.productName}, size: ${size}` });
              }
        
              
              const updatedSize = updatedProduct.sizes.find((s) => s.size === size);
              if (updatedSize.quantity <= 0) {
                updatedProduct.status = "out of stock";
                await updatedProduct.save();
              }
            }
       
        const orderData = {
            userId,
            orderedItems: cart.items.map((item) => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
            })),
            totalPrice,
            finalAmount: totalPrice, 
            address,
            status: "Pending",
            payment: [
                {
                    method: paymentMethod,
                    status: "pending",
                },
            ],
        };

        const order = new Order(orderData);
        await order.save();

        
        await Cart.findOneAndUpdate({ userId }, { items: [] });

       
        res.render("orderConfirmation"); 

    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Something went wrong!" });
    }

}


module.exports = {
    placeOrder,
   
}
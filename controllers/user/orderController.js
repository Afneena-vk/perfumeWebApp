const mongoose = require("mongoose");
// const Razorpay = require("razorpay");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const razorpayInstance = require('../../config/razorPay');
const crypto = require("crypto");




const placeOrder = async (req, res) => {
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
  
        let totalPrice = 0;
        let finalAmount = 0;
  
        cart.items.forEach((item) => {
          const product = item.productId;
          const regularPrice = product.regularPrice || 0;
          const salePrice = product.salePrice || 0;
  
          const itemTotalRegular = regularPrice * item.quantity;
          const itemTotalSale = salePrice * item.quantity;
  
          totalPrice += itemTotalRegular; 
          finalAmount += itemTotalSale;
        });
  
        
        const couponId = req.session.couponId;
        let appliedDiscount = 0;
  
        console.log("couponId in place order",  couponId);

        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (coupon && coupon.status === 'Active') {
                
                if (coupon.discountType === 'fixed') {
                    appliedDiscount = coupon.discountValue;
                } else if (coupon.discountType === 'percentage') {
                    appliedDiscount = (finalAmount * coupon.discountValue) / 100;
                }
                appliedDiscount = Math.min(appliedDiscount, finalAmount);
            }
        }
  
        finalAmount -= appliedDiscount; 
  


        const adjustedFinalAmount = finalAmount < 0 ? 0 : finalAmount;

        console.log("adjustedfinal in placeorder", adjustedFinalAmount);
  
        const orderData = {
            userId,
            orderedItems: cart.items.map((item) => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
            })),
            totalPrice, 
            finalAmount: adjustedFinalAmount, 
            address,
            status: "Pending",
            payment: [{
                method: paymentMethod,
                status: "pending"
            }],
            coupon: couponId ? couponId : null,
        };
        
      if (paymentMethod === "Online Payment") {
          
          const razorpayOrder = await razorpayInstance.orders.create({
              
              amount: finalAmount * 100,
              currency: "INR",
              receipt: `receipt_order_${Date.now()}`
          });

         
          orderData.payment[0].razorpayOrderId = razorpayOrder.id;

          
          const order = new Order(orderData);
          await order.save();

          await Cart.findOneAndUpdate({ userId }, { items: [] });

          
          return res.json({
              success: true,
              order: razorpayOrder,
              orderId: order._id,
              key: process.env.RAZOR_PAY_KEY_ID
          });
      } else if (paymentMethod === "Wallet Payment") {
        
        let wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < finalAmount) {
            return res.status(400).json({ error: "Insufficient wallet balance!" });
        }

        
        wallet.balance -= finalAmount;
        wallet.transactions.push({
            type: "DEBIT",
            amount: finalAmount,
            description: `Payment for order ${orderData.orderId}`,
        });
        await wallet.save();

        orderData.payment[0].status = "completed";

        
        const order = new Order(orderData);
        await order.save();

        
        await Cart.findOneAndUpdate({ userId }, { items: [] });

        return res.json({ success: true, message: "Order placed successfully!" });
    } else {
         
          const order = new Order(orderData);
          await order.save();

          
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
                  return res.status(400).json({ 
                      error: `Failed to update stock for product: ${item.productId.productName}, size: ${size}` 
                  });
              }

              const updatedSize = updatedProduct.sizes.find((s) => s.size === size);
              if (updatedSize.quantity <= 0) {
                  updatedProduct.status = "out of stock";
                  await updatedProduct.save();
              }
          }

          
          await Cart.findOneAndUpdate({ userId }, { items: [] });
          
          return res.json({ success: true, message: "Order placed successfully!" });
          // Render confirmation page
          // res.render("orderConfirmation");
      }
       
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Something went wrong!" });
    }
  };
  

const verifyPayment = async (req, res) => {
  try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

      console.log("razor payment id:",razorpay_payment_id);
      console.log("razorpay ordr id:",razorpay_order_id);
      console.log("razorpay signature is:",razorpay_signature);
      console.log("order id is:",orderId);     


      
      
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZOR_PAY_KEY_SECRET)
          .update(body.toString())
          .digest("hex");

      if (expectedSignature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: "Invalid signature" });
      }

      
      const order = await Order.findOne({
          _id: orderId,
          "payment.razorpayOrderId": razorpay_order_id
      });

      if (!order) {
          return res.status(404).json({ success: false, message: "Order not found!" });
      }

      
      order.payment[0].status = "completed";
      await order.save();

      
      for (const item of order.orderedItems) {
          const productId = item.product;
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

          if (updatedProduct) {
              const updatedSize = updatedProduct.sizes.find((s) => s.size === size);
              if (updatedSize.quantity <= 0) {
                  updatedProduct.status = "out of stock";
                  await updatedProduct.save();
              }
          }
      }

      
      await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });

      res.json({ success: true });
      
  } catch (error) {
      console.error("Payment verification failed:", error);
      res.status(500).json({ success: false, message: "Payment verification failed" });
  }
};

const getOrderConfirmation =  async (req, res) => {
  try {
      
      
       res.render('orderConfirmation');
  } catch (error) {
      console.error("Error in getting order confirmation: ", error);
      res.status(500).send("Something  went wrong!");
  }
};

const getPaymentFailure = async  (req, res) => {
    try {
        res.render('paymentFailure');
    } catch (error) {
        console.error("Error loading payment failure page:", error);
        res.status(500).send("Internal Server Error");
    }
};


const getOrders = async (req, res) => {
    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }

    const orderPage = parseInt(req.query.orderPage) || 1;
    const limit = 3; 

    try {
        const totalOrders = await Order.countDocuments({ userId: userSession._id });

        const orders = await Order.find({ userId: userSession._id })
            .populate({
                path: "orderedItems.product",
                select: "productName",
            })
            .skip((orderPage - 1) * limit)
            .limit(limit);
            const userData = await User.findOne({ _id: userSession._id });
            res.locals.user = userData;
        res.render('order', {
            orders: orders,
            orderPage,
            totalOrderPages: Math.ceil(totalOrders / limit),
        });
    } catch (error) {
        console.error("Error retrieving orders", error);
        res.redirect("/pageNotFound");
    }
};

const cancelOrder = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userSession = req.session.user || req.user; 
  
      if (!userSession) {
        return res.status(401).json({ message: "User not authenticated" });
      }
  
      
      const order = await Order.findOne({ _id: orderId, userId: userSession._id })
        .populate("orderedItems.product");
  
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      
      if (order.status === "Cancelled" || order.status === "Delivered") {
        return res.status(400).json({ message: "Cannot cancel this order" });
      }
  
      
      order.status = "Cancelled";

      if (order.payment[0].method === "Wallet Payment") {
        const wallet = await Wallet.findOne({ userId: userSession._id });
        if (wallet) {
            
            wallet.balance += order.finalAmount;

            
            wallet.transactions.push({
                type: "CREDIT",
                amount: order.finalAmount,
                description: `Refund for cancelled order ${order.orderId}`,
                orderId: order._id,
            });

            await wallet.save(); 
        }
        
        order.payment[0].status = "Refunded";
    }


      await order.save();
  
     
      for (const item of order.orderedItems) {
        await Product.findOneAndUpdate(
          { _id: item.product, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": item.quantity } }
        );
      }
  
    
      const user = await User.findById(userSession._id);
      if (!user) {
        return res.status(404).send("User not found");
      }
  
      
      res.status(200).json({ message: "Order cancelled successfully" });
  
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };


  const requestReturn = async (req, res) => {
    try {
        const { orderId } = req.params;

        
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        
        if (order.status !== 'Delivered') {
            return res.status(400).json({ error: 'Return can only be requested for delivered orders' });
        }

        
        order.status = 'Return Requested';
        await order.save();

        res.status(200).json({ message: 'Return requested successfully', order });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
  




module.exports = {
    placeOrder,
    getOrders,
    cancelOrder,
    verifyPayment,
    getOrderConfirmation,
    requestReturn,
    getPaymentFailure
}
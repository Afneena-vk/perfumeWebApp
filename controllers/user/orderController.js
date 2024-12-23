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

const PDFDocument = require('pdfkit');
const fs = require('fs');



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
  
        if (paymentMethod === "COD" && adjustedFinalAmount > 1000) {
            return res.status(400).json({ error: "Orders above Rs. 1000 cannot be paid via Cash on Delivery." });
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
          
          if(couponId){
            req.session.couponId= null;
        }

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

        if(couponId){
            req.session.couponId= null;
        }

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
          
          if(couponId){
            req.session.couponId= null;
        }
          
          await Cart.findOneAndUpdate({ userId }, { items: [] });
          
          return res.json({ success: true, message: "Order placed successfully!" });
          
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
      
    const user = req.session.user || req.user;
       res.render('orderConfirmation', { user });
  } catch (error) {
      console.error("Error in getting order confirmation: ", error);
      res.status(500).send("Something  went wrong!");
  }
};

const getPaymentFailure = async  (req, res) => {
    try {
        const user = req.session.user || req.user;
        res.render('paymentFailure', { user });
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

    
    if (
        (order.payment[0].method === "Wallet Payment" || 
        (order.payment[0].method === "Online Payment" && order.payment[0].status === "completed")) &&
        order.finalAmount > 0
      ) {
        
        let wallet = await Wallet.findOne({ userId: userSession._id });
        if (!wallet) {
          wallet = new Wallet({
            userId: userSession._id,
            balance: 0,
            transactions: []
          });
        }
  
       
        wallet.balance += order.finalAmount;
  
        
        wallet.transactions.push({
          type: "CREDIT",
          amount: order.finalAmount,
          description: `Refund for cancelled order ${order.orderId}`,
          orderId: order._id,
        });
  
        await wallet.save();
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


        if (order.status === 'Returned') {
            
            if (order.payment && order.payment.length > 0) {
                order.payment[0].status = 'refunded';
                await order.save();
            }


            const wallet = await Wallet.findOne({ userId: order.userId });

            if (!wallet) {
                return res.status(404).json({ error: 'Wallet not found' });
            }

            
            wallet.balance += order.finalAmount;

            
            wallet.transactions.push({
                type: "CREDIT",
                amount: order.finalAmount,
                description: `Refund for order ${order.orderId}`,
                orderId: order._id,
            });

           
            await wallet.save();
        }

        res.status(200).json({ message: 'Return requested successfully', order });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
 


const viewOrder = async (req, res) => {
    try {
        const orderId = req.query.id; 
        if (!orderId) {
            return res.status(400).render('404', { message: 'Order ID is required!' });
        }

        const order = await Order.findById(orderId)
            .populate('coupon') 
            .populate('orderedItems.product') 
            .populate('userId', 'name email'); 

        if (!order) {
            return res.status(404).render('404', { message: 'Order not found!' });
        }

        const userSession = req.session.user || req.user; 
        res.render('viewOrder', { order, user: userSession }); 
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { message: 'Internal Server Error' });
    }
};



const generateOrderPDF = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId: orderId })
            .populate('orderedItems.product')
            .populate('coupon');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        
        if (order.status !== 'Delivered') {
            return res.status(403).send('Invoice can only be downloaded for delivered orders');
        }

       
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });

       
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);

        
        doc.pipe(res);

       
        const drawLine = (y) => {
            doc.moveTo(50, y)
               .lineTo(550, y)
               .strokeColor('#aaaaaa')
               .stroke();
        };

       
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('INVOICE', { align: 'center' })
           .moveDown();

        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Invoice Number: INV-${order.orderId}`, { align: 'right' })
           .text(`Invoice Date: ${new Date().toLocaleDateString('en-US', { 
               day: 'numeric', 
               month: 'long', 
               year: 'numeric' 
           })}`, { align: 'right' })
           .text(`Order Date: ${new Date(order.date).toLocaleDateString('en-US', { 
               day: 'numeric', 
               month: 'long', 
               year: 'numeric' 
           })}`, { align: 'right' })
           .moveDown();

        drawLine(doc.y);
        doc.moveDown();

       
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Shipping Details', { underline: true })
           .moveDown();

        doc.fontSize(10)
           .font('Helvetica')
           .text(order.address.name, { continued: true })
           .text(`    Phone: ${order.address.phone}`, { align: 'right' })
           .text(order.address.addressType)
           .text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
        
        if (order.address.landMark) {
            doc.text(`Landmark: ${order.address.landMark}`);
        }
        
        doc.moveDown();
        drawLine(doc.y);
        doc.moveDown();

      
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Payment Information', { underline: true })
           .moveDown();

        doc.fontSize(10)
           .font('Helvetica')
           .text(`Payment Method: ${order.payment[0]?.method || 'N/A'}`)
           .text(`Payment Status: ${order.payment[0]?.status || 'N/A'}`)
           .moveDown();

        drawLine(doc.y);
        doc.moveDown();

        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Order Details', { underline: true })
           .moveDown();

        
        const tableTop = doc.y;
        doc.fontSize(10)
           .font('Helvetica-Bold');

        
        const productX = 50;
        const sizeX = 280;
        const qtyX = 350;
        const priceX = 450;

        
        doc.text('Product', productX)
           .text('Size', sizeX)
           .text('Quantity', qtyX)
           .text('Price', priceX);

        doc.moveDown();
        drawLine(doc.y);
        doc.moveDown();

        
        doc.font('Helvetica');
        order.orderedItems.forEach(item => {
            doc.text(item.product?.productName || 'Unknown Product', productX, doc.y, { width: 220 })
               .text(item.size, sizeX)
               .text(item.quantity.toString(), qtyX)
               .text(`₹${item.price.toFixed(2)}`, priceX);
            doc.moveDown();
        });

        drawLine(doc.y);
        doc.moveDown();

       
        const summaryX = 400;
        doc.font('Helvetica')
           .text('Subtotal:', summaryX)
           .text(`₹${order.totalPrice.toFixed(2)}`, priceX)
           .moveDown(0.5);

        if (order.coupon) {
            doc.text('Discount:', summaryX)
               .text(`-₹${(order.totalPrice - order.finalAmount).toFixed(2)}`, priceX)
               .moveDown(0.5);
        }

        drawLine(doc.y);
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('Total Amount:', summaryX)
           .text(`₹${order.finalAmount.toFixed(2)}`, priceX)
           .moveDown();

        
        doc.fontSize(10)
           .font('Helvetica')
           .text('Thank you for shopping with us!', { align: 'center' })
           .moveDown()
           .text('This is a computer generated invoice and does not require a signature.', { 
               align: 'center',
               fontSize: 8,
               color: '#666666'
           });

      
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
};

const reinitiatePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userSession = req.session?.user || req.user;
        
        if (!userSession) {
            return res.status(401).json({ success: false, message: "Please login" });
        }

        
        const order = await Order.findOne({ 
            _id: orderId,
            userId: userSession._id,
            'payment.method': 'Online Payment',
            'payment.status': 'pending'
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found or payment already completed" 
            });
        }

       
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: order.finalAmount * 100, 
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`
        });


        order.payment[0].razorpayOrderId = razorpayOrder.id;
        await order.save();

        
        return res.json({
            success: true,
            order: razorpayOrder,
            orderId: order._id,
            key: process.env.RAZOR_PAY_KEY_ID
        });

    } catch (error) {
        console.error("Error reinitiating payment:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Something went wrong!" 
        });
    }
};



module.exports = {
    placeOrder,
    getOrders,
    cancelOrder,
    verifyPayment,
    getOrderConfirmation,
    requestReturn,
    getPaymentFailure,
    viewOrder,
    generateOrderPDF, 
    reinitiatePayment,
}
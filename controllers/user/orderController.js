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
const path = require('path');




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

        
        for (const cartItem of cart.items) {
            const product = cartItem.productId;
            const requestedSize = cartItem.size;
            const requestedQuantity = cartItem.quantity;
            
            const sizeObj = product.sizes.find(s => s.size === requestedSize);
            
            if (!sizeObj || sizeObj.quantity < requestedQuantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${product.productName} in size ${requestedSize}` 
                });
            }
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
        let totalCouponDiscount = 0;
  
        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (coupon && coupon.status === 'Active') {
                if (coupon.discountType === 'fixed') {
                    totalCouponDiscount = coupon.discountValue;
                } else if (coupon.discountType === 'percentage') {
                    totalCouponDiscount = (finalAmount * coupon.discountValue) / 100;
                }
                totalCouponDiscount = Math.min(totalCouponDiscount, finalAmount);
            }
        }

        
        const numberOfItems = cart.items.length;
        const discountPerItem = numberOfItems > 0 ? totalCouponDiscount / numberOfItems : 0;
        
        
        const orderedItems = cart.items.map((item) => {
            const product = item.productId;
            const salePrice = product.salePrice || 0;
            const itemTotal = salePrice * item.quantity;
            
            return {
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: itemTotal,
                discountApplied: discountPerItem, // Store the coupon discount applied to this item
                finalPrice: itemTotal - discountPerItem // Store the final price after discount
            };
        });

        const adjustedFinalAmount = Math.max(0, finalAmount - totalCouponDiscount);

        if (paymentMethod === "COD" && adjustedFinalAmount > 1000) {
            return res.status(400).json({ error: "Orders above Rs. 1000 cannot be paid via Cash on Delivery." });
        }

        const orderData = {
            userId,
            orderedItems,
            totalPrice,
            discount: totalCouponDiscount,
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
                amount: adjustedFinalAmount * 100,
                currency: "INR",
                receipt: `receipt_order_${Date.now()}`
            });

            orderData.payment[0].razorpayOrderId = razorpayOrder.id;
            const order = new Order(orderData);
            await order.save();
            
            if(couponId) {
                req.session.couponId = null;
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
            if (!wallet || wallet.balance < adjustedFinalAmount) {
                return res.status(400).json({ error: "Insufficient wallet balance!" });
            }

            wallet.balance -= adjustedFinalAmount;
            wallet.transactions.push({
                type: "DEBIT",
                amount: adjustedFinalAmount,
                description: `Payment for order ${orderData.orderId}`,
            });
            await wallet.save();

            orderData.payment[0].status = "completed";
            const order = new Order(orderData);
            await order.save();

            if(couponId) {
                req.session.couponId = null;
            }

            await Cart.findOneAndUpdate({ userId }, { items: [] });
            return res.json({ success: true, message: "Order placed successfully!" });
        } else {
            const order = new Order(orderData);
            await order.save();

            
            for (const item of cart.items) {
                await Product.findOneAndUpdate(
                    {
                        _id: item.productId._id,
                        "sizes.size": item.size,
                    },
                    {
                        $inc: { "sizes.$.quantity": -item.quantity },
                    }
                );
            }
            
            if(couponId) {
                req.session.couponId = null;
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
            .sort({ date: -1 }) 
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


const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userSession = req.session.user || req.user;

        if (!userSession) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const order = await Order.findOne({
            _id: orderId,
            userId: userSession._id
        }).populate("orderedItems.product");

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

     
        const orderItem = order.orderedItems.id(itemId);
        if (!orderItem) {
            return res.status(404).json({ message: "Order item not found" });
        }

        if (orderItem.status === 'Cancelled' || orderItem.status === 'Delivered') {
            return res.status(400).json({ message: "Cannot cancel this item" });
        }

       
      
       const itemRefundAmount = orderItem.finalPrice * orderItem.quantity;
        
        if ((order.payment[0].method === "Wallet Payment" ||
            (order.payment[0].method === "Online Payment" &&
                order.payment[0].status === "completed")) &&
            itemRefundAmount > 0) {

            let wallet = await Wallet.findOne({ userId: userSession._id });
            if (!wallet) {
                wallet = new Wallet({
                    userId: userSession._id,
                    balance: 0,
                    transactions: []
                });
            }

            wallet.balance += itemRefundAmount;
            wallet.transactions.push({
                type: "CREDIT",
                amount: itemRefundAmount,
                description: `Refund for cancelled item in order ${order.orderId}`,
                orderId: order._id
            });

            await wallet.save();
        }

        
        orderItem.status = 'Cancelled';

        
        await Product.findOneAndUpdate(
            { _id: orderItem.product, "sizes.size": orderItem.size },
            { $inc: { "sizes.$.quantity": orderItem.quantity } }
        );

        
        const allItemsCancelled = order.orderedItems.every(item =>
            item.status === 'Cancelled'
        );

        
        order.status = allItemsCancelled ? 'Cancelled' : 'Processing';

        if (allItemsCancelled &&
            (order.payment[0].method === "Online Payment" || order.payment[0].method === "Wallet Payment")) {
            order.payment[0].status = "Refunded";
        }

        
        await updatePaymentStatus(order);

        await order.save();

        res.status(200).json({
            message: "Order item cancelled successfully",
            orderStatus: order.status,
            paymentStatus: order.payment[0].status,
            newFinalAmount: order.finalAmount 
        });

    } catch (error) {
        console.error("Error cancelling order item:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


 
const requestReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        
        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (item.status !== 'Delivered') {
            return res.status(400).json({ error: 'Return can only be requested for delivered items' });
        }

        
        item.status = 'Return Requested';



        await order.save();

       

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

        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            
            return res.redirect('/pageNotFound');
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

        
        const deliveredItems = order.orderedItems.filter(item => item.status === 'Delivered');
        
        if (deliveredItems.length === 0) {
            return res.status(400).send('No delivered items found in this order');
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

        const shippingBlock = [
            order.address.name,
            order.address.addressType,
            `${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
            order.address.landMark ? `Landmark: ${order.address.landMark}` : '',
            `Phone: ${order.address.phone}`
        ].filter(Boolean);

        doc.fontSize(10)
           .font('Helvetica');
        shippingBlock.forEach(line => doc.text(line));
        
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
           .text('Order Details (Delivered Items)', { underline: true })
           .moveDown();

        
        const columns = {
            product: { x: 50, width: 230 },
            size: { x: 280, width: 70 },
            quantity: { x: 350, width: 70 },
            price: { x: 420, width: 100 }
        };

        
        doc.fontSize(10)
           .font('Helvetica-Bold');

        
        doc.text('Product', 
            columns.product.x, 
            doc.y, 
            { width: columns.product.width, align: 'left' }
        );

        
        doc.text('Size', 
            columns.size.x, 
            doc.y - doc.currentLineHeight(), 
            { width: columns.size.width, align: 'left' }
        );

        
        doc.text('Quantity', 
            columns.quantity.x, 
            doc.y - doc.currentLineHeight(), 
            { width: columns.quantity.width, align: 'left' }
        );

       
        doc.text('Price', 
            columns.price.x, 
            doc.y - doc.currentLineHeight(), 
            { width: columns.price.width, align: 'right' }
        );

        doc.moveDown();
        drawLine(doc.y);
        doc.moveDown();

       
        doc.font('Helvetica');
        deliveredItems.forEach(item => {
            const y = doc.y;

          
            doc.text(
                item.product?.productName || 'Unknown Product',
                columns.product.x,
                y,
                { width: columns.product.width, align: 'left' }
            );

           
            doc.text(
                item.size,
                columns.size.x,
                y,
                { width: columns.size.width, align: 'left' }
            );

           
            doc.text(
                item.quantity.toString(),
                columns.quantity.x,
                y,
                { width: columns.quantity.width, align: 'left' }
            );

           
            doc.text(
                `₹${(item.price * item.quantity).toFixed(2)}`,
                columns.price.x,
                y,
                { width: columns.price.width, align: 'right' }
            );

            doc.moveDown();
        });

        drawLine(doc.y);
        doc.moveDown();

        
        const subtotal = deliveredItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = deliveredItems.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
        

        const discount = deliveredItems.reduce((sum, item) => {
            const regularPrice = item.product?.regularPrice || 0; 
            const itemDiscount = (regularPrice - item.finalPrice) * item.quantity; 
            return sum + itemDiscount;
        }, 0);

        
        const summaryStartX = 370;
        const summaryValueX = 420;
        const summaryWidth = 100;
        
        doc.font('Helvetica')
           .text('Subtotal:', summaryStartX)
           .text(`₹${subtotal.toFixed(2)}`, 
                summaryValueX, 
                doc.y - doc.currentLineHeight(), 
                { width: summaryWidth, align: 'right' })
           .moveDown(0.5);

        if (discount > 0) {
            doc.text('Discount:', summaryStartX)
               .text(`-₹${discount.toFixed(2)}`, 
                    summaryValueX, 
                    doc.y - doc.currentLineHeight(), 
                    { width: summaryWidth, align: 'right' })
               .moveDown(0.5);
        }

        drawLine(doc.y);
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('Total Amount:', summaryStartX)
           .text(`₹${total.toFixed(2)}`, 
                summaryValueX, 
                doc.y - doc.currentLineHeight(), 
                { width: summaryWidth, align: 'right' })
           .moveDown(2);

        // Footer
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


         
         const totalAmount = order.orderedItems.reduce((total, item) => {
            if (item.status !== 'Cancelled') {
               
                return total + (item.finalPrice * item.quantity);
            }
            return total;
        }, 0);

       
       
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: totalAmount * 100, 
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

const validateStock = async (req, res) => {
    try {
        const userSession = req.session?.user || req.user;
        if (!userSession) {
            return res.status(401).json({ success: false, error: "Please login" });
        }

        const userId = userSession._id;
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Cart is empty!" 
            });
        }

       
        for (const cartItem of cart.items) {
            const product = cartItem.productId;
            const requestedSize = cartItem.size;
            const requestedQuantity = cartItem.quantity;

          
            const sizeObj = product.sizes.find(s => s.size === requestedSize);

            if (!sizeObj) {
                return res.status(400).json({
                    success: false,
                    error: `Size ${requestedSize} is no longer available for ${product.productName}`
                });
            }

            if (sizeObj.quantity < requestedQuantity) {
                return res.status(400).json({
                    success: false,
                    error: `Only ${sizeObj.quantity} items available for ${product.productName} in size ${requestedSize}`
                });
            }
        }

        return res.json({
            success: true,
            message: "Stock available for all items"
        });

    } catch (error) {
        console.error("Stock validation error:", error);
        return res.status(500).json({
            success: false,
            error: "Error checking stock availability"
        });
    }
    
};





module.exports = {
    placeOrder,
    getOrders,
    cancelOrderItem,
    verifyPayment,
    getOrderConfirmation,
    requestReturn,
    getPaymentFailure,
    viewOrder,
    generateOrderPDF, 
    reinitiatePayment,
    validateStock,
   
}

const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");

const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");

function generateOtp(){
    const digits = "1234567890";
    let otp = "";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}

const sendVerificationEmail = async (email,otp)=>{
    try {
        
       const transporter = nodemailer.createTransport({
         service:"gmail",
         port:587,
         secure:false,
         auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD,
         } 
       })

       const mailOptions = {
          from:process.env.NODEMAILER_EMAIL,
          to:email,
          subject:"Your OTP for password reset",
          text:`Your OTP is ${otp}`,
          html:`<b><h4>Your OTP: ${otp}</h4><br></b>`
          
       }

       const info = await transporter.sendMail(mailOptions);
       console.log("Email sent:",info.messageId);
       return true;

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}



const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Failed to hash password");
    }
};


const getForgotPassPage = async (req,res) => {
    try {
        
       res.render("forgot-password");

    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const forgotEmailValid = async (req,res) => {
     try {
        
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP:",otp);
            }else {
                res.json({success:false,message:"Failed to send OTP. Please try again"});
            }
        }else {
            res.render("forgot-password",{
                message:"User with this email does not exist"
            });
        }

     } catch (error) {
        res.redirect("/pageNotFound");
     }
}

const verifyForgotPassOtp = async (req,res)=>{
    try {
        
      const enteredOtp = req.body.otp;
      if(enteredOtp === req.session.userOtp){
        res.json({success:true,redirectUrl:"/reset-password"});

      }else {
        res.json({success:false,message:"OTP not matching"});
      }


    } catch (error) {
        res.status(500).json({success:false, message:"An error occured. Please try again"});

    }
}

const getResetPassPage = async (req,res)=>{
    try {
        
       res.render("reset-password");

    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const resendOtp = async (req,res)=>{
    try {
        
     const otp = generateOtp();
     req.session.userOtp = otp;
     const email = req.session.email;
     console.log("Resending OTP to emai:",email);
     const emailSent = await sendVerificationEmail(email,otp);
     if(emailSent){
        console.log("Resend OTP:",otp);
        res.status(200).json({success:true, message: "Resend OTP Successful"});

     }
    } catch (error) {
        
      console.error("Error in resend otp",error);
      res.status(500).json({success:false , message:'Internal Server Error'});

    }
}



const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            req.session.destroy(); // Destroy session after resetting password
            res.redirect("/login");
        } else {
            res.render("reset-password", { message: "Passwords do not match" });
        }
    } catch (error) {
        console.error("Error resetting password:", error);
        res.redirect("/pageNotFound");
    }
};



const userProfile = async (req,res) =>{

    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }

    const addressPage = parseInt(req.query.addressPage) || 1;
    const orderPage = parseInt(req.query.orderPage) || 1;
    const limit = 3; 

    try {
        
     
       const user = await User.findById(userSession._id);

       
       if (!user) {
        return res.status(404).send("User not found");
    }

    const totalAddresses = await Address.findOne({ userId: userSession._id }).then(
        (addressDoc) => (addressDoc ? addressDoc.address.length : 0)
    );
    const totalOrders = await Order.countDocuments({ userId: userSession._id });

    
    const addressDoc = await Address.findOne({ userId: userSession._id });
    const addresses = addressDoc
        ? addressDoc.address.slice((addressPage - 1) * limit, addressPage * limit)
        : [];

    
       const orders = await Order.find({ userId: userSession._id })
            .populate({
                path: "orderedItems.product",
                select: "productName", 
            })
            .skip((orderPage - 1) * limit)
            .limit(limit);

       res.render('profile',{
        user:user,
        orders: orders,
        address: addresses,
        addressPage,
        orderPage,
        totalAddressPages: Math.ceil(totalAddresses / limit),
        totalOrderPages: Math.ceil(totalOrders / limit),
       })
    } catch (error) {
        console.error("Error for retrieve profile data",error);
        res.redirect("/pageNotFound")
    }
};

const getEditProfile = async (req,res)=>{
    try {
        
       const userId =  req.session.user || req.user;
       const userData = await User.findById(userId);
       if(!userData){
        return res.redirect('/login');
       }
        res.render('editProfile',{user:userData});

    } catch (error) {
        console.error("Error for retrieve editProfile page",error);
        res.redirect("/pageNotFound");
    }
}

const updateProfile = async (req,res)=>{

    const { name,email,phone } = req.body;

    try {
        
        const userSession = req.session.user || req.user;
        
        if (!userSession || !userSession._id) {
            return res.status(401).send("Unauthorized: No user session found");
        }
 
        const userId = userSession._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone},
            { new: true }
      );
      if (!updatedUser) {
        throw new Error("Failed to update user profile");
    }

        req.session.user = updatedUser;
        res.redirect('/userProfile');

    } catch (error) {
        console.error("Error updating profile:", error.message);
        res.status(500).send("Server error occurred");
    }
}


const getAddAddress = async (req,res) =>{
    try {
        const userSession = req.session.user || req.user;
    
        if (!userSession || !userSession._id) {
            
            return res.redirect('/login');

        }
    
        const userData = await User.findOne({ _id: userSession._id  });
        
        res.locals.user = userData;


        res.render('addAddress');

    } catch (error) {
        console.error("Error accessing the add address page:", error.message);
        res.status(500).send("Server error occurred");
    }
}


const addNewAddress = async (req, res) => {
    const { addressType, name, city, landMark, state, pincode, phone } = req.body;
    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }

    try {
      
        const newAddress = {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone
        };

        
        const updatedUser = await Address.findOneAndUpdate(
            { userId: userSession._id }, 
            {
                $push: {
                    address: newAddress, 
                },
            },
            { new: true, upsert: true } 
        );

        res.redirect('/userProfile'); 
    } catch (error) {
        console.error("Error adding address:", error.message);
        res.status(500).send("Server error occurred");
    }
};


const getEditAddress = async (req,res) =>{
    try {
        const userSession = req.session.user || req.user; 
        if (!userSession) {
            return res.redirect('/login'); 
        }

        const userId = userSession._id;
        
        const addressId = req.query.id;

        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(404).send('No address found for this user.');
        }

        const address = userAddresses.address.id(addressId);
        if (!address) {
            return res.status(404).send('Address not found.');
        }

        const userData = await User.findOne({ _id: userSession._id  });
        
        res.locals.user = userData;


        res.render('editAddress', { address });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
    

}



const editAddress = async (req,res)=>{
    try {
        const userSession = req.session.user || req.user; 
        if (!userSession) {
            return res.redirect('/login'); 
        }

        const userId = userSession._id;
        const addressId = req.query.id;
        const updatedData = {
            addressType: req.body.addressType,
            name: req.body.name,
            city: req.body.city,
            landMark: req.body.landMark,
            state: req.body.state,
            pincode: req.body.pincode,
            phone: req.body.phone,
        };

        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(404).send('No address found for this user.');
        }

        const address = userAddresses.address.id(addressId);
        if (!address) {
            return res.status(404).send('Address not found.');
        }

        
        Object.assign(address, updatedData);

        await userAddresses.save();

        res.redirect('/userProfile'); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}
const deleteAddress  = async (req,res)=>{
    const { addressId } = req.params;
    const userSession = req.session.user || req.user;
    try {
        const user = await User.findById(userSession._id);

        if (!user) {
            return res.status(404).send("User not found");
        }

        const result = await Address.findOneAndUpdate(
            { userId: userSession._id },
            { $pull: { address: { _id: addressId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send('Address not found');
        }

        res.redirect("/userProfile");

    } catch (error) {
         console.error(error);
         res.status(500).send("Error deleting address");
    }
}



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
  


module.exports = {
    userProfile,
    getEditProfile,
    updateProfile,
    getAddAddress,
    addNewAddress,
    editAddress,
    deleteAddress,
    getEditAddress,
    getForgotPassPage,
    forgotEmailValid,
    cancelOrder,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,

};

const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema")
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require('express-session');

const pageNotFound = async (req,res)=>{

    try {
        
        res.render("page-404")

    } catch (error) {
        res.redirect("/pageNotFound")
    }
};



const loadHomepage = async (req,res)=>{
    try {
          const user = req.session.user || req.user;
          const categories = await Category.find({isListed:true});
          let productData = await Product.find(
            {
                isBlocked:false,
                category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
            }
          )

          productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
          productData = productData.slice(0,4);

          if(user){
            const userData = await User.findOne({_id:user._id});
            return res.render("home",{user:userData , products:productData});
          }else{

          return res.render("home",{products:productData});
          }
    } catch (error) {
        
      console.error("Home page not loading",error);
      res.status(500).send("Server error")

    }
}

const loadSignup = async (req,res)=>{

    try {
        
      return res.render('signup');

    } catch (error) {
        
       console.log('Home page not loading:',error);
       res.status(500).send('Server Error');

    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){

    try {
        
      const transporter = nodemailer.createTransport({
         
         service:'gmail',
         port:587,
         secure:false,
         requireTLS:true, 
        auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD
        }
      })

      const info = await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to: email,
        subject: "Verify your account",
        text:`Your otp is ${otp}`,
        html:`<b>Your OTP: ${otp}</b>`,

      })

      return info.accepted.length>0

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }

}

const signup = async (req,res)=>{
    try {
        
        const {name,phone,email, password, cPassword} = req.body;
       
        if(password !== cPassword){
            return res.render("signup",{message:"Password do not match"});
          }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email already exists"});
        }

        const otp = generateOtp();
        console.log("Generated OTP:", otp); 

        const emailSent = await sendVerificationEmail(email,otp);
        if(!emailSent){
            return res.json({ message: "Error sending verification email. Please try again later." });
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        res.render("verify-otp");
        console.log("OTP Sent",otp);

    } catch (error) {
        
        console.error("signup error",error);
        res.redirect("/pageNotFound")
    }
}

const securePassword = async (password)=>{
    try {
        
      const passwordHash = await bcrypt.hash(password,10)

      return passwordHash;

    } catch (error) {
        
    }
}

const verifyOtp = async (req,res)=>{
    try {
        
        const {otp} = req.body;
        console.log(otp);
        console.log("Session OTP:", req.session.userOtp);

        if(otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
            })
           
            const savedUser = await saveUserData.save();
            console.log("User saved successfully:", savedUser);
            req.session.user = saveUserData._id;
            res.json({success:true,redirectUrl:"/"})
        }else {
            console.log("Invalid OTP provided.");
            res.status(400).json({success:false, message:"Invalid OTP, Please try again"});
        }

    } catch (error) {
        console.error("Error Verifying OTP:",error);
        res.status(500).json({success:false,message:"An error occured"});
    }
}


const resendOtp = async (req,res) =>{
    try{

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({ success :false, message :"Email not found in session"});
        }

        const otp = generateOtp();
        req.session.userOtp = otp;
        
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP : ",otp);
            res.status(200). json({ success:true,message:"OTP Resend Successfully"});
            
        } else{
            console.error("Error resending otp :" ,error);
            
            res.status(500).json({success:false,message:"Failed to resend OTP, Please try again"});
        }

    }catch(error){

        console.error("Error resending OTP",error);
        res.status(500).json({ success:false,message: "Internal Server Error .Please try again"});
        
    }
};

const loadLogin = async (req,res)=>{
    try {
        
        if(!req.session.user){
           return res.render ("login")
        }else {
            res.redirect("/")
        }

    } catch (error) {
        
       res.redirect("/pageNotFound")

    }
}

const login = async (req,res)=>{
    try {
        
       const {email,password} = req.body;

       const findUser = await User.findOne({isAdmin:0,email:email});

       if(!findUser){
          return res.render("login",{message:"User not found"})
       }

       if(findUser.isBlocked){
          return res.render("login",{message: "User is blocked by admin"})
       }

       const passwordMatch = await bcrypt.compare(password,findUser.password);

       if(!passwordMatch){
           return res.render("login",{message:"Incorrect Password"})
       }

       req.session.user = { _id: findUser._id, name: findUser.name }; 

       console.log("Session user after login:", req.session.user);

       res.redirect("/")

    } catch (error) {
        
        console.error("login error",error);
        res.render("login",{message:"login failed. please try again later"})

    }
}

const logout = async (req,res)=>{
    try {
        
       req.session.destroy((error)=>{
          if(error){
            console.log("Session destruction error",error.message);
            return res.redirect("/pageNotFound")
          }
          return res.redirect("/login")
       })

    } catch (error) {

        console.log("logout error",error);
        res.redirect("/pageNotFound");
        
    }
}


const loadShopping = async (req,res)=>{
    try {
          const user = req.session.user || req.user;
          console.log("userexist", user);
          
          const categories = await Category.find({isListed:true});
          console.log("Categories fetched:", categories); 
          const brands = await Brand.find({});
          console.log("Brands fetched:", brands); 
          let products = await Product.find(
            {
                isBlocked:false,
                category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
            }
          )
        console.log("Products fetched:", products);
        
           products.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
           products = products.slice(0,9);
        if(user){
            const userData = await User.findOne({_id:user._id});
            return res.render("shop",{user:userData , products:products , categories: categories , brands: brands});
          }else{
        
          return res.render("home",{products:products});
          }
    } catch (error) {
        
      console.error("shopping page not loading",error);
      res.status(500).send("Server error")

    }
}

const getProductDetails = async (req, res) => {
    try {
        
        const productId = req.query.id;
        const user = req.session.user || req.user; 

        if (!user) {
            return res.status(401).json({ success: false, message: 'Please login' });
            
        }

        const product = await Product.findById(productId).populate('category')

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        const totalRatings = product.ratings.reduce((sum, rating) => sum + rating, 0);
        const avgRating = product.ratings.length ? (totalRatings / product.ratings.length).toFixed(1) : 'No Ratings Yet';
        
        const relatedProducts = await Product.find({ 
            category: product.category._id, 
            _id: { $ne: product._id } 
          }).limit(4);
      
        const breadcrumbs = [
            { name: 'Home', url: '/' },
            { name: 'Shop', url: '/shop' },
            { name: product.productName, url: `/product/${productId}` }
        ];
     
        const finalPrice = product.salePrice 
      
        const stockStatus = product.quantity > 0 ? 'In Stock' : 'Out of Stock';

        res.render('productDetails', {
            user,
            product,
            breadcrumbs,
            avgRating,
            finalPrice,
            stockStatus,
            relatedProducts,
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};





module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShopping,
    getProductDetails,
};

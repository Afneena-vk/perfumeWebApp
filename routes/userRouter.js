const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController")
const passport = require("passport");
const { userAuth } = require("../middlewares/auth");


router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage);
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
});
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userController.logout);

router.get("/shop",userAuth,userController.loadShopping);
router.get('/productDetails',userAuth,userController.getProductDetails);


router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/editProfile",userAuth,profileController.getEditProfile);
router.post("/editProfile",userAuth,profileController.updateProfile);
router.get("/addAddress",userAuth,profileController.getAddAddress);
router.post('/addAddress',userAuth,profileController.addNewAddress)

// router.get('/editAddress/:id',userAuth,profileController.getEditAddress);
router.get('/editAddress',userAuth,profileController.getEditAddress);
router.post("/editAddress/:addressId",userAuth,profileController.editAddress);
router.post("/deleteAddress/:addressId",userAuth,profileController.deleteAddress);

module.exports = router;
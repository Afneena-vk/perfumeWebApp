const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const wishlistController =require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController");
const passport = require("passport");
const { userAuth, adminAuth } = require("../middlewares/auth");


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
router.post('/product/:id/stock',userAuth,userController.getStockQuantity);


router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);


router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/editProfile",userAuth,profileController.getEditProfile);
router.post("/editProfile",userAuth,profileController.updateProfile);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);


router.get("/addAddress",userAuth,profileController.getAddAddress);
router.post('/addAddress',userAuth,profileController.addNewAddress);
router.get('/editAddress',userAuth,profileController.getEditAddress);
router.post("/editAddress",userAuth,profileController.editAddress);
router.post("/deleteAddress/:addressId",userAuth,profileController.deleteAddress);


router.get('/cart',userAuth,cartController.getCart);
router.post('/add-to-cart',userAuth,cartController.addToCart);
router.get('/remove-from-cart',userAuth,cartController.removeFromCart);
router.post('/update-cart-quantity',userAuth,cartController.updateCartQuantity);
router.get('/checkout',userAuth,checkoutController.getCheckoutPage);
router.post('/cart/apply-coupon',userAuth,checkoutController.applyCoupon);
router.get('/check-coupon-status',userAuth,checkoutController.checkCouponStatus);
router.post('/cart/remove-coupon',userAuth,checkoutController.removeCoupon);



router.post("/place-order",userAuth,orderController.placeOrder);
router.get('/order-confirmation',userAuth,orderController.getOrderConfirmation);
router.post("/verify-payment", userAuth,orderController.verifyPayment);
router.get("/payment-failurePage", userAuth,orderController.getPaymentFailure);

router.get("/orders",userAuth,orderController.getOrders);
router.post("/cancelOrder/:orderId", userAuth,orderController.cancelOrder);
router.patch('/requestReturn/:orderId',userAuth,orderController.requestReturn);
router.get("/view-order",userAuth,orderController.viewOrder);
router.post('/reinitiate-payment', userAuth, orderController.reinitiatePayment);

router.get('/order/download-pdf/:orderId',userAuth,orderController.generateOrderPDF);


router.get("/wishlist", userAuth, wishlistController.getWishlist);
router.post('/wishlist/toggle', userAuth, wishlistController.toggleWishlist);
router.delete('/wishlist/:productId',userAuth, wishlistController.deleteProductFromWishlist);

router.get('/wallet',userAuth,walletController.getWalletPage);
router.post("/wallet/add", userAuth, walletController.addMoney);
router.patch('/wallet/withdraw',userAuth, walletController.withdrawMoney);
  
router.post('/validate-cart-stock',userAuth,cartController.validateCartStock);
  

module.exports = router;
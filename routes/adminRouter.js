const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const {userAuth,adminAuth} = require("../middlewares/auth");
const productController = require("../controllers/admin/productController");
const brandController = require("../controllers/admin/brandController");
const orderManagementController = require("../controllers/admin/orderManagementController");
const couponController = require("../controllers/admin/couponController");
const salesReportController = require("../controllers/admin/salesReportController")

const multer = require("multer");
const storage = require('../helpers/multer');

const uploads = multer({storage:storage});

router.get("/pageerror",adminController.pageerror);
//login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);

//customer Management
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);
//category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);
router.post('/deleteCategory',adminAuth,categoryController.deleteCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);

//Brand Management
router.get("/brands",adminAuth,brandController.getBrandPage);
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand);
router.get("/blockBrand",adminAuth,brandController.blockBrand);
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand);
router.get("/deleteBrand",adminAuth,brandController.deleteBrand);



//product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);
router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);


//order Management
router.get('/order',adminAuth,orderManagementController.getOrderManagementPage);
router.get("/orders/view/:orderId", adminAuth,orderManagementController.getOrderDetails);
router.post('/update-order-status/:orderId',adminAuth,orderManagementController.updateStatus);


//coupon management
router.get("/coupons",adminAuth,couponController.coupon);
router.get("/create-coupon",adminAuth,couponController.createCoupon)
router.post("/create-coupon/add-coupon",adminAuth,couponController.addCoupon);
router.get('/coupons/edit/:couponId', adminAuth, couponController.editCoupon);
router.put('/coupons/:couponId', adminAuth, couponController.updateCoupon); 
router.delete("/coupons/delete-coupon/:couponId",adminAuth,couponController.deleteCoupon);


router.get("/sales-report", adminAuth, salesReportController.renderSalesReport);
router.post("/sales-report", adminAuth,salesReportController.generateSalesReport);
router.get('/sales-report/pdf',adminAuth,salesReportController.generateAndDownloadPDF);
router.get('/sales-report/excel',adminAuth,salesReportController.generateAndDownloadExcel);



module.exports = router;
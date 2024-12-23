const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const pageerror = async (req,res)=>{
    
        res.render("admin-error");

    } 

const loadLogin = (req,res)=>{

    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

const login = async(req,res)=>{
    try {

        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        if(admin){

          const passwordMatch = await bcrypt.compare(password,admin.password);
          if(passwordMatch){
              req.session.admin = true;
              return res.redirect("/admin");
          }else{
            
            return res.render("admin-login", { message: "Invalid email or password" });
          }
        }else {
         
            return res.render("admin-login", { message: "Invalid email or password" });
        }

    }catch (error) {
        console.log("login error",error);
        return res.redirect("/pageerror")
    }
}

async function getCategorySalesData(startDate, endDate) {
    try {
        const categoryData = await Order.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $unwind: '$orderedItems'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {
                $unwind: '$product'
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $group: {
                    _id: '$category._id',
                    category: { $first: '$category.name' },
                    totalSales: {
                        $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] }
                    }
                }
            },
            {
                $sort: { totalSales: -1 }
            }
        ]);
        return categoryData;
    } catch (error) {
        console.error('Error getting category sales data:', error);
        return [];
    }
}


async function getPaymentMethodsData(startDate, endDate) {
    try {
        const paymentData = await Order.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $unwind: '$payment'
            },
            {
                $group: {
                    _id: '$payment.method',
                    count: { $sum: 1 }
                }
            }
        ]);
        return paymentData;
    } catch (error) {
        console.error('Error getting payment methods data:', error);
        return [];
    }
}


async function getTopSellingItems(type, limit, startDate, endDate) {
    try {
        const pipeline = [
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $unwind: '$orderedItems'
            }
        ];

    
        if (type === 'product') {
            pipeline.push(
                {
                    $lookup: {
                        from: 'products',
                        localField: 'orderedItems.product',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $unwind: '$product'
                },
                {
                    $group: {
                        _id: '$product._id',
                        productName: { $first: '$product.productName' },
                        orderedItems: {
                            $push: {
                                quantity: '$orderedItems.quantity',
                                price: '$orderedItems.price'
                            }
                        }
                    }
                }
            );
        } else if (type === 'category') {
            pipeline.push(
                {
                    $lookup: {
                        from: 'products',
                        localField: 'orderedItems.product',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $unwind: '$product'
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'product.category',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $group: {
                        _id: '$category._id',
                        name: { $first: '$category.name' },
                        orderedItems: {
                            $push: {
                                quantity: '$orderedItems.quantity',
                                price: '$orderedItems.price'
                            }
                        }
                    }
                }
            );
        } else if (type === 'brand') {
            pipeline.push(
                {
                    $lookup: {
                        from: 'products',
                        localField: 'orderedItems.product',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $unwind: '$product'
                },
                {
                    $lookup: {
                        from: 'brands',
                        localField: 'product.brand',
                        foreignField: '_id',
                        as: 'brand'
                    }
                },
                {
                    $unwind: '$brand'
                },
                {
                    $group: {
                        _id: '$brand._id',
                        brandName: { $first: '$brand.brandName' },
                        orderedItems: {
                            $push: {
                                quantity: '$orderedItems.quantity',
                                price: '$orderedItems.price'
                            }
                        }
                    }
                }
            );
        }

        pipeline.push(
            {
                $sort: {
                    'orderedItems.quantity': -1
                }
            },
            {
                $limit: limit
            }
        );

        return await Order.aggregate(pipeline);
    } catch (error) {
        console.error(`Error getting top selling ${type}s:`, error);
        return [];
    }
}

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            const filter = req.query.filter || 'yearly';
            const customStartDate = req.query.startDate;
            const customEndDate = req.query.endDate;

            let startDate, endDate;
            const now = new Date();

            switch (filter) {
                case 'yearly':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                    break;
                case 'monthly':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                    break;
                case 'weekly':
                    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                    endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6));
                    endDate.setHours(23, 59, 59);
                    break;
                case 'daily':
                    startDate = new Date(now .setHours(0, 0, 0, 0));
                    endDate = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'custom':
                    startDate = new Date(customStartDate);
                    endDate = new Date(customEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            }

            const formatDate = (date) => {
                return date.toISOString().split('T')[0];
            };

            const categorySalesData = await getCategorySalesData(startDate, endDate);
            const paymentMethodsData = await getPaymentMethodsData(startDate, endDate);

            const topProducts = await getTopSellingItems('product', 10, startDate, endDate);
            const topCategories = await getTopSellingItems('category', 10, startDate, endDate);
            const topBrands = await getTopSellingItems('brand', 10, startDate, endDate);

            
            const calculateTotals = (items) => {
                return items.map(item => ({
                    ...item,
                    totalQuantity: item.orderedItems.reduce((sum, order) => sum + order.quantity, 0),
                    totalRevenue: item.orderedItems.reduce((sum, order) => sum + (order.price * order.quantity), 0)
                }));
            };

            const formattedTopProducts = calculateTotals(topProducts);
            const formattedTopCategories = calculateTotals(topCategories);
            const formattedTopBrands = calculateTotals(topBrands);

            const chartData = {
                categorySalesData: categorySalesData.length ? categorySalesData : [{ category: 'No Data', totalSales: 0 }],
                paymentMethodsData: paymentMethodsData.length ? paymentMethodsData : [{ _id: 'No Data', count: 0 }],
            };

            res.render("dashboard", {
                ...chartData,
                topProducts: formattedTopProducts,
                topCategories: formattedTopCategories,
                topBrands: formattedTopBrands,
                filter,
                customStartDate: formatDate(startDate),
                customEndDate: formatDate(endDate)
            });
        } catch (error) {
            console.log("Unexpected error during loading dashboard", error);
            res.status(500).send("An error occurred while loading the dashboard");
        }
    } else {
        res.redirect('/admin/login');
    }
};

const logout = async (req,res)=>{
    try {

        req.session.destroy((error)=>{
           if(error){
            console.log("Error destroying session",error);
            return res.redirect("/pageerror")
           }
           res.redirect("/admin/login")
           console.log("successfully logout");
        })
        
    } catch (error) {

        console.log(("unexpected error during logout",error));
        res.redirect("/pageerror")
        
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getCategorySalesData,
    getPaymentMethodsData,
    getTopSellingItems,
}
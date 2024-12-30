const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const mongoose = require("mongoose");

const env = require("dotenv").config();

const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const { cart } = require("./cartController");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema")
const Coupon = require("../../models/couponSchema")
const razorpayInstance = require('../../config/razorPay'); 
const Wallet =require("../../models/walletSchema")

const ReferralOffer = require('../../models/referralOfferSchema');
const Referral = require('../../models/referralSchema');



const applyReferralOffer = async (newUserId, referalCode) => {
    try {
        
        const referrer = await User.findOne({ referalCode });
        if (!referrer) {
            console.log('Invalid referral code');
            return;
        }

        const currentDate = new Date();
        const activeOffer = await ReferralOffer.findOne({
            status: 'active',
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });
        if (!activeOffer) {
            console.log('No active referral offer found');
            return;
        }

      
        const newReferral = new Referral({
            referrerUserId: referrer._id,
            refereeUserId: newUserId,
            rewardClaimed: true 
        });
        await newReferral.save();

        
        await User.findByIdAndUpdate(referrer._id, {
            $push: { referrals: newReferral._id }
        });

        
        let referrerRewardAmount = activeOffer.referrerReward;
        if (referrerRewardAmount > 0) {
            await creditWallet(
                referrer._id, 
                referrerRewardAmount, 
                'Referral reward for inviting a new user'
            );
        }

       
        if (activeOffer.refereeReward > 0) {
            await creditWallet(
                newUserId, 
                activeOffer.refereeReward, 
                'New user referral bonus'
            );
        } else if (activeOffer.walletCreditAmount > 0) {
            await creditWallet(
                newUserId, 
                activeOffer.walletCreditAmount, 
                'New user referral wallet credit'
            );
        }

      
        if (activeOffer.firstOrderDiscountPercentage > 0) {
            
            await storeFirstOrderDiscount(newUserId, activeOffer.firstOrderDiscountPercentage);
        }

        console.log('Referral offer applied successfully');
    } catch (error) {
        console.error('Error applying referral offer:', error);
    }
};

const creditWallet = async (userId, amount, description) => {
    try {
        let user = await User.findById(userId);
        if (!user) {
            console.error('User not found');
            return;
        }

       
        if (!user.wallet) {
            const newWallet = new Wallet({
                userId: user._id,
                balance: 0,
                transactions: []
            });
            const savedWallet = await newWallet.save();

            user = await User.findByIdAndUpdate(
                userId, 
                { wallet: savedWallet._id }, 
                { new: true }
            );
        }

        
        await Wallet.findByIdAndUpdate(user.wallet, {
            $inc: { balance: amount },
            $push: {
                transactions: {
                    type: 'CREDIT', 
                    amount: amount,
                    description: description,
                    date: new Date()
                }
            }
        });
    } catch (error) {
        console.error('Error crediting wallet:', error);
    }
};


const storeFirstOrderDiscount = async (userId, discountPercentage) => {
    try {
        
        const UserDiscount = mongoose.model('UserDiscount', {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            firstOrderDiscountPercentage: Number,
            isUsed: { type: Boolean, default: false }
        });

        await UserDiscount.create({
            userId,
            firstOrderDiscountPercentage: discountPercentage
        });
    } catch (error) {
        console.error('Error storing first order discount:', error);
    }
};



module.exports = { 
  applyReferralOffer, 
  creditWallet
 };
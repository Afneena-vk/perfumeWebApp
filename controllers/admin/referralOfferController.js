const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const ReferralOffer = require("../../models/referralOfferSchema");

const getReferralOffers = async (req, res) => {
    try {
      const referralOffers = await ReferralOffer.find();
      res.render("referral-offer", { referralOffers });
    } catch (error) {
      console.error("Error fetching referral offers:", error);
      res.status(500).send("An error occurred while fetching referral offers");
    }
  };

  const createReferralOffer = async (req, res) => {
    const { 
      offerCode, 
      title, 
      description, 
    
      walletCreditAmount,
      startDate, 
      endDate, 
      status
    } = req.body;

    console.log("offercde is given ",offerCode);
    console.log("title is given",title);
    console.log("description is given",description);
   
    console.log(" walletCreditAmount is", walletCreditAmount);
    console.log("startDate is",startDate);
    console.log("endDate", endDate);
    console.log("status", status);
  
    try {

      if (!offerCode || !title || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Required fields are missing"
        });
      }
  
      const existingReferralOfferCount = await ReferralOffer.countDocuments();
  
      
      if (existingReferralOfferCount > 0) {
        return res.status(400).json({
          success: false,
          message: "A referral offer already exists. Only one referral offer can be active at a time."
        });
      }
  
      

      const newReferralOffer = new ReferralOffer({
        offerCode,
        title,
        description,
        
        walletCreditAmount: Number(walletCreditAmount) || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status
      });
  
  
      await newReferralOffer.save();
    
      res.status(200).json({
        success: true,
        message: "Referral offer created successfully"
      });

    } catch (error) {
      console.error("Error creating referral offer:", error);
      

      res.status(500).json({
        success: false,
        message: error.message || "An error occurred while creating the referral offer"
      });

    }
  };
  
  const deleteReferralOffer = async (req, res) => {
    const { id } = req.params;
  
    try {
      const deletedOffer = await ReferralOffer.findByIdAndDelete(id);
      if (deletedOffer) {
        return res.status(200).json({ success: true });
      }
      return res.status(404).json({ success: false, message: 'Offer not found' });
    } catch (error) {
      console.error("Error deleting referral offer:", error);
      return res.status(500).json({ success: false, message: 'Failed to delete referral offer' });
    }
  };

  module.exports = {
      getReferralOffers,
      createReferralOffer,
      deleteReferralOffer,
  };
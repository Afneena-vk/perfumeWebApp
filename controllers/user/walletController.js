const mongoose = require("mongoose");
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');

const getWalletPage = async (req, res) => {
    try {
      const userSession = req.session.user || req.user; 
      if (!userSession) {
        return res.status(400).json({ message: "User not authenticated" }); 
      }
      
      const userId = userSession; 
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
  
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId });
        await wallet.save();
      }
  
      const totalTransactions = wallet.transactions.length;
      const totalPages = Math.ceil(totalTransactions / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
  
      
      wallet.transactions.sort((a, b) => b.date - a.date);
  
      
      const paginatedTransactions = wallet.transactions.slice(startIndex, endIndex);
      wallet.transactions = paginatedTransactions;
  
      const userData =  await User.findOne({ _id: userSession._id });
      res.locals.user = userData;
      
      res.render("wallet", {
        wallet,
        transactions: paginatedTransactions,
        currentPage: page,
        totalPages: totalPages,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
 
  
  const addMoney = async (req, res) => {
    try {
      const { amount } = req.body;
  
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
  
      
      const userSession = req.session.user || req.user;

      if (!userSession || !userSession._id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
  
      const userId = userSession._id;
      
      
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }
  
    
      wallet.balance += parseFloat(amount);
  
      
      wallet.transactions.push({
        type: 'CREDIT',
        amount: parseFloat(amount),
        description: 'Added money to wallet',
        date: new Date(),
      });
  
      await wallet.save();
  
      res.status(200).json({
        message: 'Money added successfully',
        balance: wallet.balance,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  const withdrawMoney = async (req, res) => {
    try {
      const { amount } = req.body;
  
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
  
      
      const userId = req.session.user?._id || req.user?._id;
  
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
  
      
      if (wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }
  
      
      wallet.balance -= parseFloat(amount);
      wallet.transactions.push({
        type: 'DEBIT',
        amount: parseFloat(amount),
        description: 'Withdrawn from wallet',
        date: new Date(),
      });
  
      await wallet.save();
  
      res.status(200).json({
        message: 'Money withdrawn successfully',
        balance: wallet.balance,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  

 

  module.exports = {
    getWalletPage,
    addMoney,
    withdrawMoney,
   
  }
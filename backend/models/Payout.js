const mongoose=require('mongoose');
const payoutSchema=new mongoose.Schema({
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},
  farmer:{type:mongoose.Schema.Types.ObjectId,ref:'Farmer',required:true,index:true},
  batch:{type:mongoose.Schema.Types.ObjectId,ref:'Batch'},
  produceIntakeIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Batch'}],
  amount:{type:Number,required:true,min:0},totalAmount:{type:Number,min:0},
  paymentMethod:{type:String,enum:['UPI','BANK_TRANSFER','CASH'],default:'BANK_TRANSFER'},
  fundedFrom:{type:String,enum:['FPO_CASH','CREDIT_LINE'],default:'FPO_CASH'},
  status:{type:String,enum:['Pending','Completed','Failed'],default:'Pending'},
  transactionId:{type:String,trim:true},paymentDate:{type:Date},paidAt:{type:Date}
},{timestamps:true});
module.exports=mongoose.model('Payout',payoutSchema);

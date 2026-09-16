const mongoose=require('mongoose');
const fpoOrderSchema=new mongoose.Schema({
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},listing:{type:mongoose.Schema.Types.ObjectId,ref:'Listing',required:true},
  consumer:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},quantityKg:{type:Number,required:true,min:0.001},totalPrice:{type:Number,required:true,min:0},
  buyerType:{type:String,enum:['INDIVIDUAL','RESTAURANT','KIRANA','WHOLESALER'],default:'INDIVIDUAL'},gradeOrdered:{type:String,enum:['A','B','C','Custom']},
  status:{type:String,enum:['Placed','Accepted','Rejected','Packed','Dispatched','Delivered','Cancelled','Refunded'],default:'Placed'},
  cancelReason:{type:String,default:''},rejectionReason:{type:String,default:''},refundStatus:{type:String,enum:['NotRequired','Pending','Processed','Failed'],default:'NotRequired'},refundTransactionId:{type:String}
},{timestamps:true});
module.exports=mongoose.model('FpoOrder',fpoOrderSchema);

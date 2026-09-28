const mongoose=require('mongoose');
const fpoOrderSchema=new mongoose.Schema({
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},listing:{type:mongoose.Schema.Types.ObjectId,ref:'Listing',required:true},
  consumer:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},quantityKg:{type:Number,required:true,min:0.001},totalPrice:{type:Number,required:true,min:0},
  buyerType:{type:String,enum:['INDIVIDUAL','RESTAURANT','KIRANA','WHOLESALER'],default:'INDIVIDUAL'},gradeOrdered:{type:String,enum:['A','B','C','Custom']},
  status:{type:String,enum:['Placed','Accepted','Rejected','Packed','Dispatched','Delivered','Cancelled','Refunded'],default:'Placed'},
  cancelReason:{type:String,default:''},rejectionReason:{type:String,default:''},returnReason:{type:String,default:''},refundStatus:{type:String,enum:['NotRequired','Pending','Processed','Failed'],default:'NotRequired'},refundTransactionId:{type:String},
  deliveryAddress: {
    fullName: { type: String },
    phone: { type: String },
    streetAddress: { type: String },
    landmark: { type: String, default: '' },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  },
  deliverySlot: { type: String, default: 'Standard Delivery' },
  paymentMethod: { type: String, default: 'CARD' },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  // Platform fee split (filled by services/paymentService.js at payment time)
  platformFee: { type: Number, default: 0, min: 0 },
  platformFeePercent: { type: Number, default: 0 },
  fpoAmount: { type: Number, default: 0, min: 0 },
  totalCharged: { type: Number, default: 0, min: 0 },
  paymentTransactionId: { type: String, index: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' }
},{timestamps:true});
module.exports=mongoose.model('FpoOrder',fpoOrderSchema);

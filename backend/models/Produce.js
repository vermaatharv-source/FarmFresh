const mongoose=require('mongoose');
const produceSchema=new mongoose.Schema({
  farmerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},name:{type:String,required:true},category:{type:String,required:true},
  pricePerKg:{type:Number,required:true},quantityAvailable:{type:Number,required:true},imageUrl:{type:String,default:''},location:{type:String,required:true},
  requestedFpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo'},
  fpoApprovalStatus:{type:String,enum:['NotRequested','Pending','Approved','Rejected'],default:'NotRequested'},
  approvedByFpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo'},fpoApprovalReason:{type:String,default:''},fpoApprovedAt:{type:Date}
},{timestamps:true});
module.exports=mongoose.model('Produce',produceSchema);

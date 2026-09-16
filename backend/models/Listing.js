const mongoose=require('mongoose');
const listingSchema=new mongoose.Schema({
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},
  produceType:{type:String,required:true,trim:true},grade:{type:String,enum:['A','B','C','Custom'],required:true},
  pricePerKg:{type:Number,required:true,min:0},availableQuantityKg:{type:Number,required:true,min:0},
  minOrderQtyKg:{type:Number,default:1,min:0.001},description:{type:String,default:''},images:[String],
  sourceBatch:{type:mongoose.Schema.Types.ObjectId,ref:'Batch'},sourceIntakeId:{type:mongoose.Schema.Types.ObjectId,ref:'Batch'},
  status:{type:String,enum:['Draft','Published','Paused'],default:'Draft'}
},{timestamps:true});
module.exports=mongoose.model('Listing',listingSchema);

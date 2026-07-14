const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Produce = require('./models/Produce');

dotenv.config();

const farmers = [
  { name: 'Ramesh Kumar', email: 'ramesh@farmfresh.com', location: 'Delhi' },
  { name: 'Suresh Patel', email: 'suresh@farmfresh.com', location: 'Punjab' },
  { name: 'Lakshmi Devi', email: 'lakshmi@farmfresh.com', location: 'Karnataka' }
];

const produceList = [
  { name: 'Tomatoes', category: 'Vegetable', pricePerKg: 40, quantityAvailable: 120, imageUrl: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400' },
  { name: 'Onions', category: 'Vegetable', pricePerKg: 30, quantityAvailable: 200, imageUrl: 'https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400' },
  { name: 'Potatoes', category: 'Vegetable', pricePerKg: 25, quantityAvailable: 150, imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400' },
  { name: 'Spinach', category: 'Leafy Green', pricePerKg: 20, quantityAvailable: 60, imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400' },
  { name: 'Carrots', category: 'Vegetable', pricePerKg: 35, quantityAvailable: 90, imageUrl: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=400' },
  { name: 'Mangoes', category: 'Fruit', pricePerKg: 80, quantityAvailable: 100, imageUrl: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400' },
  { name: 'Bananas', category: 'Fruit', pricePerKg: 45, quantityAvailable: 140, imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400' },
  { name: 'Apples', category: 'Fruit', pricePerKg: 120, quantityAvailable: 70, imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400' },
  { name: 'Cauliflower', category: 'Vegetable', pricePerKg: 30, quantityAvailable: 80, imageUrl: 'https://images.unsplash.com/photo-1568584711271-946d604c8fc2?w=400' },
  { name: 'Green Chillies', category: 'Vegetable', pricePerKg: 60, quantityAvailable: 40, imageUrl: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const farmerDocs = [];

    for (const f of farmers) {
      let user = await User.findOne({ email: f.email });
      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        user = await User.create({
          name: f.name,
          email: f.email,
          password: hashedPassword,
          role: 'farmer',
          location: f.location
        });
        console.log('Created farmer:', f.name);
      } else {
        console.log('Farmer already exists:', f.name);
      }
      farmerDocs.push(user);
    }

    for (let i = 0; i < produceList.length; i++) {
      const item = produceList[i];
      const farmer = farmerDocs[i % farmerDocs.length];

      const exists = await Produce.findOne({ name: item.name, farmerId: farmer._id });
      if (!exists) {
        await Produce.create({
          farmerId: farmer._id,
          name: item.name,
          category: item.category,
          pricePerKg: item.pricePerKg,
          quantityAvailable: item.quantityAvailable,
          location: farmer.location,
          imageUrl: item.imageUrl
        });
        console.log('Added produce:', item.name, 'for', farmer.name);
      } else {
        console.log('Produce already exists:', item.name);
      }
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
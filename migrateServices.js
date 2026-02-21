import mongoose from 'mongoose';
import Vendor from './server/models/Vendor.js';
import Service from './server/models/Service.js';

const MONGO_URI = 'mongodb://localhost:27017/bapve'; // change this

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

async function createServicesForVendors() {
  const vendors = await Vendor.find({ verificationStatus: 'verified' });

  for (const vendor of vendors) {
    const existingServices = await Service.find({ vendor: vendor._id });
    if (!existingServices || existingServices.length === 0) {
      const defaultServices = vendor.serviceCategories.map(cat => ({
        title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Service`,
        description: `Professional ${cat.replace('-', ' ')} service by ${vendor.businessName}`,
        category: cat,
        pricing: { type: 'fixed', amount: 500, unit: 'per job' },
        images: [],
        vendor: vendor._id,
        isActive: true,
      }));

      const insertedServices = await Service.insertMany(defaultServices);

      vendor.services = insertedServices.map(s => s._id);
      await vendor.save();

      console.log(`Added ${insertedServices.length} services for vendor: ${vendor.businessName}`);
    }
  }

  console.log('All verified vendors processed');
  mongoose.disconnect();
}

createServicesForVendors().catch(err => console.error(err));

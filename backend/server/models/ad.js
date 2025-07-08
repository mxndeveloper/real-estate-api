import mongoose from "mongoose";
const { Schema, ObjectId } = mongoose;

// Define Point schema type separately
const pointSchema = new Schema({
  type: {
    type: String,
    enum: ["Point"],
    required: true,
    default: "Point"
  },
  coordinates: {
    type: [Number],
    required: true,
    default: [151.2076681, -33.8624587] // Sydney coordinates as fallback
  }
});

const adSchema = new Schema(
  {
    photos: [{}],
    price: {
      type: String,
      maxLength: 255,
      index: true,
    },
    address: {
      type: String,
      maxLength: 255,
      index: true,
    },
    propertytype: {  // Fixed typo from 'properytype'
      type: String,
      default: "Apartment",
      enum: ["House", "Apartment", "Townhouse", "Land"],
    },
    bedrooms: Number,
    bathrooms: Number,
    landsize: Number,
    landsizetype: String,
    carpark: Number,
    location: pointSchema,  // Using the defined pointSchema
    googleMap: {},
    title: {
      type: String,
      maxLength: 255,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      lowercase: true,
    },
    description: {},
    features: {},
    nearby: {},
    postedBy: {
      type: ObjectId,
      ref: "User",
    },
    published: {
      type: Boolean,
      default: true,
    },
    action: {
      type: String,
      default: "Sell",
      enum: ["Sell", "Rent"],
    },
    views: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "In market",
        "Deposit taken",
        "Under offer",
        "Contact agent",
        "Sold",
        "Rented",
        "Off market",
      ],
      default: "In market",
    },
    inspectionTime: String,
  },
  { timestamps: true }
);

// Create geospatial index
adSchema.index({ location: "2dsphere" });

export default mongoose.model("Ad", adSchema);
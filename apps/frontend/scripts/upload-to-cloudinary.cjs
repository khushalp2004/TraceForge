
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const publicDir = path.join(__dirname, '../public');
const filesToUpload = [
  'product-demo.mp4',
  'traceforge-dashboard.png',
  'traceforge-logo.svg'
];

async function uploadFiles() {
  console.log('Starting upload to Cloudinary...');
  
  for (const file of filesToUpload) {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found, skipping: ${file}`);
      continue;
    }
    
    console.log(`Uploading ${file}...`);
    try {
      const resourceType = file.endsWith('.mp4') ? 'video' : 'image';
      // Use the original filename without extension as the public_id
      const publicId = path.parse(file).name;
      
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: resourceType,
        public_id: `traceforge/${publicId}`,
        overwrite: true
      });
      
      console.log(`✅ Uploaded ${file}! URL: ${result.secure_url}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
    }
  }
  
  console.log('Upload complete.');
}

uploadFiles();

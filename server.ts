import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.resolve(process.cwd(), 'data', 'uploads')));

// Direct APK download route for FoodHub Rider Android App
app.get(['/download/FoodHub-Rider.apk', '/FoodHub-Rider.apk'], (_req, res) => {
  const apkPath = path.resolve(process.cwd(), 'public', 'FoodHub-Rider.apk');
  if (fs.existsSync(apkPath)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="FoodHub-Rider.apk"');
    return res.sendFile(apkPath);
  }
  return res.status(404).send('APK file not found');
});

// Path to persistent data file
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial in-memory & file-persisted state
interface ServerState {
  supabaseConfig: { url: string; anonKey: string };
  pausedRiderIds: string[];
  pausedVendorIds: string[];
  zones: any[];
  riders: any[];
  vendors: any[];
  orders: any[];
  settings: any;
  menuItems: any[];
  foodCategories: any[];
  adBanners: any[];
  customers: any[];
  addresses: any[];
  customerCarts: Record<string, { items: any[]; vendor: any; updatedAt: string }>;
  reviews?: any[];
  favorites?: any[];
  otpSenders?: any[];
  updatedAt: string;
}

const INITIAL_SERVER_STATE: ServerState = {
  supabaseConfig: {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || ''
  },
  pausedRiderIds: [],
  pausedVendorIds: [],
  customers: [],
  addresses: [],
  customerCarts: {},
  reviews: [],
  favorites: [],
  otpSenders: [],
  zones: [
    {
      id: 'zone-001',
      name: 'Chawkbazar Zone',
      bn_name: 'চকবাজার জোন',
      description: 'Chawkbazar, Parade Square, Chatteshwari, Gani Bakery, DC Hill',
      center_latitude: 22.3590,
      center_longitude: 91.8380,
      radius_km: 2.5,
      color: '#E11D48',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'zone-002',
      name: 'GEC Zone',
      bn_name: 'জিইসি জোন',
      description: 'GEC Circle, CDA Avenue, Dampara, Golpahar, Prabartak Circle',
      center_latitude: 22.3595,
      center_longitude: 91.8215,
      radius_km: 2.5,
      color: '#2563EB',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'zone-003',
      name: 'Khulshi Zone',
      bn_name: 'খুলশী জোন',
      description: 'South Khulshi, North Khulshi, Zakir Hossain Road, Wireless Gate',
      center_latitude: 22.3650,
      center_longitude: 91.8150,
      radius_km: 2.5,
      color: '#7C3AED',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'zone-004',
      name: 'Agrabad Zone',
      bn_name: 'আগ্রাবাদ জোন',
      description: 'Commercial Area, Badamtali, Sheikh Mujib Road, Chowmuhani',
      center_latitude: 22.3275,
      center_longitude: 91.8120,
      radius_km: 3.0,
      color: '#059669',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'zone-005',
      name: 'Nasirabad Zone',
      bn_name: 'নাসিরাবাদ জোন',
      description: 'Nasirabad Housing, Polytechnic, Baizid Bostami, Sholashahar',
      center_latitude: 22.3780,
      center_longitude: 91.8250,
      radius_km: 3.0,
      color: '#D97706',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'zone-006',
      name: 'Halishahar Zone',
      bn_name: 'হালিশহর জোন',
      description: 'Halishahar Housing Estate, Boropool, Rampur, Block A-L',
      center_latitude: 22.3350,
      center_longitude: 91.7850,
      radius_km: 3.5,
      color: '#0D9488',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  riders: [],
  vendors: [],
  orders: [],
  settings: null,
  menuItems: [],
  foodCategories: [],
  adBanners: [],
  updatedAt: new Date().toISOString()
};

function loadState(): ServerState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...INITIAL_SERVER_STATE, ...parsed };
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return { ...INITIAL_SERVER_STATE };
}

function saveState(state: ServerState) {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

let serverState = loadState();

// -------------------------------------------------------------
// REST API ENDPOINTS FOR MULTI-BROWSER SYNCHRONIZATION
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Global sync endpoint
app.get('/api/sync', (_req, res) => {
  res.json(serverState);
});

// 3. Supabase Config sharing (allows all browsers to automatically inherit the configured DB)
app.get('/api/config', (_req, res) => {
  res.json(serverState.supabaseConfig);
});

app.post('/api/config', (req, res) => {
  const { url, anonKey } = req.body;
  serverState.supabaseConfig = {
    url: (url || '').trim(),
    anonKey: (anonKey || '').trim()
  };
  saveState(serverState);
  res.json({ success: true, config: serverState.supabaseConfig });
});

// 3B. Zones API (Rider Zones / Delivery Zones)
app.get('/api/zones', (_req, res) => {
  if (!serverState.zones || !Array.isArray(serverState.zones) || serverState.zones.length === 0) {
    serverState.zones = INITIAL_SERVER_STATE.zones;
    saveState(serverState);
  }
  res.json(serverState.zones);
});

// Create new Zone
app.post('/api/zones', (req, res) => {
  const newZone = req.body;
  if (!newZone.id) {
    newZone.id = `zone-${Date.now()}`;
  }
  if (!serverState.zones) serverState.zones = [];
  
  const existingIdx = serverState.zones.findIndex(z => z.id === newZone.id || (newZone.name && z.name.toLowerCase() === newZone.name.toLowerCase()));
  if (existingIdx >= 0) {
    serverState.zones[existingIdx] = { ...serverState.zones[existingIdx], ...newZone, updated_at: new Date().toISOString() };
    saveState(serverState);
    return res.json({ success: true, zone: serverState.zones[existingIdx] });
  }

  const zoneToSave = {
    id: newZone.id,
    name: newZone.name,
    bn_name: newZone.bn_name || '',
    description: newZone.description || '',
    center_latitude: Number(newZone.center_latitude) || 22.3590,
    center_longitude: Number(newZone.center_longitude) || 91.8380,
    radius_km: Number(newZone.radius_km) || 3.0,
    boundary_coordinates: newZone.boundary_coordinates || [],
    color: newZone.color || '#E11D48',
    is_active: newZone.is_active !== false,
    created_at: newZone.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  serverState.zones.push(zoneToSave);
  saveState(serverState);
  console.log(`[API] Zone created: ${zoneToSave.name} (${zoneToSave.id})`);
  res.json({ success: true, zone: zoneToSave });
});

// Update Zone
app.put('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!serverState.zones) serverState.zones = [];

  const idx = serverState.zones.findIndex(z => z.id === id);
  if (idx >= 0) {
    serverState.zones[idx] = { 
      ...serverState.zones[idx], 
      ...updates, 
      updated_at: new Date().toISOString() 
    };
    saveState(serverState);
    return res.json({ success: true, zone: serverState.zones[idx] });
  }

  res.status(404).json({ success: false, message: 'Zone not found' });
});

// Delete Zone
app.delete('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.zones) serverState.zones = [];
  serverState.zones = serverState.zones.filter(z => z.id !== id);
  saveState(serverState);
  res.json({ success: true });
});

// 4. Riders API
app.get('/api/riders', (_req, res) => {
  res.json(serverState.riders);
});

// Admin Pause/Resume Rider endpoint
app.post('/api/riders/:id/pause', (req, res) => {
  const { id } = req.params;
  const { is_paused } = req.body;

  let targetRider = serverState.riders.find(r => r.id === id);
  if (!targetRider) {
    // If rider doesn't exist yet, create a placeholder
    targetRider = {
      id,
      name: `Rider ${id}`,
      phone: '',
      is_online: false,
      is_paused: false
    };
    serverState.riders.push(targetRider);
  }

  const nextPaused = typeof is_paused === 'boolean' ? is_paused : !targetRider.is_paused;
  targetRider.is_paused = nextPaused;
  if (nextPaused) {
    targetRider.is_online = false;
    if (!serverState.pausedRiderIds.includes(id)) {
      serverState.pausedRiderIds.push(id);
    }
  } else {
    serverState.pausedRiderIds = serverState.pausedRiderIds.filter(pid => pid !== id);
  }

  saveState(serverState);
  console.log(`[API] Rider ${id} pause toggled -> is_paused: ${nextPaused}`);
  res.json({ 
    success: true, 
    rider: targetRider, 
    is_paused: nextPaused, 
    pausedRiderIds: serverState.pausedRiderIds 
  });
});

// Update Rider (online status, GPS location, profile)
app.put('/api/riders/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  let targetRider = serverState.riders.find(r => r.id === id);
  if (!targetRider) {
    targetRider = { id, ...updates };
    serverState.riders.push(targetRider);
  } else {
    Object.assign(targetRider, updates);
  }

  // If paused, rider cannot be online
  if (targetRider.is_paused && targetRider.is_online) {
    targetRider.is_online = false;
  }

  saveState(serverState);
  res.json({ success: true, rider: targetRider });
});

// Register or Add Rider
app.post('/api/riders', (req, res) => {
  const newRider = req.body;
  if (!newRider.id) {
    newRider.id = `r-${Date.now()}`;
  }
  const existingIdx = serverState.riders.findIndex(r => r.id === newRider.id || (newRider.phone && r.phone === newRider.phone));
  if (existingIdx >= 0) {
    serverState.riders[existingIdx] = { ...serverState.riders[existingIdx], ...newRider };
  } else {
    serverState.riders.push(newRider);
  }
  saveState(serverState);
  res.json({ success: true, rider: newRider });
});

// Delete Rider
app.delete('/api/riders/:id', (req, res) => {
  const { id } = req.params;
  serverState.riders = serverState.riders.filter(r => r.id !== id);
  serverState.pausedRiderIds = serverState.pausedRiderIds.filter(pid => pid !== id);
  saveState(serverState);
  res.json({ success: true });
});

// 5. Orders API
app.get('/api/orders', (_req, res) => {
  res.json(serverState.orders);
});

app.post('/api/orders', (req, res) => {
  const order = req.body;
  serverState.orders = [order, ...serverState.orders.filter(o => o.id !== order.id)];
  saveState(serverState);
  res.json({ success: true, order });
});

app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const idx = serverState.orders.findIndex(o => o.id === id);
  if (idx >= 0) {
    serverState.orders[idx] = { ...serverState.orders[idx], ...updates };
  }
  saveState(serverState);
  res.json({ success: true, order: serverState.orders[idx] });
});

// 6. Vendors API
app.get('/api/vendors', (_req, res) => {
  if (!serverState.vendors) serverState.vendors = [];
  res.json(serverState.vendors);
});

app.post('/api/vendors', (req, res) => {
  if (!serverState.vendors) serverState.vendors = [];
  const newVendor = req.body;
  if (!newVendor.id) newVendor.id = `v-${Date.now()}`;
  const existingIdx = serverState.vendors.findIndex(v => v.id === newVendor.id || (newVendor.phone && v.phone === newVendor.phone));
  if (existingIdx >= 0) {
    serverState.vendors[existingIdx] = { ...serverState.vendors[existingIdx], ...newVendor, updated_at: new Date().toISOString() };
    saveState(serverState);
    return res.json({ success: true, vendor: serverState.vendors[existingIdx] });
  }
  serverState.vendors.unshift(newVendor);
  saveState(serverState);
  res.json({ success: true, vendor: newVendor });
});

app.put('/api/vendors/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!serverState.vendors) serverState.vendors = [];
  const idx = serverState.vendors.findIndex(v => v.id === id);
  if (idx >= 0) {
    serverState.vendors[idx] = { ...serverState.vendors[idx], ...updates, updated_at: new Date().toISOString() };
    saveState(serverState);
    return res.json({ success: true, vendor: serverState.vendors[idx] });
  }
  res.status(404).json({ success: false, message: 'Vendor not found' });
});

app.delete('/api/vendors/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.vendors) serverState.vendors = [];
  serverState.vendors = serverState.vendors.filter(v => v.id !== id);
  saveState(serverState);
  res.json({ success: true });
});

app.post('/api/vendors/:id/pause', (req, res) => {
  const { id } = req.params;
  const { is_paused } = req.body;
  let target = serverState.vendors.find(v => v.id === id);
  if (target) {
    target.is_paused = typeof is_paused === 'boolean' ? is_paused : !target.is_paused;
  }
  saveState(serverState);
  res.json({ success: true, vendor: target });
});

// 6B. Menu Items API
app.get('/api/menu-items', (req, res) => {
  if (!serverState.menuItems) serverState.menuItems = [];
  const { vendor_id } = req.query;
  if (vendor_id) {
    return res.json(serverState.menuItems.filter(m => m.vendor_id === vendor_id));
  }
  res.json(serverState.menuItems);
});

app.post('/api/menu-items', (req, res) => {
  if (!serverState.menuItems) serverState.menuItems = [];
  const newItem = req.body;
  if (!newItem.id) newItem.id = `m-${Date.now()}`;
  const existingIdx = serverState.menuItems.findIndex(m => m.id === newItem.id);
  if (existingIdx >= 0) {
    serverState.menuItems[existingIdx] = { ...serverState.menuItems[existingIdx], ...newItem };
    saveState(serverState);
    return res.json({ success: true, item: serverState.menuItems[existingIdx] });
  }
  serverState.menuItems.push(newItem);
  saveState(serverState);
  res.json({ success: true, item: newItem });
});

app.put('/api/menu-items/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!serverState.menuItems) serverState.menuItems = [];
  const idx = serverState.menuItems.findIndex(m => m.id === id);
  if (idx >= 0) {
    serverState.menuItems[idx] = { ...serverState.menuItems[idx], ...updates };
    saveState(serverState);
    return res.json({ success: true, item: serverState.menuItems[idx] });
  }
  res.status(404).json({ success: false, message: 'Item not found' });
});

app.delete('/api/menu-items/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.menuItems) serverState.menuItems = [];
  serverState.menuItems = serverState.menuItems.filter(m => m.id !== id);
  saveState(serverState);
  res.json({ success: true });
});

// 6C. Food Categories API
app.get('/api/food-categories', (_req, res) => {
  if (!serverState.foodCategories) serverState.foodCategories = [];
  res.json(serverState.foodCategories);
});

app.post('/api/food-categories', (req, res) => {
  if (!serverState.foodCategories) serverState.foodCategories = [];
  const newCat = req.body;
  if (!newCat.id) newCat.id = `cat-${Date.now()}`;
  const idx = serverState.foodCategories.findIndex(c => c.id === newCat.id || c.name.toLowerCase() === newCat.name.toLowerCase());
  if (idx >= 0) {
    serverState.foodCategories[idx] = { ...serverState.foodCategories[idx], ...newCat };
  } else {
    serverState.foodCategories.push(newCat);
  }
  saveState(serverState);
  res.json({ success: true, category: newCat });
});

app.delete('/api/food-categories/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.foodCategories) serverState.foodCategories = [];
  serverState.foodCategories = serverState.foodCategories.filter(c => c.id !== id);
  saveState(serverState);
  res.json({ success: true });
});

// 6D. Promotional Ad Banners API
app.get('/api/banners', (_req, res) => {
  if (!serverState.adBanners) serverState.adBanners = [];
  res.json(serverState.adBanners);
});

app.post('/api/banners', (req, res) => {
  if (!serverState.adBanners) serverState.adBanners = [];
  const newBanner = req.body;
  if (!newBanner.id) newBanner.id = `ad-${Date.now()}`;
  if (!newBanner.created_at) newBanner.created_at = new Date().toISOString();

  const existingIdx = serverState.adBanners.findIndex(b => b.id === newBanner.id);
  if (existingIdx >= 0) {
    serverState.adBanners[existingIdx] = { ...serverState.adBanners[existingIdx], ...newBanner };
  } else {
    serverState.adBanners.unshift(newBanner);
  }
  saveState(serverState);
  console.log(`[API] Banner saved: ${newBanner.id} (${newBanner.portal_type || 'food'})`);
  res.json({ success: true, banner: newBanner });
});

app.put('/api/banners/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!serverState.adBanners) serverState.adBanners = [];
  const idx = serverState.adBanners.findIndex(b => b.id === id);
  if (idx >= 0) {
    serverState.adBanners[idx] = { ...serverState.adBanners[idx], ...updates };
    saveState(serverState);
    return res.json({ success: true, banner: serverState.adBanners[idx] });
  }
  res.status(404).json({ success: false, message: 'Banner not found' });
});

app.delete('/api/banners/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.adBanners) serverState.adBanners = [];
  serverState.adBanners = serverState.adBanners.filter(b => b.id !== id);
  saveState(serverState);
  console.log(`[API] Banner deleted: ${id}`);
  res.json({ success: true });
});

// File Upload Endpoint (Saves vendor profile & cover images into data/uploads/images/:folderName/)
app.post('/api/upload', (req, res) => {
  try {
    const { folderName, fileName, fileData } = req.body;
    if (!folderName || !fileName || !fileData) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }
    const safeFolder = (folderName || 'vendor').replace(/[^a-z0-9_-]/gi, '_');
    const safeFile = (fileName || 'image.png').replace(/[^a-z0-9_.-]/gi, '_');
    const targetDir = path.resolve(process.cwd(), 'data', 'uploads', 'images', safeFolder);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.json({ success: true, url: fileData });
    }
    
    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = path.join(targetDir, safeFile);
    fs.writeFileSync(filePath, buffer);
    
    const publicUrl = `/uploads/images/${safeFolder}/${safeFile}`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Upload endpoint error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Delete uploaded image endpoint
app.post('/api/upload/delete', (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'Missing url' });
    if (typeof url === 'string' && url.startsWith('/uploads/images/')) {
      const relPath = url.replace(/^\/uploads\/images\//, '');
      const filePath = path.resolve(process.cwd(), 'data', 'uploads', 'images', relPath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[API] Deleted physical file: ${filePath}`);
        } catch (unlinkErr) {
          console.warn('[API] Could not delete physical file:', unlinkErr);
        }
      }
    }
    res.json({ success: true, message: 'File deleted from server storage' });
  } catch (err) {
    console.error('Delete upload endpoint error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

// 7. Customer Cart API (Saved to database per individual customer account)
app.get('/api/cart/:customerId', (req, res) => {
  const { customerId } = req.params;
  if (!serverState.customerCarts) serverState.customerCarts = {};
  const userCart = serverState.customerCarts[customerId] || { items: [], vendor: null, updatedAt: new Date().toISOString() };
  res.json({ success: true, cart: userCart });
});

app.post('/api/cart/:customerId', (req, res) => {
  const { customerId } = req.params;
  const { items, vendor } = req.body;
  if (!serverState.customerCarts) serverState.customerCarts = {};
  serverState.customerCarts[customerId] = {
    items: Array.isArray(items) ? items : [],
    vendor: vendor || null,
    updatedAt: new Date().toISOString()
  };
  saveState(serverState);
  res.json({ success: true, cart: serverState.customerCarts[customerId] });
});

app.delete('/api/cart/:customerId', (req, res) => {
  const { customerId } = req.params;
  if (!serverState.customerCarts) serverState.customerCarts = {};
  delete serverState.customerCarts[customerId];
  saveState(serverState);
  res.json({ success: true });
});

// 8. Customers API (Customer Accounts Database)
app.get('/api/customers', (_req, res) => {
  if (!serverState.customers) serverState.customers = [];
  res.json(serverState.customers);
});

app.post('/api/customers', (req, res) => {
  const newCustomer = req.body;
  if (!serverState.customers) serverState.customers = [];
  const oldPhone = newCustomer.oldPhone;
  const cleanNewPhone = (newCustomer.phone || '').replace(/\D/g, '');
  const cleanOldPhone = (oldPhone || '').replace(/\D/g, '');

  const existingIdx = serverState.customers.findIndex(c => 
    (newCustomer.id && c.id === newCustomer.id) || 
    (cleanOldPhone && c.phone && c.phone.replace(/\D/g, '') === cleanOldPhone) ||
    (cleanNewPhone && c.phone && c.phone.replace(/\D/g, '') === cleanNewPhone)
  );

  const customerToSave = {
    ...newCustomer,
    updated_at: new Date().toISOString()
  };
  delete customerToSave.oldPhone;

  if (existingIdx >= 0) {
    serverState.customers[existingIdx] = { 
      ...serverState.customers[existingIdx], 
      ...customerToSave 
    };
  } else {
    serverState.customers.push({
      ...customerToSave,
      created_at: customerToSave.created_at || new Date().toISOString()
    });
  }

  // If phone/name changed, update customer's addresses
  if (customerToSave.phone && serverState.addresses) {
    const custId = customerToSave.id;
    serverState.addresses.forEach(a => {
      const aClean = (a.customer_phone || '').replace(/\D/g, '');
      if (
        (custId && a.customer_id === custId) || 
        (cleanOldPhone && aClean === cleanOldPhone) || 
        (cleanNewPhone && aClean === cleanNewPhone)
      ) {
        a.customer_phone = customerToSave.phone;
        if (customerToSave.name) a.customer_name = customerToSave.name;
        if (custId) a.customer_id = custId;
      }
    });
  }

  saveState(serverState);
  console.log(`[API] Customer saved/updated: ${customerToSave.name} (${customerToSave.phone})`);
  res.json({ success: true, customer: existingIdx >= 0 ? serverState.customers[existingIdx] : customerToSave });
});

// Update Customer by ID
app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!serverState.customers) serverState.customers = [];

  const oldPhone = updates.oldPhone;
  const cleanNewPhone = (updates.phone || '').replace(/\D/g, '');
  const cleanOldPhone = (oldPhone || '').replace(/\D/g, '');

  let existingIdx = serverState.customers.findIndex(c => c.id === id);
  if (existingIdx === -1 && cleanOldPhone) {
    existingIdx = serverState.customers.findIndex(c => 
      c.phone && c.phone.replace(/\D/g, '') === cleanOldPhone
    );
  }

  const updatesToSave = {
    ...updates,
    id,
    updated_at: new Date().toISOString()
  };
  delete updatesToSave.oldPhone;

  if (existingIdx >= 0) {
    serverState.customers[existingIdx] = {
      ...serverState.customers[existingIdx],
      ...updatesToSave
    };

    // Update addresses
    if (updatesToSave.phone && serverState.addresses) {
      serverState.addresses.forEach(a => {
        const aClean = (a.customer_phone || '').replace(/\D/g, '');
        if (
          a.customer_id === id || 
          (cleanOldPhone && aClean === cleanOldPhone) || 
          (cleanNewPhone && aClean === cleanNewPhone)
        ) {
          a.customer_phone = updatesToSave.phone;
          if (updatesToSave.name) a.customer_name = updatesToSave.name;
          a.customer_id = id;
        }
      });
    }

    saveState(serverState);
    console.log(`[API] Customer ${id} updated: ${updatesToSave.name} (${updatesToSave.phone})`);
    return res.json({ success: true, customer: serverState.customers[existingIdx] });
  }

  const newCust = {
    ...updatesToSave,
    created_at: new Date().toISOString()
  };
  serverState.customers.push(newCust);
  saveState(serverState);
  res.json({ success: true, customer: newCust });
});

// ====================================================================
// 8B. OTP SENDER API (Customer Signup OTP Verification via external SMS app)
// Inserts id (customer id) & phone; external SMS app populates `otp` column
// ====================================================================
app.get('/api/otp_sender', (_req, res) => {
  if (!serverState.otpSenders) serverState.otpSenders = [];
  res.json(serverState.otpSenders);
});

app.get('/api/otp_sender/:id', (req, res) => {
  const { id } = req.params;
  if (!serverState.otpSenders) serverState.otpSenders = [];
  const cleanPhone = id.replace(/\D/g, '');

  const record = serverState.otpSenders.find(o => 
    o.id === id || 
    (cleanPhone && o.phone && o.phone.replace(/\D/g, '') === cleanPhone)
  );

  if (!record) {
    return res.status(404).json({ success: false, message: 'OTP record not found' });
  }

  res.json({ success: true, ...record });
});

app.post('/api/otp_sender', (req, res) => {
  const { id, phone, phone_number } = req.body;
  if (!serverState.otpSenders) serverState.otpSenders = [];

  const rawPhone = phone || phone_number || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const recId = id || `otp-${Date.now()}`;

  const existingIdx = serverState.otpSenders.findIndex(o => 
    o.id === recId || 
    (cleanPhone && o.phone && o.phone.replace(/\D/g, '') === cleanPhone)
  );

  // New record with id and phone; otp initially left empty for external app / SMS gateway
  const newRecord = {
    id: recId,
    phone: rawPhone,
    phone_number: rawPhone,
    otp: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    serverState.otpSenders[existingIdx] = {
      ...serverState.otpSenders[existingIdx],
      phone: rawPhone,
      phone_number: rawPhone,
      updated_at: new Date().toISOString()
    };
  } else {
    serverState.otpSenders.unshift(newRecord);
  }

  saveState(serverState);
  console.log(`[API] otp_sender row inserted: ID=${recId}, Phone=${rawPhone} (waiting for SMS app to generate OTP)`);

  // Fallback simulator for offline/dev test: if no external app populates otp within 1.5s, generate 6-digit OTP
  setTimeout(() => {
    const r = (serverState.otpSenders || []).find(o => o.id === recId);
    if (r && !r.otp) {
      r.otp = Math.floor(100000 + Math.random() * 900000).toString();
      r.updated_at = new Date().toISOString();
      saveState(serverState);
      console.log(`[API] otp_sender auto-fallback OTP generated for dev: ${r.otp} (phone: ${r.phone})`);
    }
  }, 1200);

  res.json({ success: true, record: existingIdx >= 0 ? serverState.otpSenders[existingIdx] : newRecord });
});

app.put('/api/otp_sender/:id', (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;
  if (!serverState.otpSenders) serverState.otpSenders = [];

  const record = serverState.otpSenders.find(o => o.id === id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  if (otp) {
    record.otp = String(otp).trim();
    record.updated_at = new Date().toISOString();
  }

  saveState(serverState);
  console.log(`[API] otp_sender updated: ID=${id}, OTP=${record.otp}`);
  res.json({ success: true, record });
});

// 9. Customer Addresses API (Strictly isolated by customer phone/ID & persistent active status)
app.get('/api/addresses/:customerIdentifier', (req, res) => {
  const { customerIdentifier } = req.params;
  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  if (!serverState.addresses) serverState.addresses = [];
  
  const userAddresses = serverState.addresses.filter(a => {
    const aPhoneClean = (a.customer_phone || '').replace(/\D/g, '');
    return (aPhoneClean && cleanId && aPhoneClean === cleanId) || 
           a.customer_id === customerIdentifier ||
           a.customer_phone === customerIdentifier ||
           (cleanId === '' && customerIdentifier === 'guest' && (!a.customer_phone || a.customer_phone === 'guest'));
  });

  // Ensure at least one has active status if addresses exist and none is active
  const hasActive = userAddresses.some(a => a.status === 'active');
  if (userAddresses.length > 0 && !hasActive) {
    const defaultIdx = userAddresses.findIndex(a => a.is_default);
    const target = defaultIdx >= 0 ? userAddresses[defaultIdx] : userAddresses[0];
    target.status = 'active';
    target.is_default = true;
    userAddresses.forEach(a => {
      if (a.id !== target.id) {
        a.status = 'inactive';
        a.is_default = false;
      }
    });
    saveState(serverState);
  }
  
  res.json({ success: true, addresses: userAddresses });
});

// Activate a specific address (sets status to 'active' for this address and 'inactive' for all other addresses of this customer)
const handleActivateAddress = (req: express.Request, res: express.Response) => {
  const { customerIdentifier, addressId } = req.params;
  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  if (!serverState.addresses) serverState.addresses = [];

  let activatedAddress: any = null;

  serverState.addresses.forEach(a => {
    const aPhoneClean = (a.customer_phone || '').replace(/\D/g, '');
    const isSameCust = (cleanId && aPhoneClean && cleanId === aPhoneClean) || 
                       a.customer_id === customerIdentifier ||
                       a.customer_phone === customerIdentifier ||
                       (cleanId === '' && customerIdentifier === 'guest' && (!a.customer_phone || a.customer_phone === 'guest'));

    if (isSameCust) {
      if (a.id === addressId) {
        a.status = 'active';
        a.is_default = true;
        activatedAddress = a;
      } else {
        a.status = 'inactive';
        a.is_default = false;
      }
    }
  });

  saveState(serverState);
  console.log(`[API] Address ${addressId} activated for customer ${customerIdentifier}`);
  res.json({ success: true, activeAddress: activatedAddress, addresses: serverState.addresses });
};

app.put('/api/addresses/:customerIdentifier/:addressId/activate', handleActivateAddress);
app.post('/api/addresses/:customerIdentifier/:addressId/activate', handleActivateAddress);

// Create or Update Address
app.post('/api/addresses/:customerIdentifier', (req, res) => {
  const { customerIdentifier } = req.params;
  const newAddress = req.body;
  if (!serverState.addresses) serverState.addresses = [];

  if (!newAddress.id) {
    newAddress.id = `addr-${Date.now()}`;
  }
  if (!newAddress.customer_phone && customerIdentifier) {
    newAddress.customer_phone = customerIdentifier;
  }
  if (!newAddress.status) {
    newAddress.status = newAddress.is_default ? 'active' : 'active';
  }

  const cleanId = (customerIdentifier || newAddress.customer_phone || '').replace(/\D/g, '');

  // If newly created/updated address is active, deactivate other addresses for this customer
  if (newAddress.status === 'active') {
    newAddress.is_default = true;
    serverState.addresses.forEach(a => {
      const aPhoneClean = (a.customer_phone || '').replace(/\D/g, '');
      const isSameCust = (cleanId && aPhoneClean && cleanId === aPhoneClean) || 
                         (newAddress.customer_id && a.customer_id === newAddress.customer_id) ||
                         (newAddress.customer_phone && a.customer_phone === newAddress.customer_phone);
      if (isSameCust && a.id !== newAddress.id) {
        a.status = 'inactive';
        a.is_default = false;
      }
    });
  }

  const existingIdx = serverState.addresses.findIndex(a => a.id === newAddress.id);
  if (existingIdx >= 0) {
    serverState.addresses[existingIdx] = { ...serverState.addresses[existingIdx], ...newAddress };
  } else {
    serverState.addresses.unshift(newAddress);
  }

  saveState(serverState);
  console.log(`[API] Address saved: ${newAddress.address_line} (${newAddress.id}) status=${newAddress.status}`);
  res.json({ success: true, address: newAddress });
});

app.put('/api/addresses/:customerIdentifier/:addressId', (req, res) => {
  const { addressId } = req.params;
  const updates = req.body;
  if (!serverState.addresses) serverState.addresses = [];

  const idx = serverState.addresses.findIndex(a => a.id === addressId);
  if (idx >= 0) {
    serverState.addresses[idx] = { ...serverState.addresses[idx], ...updates };
    saveState(serverState);
    return res.json({ success: true, address: serverState.addresses[idx] });
  }
  res.status(404).json({ success: false, message: 'Address not found' });
});

app.delete('/api/addresses/:customerIdentifier/:addressId', (req, res) => {
  const { customerIdentifier, addressId } = req.params;
  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  if (!serverState.addresses) serverState.addresses = [];

  const deleted = serverState.addresses.find(a => a.id === addressId);
  serverState.addresses = serverState.addresses.filter(a => a.id !== addressId);

  // If deleted address was active, make the first remaining address for this customer active
  if (deleted && deleted.status === 'active') {
    const remaining = serverState.addresses.find(a => {
      const aPhoneClean = (a.customer_phone || '').replace(/\D/g, '');
      return (cleanId && aPhoneClean && cleanId === aPhoneClean) || 
             a.customer_id === customerIdentifier ||
             a.customer_phone === customerIdentifier;
    });
    if (remaining) {
      remaining.status = 'active';
      remaining.is_default = true;
    }
  }

  saveState(serverState);
  res.json({ success: true });
});

// 10. Reviews API (Customer Order Reviews & Ratings)
app.get('/api/reviews', (req, res) => {
  if (!serverState.reviews) serverState.reviews = [];
  const { vendor_id, order_code } = req.query;
  
  let list = [...serverState.reviews];
  if (vendor_id) {
    list = list.filter((r: any) => r.vendor_id === vendor_id);
  }
  if (order_code) {
    list = list.filter((r: any) => r.order_code === order_code);
  }
  res.json(list);
});

app.post('/api/reviews', (req, res) => {
  if (!serverState.reviews) serverState.reviews = [];
  const newReview = req.body;
  if (!newReview.id) newReview.id = `rev-${Date.now()}`;
  if (!newReview.created_at) newReview.created_at = new Date().toISOString();

  // Deduplicate by order_code or id
  const existingIdx = serverState.reviews.findIndex((r: any) => 
    (newReview.order_code && r.order_code === newReview.order_code) ||
    (newReview.id && r.id === newReview.id)
  );

  if (existingIdx >= 0) {
    serverState.reviews[existingIdx] = {
      ...serverState.reviews[existingIdx],
      ...newReview,
      updated_at: new Date().toISOString()
    };
  } else {
    serverState.reviews.unshift(newReview);
  }

  // Recalculate vendor average rating if vendors in serverState
  if (newReview.vendor_id && serverState.vendors && serverState.vendors.length > 0) {
    const vReviews = serverState.reviews.filter((r: any) => r.vendor_id === newReview.vendor_id);
    if (vReviews.length > 0) {
      const avg = vReviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / vReviews.length;
      const rounded = Math.round(avg * 10) / 10;
      const vIdx = serverState.vendors.findIndex((v: any) => v.id === newReview.vendor_id);
      if (vIdx >= 0) {
        serverState.vendors[vIdx].rating = rounded;
      }
    }
  }

  saveState(serverState);
  res.json({ success: true, review: newReview });
});

// 11. Customer Favorites API
app.get('/api/favorites/:customerIdentifier', (req, res) => {
  const { customerIdentifier } = req.params;
  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  if (!serverState.favorites) serverState.favorites = [];

  const userFavs = serverState.favorites.filter((f: any) => {
    const fPhoneClean = (f.customer_phone || '').replace(/\D/g, '');
    return (cleanId && fPhoneClean && cleanId === fPhoneClean) ||
           f.customer_phone === customerIdentifier ||
           f.customer_id === customerIdentifier ||
           (cleanId === '' && customerIdentifier === 'guest' && (!f.customer_phone || f.customer_phone === 'guest'));
  });

  const vendorIds = userFavs.map((f: any) => f.vendor_id).filter(Boolean);
  res.json({ success: true, favorites: vendorIds, details: userFavs });
});

app.post('/api/favorites/:customerIdentifier', (req, res) => {
  const { customerIdentifier } = req.params;
  const { vendor_id, customer_id } = req.body;
  if (!vendor_id) return res.status(400).json({ success: false, message: 'vendor_id required' });
  if (!serverState.favorites) serverState.favorites = [];

  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  const existingIdx = serverState.favorites.findIndex((f: any) => {
    const fPhoneClean = (f.customer_phone || '').replace(/\D/g, '');
    const isSameCust = (cleanId && fPhoneClean && cleanId === fPhoneClean) ||
                       f.customer_phone === customerIdentifier ||
                       f.customer_id === customerIdentifier ||
                       (cleanId === '' && customerIdentifier === 'guest');
    return isSameCust && f.vendor_id === vendor_id;
  });

  if (existingIdx < 0) {
    serverState.favorites.push({
      id: `fav-${Date.now()}`,
      vendor_id,
      customer_phone: customerIdentifier,
      customer_id: customer_id || null,
      created_at: new Date().toISOString()
    });
    saveState(serverState);
  }

  const userFavs = serverState.favorites.filter((f: any) => {
    const fPhoneClean = (f.customer_phone || '').replace(/\D/g, '');
    return (cleanId && fPhoneClean && cleanId === fPhoneClean) ||
           f.customer_phone === customerIdentifier ||
           f.customer_id === customerIdentifier ||
           (cleanId === '' && customerIdentifier === 'guest');
  }).map(f => f.vendor_id);

  res.json({ success: true, favorites: userFavs });
});

app.delete('/api/favorites/:customerIdentifier', (req, res) => {
  const { customerIdentifier } = req.params;
  const { vendor_id } = req.body;
  if (!vendor_id) return res.status(400).json({ success: false, message: 'vendor_id required' });
  if (!serverState.favorites) serverState.favorites = [];

  const cleanId = (customerIdentifier || '').replace(/\D/g, '');
  serverState.favorites = serverState.favorites.filter((f: any) => {
    const fPhoneClean = (f.customer_phone || '').replace(/\D/g, '');
    const isSameCust = (cleanId && fPhoneClean && cleanId === fPhoneClean) ||
                       f.customer_phone === customerIdentifier ||
                       f.customer_id === customerIdentifier ||
                       (cleanId === '' && customerIdentifier === 'guest');
    return !(isSameCust && f.vendor_id === vendor_id);
  });

  saveState(serverState);
  res.json({ success: true });
});


// -------------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`> Foodiplace server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

const SUPABASE_URL = 'https://kdqyompkfmnocpihfzdj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcXlvbXBrZm1ub2NwaWhmemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDkxOTIsImV4cCI6MjEwNDg4NTE5Mn0.4gmwMruyf54ZdXAADEAa9noLZD5JMFyLOzrszUIMVns';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let vendors = [];
let cart = [];
let currentVendorId = null;
let currentVendorName = "";

lucide.createIcons();

// Fetch Data from Supabase (vendors & menus table)
async function fetchAppData() {
    try {
        const { data: vendorData, error: vendorError } = await supabaseClient.from('vendors').select('*');
        if (vendorError) throw vendorError;

        const { data: menuData, error: menuError } = await supabaseClient.from('menus').select('*');
        if (menuError) throw menuError;

        vendors = (vendorData || []).map(res => ({
            id: res.id,
            name: res.name,
            category: res.types || 'Fast Food',
            image: res.profile_image_url || 'https://images.unsplash.com/photo-1552566626-52f8b828add9',
            menu: (menuData || []).filter(m => m.vendor_id == res.id)
        }));

        renderVendors(vendors);
    } catch (err) {
        console.error("Error loading app data:", err);
    }
}

function renderVendors(data) {
    const container = document.getElementById('vendorContainer');
    container.innerHTML = '';
    if(data.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">No restaurants found right now.</p>`;
        return;
    }
    data.forEach(res => {
        container.innerHTML += `
            <div onclick="openVendor(${res.id})" class="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition cursor-pointer group">
                <div class="h-48 overflow-hidden">
                    <img src="${res.image}" alt="${res.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                </div>
                <div class="p-5">
                    <span class="text-xs bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-semibold">${res.category}</span>
                    <h4 class="text-lg font-bold mt-2 text-gray-800">${res.name}</h4>
                    <div class="flex items-center gap-1 text-yellow-500 mt-2 text-sm font-semibold">
                        <i data-lucide="star" class="w-4 h-4 fill-current"></i> 5.0 • ${res.menu.length} items
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function filterData() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;

    const filtered = vendors.filter(res => {
        const matchesCategory = category === 'all' || res.category.toLowerCase().includes(category.toLowerCase());
        const matchesSearch = res.name.toLowerCase().includes(query) || res.menu.some(m => m.name.toLowerCase().includes(query));
        return matchesCategory && matchesSearch;
    });
    renderVendors(filtered);
}

function openVendor(id) {
    const res = vendors.find(r => r.id === id);
    currentVendorId = res.id;
    currentVendorName = res.name;

    document.getElementById('vendorSection').classList.add('hidden');
    document.querySelector('section.hero-bg').classList.add('hidden');
    
    const menuSection = document.getElementById('menuSection');
    menuSection.classList.remove('hidden');

    document.getElementById('vendorHeader').innerHTML = `
        <img src="${res.image}" class="w-20 h-20 rounded-xl object-cover">
        <div>
            <h3 class="text-2xl font-bold">${res.name}</h3>
            <p class="text-gray-500">${res.category} • ⭐ 5.0</p>
        </div>
    `;

    const menuContainer = document.getElementById('menuContainer');
    menuContainer.innerHTML = '';
    if(res.menu.length === 0) {
        menuContainer.innerHTML = `<p class="col-span-full text-center text-gray-400 py-10">No menu items added for this restaurant yet.</p>`;
        return;
    }

    res.menu.forEach(item => {
        menuContainer.innerHTML += `
            <div class="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4">
                <img src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}" class="w-24 h-24 rounded-xl object-cover">
                <div class="flex-grow">
                    <h5 class="font-bold text-gray-800">${item.name}</h5>
                    <p class="text-orange-500 font-semibold mt-1">$${parseFloat(item.price).toFixed(2)}</p>
                    <button onclick="addToCart('${item.name}', ${item.price})" class="mt-2 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-2 rounded-lg transition font-medium">Add to Cart</button>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function backToVendors() {
    document.getElementById('vendorSection').classList.remove('hidden');
    document.querySelector('section.hero-bg').classList.remove('hidden');
    document.getElementById('menuSection').classList.add('hidden');
}

// Cart Actions
function toggleCart() {
    document.getElementById('cartDrawer').classList.toggle('hidden');
}

function addToCart(name, price) {
    const existing = cart.find(item => item.name === name);
    if(existing) { existing.qty++; } 
    else { cart.push({ name, price, qty: 1 }); }
    updateCartUI();
    toggleCart();
}

function updateCartUI() {
    document.getElementById('cartCount').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    const container = document.getElementById('cartItems');
    container.innerHTML = '';
    let total = 0;

    if(cart.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 py-10">Your cart is empty.</p>`;
    }

    cart.forEach((item, index) => {
        total += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                <div>
                    <h6 class="font-semibold text-sm">${item.name}</h6>
                    <p class="text-xs text-gray-500">$${item.price} x ${item.qty}</p>
                </div>
                <button onclick="cart.splice(${index},1); updateCartUI();" class="text-red-500 text-xs font-semibold hover:underline">Remove</button>
            </div>
        `;
    });
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
}

// Orders Table এ ডাটা সেভ করা
async function placeOrder() {
    if(cart.length === 0) { alert("Cart is empty!"); return; }
    const name = document.getElementById('custName').value;
    const mobile = document.getElementById('custMobile').value;
    const address = document.getElementById('custAddress').value;

    if(!name || !mobile || !address) { alert("Please fill up all contact details in cart!"); return; }

    const total_amount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const { error } = await supabaseClient.from('orders').insert([{
        vendor_id: currentVendorId,
        customer_name: name,
        vendor_name: currentVendorName,
        items: cart,
        amount: total_amount,
        delivery_address: address,
        status: 'Pending'
    }]);

    if(error) {
        alert("Error placing order: " + error.message);
    } else {
        alert("Order placed successfully!");
        cart = [];
        updateCartUI();
        toggleCart();
    }
}

// Initial Load
fetchAppData();

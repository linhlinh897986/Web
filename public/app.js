// ── HỖ TRỢ XÁC THỰC PHIÊN ĐĂNG NHẬP ──────────────────────────────────────────
const token = localStorage.getItem('aio_web_token');
const userStr = localStorage.getItem('aio_web_user');
const currentUser = userStr ? JSON.parse(userStr) : null;

// Khởi tạo giao diện khi trang tải xong
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/login') return;

  startHUDClock();

  // Xác định vai trò để xử lý trang tương ứng
  if (window.location.pathname.startsWith('/admin')) {
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    renderUserProfileWidget();
    setupLogoutButton();
    initAdminDashboard();
  } else {
    if (token && currentUser) {
      renderUserProfileWidget();
      setupLogoutButton();
    } else {
      renderGuestHeader();
    }
    initUserDashboard();
  }
});

// Cập nhật đồng hồ HUD thời gian hệ thống
function startHUDClock() {
  const clockEl = document.getElementById('system-time');
  if (!clockEl) return;
  
  function updateClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}:${secs}`;
  }
  
  updateClock();
  setInterval(updateClock, 1000);
}

// Hiển thị nút đăng nhập cho khách chưa có tài khoản
function renderGuestHeader() {
  const widget = document.getElementById('user-profile-widget');
  if (widget) {
    widget.innerHTML = `
      <a href="/login" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px; border-radius: 20px; border-color: rgba(249, 115, 22, 0.3); color: var(--primary-color);">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1" />
        </svg> Đăng nhập
      </a>
    `;
  }
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.style.display = 'none';
}

// Hiển thị thông tin người dùng ở góc trên bên phải và stats cards
function renderUserProfileWidget() {
  const widget = document.getElementById('user-profile-widget');
  if (!widget || !currentUser) return;

  widget.innerHTML = `
    <img src="${currentUser.picture || 'https://via.placeholder.com/150'}" alt="Avatar" class="user-avatar">
    <span class="user-name">${currentUser.name}</span>
  `;

  // Hiển thị nút liên kết admin nếu là Admin
  const adminLink = document.getElementById('admin-link');
  if (adminLink && currentUser.role === 'admin') {
    adminLink.style.display = 'inline-flex';
  }

  // Cập nhật thẻ trạng thái tài khoản
  const statUserRole = document.getElementById('stat-user-role');
  if (statUserRole) {
    statUserRole.textContent = currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên';
  }
}

// Cấu hình nút đăng xuất
function setupLogoutButton() {
  const logoutBtn = document.getElementById('btn-logout');
  if (!logoutBtn) return;

  logoutBtn.style.display = 'inline-flex';
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('aio_web_token');
    localStorage.removeItem('aio_web_user');
    window.location.href = '/login';
  });
}

// ── BẢNG ĐIỀU KHIỂN KHÁCH HÀNG (USER DASHBOARD) ──────────────────────────────────
let paymentPollerId = null;
let initialKeysCount = 0;
let cachedProducts = [];
let currentCheckoutProductId = null;

function initUserDashboard() {
  loadProductsCatalog();
  loadContactSettings();

  if (token && currentUser) {
    const dashboardSec = document.getElementById('personal-dashboard-section');
    if (dashboardSec) dashboardSec.style.display = 'block';
    loadUserKeys();
    loadUserTransactions();
  } else {
    const dashboardSec = document.getElementById('personal-dashboard-section');
    if (dashboardSec) dashboardSec.style.display = 'none';
  }

  const createOrderBtn = document.getElementById('btn-create-order');
  const cancelOrderBtn = document.getElementById('btn-cancel-order');
  
  if (createOrderBtn) {
    createOrderBtn.addEventListener('click', createPaymentRequest);
  }

  if (cancelOrderBtn) {
    cancelOrderBtn.addEventListener('click', () => {
      stopPaymentPolling();
      document.getElementById('payment-section').style.display = 'none';
      document.getElementById('checkout-form-section').style.display = 'block';
    });
  }
}

// Tải danh sách sản phẩm hiển thị ngoài trang chủ (Storefront Catalog)
async function loadProductsCatalog() {
  const container = document.getElementById('storefront-products-list');
  if (!container) return;

  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    cachedProducts = data.products;

    if (data.products.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">Hiện chưa có sản phẩm nào được đăng bán.</div>`;
      return;
    }

    container.innerHTML = data.products.map(p => {
      const imgUrl = p.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60';
      return `
        <div class="product-card">
          <div class="product-image-area" style="background-image: url('${imgUrl}')">
            <div class="product-image-overlay"></div>
            <span class="product-tag">Active</span>
          </div>
          <div class="product-body">
            <h4 class="product-name">${p.name}</h4>
            <p class="product-desc">${p.description || 'Chưa có mô tả cho sản phẩm này.'}</p>
            <div class="product-price-list">
              <div class="product-price-item">
                <span class="product-price-label">1 Tháng (30 ngày)</span>
                <span class="product-price-val">${parseInt(p.price_30_days).toLocaleString('vi-VN')} đ</span>
              </div>
              <div class="product-price-item">
                <span class="product-price-label">6 Tháng (180 ngày)</span>
                <span class="product-price-val">${parseInt(p.price_180_days).toLocaleString('vi-VN')} đ</span>
              </div>
              <div class="product-price-item">
                <span class="product-price-label">1 Năm (365 ngày)</span>
                <span class="product-price-val">${parseInt(p.price_365_days).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
            <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px; width: 100%;">
              ${p.download_url ? `
                <a href="${p.download_url}" target="_blank" class="btn btn-secondary" style="width: 100%; justify-content: center; border-color: rgba(249, 115, 22, 0.3); color: var(--primary-color);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải Tool về máy
                </a>
              ` : ''}
              <button onclick="openCheckoutModal(${p.id})" class="btn" style="width: 100%; justify-content: center; box-shadow: 0 4px 12px var(--primary-glow);">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Mua bản quyền
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--color-danger); padding: 40px;">Lỗi tải sản phẩm: ${err.message}</div>`;
  }
}

// Quản lý Modal Checkout
window.openCheckoutModal = function(productId) {
  if (!token || !currentUser) {
    alert('Vui lòng đăng nhập tài khoản Google để thực hiện mua bản quyền!');
    window.location.href = '/login';
    return;
  }
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const product = cachedProducts.find(p => p.id == productId);
  if (!product) return;

  currentCheckoutProductId = productId;

  document.getElementById('checkout-product-title').textContent = `Mua bản quyền - ${product.name}`;

  const select = document.getElementById('checkout-key-package');
  select.innerHTML = `
    <option value="30_days">Gói 30 ngày (1 Tháng) - ${parseInt(product.price_30_days).toLocaleString('vi-VN')} đ</option>
    <option value="180_days">Gói 180 ngày (6 Tháng) - ${parseInt(product.price_180_days).toLocaleString('vi-VN')} đ</option>
    <option value="365_days">Gói 365 ngày (1 Năm) - ${parseInt(product.price_365_days).toLocaleString('vi-VN')} đ</option>
  `;

  // Render 3 interactive package cards
  const packagesContainer = document.getElementById('checkout-packages-container');
  if (packagesContainer) {
    packagesContainer.innerHTML = `
      <div class="package-option-card" data-value="30_days">
        <div class="package-duration">1 Tháng</div>
        <div class="package-price">${parseInt(product.price_30_days).toLocaleString('vi-VN')} đ</div>
        <div class="package-price-sub">30 ngày sử dụng</div>
      </div>
      <div class="package-option-card selected" data-value="180_days">
        <span class="package-badge">Phổ biến</span>
        <div class="package-duration">6 Tháng</div>
        <div class="package-price">${parseInt(product.price_180_days).toLocaleString('vi-VN')} đ</div>
        <div class="package-price-sub">180 ngày sử dụng</div>
      </div>
      <div class="package-option-card" data-value="365_days">
        <span class="package-badge" style="background: linear-gradient(135deg, #22c55e 0%, #15803d 100%); box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);">Tiết kiệm</span>
        <div class="package-duration">1 Năm</div>
        <div class="package-price">${parseInt(product.price_365_days).toLocaleString('vi-VN')} đ</div>
        <div class="package-price-sub">365 ngày sử dụng</div>
      </div>
    `;

    // Set default package selection to 180 days (Popular)
    select.value = '180_days';

    // Add dynamic click selection logic
    const cards = packagesContainer.querySelectorAll('.package-option-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        select.value = card.dataset.value;
      });
    });
  }

  // Reset hiển thị
  document.getElementById('payment-section').style.display = 'none';
  document.getElementById('checkout-form-section').style.display = 'block';

  modal.classList.add('active');
}

window.closeCheckoutModal = function() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  stopPaymentPolling();
}

async function loadUserKeys() {
  const tbody = document.getElementById('keys-list');
  if (!tbody) return;

  try {
    const res = await fetch('/api/user/keys', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    initialKeysCount = data.keys.length;

    if (data.keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Bạn chưa sở hữu mã bản quyền nào. Hãy bấm mua ở cửa hàng phía trên!</td></tr>`;
      return;
    }

    tbody.innerHTML = data.keys.map(k => {
      const typeLabel = k.type === 'lifetime' ? 'Vĩnh viễn' : (k.type === '365_days' ? '1 Năm' : (k.type === '180_days' ? '6 Tháng' : '1 Tháng'));
      const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
      const statusBadge = isExpired 
        ? '<span class="badge badge-expired">Hết hạn</span>' 
        : (k.status === 'active' ? '<span class="badge badge-active">Hoạt động</span>' : `<span class="badge badge-expired">${k.status}</span>`);
      
      const expiryDate = k.expires_at ? new Date(k.expires_at).toLocaleDateString('vi-VN') : 'Vô thời hạn';
      const createdDate = new Date(k.created_at).toLocaleDateString('vi-VN');
      const prodName = k.product_name || 'AIO Scraper';
      const dlLink = k.product_download_url
        ? `<a href="${k.product_download_url}" target="_blank" style="color: var(--primary-color); display: inline-flex; align-items: center; gap: 4px; font-size: 12px; margin-left: 10px; text-decoration: none; border: 1px solid rgba(249, 115, 22, 0.3); padding: 2px 8px; border-radius: 6px; background: rgba(249, 115, 22, 0.05); font-weight: 500;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg> Tải tool
           </a>`
        : '';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
              <strong style="color: #fff;">${prodName}</strong>
              ${dlLink}
            </div>
          </td>
          <td>
            <div class="key-code">
              <span>${k.key_value}</span>
              <button onclick="copyKeyValue(this, '${k.key_value}')" class="copy-btn" style="padding: 2px 6px; font-size: 11px;">Sao chép</button>
            </div>
          </td>
          <td>${typeLabel}</td>
          <td>${statusBadge}</td>
          <td>${expiryDate}</td>
          <td>${createdDate}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger);">Không thể tải danh sách khóa: ${err.message}</td></tr>`;
  }
}

async function loadUserTransactions() {
  const tbody = document.getElementById('transactions-list');
  if (!tbody) return;

  try {
    const res = await fetch('/api/user/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Chưa phát sinh giao dịch thanh toán nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.transactions.map(t => {
      const statusBadge = t.status === 'completed' 
        ? '<span class="badge badge-active">Thành công</span>' 
        : '<span class="badge badge-pending">Chờ thanh toán</span>';
      
      const amountFormatted = parseInt(t.amount).toLocaleString('vi-VN') + ' đ';
      const createdDate = new Date(t.created_at).toLocaleString('vi-VN');
      const prodName = t.product_name || 'AIO Scraper';

      return `
        <tr>
          <td><strong style="color: #fff;">${prodName}</strong></td>
          <td><strong style="color: var(--color-warning);">${t.memo_code}</strong></td>
          <td style="color:var(--color-success); font-weight:600;">${amountFormatted}</td>
          <td>${statusBadge}</td>
          <td>${createdDate}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-danger);">Không thể tải giao dịch: ${err.message}</td></tr>`;
  }
}

async function createPaymentRequest() {
  const select = document.getElementById('checkout-key-package');
  const packageType = select.value;
  const createOrderBtn = document.getElementById('btn-create-order');
  
  createOrderBtn.disabled = true;
  createOrderBtn.textContent = 'Đang khởi tạo...';

  try {
    const res = await fetch('/api/buy-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId: currentCheckoutProductId, packageType })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Điền dữ liệu vào form thanh toán VietQR
    document.getElementById('payment-qr').src = data.qrUrl;
    document.getElementById('payment-bank').textContent = data.bankId;
    document.getElementById('payment-account').textContent = data.bankAccount;
    document.getElementById('payment-holder').textContent = data.bankAccountName;
    document.getElementById('payment-amount').textContent = parseInt(data.amount).toLocaleString('vi-VN') + ' đ';
    document.getElementById('payment-memo').textContent = data.memoCode;

    // Hiển thị khung thanh toán trong Modal
    document.getElementById('checkout-form-section').style.display = 'none';
    document.getElementById('payment-section').style.display = 'block';

    // Reload Transactions to show pending order
    loadUserTransactions();

    // Bắt đầu vòng lặp kiểm tra thanh toán
    startPaymentPolling();
  } catch (err) {
    alert('Không thể tạo đơn thanh toán: ' + err.message);
  } finally {
    createOrderBtn.disabled = false;
    createOrderBtn.textContent = 'Tạo mã thanh toán';
  }
}

function startPaymentPolling() {
  stopPaymentPolling();
  
  // Kiểm tra 5 giây 1 lần xem có Key mới được tạo ra hay chưa
  paymentPollerId = setInterval(async () => {
    try {
      const res = await fetch('/api/user/keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok && data.keys.length > initialKeysCount) {
        // Có key mới -> Thanh toán thành công!
        stopPaymentPolling();
        alert('🎉 Chúc mừng! Hệ thống đã nhận được tiền chuyển khoản và tự động kích hoạt mã Key thành công!');
        
        // Đóng modal checkout
        closeCheckoutModal();
        
        // Reload tables
        loadUserKeys();
        loadUserTransactions();
      }
    } catch (e) {
      console.error('Error polling payment status:', e);
    }
  }, 5000);
}

function stopPaymentPolling() {
  if (paymentPollerId) {
    clearInterval(paymentPollerId);
    paymentPollerId = null;
  }
}

// ── BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN DASHBOARD) ───────────────────────────────────
function initAdminDashboard() {
  setupAdminTabs();
  loadAdminKeys();
  loadAdminProducts();
  loadAdminTransactions();
  loadAdminUsers();
  loadAdminProductsDropdown();
  loadAdminStats();

  const monthFilter = document.getElementById('admin-revenue-month-filter');
  if (monthFilter) {
    monthFilter.addEventListener('change', (e) => {
      loadAdminStats(e.target.value);
    });
  }

  const settingsForm = document.getElementById('admin-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const zalo = document.getElementById('setting-zalo').value;
      const facebook = document.getElementById('setting-facebook').value;
      const email = document.getElementById('setting-email').value;

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ zalo, facebook, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(data.message || 'Lưu cấu hình liên hệ thành công!');
      } catch (err) {
        alert('Không thể lưu cấu hình: ' + err.message);
      }
    });
  }

  // Nút hiển thị hộp cấp key thủ công
  const toggleGenBtn = document.getElementById('btn-show-key-gen');
  const genBox = document.getElementById('manual-key-gen-box');
  if (toggleGenBtn && genBox) {
    toggleGenBtn.addEventListener('click', () => {
      const isHidden = genBox.style.display === 'none';
      genBox.style.display = isHidden ? 'block' : 'none';
      toggleGenBtn.textContent = isHidden ? 'Đóng bảng cấp' : '+ Cấp Key Thủ Công';
    });
  }

  // Submit cấp key thủ công
  const submitGenBtn = document.getElementById('btn-submit-generate');
  if (submitGenBtn) {
    submitGenBtn.addEventListener('click', submitGenerateKeyManual);
  }

  // Tự động cập nhật số ngày hạn khi chọn gói key thủ công
  const keyTypeSelect = document.getElementById('gen-key-type');
  const keyDurationInput = document.getElementById('gen-key-duration');
  if (keyTypeSelect && keyDurationInput) {
    keyTypeSelect.addEventListener('change', () => {
      const type = keyTypeSelect.value;
      if (type === '30_days') keyDurationInput.value = 30;
      else if (type === '180_days') keyDurationInput.value = 180;
      else if (type === '365_days') keyDurationInput.value = 365;
    });
  }

  // Nút bấm Product CRUD
  const btnShowAddProduct = document.getElementById('btn-show-add-product');
  const productFormBox = document.getElementById('product-form-box');
  const btnCancelProduct = document.getElementById('btn-cancel-product');
  const btnSubmitProduct = document.getElementById('btn-submit-product');

  if (btnShowAddProduct && productFormBox) {
    btnShowAddProduct.addEventListener('click', () => {
      document.getElementById('product-form-title').textContent = 'Đăng sản phẩm mới';
      document.getElementById('prod-id').value = '';
      document.getElementById('prod-name').value = '';
      document.getElementById('prod-image-file').value = '';
      currentProductBase64 = '';
      if (document.getElementById('image-preview-container')) {
        document.getElementById('image-preview-container').style.display = 'none';
      }
      document.getElementById('prod-description').value = '';
      document.getElementById('prod-download-url').value = '';
      document.getElementById('prod-price-30').value = 50000;
      document.getElementById('prod-price-180').value = 250000;
      document.getElementById('prod-price-365').value = 450000;
      productFormBox.style.display = 'block';
    });
  }

  if (btnCancelProduct && productFormBox) {
    btnCancelProduct.addEventListener('click', () => {
      productFormBox.style.display = 'none';
    });
  }

  if (btnSubmitProduct) {
    btnSubmitProduct.addEventListener('click', submitProductForm);
  }

  // Khởi chạy file reader cho ảnh sản phẩm
  const imageFileInput = document.getElementById('prod-image-file');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreview = document.getElementById('prod-image-preview');

  if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          currentProductBase64 = event.target.result;
          if (imagePreview) imagePreview.src = currentProductBase64;
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        currentProductBase64 = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      }
    });
  }
}

function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.classList.add('btn-secondary');
      });
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

      tab.classList.add('active');
      tab.classList.remove('btn-secondary');
      
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).style.display = 'block';

      // Load products if products tab is opened
      if (tabId === 'tab-products') {
        loadAdminProducts();
      } else if (tabId === 'tab-settings') {
        loadAdminSettings();
      }
    });
  });
}

async function loadAdminKeys() {
  const tbody = document.getElementById('admin-keys-list');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/keys', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Chưa có key nào được tạo.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.keys.map(k => {
      const owner = k.user_email ? `${k.user_name} (${k.user_email})` : '<em style="color:var(--text-muted);">Cấp offline</em>';
      const expiresAt = k.expires_at ? new Date(k.expires_at).toLocaleDateString('vi-VN') : 'Lifetime';
      const createdDate = new Date(k.created_at).toLocaleString('vi-VN');
      const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
      const statusBadge = isExpired 
        ? '<span class="badge badge-expired">Hết hạn</span>' 
        : (k.status === 'active' ? '<span class="badge badge-active">Hoạt động</span>' : `<span class="badge badge-expired">${k.status}</span>`);

      const typeLabel = k.type === 'lifetime' ? 'Vĩnh viễn' : (k.type === '365_days' ? '1 Năm' : (k.type === '180_days' ? '6 Tháng' : '1 Tháng'));
      const prodName = k.product_name || 'AIO Scraper';

      return `
        <tr>
          <td>${k.id}</td>
          <td><strong style="color:#fff;">${prodName}</strong></td>
          <td><strong style="color:#a5b4fc; font-family:monospace;">${k.key_value}</strong></td>
          <td>${owner}</td>
          <td>${typeLabel}</td>
          <td>${statusBadge}</td>
          <td>${expiresAt}</td>
          <td>${createdDate}</td>
          <td>
            <button onclick="deleteKey(${k.id})" class="btn btn-danger" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; box-shadow: none;">Xóa</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-danger);">Không thể tải dữ liệu: ${err.message}</td></tr>`;
  }
}

async function deleteKey(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa mã Key này khỏi hệ thống?')) return;

  try {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert('Đã xóa key thành công!');
    loadAdminKeys();
  } catch (err) {
    alert('Lỗi xóa key: ' + err.message);
  }
}
window.deleteKey = deleteKey;

async function loadAdminProductsDropdown() {
  const select = document.getElementById('gen-key-product-id');
  if (!select) return;

  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (res.ok) {
      select.innerHTML = data.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  } catch (e) {
    console.error('Error loading products list in dropdown:', e);
  }
}

// CRUD Products
let adminProductsList = [];
let currentProductBase64 = '';
async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-list');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    adminProductsList = data.products;

    if (data.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Hiện chưa có sản phẩm nào. Hãy tạo mới!</td></tr>`;
      return;
    }

    tbody.innerHTML = data.products.map(p => {
      const imgUrl = p.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60';
      const dlBadge = p.download_url 
        ? `<br><a href="${p.download_url}" target="_blank" style="color: var(--primary-color); font-size: 11px; text-decoration: none; word-break: break-all;">Link: ${p.download_url}</a>`
        : '<br><span style="color: var(--text-muted); font-size: 11px; font-style: italic;">Chưa có link tải</span>';
      return `
        <tr>
          <td>${p.id}</td>
          <td><img src="${imgUrl}" style="width: 40px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);"></td>
          <td><strong style="color: #fff;">${p.name}</strong>${dlBadge}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.description || '-'}</td>
          <td>${parseInt(p.price_30_days).toLocaleString('vi-VN')} đ</td>
          <td>${parseInt(p.price_180_days).toLocaleString('vi-VN')} đ</td>
          <td>${parseInt(p.price_365_days).toLocaleString('vi-VN')} đ</td>
          <td>
            <div style="display:flex; gap: 8px;">
              <button onclick="editProduct(${p.id})" class="btn" style="padding: 6px 12px; font-size: 11px; border-radius: 6px; box-shadow:none;">Sửa</button>
              <button onclick="deleteProduct(${p.id})" class="btn btn-danger" style="padding: 6px 12px; font-size: 11px; border-radius: 6px; box-shadow:none;">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger);">Lỗi tải danh sách sản phẩm: ${err.message}</td></tr>`;
  }
}

window.editProduct = function(id) {
  const p = adminProductsList.find(item => item.id == id);
  if (!p) return;

  document.getElementById('product-form-title').textContent = 'Chỉnh sửa sản phẩm';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-image-file').value = '';
  
  if (p.image_url) {
    currentProductBase64 = p.image_url;
    document.getElementById('prod-image-preview').src = p.image_url;
    document.getElementById('image-preview-container').style.display = 'block';
  } else {
    currentProductBase64 = '';
    document.getElementById('image-preview-container').style.display = 'none';
  }

  document.getElementById('prod-description').value = p.description || '';
  document.getElementById('prod-download-url').value = p.download_url || '';
  document.getElementById('prod-price-30').value = p.price_30_days;
  document.getElementById('prod-price-180').value = p.price_180_days;
  document.getElementById('prod-price-365').value = p.price_365_days;

  document.getElementById('product-form-box').style.display = 'block';
  document.getElementById('product-form-box').scrollIntoView({ behavior: 'smooth' });
}

window.deleteProduct = async function(id) {
  if (id == 1) {
    alert('Không thể xóa sản phẩm mặc định đầu tiên.');
    return;
  }
  if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này khỏi hệ thống?')) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert('Đã xóa sản phẩm thành công!');
    loadAdminProducts();
    loadAdminProductsDropdown();
  } catch (err) {
    alert('Lỗi xóa sản phẩm: ' + err.message);
  }
}

async function submitProductForm() {
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const description = document.getElementById('prod-description').value;
  const downloadUrl = document.getElementById('prod-download-url').value;
  const price30 = document.getElementById('prod-price-30').value;
  const price180 = document.getElementById('prod-price-180').value;
  const price365 = document.getElementById('prod-price-365').value;

  if (!name || !price30 || !price180 || !price365) {
    alert('Vui lòng nhập đầy đủ thông tin bắt buộc.');
    return;
  }

  const payload = {
    name,
    description,
    price_30_days: parseInt(price30),
    price_180_days: parseInt(price180),
    price_365_days: parseInt(price365),
    image_url: currentProductBase64,
    download_url: downloadUrl || null
  };

  const submitBtn = document.getElementById('btn-submit-product');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang lưu...';

  try {
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert('Lưu sản phẩm thành công!');
    document.getElementById('product-form-box').style.display = 'none';
    loadAdminProducts();
    loadAdminProductsDropdown();
  } catch (err) {
    alert('Lỗi lưu sản phẩm: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lưu sản phẩm';
  }
}

async function loadAdminTransactions() {
  const tbody = document.getElementById('admin-transactions-list');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Chưa phát sinh giao dịch nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.transactions.map(t => {
      const owner = `${t.user_name} (${t.user_email})`;
      const amountFormatted = parseInt(t.amount).toLocaleString('vi-VN') + ' đ';
      const statusBadge = t.status === 'completed' 
        ? '<span class="badge badge-active">Thành công</span>' 
        : '<span class="badge badge-pending">Chờ chuyển khoản</span>';
      
      const createdDate = new Date(t.created_at).toLocaleString('vi-VN');
      const updatedDate = t.updated_at ? new Date(t.updated_at).toLocaleString('vi-VN') : '-';
      const prodName = t.product_name || 'AIO Scraper';

      return `
        <tr>
          <td>${t.id}</td>
          <td><strong style="color:#fff;">${prodName}</strong></td>
          <td>${owner}</td>
          <td style="color:var(--color-success); font-weight:600;">${amountFormatted}</td>
          <td><strong style="color:var(--color-warning); font-family:monospace; font-size:14px;">${t.memo_code}</strong></td>
          <td>${statusBadge}</td>
          <td>${createdDate}</td>
          <td>${updatedDate}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger);">Không thể tải dữ liệu: ${err.message}</td></tr>`;
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-list');
  const userSelect = document.getElementById('gen-user-id');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Không tìm thấy người dùng nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.users.map(u => {
      const createdDate = new Date(u.created_at).toLocaleDateString('vi-VN');
      const roleBadge = u.role === 'admin' 
        ? '<span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4)">Admin</span>' 
        : '<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border-color)">User</span>';

      return `
        <tr>
          <td><code style="font-size:11.5px;">${u.id}</code></td>
          <td><img src="${u.picture || 'https://via.placeholder.com/150'}" style="width:28px; height:28px; border-radius:50%;"></td>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${roleBadge}</td>
          <td>${createdDate}</td>
        </tr>
      `;
    }).join('');

    if (userSelect) {
      userSelect.innerHTML = '<option value="">-- Cấp offline --</option>' + 
        data.users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger);">Không thể tải dữ liệu: ${err.message}</td></tr>`;
  }
}

async function submitGenerateKeyManual() {
  const productId = document.getElementById('gen-key-product-id').value;
  const userId = document.getElementById('gen-user-id').value;
  const type = document.getElementById('gen-key-type').value;
  const durationDays = document.getElementById('gen-key-duration').value;
  const submitBtn = document.getElementById('btn-submit-generate');

  if (!productId) {
    alert('Vui lòng chọn sản phẩm.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '...';

  try {
    const res = await fetch('/api/admin/generate-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId: userId || null, type, durationDays, productId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert(`✅ Đã cấp thành công mã Key mới:\n${data.key}`);
    document.getElementById('manual-key-gen-box').style.display = 'none';
    document.getElementById('btn-show-key-gen').textContent = '+ Cấp Key Thủ Công';
    
    loadAdminKeys();
  } catch (err) {
    alert('Lỗi tạo key thủ công: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Tạo Key';
  }
}

// Hàm hỗ trợ sao chép giá trị Key có hiệu ứng visual phản hồi
window.copyKeyValue = function(btn, val) {
  navigator.clipboard.writeText(val).then(() => {
    const oldText = btn.textContent;
    btn.textContent = 'Đã chép!';
    btn.style.background = 'var(--color-success)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--color-success)';
    setTimeout(() => {
      btn.textContent = oldText;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  });
};

// Tải cấu hình liên hệ và hiển thị lên Landing Page
async function loadContactSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (res.ok && data.settings) {
      const { contact_zalo, contact_facebook, contact_email } = data.settings;
      const zaloBtn = document.getElementById('contact-zalo-btn');
      if (zaloBtn && contact_zalo) zaloBtn.href = contact_zalo;

      const fbBtn = document.getElementById('contact-facebook-btn');
      if (fbBtn && contact_facebook) fbBtn.href = contact_facebook;

      const emailBtn = document.getElementById('contact-email-btn');
      if (emailBtn && contact_email) emailBtn.href = `mailto:${contact_email}`;
    }
  } catch (err) {
    console.error('Lỗi tải cấu hình liên hệ:', err);
  }
}

// Tải cấu hình liên hệ cho form Admin
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (res.ok && data.settings) {
      document.getElementById('setting-zalo').value = data.settings.contact_zalo || '';
      document.getElementById('setting-facebook').value = data.settings.contact_facebook || '';
      document.getElementById('setting-email').value = data.settings.contact_email || '';
    }
  } catch (err) {
    console.error('Lỗi tải cấu hình Zalo/FB/Email:', err);
  }
}

// Tải thống kê doanh thu và số key còn hạn cho Admin
async function loadAdminStats(monthVal = '') {
  try {
    const url = monthVal ? `/api/admin/stats?month=${monthVal}` : '/api/admin/stats';
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('admin-stat-total-revenue').textContent = `${parseInt(data.totalRevenue).toLocaleString('vi-VN')} đ`;
    document.getElementById('admin-stat-active-keys').textContent = data.activeKeysCount;
    document.getElementById('admin-stat-monthly-revenue').textContent = `${parseInt(data.monthlyRevenue).toLocaleString('vi-VN')} đ`;
    
    const monthFilter = document.getElementById('admin-revenue-month-filter');
    if (monthFilter && !monthFilter.value) {
      monthFilter.value = data.month;
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu thống kê:', err);
  }
}

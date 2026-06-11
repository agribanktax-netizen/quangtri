// CẤU HÌNH NGÂN HÀNG ĐÍCH
const BANK_BIN = "VBA"; 
const BANK_ACCOUNT = "3900205361940"; 

const firebaseConfig = {
    apiKey: "AIzaSyAOSKLNPXp-s40iJNYYzdEWDnQDFoa6x_Q",
    authDomain: "thue2026-f558d.firebaseapp.com",
    databaseURL: "https://thue2026-f558d-default-rtdb.firebaseio.com",
    projectId: "thue2026-f558d",
    storageBucket: "thue2026-f558d.firebasestorage.app",
    messagingSenderId: "1008017359572",
    appId: "1:1008017359572:web:f70cf40778e600e8deb141"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let allData = [];
let filteredData = []; 
let currentSelectedCustomerId = null; 

// QUẢN LÝ USER CỤC BỘ QUA SESSION STORAGE (Tránh mất login khi F5 trang)
let currentUser = JSON.parse(sessionStorage.getItem('customUser')) || null;

// CẤU HÌNH PHÂN TRANG 
let currentPage = 1;
const rowsPerPage = 10;

// KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP NGAY KHI TẢI TRANG
window.onload = function() {
    checkLoginStatus();
};

function checkLoginStatus() {
    if (currentUser) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('mainSection').classList.remove('hidden');
        document.getElementById('txtLoginUser').innerText = `👤 ${currentUser.username} (${currentUser.Branch})`;
        fetchTaxData(); 
    } else {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('mainSection').classList.add('hidden');
        document.getElementById('qrPopup').classList.add('hidden'); 
    }
}

// CHỨC NĂNG MỚI: ĐĂNG NHẬP BẰNG TÀI KHOẢN DATABASE CÓ PHÂN CHIA BRANCH
function loginWithUsernamePassword() {
    const userInp = document.getElementById('loginUsername').value.trim();
    const passInp = document.getElementById('loginPassword').value.trim();

    if (!userInp || !passInp) {
        alert("Vui lòng nhập đầy đủ Tài khoản và Mật khẩu!");
        return;
    }

    // Kiểm tra trực tiếp trên bảng "users" từ Firebase
    db.ref('users/' + userInp).once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.password === passInp) {
            currentUser = {
                username: userData.username,
                Branch: userData.Branch
            };
            // Lưu phiên đăng nhập tạm thời vào trình duyệt
            sessionStorage.setItem('customUser', JSON.stringify(currentUser));
            checkLoginStatus();
        } else {
            alert("Sai tài khoản hoặc mật khẩu. Vui lòng thử lại!");
        }
    }).catch(err => {
        alert("Lỗi kết nối cơ sở dữ liệu: " + err.message);
    });
}

function logout() {
    sessionStorage.removeItem('customUser');
    currentUser = null;
    location.reload();
}

// CẬP NHẬT: CHỈ LẤY DỮ LIỆU THUỘC ĐỊA BÀN (BRANCH) CỦA CÁN BỘ ĐÓ
function fetchTaxData() {
    if (!currentUser || !currentUser.Branch) return;

    db.ref('QRCodeTax').on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            allData = [];
            if (data) {
                for (let id in data) {
                    let item = data[id];
                    if (!item.ID) item.ID = id; 
                    
                    // BỘ LỌC ĐỊA BÀN CHIẾN LƯỢC: User thuộc Branch nào chỉ nạp data của Branch đó
                    if (item.Branch === currentUser.Branch) {
                        allData.push(item);
                    }
                }
                allData.sort((a, b) => new Date(b.InsertTime) - new Date(a.InsertTime));
            }
            initComboboxes();
            searchData(); 
        } catch (error) {
            console.error(error);
        }
    });
}

function initComboboxes() {
    const phuongXaSelect = document.getElementById('filterPhuongXa');
    const currentPx = phuongXaSelect.value;
    const uniquePhuongXa = [...new Set(allData.map(item => item.PhuongXa).filter(Boolean))];
    
    phuongXaSelect.innerHTML = '<option value="">-- Tất cả Phường/Xã --</option>';
    uniquePhuongXa.forEach(px => {
        phuongXaSelect.innerHTML += `<option value="${px}">${px}</option>`;
    });
    if(uniquePhuongXa.includes(currentPx)) phuongXaSelect.value = currentPx;
    updateThonToCombobox();
}

function updateThonToCombobox() {
    const selectedPx = document.getElementById('filterPhuongXa').value;
    const thonToSelect = document.getElementById('filterThonTo');
    const currentTt = thonToSelect.value;
    
    const filteredItems = selectedPx ? allData.filter(item => item.PhuongXa === selectedPx) : allData;
    const uniqueThonTo = [...new Set(filteredItems.map(item => item.ThonTo).filter(Boolean))];

    thonToSelect.innerHTML = '<option value="">-- Tất cả Thôn/Tổ --</option>';
    uniqueThonTo.forEach(tt => {
        thonToSelect.innerHTML += `<option value="${tt}">${tt}</option>`;
    });
    if(uniqueThonTo.includes(currentTt)) thonToSelect.value = currentTt;
}

function searchData() {
    const pxValue = document.getElementById('filterPhuongXa').value;
    const ttValue = document.getElementById('filterThonTo').value;
    const statusValue = document.getElementById('filterTrangThai').value; 

    filteredData = allData;

    if (pxValue) filteredData = filteredData.filter(item => item.PhuongXa === pxValue);
    if (ttValue) filteredData = filteredData.filter(item => item.ThonTo === ttValue);
    
    if (statusValue !== "") {
        const isPaid = statusValue === "true";
        filteredData = filteredData.filter(item => {
            const itemStatus = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1;
            return itemStatus === isPaid;
        });
    }

    currentPage = 1; 
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('taxTableBody');
    tbody.innerHTML = "";

    if (!filteredData || filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Không tìm thấy dữ liệu phù hợp với địa bàn của bạn</td></tr>`;
        updatePaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    pageData.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => handleRowClick(item);

        const statusText = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1
            ? "<b style='color:green;'>Đã thanh toán</b>" 
            : "<b style='color:red;'>Chưa thanh toán</b>";
        
        tr.innerHTML = `
            <td>${item.MaSoThue || ''}</td>
            <td>${item.Ho || ''} ${item.Ten || ''}</td>
            <td>${item.ThonTo || ''}</td>
            <td>${item.PhuongXa || ''}</td>
            <td><span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size:12px;">${item.Branch || 'N/A'}</span></td>
            <td>${item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0} đ</td>
            <td>${statusText}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationControls(filteredData.length);
}

function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    document.getElementById('pageInfo').innerText = `Trang ${currentPage} / ${totalPages}`;
    document.getElementById('btnPrev').disabled = (currentPage === 1);
    document.getElementById('btnNext').disabled = (currentPage === totalPages);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

function handleRowClick(item) {
    if (item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1) {
        alert(`Khách hàng ${item.Ho} ${item.Ten} đã thanh toán.`);
        return;
    }

    currentSelectedCustomerId = item.ID;
    document.getElementById('chkPaymentConfirm').checked = false;

    const rawPurpose = `${item.IDSUM || ''} ${item.Ho || ''} ${item.Ten || ''} ${item.MaSoThue || ''}`;
    const purpose = removeVietnameseTones(rawPurpose);

    const qrUrl = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-qr_only.png?amount=${item.SoTienThuThue}&addInfo=${encodeURIComponent(purpose)}`;

    document.getElementById('qrInfo').innerHTML = `
        <b>Khách hàng:</b> ${item.Ho || ''} ${item.Ten || ''}<br>
        <b>Số tiền:</b> ${item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0} đ<br>
        <b>Nội dung CK:</b> ${purpose}
    `;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrPopup').classList.remove('hidden');
}

function verifyAndPay() {
    const isChecked = document.getElementById('chkPaymentConfirm').checked;
    
    if (isChecked && currentSelectedCustomerId) {
        if(confirm("Bạn có chắc chắn muốn xác nhận khách hàng này ĐÃ THANH TOÁN?")) {
            db.ref('QRCodeTax/' + currentSelectedCustomerId).update({
                DaThanhToan: true
            }).then(() => {
                alert("Cập nhật trạng thái thanh toán thành công!");
                closePopup(); 
            }).catch((error) => {
                alert("Lỗi cập nhật dữ liệu: " + error.message);
                document.getElementById('chkPaymentConfirm').checked = false; 
            });
        } else {
            document.getElementById('chkPaymentConfirm').checked = false; 
        }
    }
}

function toggleCheckbox() {
    const checkbox = document.getElementById('chkPaymentConfirm');
    checkbox.checked = !checkbox.checked;
    verifyAndPay();
}

function closePopup() {
    document.getElementById('qrPopup').classList.add('hidden');
    currentSelectedCustomerId = null; 
}

function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ẽ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|ể|Ẽ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.trim();
}

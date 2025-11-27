const API_BASE = "/api";
let currentTab = "auction";
let socket;
let flatpickrDate;
let flatpickrTime;

// localStorage 키 정의
const STORAGE_KEYS = {
  itemForm: "auction_item_form",
  postForm: "auction_post_form",
};

document.addEventListener("DOMContentLoaded", () => {
  // Initialize socket
  socket = io();
  setupSocketListeners();

  // Initialize icons
  lucide.createIcons();

  // Initialize data
  checkAdmin();
  loadUserInfo();
  loadItems();

  // Initialize time picker if modal is open (unlikely on load but good practice)
  // initializeTimePicker();
});

// XSS 방지를 위한 HTML 이스케이프 함수
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===== API 헬퍼 함수 =====
async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return data;
}

async function apiGet(url) {
  return apiRequest(url);
}

async function apiPost(url, body) {
  return apiRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiDelete(url, body = {}) {
  return apiRequest(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiPut(url, body) {
  return apiRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupSocketListeners() {
  // 연결 성공
  socket.on("connect", () => {
    console.log("✓ WebSocket 연결됨:", socket.id);
  });

  // 실시간 접속자 수 업데이트
  socket.on("user_count", (count) => {
    const el = document.getElementById("onlineUsers");
    if (el) el.textContent = count;
    lucide.createIcons();
  });

  // 실시간 새 상품 등록 알림
  socket.on("new_item", (data) => {
    console.log("새 상품 등록:", data);
    showNotification(
      `${data.sellerName}님이 "${data.itemTitle}" 상품을 등록했습니다!`,
      "success"
    );

    // 현재 경매 탭이면 목록 새로고침
    if (currentTab === "auction") {
      loadItems();
    }
  });

  // 실시간 입찰 알림
  socket.on("new_bid", (data) => {
    console.log("새로운 입찰:", data);
    showNotification(
      `${data.bidderName}님이 ${
        data.itemTitle
      }에 ${data.newPrice.toLocaleString()}원 입찰!`,
      "success"
    );

    // 현재 경매 탭이면 해당 상품만 업데이트
    if (currentTab === "auction" && data.itemId) {
      updateSingleItem(data.itemId);
    }

    // 내가 입찰한 경우 잔액 업데이트
    loadUserInfo();
  });

  // 실시간 경매 종료 알림
  socket.on("auction_ended", (data) => {
    console.log("경매 종료:", data);

    if (data.status === "sold") {
      showNotification(
        `🎉 ${data.itemTitle} 경매 종료! ${
          data.winnerName
        }님이 ${data.finalPrice.toLocaleString()}원에 낙찰!`,
        "success"
      );
    } else {
      showNotification(`${data.itemTitle} 경매가 종료되었습니다.`, "error");
    }

    // 현재 경매 탭이면 해당 상품만 업데이트
    if (currentTab === "auction" && data.itemId) {
      updateSingleItem(data.itemId);
    }

    // 잔액 업데이트 (낙찰자, 판매자, 입찰 환불 등)
    loadUserInfo();
  });

  // 실시간 즉시 구매 알림
  socket.on("item_sold", (data) => {
    console.log("즉시 구매:", data);
    showNotification(
      `⚡ ${data.buyerName}님이 ${data.itemTitle}을(를) 즉시 구매!`,
      "success"
    );

    // 현재 경매 탭이면 해당 상품만 업데이트
    if (currentTab === "auction" && data.itemId) {
      updateSingleItem(data.itemId);
    }

    // 잔액 업데이트 (구매자, 판매자)
    loadUserInfo();
  });

  // 연결 해제
  socket.on("disconnect", () => {
    console.log("✗ WebSocket 연결 해제");
  });
}

// 탭 전환
function switchTab(tab, fromEvent = true) {
  currentTab = tab;

  document
    .querySelectorAll(".nav-tab")
    .forEach((btn) => btn.classList.remove("active"));

  // 이벤트에서 호출된 경우만 active 클래스 추가
  if (fromEvent && event && event.target) {
    event.target.closest(".nav-tab").classList.add("active");
  } else {
    // 프로그래매틱 호출의 경우 해당 탭 버튼 찾아서 active 추가
    const tabs = {
      auction: 0,
      community: 1,
    };
    const tabButtons = document.querySelectorAll(".nav-tab");
    if (tabButtons[tabs[tab]]) {
      tabButtons[tabs[tab]].classList.add("active");
    }
  }

  document
    .querySelectorAll(".tab-content")
    .forEach((content) => (content.style.display = "none"));

  if (tab === "auction") {
    document.getElementById("auctionTab").style.display = "block";
    loadItems();
  } else if (tab === "community") {
    document.getElementById("communityTab").style.display = "block";
    loadPosts();
  }

  lucide.createIcons();
}

// 관리자 확인
async function checkAdmin() {
  const data = await apiGet("/auth/me");
  if (data.success && data.user.role === "admin") {
    document.getElementById("adminTab").style.display = "flex";
  }
}

async function logout() {
  const data = await apiPost("/auth/logout");
  if (data.success) window.location.href = "/login";
}

async function loadUserInfo() {
  const data = await apiGet("/auth/me");
  if (data.success) {
    document.getElementById("userBalance").textContent =
      formatPrice(data.user.balance) + "원";
  }
}

// ===== 경매 기능 =====

async function loadItems() {
  const data = await apiGet(`${API_BASE}/items`);
  if (data.success) displayItems(data.items);
}

// 개별 상품 업데이트 (WebSocket용)
async function updateSingleItem(itemId) {
  const data = await apiGet(`${API_BASE}/items/${itemId}`);

  const itemCard = document.querySelector(`[data-item-id="${itemId}"]`);

  if (data.success && data.item) {
    const item = data.item;

    // 상품이 sold나 expired 상태면 카드 제거
    if (item.status !== "active") {
      if (itemCard) {
        itemCard.remove();
        lucide.createIcons();
      }
      return;
    }

    if (itemCard) {
      // 기존 입찰가 입력값 저장
      const bidInput = itemCard.querySelector(`#bid-${itemId}`);
      const savedBidValue = bidInput ? bidInput.value : "";

      // 상품 카드 HTML 생성
      const newCardHTML = generateItemCardHTML(item);

      // 카드 교체
      itemCard.outerHTML = newCardHTML;

      // 입찰가 입력값 복원
      if (savedBidValue) {
        const newBidInput = document.querySelector(`#bid-${itemId}`);
        if (newBidInput) {
          newBidInput.value = savedBidValue;
        }
      }

      lucide.createIcons();
    }
  } else {
    // 상품을 찾을 수 없으면 카드 제거
    if (itemCard) {
      itemCard.remove();
      lucide.createIcons();
    }
  }
}

// 개별 상품 카드 HTML 생성 (재사용 가능)
function generateItemCardHTML(item) {
  const endTime = new Date(item.end_time);
  const timeRemaining = getTimeRemaining(endTime);
  const isOwner = item.seller_id === window.APP_DATA.userId;
  const isExpired = new Date() >= endTime;

  return `
        <div class="item-card" data-item-id="${item.id}">
            <div class="item-header">
                <h3 class="item-title">${item.title}</h3>
                <span class="item-status ${
                  isExpired ? "status-expired" : "status-active"
                }">
                    <i data-lucide="${
                      isExpired ? "x-circle" : "zap"
                    }" style="width: 14px; height: 14px;"></i>
                    ${isExpired ? "종료" : "진행중"}
                </span>
            </div>
            <p class="item-description">${
              escapeHtml(item.description) || "설명 없음"
            }</p>
            <div class="item-price">
                <div class="price-label">현재가</div>
                <div class="price-amount">${formatPrice(
                  item.current_price
                )}원</div>
            </div>
            ${
              item.buy_now_price
                ? `
                <div class="buy-now-badge">
                    <div class="buy-now-label">즉시 구매가</div>
                    <div class="buy-now-price">${formatPrice(
                      item.buy_now_price
                    )}원</div>
                </div>
            `
                : ""
            }
            <div class="item-meta">
                <div class="meta-item">
                    <i data-lucide="user" style="width: 16px; height: 16px;"></i>
                    ${item.seller_name}
                </div>
                <div class="meta-item">
                    <i data-lucide="clock" style="width: 16px; height: 16px;"></i>
                    ${timeRemaining}
                </div>
                <div class="meta-item">
                    <i data-lucide="activity" style="width: 16px; height: 16px;"></i>
                    ${item.bid_count}회 입찰
                </div>
            </div>
            ${
              isOwner
                ? `
                <div class="item-actions">
                    <button class="delete-button" onclick="deleteItem(${item.id})">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        삭제
                    </button>
                </div>
            `
                : `
                <div class="item-actions">
                    ${
                      item.buy_now_price && !isExpired
                        ? `
                        <button class="chat-button buy-now-btn" onclick="buyNow(${item.id}, ${item.buy_now_price})">
                            <i data-lucide="zap" style="width: 16px; height: 16px;"></i>
                            즉시 구매
                        </button>
                    `
                        : ""
                    }
                </div>
            `
            }
            ${
              !isExpired && !isOwner
                ? `
            <div class="bid-section">
                <input type="number" class="bid-input" id="bid-${item.id}"
                       placeholder="입찰가 입력"
                       min="${parseInt(item.current_price) + 1000}"
                       ${
                         item.buy_now_price ? `max="${item.buy_now_price}"` : ""
                       }
                       step="1000">
                <button class="bid-button" onclick="placeBid(${item.id})">
                    <i data-lucide="gavel" style="width: 18px; height: 18px;"></i>
                    입찰
                </button>
            </div>
            `
                : isExpired
                ? `
            <div class="expired-notice">
                <i data-lucide="clock" style="width: 18px; height: 18px;"></i>
                경매가 종료되었습니다
            </div>
            `
                : ""
            }
        </div>
    `;
}

function displayItems(items) {
  const container = document.getElementById("itemsContainer");
  if (items.length === 0) {
    container.innerHTML =
      '<div class="loading">진행 중인 경매가 없습니다.</div>';
    lucide.createIcons();
    return;
  }

  container.innerHTML = items
    .map((item) => generateItemCardHTML(item))
    .join("");
  lucide.createIcons();
}

async function placeBid(itemId) {
  const bidInput = document.getElementById(`bid-${itemId}`);
  const bidAmount = parseInt(bidInput.value);
  if (!bidAmount) {
    showNotification("입찰가를 입력해주세요.", "error");
    return;
  }

  try {
    // 먼저 상품 정보를 가져와서 즉시 구매가 확인
    const itemData = await apiGet(`${API_BASE}/items/${itemId}`);

    if (!itemData.success) {
      showNotification("상품 정보를 불러올 수 없습니다.", "error");
      return;
    }

    const item = itemData.item;

    // 즉시 구매가가 있고, 입찰가가 즉시 구매가 이상이면 경고
    if (item.buy_now_price && bidAmount >= parseFloat(item.buy_now_price)) {
      const confirmBuy = confirm(
        `입찰가(₩${formatPrice(bidAmount)})가 즉시 구매가(₩${formatPrice(
          item.buy_now_price
        )})와 같거나 높습니다.\n\n즉시 구매하시겠습니까?`
      );
      if (confirmBuy) {
        await buyNow(itemId, bidAmount);
      }
      return;
    }

    // 일반 입찰 처리
    const data = await apiPost(`${API_BASE}/bids`, { itemId, bidAmount });
    if (data.success) {
      showNotification("입찰에 성공했습니다!", "success");
      bidInput.value = "";
      // WebSocket으로 자동 업데이트되므로 loadItems() 불필요
      loadUserInfo();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("입찰에 실패했습니다.", "error");
  }
}

async function deleteItem(itemId) {
  if (!confirm("정말 이 상품을 삭제하시겠습니까?")) return;

  try {
    const data = await apiDelete(`${API_BASE}/items/${itemId}`);
    if (data.success) {
      showNotification("상품이 삭제되었습니다.", "success");
      loadItems();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("삭제에 실패했습니다.", "error");
  }
}

// 폼 데이터 저장
function saveFormData(formKey, data) {
  localStorage.setItem(formKey, JSON.stringify(data));
}

// 폼 데이터 불러오기
function loadFormData(formKey) {
  const data = localStorage.getItem(formKey);
  return data ? JSON.parse(data) : null;
}

// 폼 데이터 삭제
function clearFormData(formKey) {
  localStorage.removeItem(formKey);
}

// 상품 등록 폼 데이터 저장
function saveItemFormData() {
  const data = {
    title: document.getElementById("itemTitle").value,
    description: document.getElementById("itemDescription").value,
    price: document.getElementById("itemPrice").value,
    buyNowPrice: document.getElementById("itemBuyNowPrice").value,
    endDate: document.getElementById("auctionEndDate").value,
    endTime: document.getElementById("auctionEndTime").value,
  };
  saveFormData(STORAGE_KEYS.itemForm, data);
}

// 상품 등록 폼 데이터 복원
function restoreItemFormData() {
  const data = loadFormData(STORAGE_KEYS.itemForm);
  if (data) {
    if (data.title) document.getElementById("itemTitle").value = data.title;
    if (data.description)
      document.getElementById("itemDescription").value = data.description;
    if (data.price) document.getElementById("itemPrice").value = data.price;
    if (data.buyNowPrice)
      document.getElementById("itemBuyNowPrice").value = data.buyNowPrice;
    if (data.endDate && flatpickrDate) {
      flatpickrDate.setDate(data.endDate);
    }
    if (data.endTime && flatpickrTime) {
      flatpickrTime.setDate(data.endTime);
    }
  }
}

function openAddItemModal() {
  document.getElementById("addItemModal").classList.add("active");

  // Initialize Flatpickr for date
  if (document.getElementById("auctionEndDate")) {
    flatpickrDate = flatpickr("#auctionEndDate", {
      dateFormat: "Y-m-d",
      minDate: "today",
      locale: "ko",
      onChange: function () {
        saveItemFormData();
      },
    });
  }

  // Initialize Flatpickr for time
  if (document.getElementById("auctionEndTime")) {
    flatpickrTime = flatpickr("#auctionEndTime", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "h:i K",
      time_24hr: false,
      locale: "ko",
      onChange: function () {
        saveItemFormData();
      },
    });
  }

  // 저장된 폼 데이터 복원
  setTimeout(() => {
    restoreItemFormData();

    // 입력 이벤트 리스너 추가
    [
      "itemTitle",
      "itemDescription",
      "itemPrice",
      "itemBuyNowPrice",
      "auctionEndDate",
      "auctionEndTime",
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener("input", saveItemFormData);
        element.addEventListener("change", saveItemFormData);
      }
    });
  }, 100);

  lucide.createIcons();
}

function closeAddItemModal() {
  document.getElementById("addItemModal").classList.remove("active");
  document.getElementById("addItemForm").reset();
  if (flatpickrDate) {
    flatpickrDate.destroy();
    flatpickrDate = null;
  }
  if (flatpickrTime) {
    flatpickrTime.destroy();
    flatpickrTime = null;
  }
}

async function submitNewItem(event) {
  event.preventDefault();
  const title = document.getElementById("itemTitle").value;
  const description = document.getElementById("itemDescription").value;
  const startingPrice = document.getElementById("itemPrice").value;
  const buyNowPrice = document.getElementById("itemBuyNowPrice").value;

  // 날짜/시간 조합
  const endDate = document.getElementById("auctionEndDate").value;
  const endTime = document.getElementById("auctionEndTime").value;

  if (!endDate || !endTime) {
    showNotification("경매 종료 날짜와 시간을 모두 선택해주세요.", "error");
    return;
  }

  // Combine date and time
  const dateObj = flatpickrDate.selectedDates[0];
  const timeObj = flatpickrTime.selectedDates[0];

  if (!dateObj || !timeObj) {
    showNotification("유효하지 않은 날짜 또는 시간입니다.", "error");
    return;
  }

  // Combine
  const combinedDate = new Date(dateObj);
  combinedDate.setHours(timeObj.getHours());
  combinedDate.setMinutes(timeObj.getMinutes());
  combinedDate.setSeconds(0);

  const formattedEndTime = combinedDate.toISOString();

  // 즉시 구매가 유효성 검사
  if (buyNowPrice && parseFloat(buyNowPrice) <= parseFloat(startingPrice)) {
    showNotification("즉시 구매가는 시작 가격보다 높아야 합니다.", "error");
    return;
  }

  try {
    const data = await apiPost(`${API_BASE}/items`, {
      title,
      description,
      startingPrice,
      buyNowPrice: buyNowPrice || null,
      endTime: formattedEndTime,
    });
    if (data.success) {
      showNotification("상품이 등록되었습니다!", "success");
      clearFormData(STORAGE_KEYS.itemForm); // localStorage 데이터 삭제
      closeAddItemModal();
      loadItems();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("상품 등록에 실패했습니다.", "error");
  }
}

// 즉시 구매
async function buyNow(itemId, price) {
  if (
    !confirm(
      `₩${formatPrice(
        price
      )}원에 이 상품을 즉시 구매하시겠습니까?\n\n구매 후 취소가 불가능합니다.`
    )
  ) {
    return;
  }

  try {
    const data = await apiPost(`${API_BASE}/buy-now`, { itemId });

    if (data.success) {
      showNotification(
        `${data.message}\n남은 잔액: ₩${formatPrice(
          data.data.remainingBalance
        )}`,
        "success"
      );
      loadItems();
      loadUserInfo(); // 잔액 업데이트
    } else {
      if (data.required && data.current) {
        showNotification(
          `${data.message}\n필요: ₩${formatPrice(
            data.required
          )}, 현재: ₩${formatPrice(data.current)}`,
          "error"
        );
      } else {
        showNotification(data.message, "error");
      }
    }
  } catch (error) {
    showNotification("즉시 구매에 실패했습니다.", "error");
  }
}

// ===== 커뮤니티 기능 =====
async function loadPosts() {
  const data = await apiGet("/api/community/posts");
  if (data.success) displayPosts(data.posts);
}

function displayPosts(posts) {
  const container = document.getElementById("postsContainer");
  if (posts.length === 0) {
    container.innerHTML = '<div class="loading">게시글이 없습니다.</div>';
    return;
  }

  container.innerHTML = posts
    .map(
      (post) => `
        <div class="post-card" onclick="openPostDetail(${post.id})">
            <div class="post-header">
                <h3 class="post-title">${post.title}</h3>
                <div class="post-meta">
                    <span>${post.username}</span> ·
                    <span>${new Date(
                      post.created_at
                    ).toLocaleDateString()}</span>
                </div>
            </div>
            <p class="post-content">${post.content.substring(0, 100)}${
        post.content.length > 100 ? "..." : ""
      }</p>
            <div class="post-stats">
                <span><i data-lucide="eye" style="width: 14px; height: 14px;"></i> ${
                  post.views
                }</span>
                <span><i data-lucide="message-square" style="width: 14px; height: 14px;"></i> ${
                  post.comment_count
                }</span>
            </div>
        </div>
    `
    )
    .join("");
  lucide.createIcons();
}

async function openPostDetail(postId) {
  try {
    const data = await apiGet(`/api/community/posts/${postId}`);

    if (data.success) {
      const post = data.post;
      const comments = data.comments;

      document.getElementById("detailPostTitle").textContent = post.title;

      const commentsHtml =
        comments.length > 0
          ? comments
              .map(
                (comment) => `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author">${
                              comment.username
                            }</span>
                            <span class="comment-date">${new Date(
                              comment.created_at
                            ).toLocaleString()}</span>
                            ${
                              comment.user_id === window.APP_DATA.userId
                                ? `
                                <button class="delete-button delete-comment-btn" onclick="deleteComment(${comment.id}, ${postId})">
                                    <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                                    삭제
                                </button>
                            `
                                : ""
                            }
                        </div>
                        <p class="comment-content">${comment.content}</p>
                    </div>
                `
              )
              .join("")
          : '<div class="loading">댓글이 없습니다.</div>';

      document.getElementById("postDetailContent").innerHTML = `
                <div class="post-detail-meta">
                    <span>${post.username}</span> ·
                    <span>${new Date(post.created_at).toLocaleString()}</span> ·
                    <span>조회 ${post.views}</span>
                    ${
                      post.user_id === window.APP_DATA.userId
                        ? `
                        <button class="delete-button delete-post-btn" onclick="deletePost(${postId})">
                            <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                            삭제
                        </button>
                    `
                        : ""
                    }
                </div>
                <div class="post-detail-body">${post.content}</div>
                <hr class="post-divider">
                <h3 class="comments-title">
                    <i data-lucide="message-square" style="width: 18px; height: 18px;"></i>
                    댓글 ${comments.length}개
                </h3>
                <div class="comments-list">${commentsHtml}</div>
                <form class="comment-form" onsubmit="submitComment(event, ${postId})">
                    <textarea class="form-textarea comment-textarea" id="commentContent" placeholder="댓글을 입력하세요..." required></textarea>
                    <div class="comment-options">
                        <input type="checkbox" id="commentAnonymous" class="checkbox-input" />
                        <label for="commentAnonymous" class="checkbox-label">익명으로 작성</label>
                    </div>
                    <button type="submit" class="submit-button comment-submit-btn">
                        <i data-lucide="send" style="width: 16px; height: 16px;"></i>
                        댓글 작성
                    </button>
                </form>
            `;

      document.getElementById("postDetailModal").classList.add("active");
      lucide.createIcons();
    }
  } catch (error) {
    showNotification("게시글을 불러오는데 실패했습니다.", "error");
  }
}

function closePostDetailModal() {
  document.getElementById("postDetailModal").classList.remove("active");
}

async function submitComment(event, postId) {
  event.preventDefault();
  const content = document.getElementById("commentContent").value;
  const isAnonymous = document.getElementById("commentAnonymous").checked;

  try {
    const data = await apiPost("/api/community/comments", {
      postId,
      content,
      isAnonymous,
    });

    if (data.success) {
      showNotification("댓글이 작성되었습니다!", "success");
      closePostDetailModal();
      loadPosts();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("댓글 작성에 실패했습니다.", "error");
  }
}

function openPostModal() {
  document.getElementById("postModal").classList.add("active");

  // 폼 초기화
  document.getElementById("postForm").reset();
  clearFormData(STORAGE_KEYS.postForm); // localStorage 데이터도 삭제

  lucide.createIcons();
}

function closePostModal() {
  document.getElementById("postModal").classList.remove("active");
  document.getElementById("postForm").reset();
  clearFormData(STORAGE_KEYS.postForm); // localStorage 데이터 삭제
}

async function submitPost(event) {
  event.preventDefault();
  const title = document.getElementById("postTitle").value;
  const content = document.getElementById("postContent").value;
  const isAnonymous = document.getElementById("postAnonymous").checked;

  try {
    const data = await apiPost("/api/community/posts", {
      title,
      content,
      isAnonymous,
    });
    if (data.success) {
      showNotification("게시글이 작성되었습니다!", "success");
      clearFormData(STORAGE_KEYS.postForm); // localStorage 데이터 삭제
      closePostModal();
      loadPosts();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("게시글 작성에 실패했습니다.", "error");
  }
}

// 게시글 삭제
async function deletePost(postId) {
  if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) {
    return;
  }

  try {
    const data = await apiDelete(`/api/community/posts/${postId}`);

    if (data.success) {
      showNotification("게시글이 삭제되었습니다.", "success");
      closePostDetailModal();
      loadPosts();
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("게시글 삭제에 실패했습니다.", "error");
  }
}

// 댓글 삭제
async function deleteComment(commentId, postId) {
  if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) {
    return;
  }

  try {
    const data = await apiDelete(`/api/community/comments/${commentId}`);

    if (data.success) {
      showNotification("댓글이 삭제되었습니다.", "success");
      openPostDetail(postId);
    } else {
      showNotification(data.message, "error");
    }
  } catch (error) {
    showNotification("댓글 삭제에 실패했습니다.", "error");
  }
}

// ===== 유틸리티 =====
function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  const messageEl = document.getElementById("notificationMessage");
  messageEl.textContent = message;
  notification.className = `notification ${type} active`;
  setTimeout(() => notification.classList.remove("active"), 3000);
}

function formatPrice(price) {
  return new Intl.NumberFormat("ko-KR").format(price);
}

function getTimeRemaining(endTime) {
  const now = new Date();
  const diff = endTime - now;
  if (diff <= 0) return "종료";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 남음`;
  }
  return `${hours}시간 ${minutes}분 남음`;
}

import { db } from './firebase.js';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Admin password - same as in your main app
const ADMIN_SECRET = 'hzk-admin-2024';

// State
let state = {
  isAuthenticated: false,
  currentPage: 'tickets', // 'tickets' or 'controls'
  tickets: [],
  filterStatus: 'all',
  expandedTicketId: null,
  adminActionLog: [],
  unsubscribe: null,
  unsubscribeLog: null,
  mobileMenuOpen: false,
  deleteConfirmTicketId: null
};

// Initialize app
function init() {
  checkAuth();
  renderApp();
}

// Check if admin is already authenticated
function checkAuth() {
  const isAuth = sessionStorage.getItem('hzk_admin_auth');
  if (isAuth === 'true') {
    state.isAuthenticated = true;
    subscribeToTickets();
    subscribeToActionLogs();
  }
}

// Render the application
function renderApp() {
  const app = document.getElementById('app');
  
  if (!state.isAuthenticated) {
    app.innerHTML = renderLoginScreen();
    attachLoginListeners();
  } else {
    app.innerHTML = renderDashboard();
    attachDashboardListeners();
  }
}

// Login screen template
function renderLoginScreen() {
  return `
    <div class="login-container">
      <div class="login-card">
        <div class="login-icon">🔐</div>
        <h1>HZK Support Admin</h1>
        <p class="login-subtitle">Enter admin credentials to access the dashboard</p>
        
        <form id="loginForm" class="login-form">
          <div class="form-group">
            <input 
              type="password" 
              id="password" 
              placeholder="Admin Password"
              autocomplete="current-password"
            />
          </div>
          <button type="submit" class="login-btn">
            Access Dashboard
          </button>
        </form>
        
        <div id="loginError" class="login-error" style="display: none;"></div>
      </div>
    </div>
  `;
}

// Dashboard template
function renderDashboard() {
  const stats = calculateStats();
  
  return `
    <div class="dashboard-layout">
      <!-- Mobile Top Nav -->
      <header class="mobile-header">
        <div class="mobile-header-content">
          <button id="mobileMenuBtn" class="mobile-menu-btn ${state.mobileMenuOpen ? 'active' : ''}">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>
          <h1 class="mobile-title">
            <span class="title-icon">🎫</span>
            HZK Admin
          </h1>
          <div class="mobile-status">
            <span class="status-dot"></span>
          </div>
        </div>
        
        <!-- Mobile Menu Dropdown -->
        <nav class="mobile-nav ${state.mobileMenuOpen ? 'open' : ''}">
          <a href="#" class="mobile-nav-item ${state.currentPage === 'tickets' ? 'active' : ''}" data-page="tickets">
            <span class="nav-icon">🎫</span>
            <span>Tickets</span>
          </a>
          <a href="#" class="mobile-nav-item ${state.currentPage === 'controls' ? 'active' : ''}" data-page="controls">
            <span class="nav-icon">⚙️</span>
            <span>Controls</span>
          </a>
          <button id="mobileLogoutBtn" class="mobile-nav-item logout">
            <span class="nav-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </nav>
      </header>

      <!-- Desktop Side Nav -->
      <aside class="side-nav">
        <div class="side-nav-header">
          <div class="brand">
            <span class="brand-icon">🎫</span>
            <div class="brand-text">
              <h1>HZK Admin</h1>
              <span class="brand-subtitle">Support Dashboard</span>
            </div>
          </div>
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Live</span>
          </div>
        </div>
        
        <nav class="side-nav-menu">
          <a href="#" class="nav-item ${state.currentPage === 'tickets' ? 'active' : ''}" data-page="tickets">
            <span class="nav-icon">🎫</span>
            <span class="nav-label">Tickets</span>
            <span class="nav-badge">${stats.total}</span>
          </a>
          <a href="#" class="nav-item ${state.currentPage === 'controls' ? 'active' : ''}" data-page="controls">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Controls</span>
          </a>
        </nav>
        
        <div class="side-nav-footer">
          <button id="logoutBtn" class="logout-btn">
            <span class="nav-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        ${state.currentPage === 'tickets' ? renderTicketsPage(stats) : renderControlsPage()}
      </main>

      <!-- Success Modal -->
      <div id="successModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-icon">✅</div>
          <h2 class="modal-title">Success!</h2>
          <p id="modalMessage" class="modal-message">Your changes have been saved.</p>
          <div id="modalDetails" class="modal-details"></div>
          <button id="modalCloseBtn" class="modal-close-btn">Got It</button>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div id="deleteModal" class="modal-overlay ${state.deleteConfirmTicketId ? 'active' : ''}">
        <div class="modal-content delete-modal">
          <div class="modal-icon delete-icon">⚠️</div>
          <h2 class="modal-title delete-title">Delete Ticket?</h2>
          <p class="modal-message">This action cannot be undone. The ticket and all its data will be permanently removed.</p>
          <div class="modal-actions">
            <button id="cancelDeleteBtn" class="modal-btn cancel-btn">Cancel</button>
            <button id="confirmDeleteBtn" class="modal-btn delete-btn">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Tickets Page
function renderTicketsPage(stats) {
  return `
    <div class="page-header">
      <h2 class="page-title">Support Tickets</h2>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card stat-total">
        <div class="stat-content">
          <div class="stat-label">Total Tickets</div>
          <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-icon">📊</div>
      </div>
      
      <div class="stat-card stat-open">
        <div class="stat-content">
          <div class="stat-label">Open</div>
          <div class="stat-value">${stats.open}</div>
        </div>
        <div class="stat-icon">🔔</div>
      </div>
      
      <div class="stat-card stat-progress">
        <div class="stat-content">
          <div class="stat-label">In Progress</div>
          <div class="stat-value">${stats.inProgress}</div>
        </div>
        <div class="stat-icon">⚡</div>
      </div>
      
      <div class="stat-card stat-resolved">
        <div class="stat-content">
          <div class="stat-label">Resolved</div>
          <div class="stat-value">${stats.resolved}</div>
        </div>
        <div class="stat-icon">✅</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label for="statusFilter">Filter by Status</label>
        <select id="statusFilter" class="filter-select">
          <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>
            All Tickets (${stats.total})
          </option>
          <option value="open" ${state.filterStatus === 'open' ? 'selected' : ''}>
            Open (${stats.open})
          </option>
          <option value="in-progress" ${state.filterStatus === 'in-progress' ? 'selected' : ''}>
            In Progress (${stats.inProgress})
          </option>
          <option value="resolved" ${state.filterStatus === 'resolved' ? 'selected' : ''}>
            Resolved (${stats.resolved})
          </option>
          <option value="closed" ${state.filterStatus === 'closed' ? 'selected' : ''}>
            Closed (${stats.closed})
          </option>
        </select>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="content-grid">
      <!-- Tickets List -->
      <div class="tickets-section">
        <h3 class="section-title">
          <span class="title-icon">🎫</span>
          ${state.filterStatus === 'all' ? 'All Tickets' : getFilterTitle(state.filterStatus)}
        </h3>
        <div class="tickets-list">
          ${renderTicketsList()}
        </div>
      </div>

      <!-- Action Log -->
      <div class="action-log-section">
        <h4 class="section-title">
          <span class="title-icon">📋</span>
          Recent Actions
        </h4>
        <div class="action-log">
          ${renderActionLog()}
        </div>
      </div>
    </div>
  `;
}

// Controls Page (Empty for now)
function renderControlsPage() {
  return `
    <div class="page-header">
      <h2 class="page-title">Controls</h2>
    </div>

    <div class="controls-container">
      <div class="empty-controls">
        <div class="empty-icon">⚙️</div>
        <h3>Control Panel</h3>
        <p>Admin controls and settings will be available here.</p>
        <div class="coming-soon-badge">Coming Soon</div>
      </div>
    </div>
  `;
}

// Calculate statistics
function calculateStats() {
  return {
    total: state.tickets.length,
    open: state.tickets.filter(t => t.status === 'open').length,
    inProgress: state.tickets.filter(t => t.status === 'in-progress').length,
    resolved: state.tickets.filter(t => t.status === 'resolved').length,
    closed: state.tickets.filter(t => t.status === 'closed').length
  };
}

// Get filter title
function getFilterTitle(filter) {
  const titles = {
    'open': 'Open Tickets',
    'in-progress': 'In Progress Tickets',
    'resolved': 'Resolved Tickets',
    'closed': 'Closed Tickets'
  };
  return titles[filter] || 'Tickets';
}

// Render action log
function renderActionLog() {
  if (state.adminActionLog.length === 0) {
    return '<div class="log-empty">No recent actions</div>';
  }
  
  return state.adminActionLog.map((log, index) => {
    const shortTicketId = log.ticketId === 'N/A' ? 'N/A' : log.ticketId.slice(0, 8);
    const isNew = index === 0 ? 'new-entry' : '';
    const isDelete = log.action.toLowerCase().includes('delete') ? 'delete-action' : '';
    return `
      <div class="log-entry ${isNew} ${isDelete}">
        <span class="log-time">${log.timestamp}</span>
        <span class="log-action">${log.action}</span>
        <span class="log-ticket">#${shortTicketId}</span>
        <span class="log-details">${log.details}</span>
      </div>
    `;
  }).join('');
}

// Render tickets list
function renderTicketsList() {
  if (state.tickets.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No tickets found</p>
      </div>
    `;
  }
  
  return state.tickets.map(ticket => renderTicketCard(ticket)).join('');
}

// Render individual ticket card
function renderTicketCard(ticket) {
  const isExpanded = state.expandedTicketId === ticket.id;
  
  return `
    <div class="ticket-card ${isExpanded ? 'expanded' : ''}" data-ticket-id="${ticket.id}">
      <div class="ticket-header" onclick="toggleTicket('${ticket.id}')">
        <div class="ticket-main">
          <div class="ticket-row-1">
            <span class="ticket-status status-${ticket.status}">
              ${getStatusIcon(ticket.status)} ${ticket.status.toUpperCase()}
            </span>
            <span class="ticket-category">${ticket.category}</span>
            <span class="ticket-id">ID: ${ticket.id.slice(0, 8)}</span>
          </div>
          
          <h4 class="ticket-subject">${escapeHtml(ticket.subject)}</h4>
          
          <div class="ticket-row-3">
            <span class="ticket-wallet">
              <span class="wallet-icon">👤</span>
              ${ticket.walletAddress.slice(0, 6)}...${ticket.walletAddress.slice(-4)}
            </span>
            <span class="ticket-date">
              📅 ${formatDate(ticket.createdAt)}
            </span>
          </div>
        </div>
        
        <div class="ticket-toggle">
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      ${isExpanded ? renderTicketDetails(ticket) : ''}
    </div>
  `;
}

// Render ticket details (expanded view)
function renderTicketDetails(ticket) {
  return `
    <div class="ticket-details">
      <div class="detail-section">
        <label class="detail-label">Full Wallet Address</label>
        <div class="wallet-address">
          <code>${ticket.walletAddress}</code>
          <button 
            class="copy-btn" 
            onclick="copyToClipboard('${ticket.walletAddress}')"
            title="Copy wallet address"
          >
            📋
          </button>
        </div>
      </div>

      <div class="detail-section">
        <label class="detail-label">Description</label>
        <p class="ticket-description">${escapeHtml(ticket.description)}</p>
      </div>

      <div class="detail-section">
        <label class="detail-label">Status</label>
        <select 
          class="status-select"
          onchange="updateTicketStatus('${ticket.id}', this.value, '${ticket.status}')"
          data-original-status="${ticket.status}"
        >
          <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Open</option>
          <option value="in-progress" ${ticket.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
      </div>

      <div class="detail-section">
        <label class="detail-label">Admin Notes</label>
        <textarea 
          id="notes-${ticket.id}"
          class="notes-textarea"
          placeholder="Add notes or response for the user..."
          rows="4"
        >${ticket.adminNotes || ''}</textarea>
        <button 
          class="save-btn"
          onclick="saveNotes('${ticket.id}')"
        >
          Save Notes
        </button>
      </div>

      <div class="detail-footer">
        <div class="footer-info">
          <small>Created: ${formatDate(ticket.createdAt)}</small>
          ${ticket.updatedAt ? `<small> | Updated: ${formatDate(ticket.updatedAt)}</small>` : ''}
        </div>
        <button 
          class="delete-ticket-btn"
          onclick="showDeleteConfirm('${ticket.id}', '${escapeHtml(ticket.subject)}')"
        >
          <span class="delete-icon">🗑️</span>
          Delete Ticket
        </button>
      </div>
    </div>
  `;
}

// Get status icon
function getStatusIcon(status) {
  const icons = {
    'open': '🔔',
    'in-progress': '⚡',
    'resolved': '✅',
    'closed': '🔒'
  };
  return icons[status] || '📝';
}

// Format date
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show delete confirmation
window.showDeleteConfirm = function(ticketId, ticketSubject) {
  state.deleteConfirmTicketId = ticketId;
  state.deleteConfirmTicketSubject = ticketSubject;
  
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.add('active');
  }
};

// Hide delete confirmation
function hideDeleteConfirm() {
  state.deleteConfirmTicketId = null;
  state.deleteConfirmTicketSubject = null;
  
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Delete ticket
async function deleteTicket() {
  const ticketId = state.deleteConfirmTicketId;
  const ticketSubject = state.deleteConfirmTicketSubject;
  
  if (!ticketId) return;
  
  try {
    // Delete from Firestore
    await deleteDoc(doc(db, 'support_tickets', ticketId));
    
    // Log the action
    await logAdminAction('Ticket Deleted', ticketId, `Subject: ${ticketSubject || 'N/A'}`);
    
    // Hide modal
    hideDeleteConfirm();
    
    // Reset expanded state if deleted ticket was expanded
    if (state.expandedTicketId === ticketId) {
      state.expandedTicketId = null;
    }
    
    // Show success modal
    showSuccessModal(
      'Ticket Deleted!',
      'The ticket has been permanently removed.',
      `
        <div class="modal-detail-row">
          <span class="modal-detail-label">Ticket ID</span>
          <span class="modal-detail-value">#${ticketId.slice(0, 8)}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Subject</span>
          <span class="modal-detail-value">${ticketSubject || 'N/A'}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Timestamp</span>
          <span class="modal-detail-value">${new Date().toLocaleString()}</span>
        </div>
      `
    );
  } catch (error) {
    console.error('Error deleting ticket:', error);
    alert('Failed to delete ticket: ' + error.message);
    hideDeleteConfirm();
  }
}

// Show success modal
function showSuccessModal(title, message, details = null) {
  const modal = document.getElementById('successModal');
  const modalTitle = modal.querySelector('.modal-title');
  const modalMessage = document.getElementById('modalMessage');
  const modalDetails = document.getElementById('modalDetails');
  const closeBtn = document.getElementById('modalCloseBtn');
  
  modalTitle.textContent = title || 'Success!';
  modalMessage.textContent = message;
  
  if (details) {
    modalDetails.innerHTML = details;
    modalDetails.style.display = 'block';
  } else {
    modalDetails.style.display = 'none';
  }
  
  modal.classList.add('active');
  
  const autoCloseTimeout = setTimeout(() => {
    hideSuccessModal();
  }, 4000);
  
  const closeHandler = () => {
    clearTimeout(autoCloseTimeout);
    hideSuccessModal();
    closeBtn.removeEventListener('click', closeHandler);
  };
  
  closeBtn.addEventListener('click', closeHandler);
  
  const overlayHandler = (e) => {
    if (e.target === modal) {
      clearTimeout(autoCloseTimeout);
      hideSuccessModal();
      modal.removeEventListener('click', overlayHandler);
    }
  };
  
  modal.addEventListener('click', overlayHandler);
}

// Hide success modal
function hideSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Update only the tickets section
function updateTicketsSection() {
  const ticketsList = document.querySelector('.tickets-list');
  if (ticketsList) {
    ticketsList.innerHTML = renderTicketsList();
  }
  
  const sectionTitle = document.querySelector('.tickets-section .section-title');
  if (sectionTitle) {
    const titleText = state.filterStatus === 'all' ? 'All Tickets' : getFilterTitle(state.filterStatus);
    sectionTitle.innerHTML = `
      <span class="title-icon">🎫</span>
      ${titleText}
    `;
  }
}

// Update only the stats section
function updateStatsSection() {
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid) {
    const stats = calculateStats();
    
    const statCards = statsGrid.querySelectorAll('.stat-value');
    if (statCards.length === 4) {
      statCards[0].textContent = stats.total;
      statCards[1].textContent = stats.open;
      statCards[2].textContent = stats.inProgress;
      statCards[3].textContent = stats.resolved;
    }
  }
  
  // Update nav badge
  const navBadge = document.querySelector('.nav-badge');
  if (navBadge) {
    navBadge.textContent = state.tickets.length;
  }
}

// Update filter option counts
function updateFilterCounts() {
  const filterSelect = document.getElementById('statusFilter');
  if (filterSelect) {
    const stats = calculateStats();
    const currentValue = state.filterStatus;
    
    filterSelect.innerHTML = `
      <option value="all" ${currentValue === 'all' ? 'selected' : ''}>
        All Tickets (${stats.total})
      </option>
      <option value="open" ${currentValue === 'open' ? 'selected' : ''}>
        Open (${stats.open})
      </option>
      <option value="in-progress" ${currentValue === 'in-progress' ? 'selected' : ''}>
        In Progress (${stats.inProgress})
      </option>
      <option value="resolved" ${currentValue === 'resolved' ? 'selected' : ''}>
        Resolved (${stats.resolved})
      </option>
      <option value="closed" ${currentValue === 'closed' ? 'selected' : ''}>
        Closed (${stats.closed})
      </option>
    `;
    
    filterSelect.onchange = function(event) {
      const newValue = this.value;
      state.filterStatus = newValue;
      state.expandedTicketId = null;
      
      if (state.unsubscribe) {
        state.unsubscribe();
      }
      
      subscribeToTickets();
    };
  }
}

// Log admin action
async function logAdminAction(action, ticketId, details) {
  try {
    const docRef = await addDoc(collection(db, 'admin_action_logs'), {
      action,
      ticketId: ticketId || 'N/A',
      details,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving admin action log:', error);
    throw error;
  }
}

// Attach login listeners
function attachLoginListeners() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', handleLogin);
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  
  const passwordInput = document.getElementById('password');
  const password = passwordInput.value;
  const errorDiv = document.getElementById('loginError');
  
  if (password === ADMIN_SECRET) {
    sessionStorage.setItem('hzk_admin_auth', 'true');
    state.isAuthenticated = true;
    subscribeToTickets();
    subscribeToActionLogs();
    renderApp();
  } else {
    errorDiv.textContent = 'Invalid password. Please try again.';
    errorDiv.style.display = 'block';
    passwordInput.value = '';
    
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 3000);
  }
}

// Subscribe to tickets
function subscribeToTickets() {
  if (state.unsubscribe) {
    state.unsubscribe();
  }
  
  let q;
  if (state.filterStatus === 'all') {
    q = query(
      collection(db, 'support_tickets'),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'support_tickets'),
      where('status', '==', state.filterStatus),
      orderBy('createdAt', 'desc')
    );
  }

  state.unsubscribe = onSnapshot(q, (snapshot) => {
    state.tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (state.isAuthenticated && state.currentPage === 'tickets') {
      updateTicketsSection();
      updateStatsSection();
      updateFilterCounts();
    }
  }, (error) => {
    console.error('Firebase error:', error);
  });
}

// Subscribe to admin action logs
function subscribeToActionLogs() {
  if (state.unsubscribeLog) {
    state.unsubscribeLog();
  }

  const logsQuery = query(
    collection(db, 'admin_action_logs'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  state.unsubscribeLog = onSnapshot(logsQuery, (snapshot) => {
    state.adminActionLog = snapshot.docs.map(doc => {
      const data = doc.data();
      
      let timestamp;
      if (data.timestamp?.toDate) {
        timestamp = data.timestamp.toDate();
      } else if (data.createdAt) {
        timestamp = new Date(data.createdAt);
      } else {
        timestamp = new Date();
      }
      
      return {
        id: doc.id,
        action: data.action,
        ticketId: data.ticketId,
        details: data.details,
        timestamp: timestamp.toLocaleTimeString(),
        fullTimestamp: timestamp
      };
    });

    if (state.isAuthenticated && state.currentPage === 'tickets') {
      updateActionLogSection();
    }
  }, (error) => {
    console.error('Error loading action logs:', error);
  });
}

// Update only the action log section
function updateActionLogSection() {
  const actionLog = document.querySelector('.action-log');
  if (actionLog) {
    actionLog.innerHTML = renderActionLog();
  }
}

// Attach dashboard listeners
function attachDashboardListeners() {
  // Desktop logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Mobile logout
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
  }
  
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }
  
  // Navigation items (desktop)
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateToPage(page);
    });
  });
  
  // Navigation items (mobile)
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-page]');
  mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      state.mobileMenuOpen = false;
      navigateToPage(page);
    });
  });
  
  // Status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.onchange = function(event) {
      const newValue = this.value;
      state.filterStatus = newValue;
      state.expandedTicketId = null;
      
      if (state.unsubscribe) {
        state.unsubscribe();
      }
      
      subscribeToTickets();
    };
  }
  
  // Delete modal buttons
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', hideDeleteConfirm);
  }
  
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', deleteTicket);
  }
  
  // Close delete modal on overlay click
  const deleteModal = document.getElementById('deleteModal');
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        hideDeleteConfirm();
      }
    });
  }
}

// Toggle mobile menu
function toggleMobileMenu() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.querySelector('.mobile-nav');
  
  if (menuBtn) {
    menuBtn.classList.toggle('active', state.mobileMenuOpen);
  }
  
  if (mobileNav) {
    mobileNav.classList.toggle('open', state.mobileMenuOpen);
  }
}

// Navigate to page
function navigateToPage(page) {
  if (state.currentPage === page) return;
  
  state.currentPage = page;
  state.expandedTicketId = null;
  
  renderApp();
}

// Handle logout
function handleLogout() {
  sessionStorage.removeItem('hzk_admin_auth');
  state.isAuthenticated = false;
  state.expandedTicketId = null;
  state.currentPage = 'tickets';
  state.mobileMenuOpen = false;
  
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
  
  if (state.unsubscribeLog) {
    state.unsubscribeLog();
    state.unsubscribeLog = null;
  }
  
  renderApp();
}

// Toggle ticket expansion (global function)
window.toggleTicket = function(ticketId) {
  const wasExpanded = state.expandedTicketId === ticketId;
  state.expandedTicketId = wasExpanded ? null : ticketId;
  updateTicketsSection();
};

// Update ticket status (global function)
window.updateTicketStatus = async function(ticketId, newStatus, oldStatus) {
  if (newStatus === oldStatus) return;
  
  try {
    await updateDoc(doc(db, 'support_tickets', ticketId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    
    await logAdminAction('Status Change', ticketId, `${oldStatus} → ${newStatus}`);
    
    const shortId = ticketId.slice(0, 8);
    showSuccessModal(
      'Status Updated!',
      'Ticket status has been changed successfully.',
      `
        <div class="modal-detail-row">
          <span class="modal-detail-label">Ticket ID</span>
          <span class="modal-detail-value">#${shortId}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Previous Status</span>
          <span class="modal-detail-value">${oldStatus.toUpperCase()}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">New Status</span>
          <span class="modal-detail-value">${newStatus.toUpperCase()}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Timestamp</span>
          <span class="modal-detail-value">${new Date().toLocaleString()}</span>
        </div>
      `
    );
  } catch (error) {
    console.error('Error updating ticket:', error);
    alert('Failed to update ticket status: ' + error.message);
  }
};

// Save notes (global function)
window.saveNotes = async function(ticketId) {
  const notesTextarea = document.getElementById(`notes-${ticketId}`);
  if (!notesTextarea) return;
  
  const notes = notesTextarea.value;
  const saveBtn = notesTextarea.nextElementSibling;
  
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
    
    await updateDoc(doc(db, 'support_tickets', ticketId), {
      adminNotes: notes,
      updatedAt: serverTimestamp()
    });
    
    const notePreview = notes.length > 50 ? notes.slice(0, 50) + '...' : notes;
    await logAdminAction('Notes Updated', ticketId, notePreview || 'Notes cleared');
    
    if (saveBtn) {
      saveBtn.textContent = '✓ Saved!';
      saveBtn.classList.add('saved');
      
      setTimeout(() => {
        saveBtn.textContent = 'Save Notes';
        saveBtn.disabled = false;
        saveBtn.classList.remove('saved');
      }, 2000);
    }
    
    const shortId = ticketId.slice(0, 8);
    showSuccessModal(
      'Notes Saved!',
      'Admin notes have been updated successfully.',
      `
        <div class="modal-detail-row">
          <span class="modal-detail-label">Ticket ID</span>
          <span class="modal-detail-value">#${shortId}</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Action</span>
          <span class="modal-detail-value">Notes Updated</span>
        </div>
        <div class="modal-detail-row">
          <span class="modal-detail-label">Timestamp</span>
          <span class="modal-detail-value">${new Date().toLocaleString()}</span>
        </div>
      `
    );
  } catch (error) {
    console.error('Error saving notes:', error);
    alert('Failed to save notes: ' + error.message);
    
    if (saveBtn) {
      saveBtn.textContent = 'Save Notes';
      saveBtn.disabled = false;
    }
  }
};

// Copy to clipboard (global function)
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓';
    
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
};

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
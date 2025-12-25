// Vaults Management Page - HZK Reward Vault

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { logAdminAction } from './app.js';

// Configuration
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=08b42024-9864-4c44-b8bb-8b9ba745505c';
const PROGRAM_ID = new PublicKey('TBbk3oRZdQmJ5fZvRDkBRKCHcXD9YM2fhfwpDhoMwEu');
const HZK_MINT = new PublicKey('8zzDzPCCLd1TaEy35mwN1GJW89QEFP6ypveutcjRpump');
const POOL_AUTHORITY = new PublicKey('MgQBePciru5mCqSaLCsG4h4HGeLbLDJ566G8W2SYEcP');
const DECIMALS = 6;
const FUND_REWARDS_DISCRIMINATOR = Buffer.from([114, 64, 163, 112, 175, 167, 19, 121]);

const vaultsState = {
  connection: null,
  wallet: null,
  walletAddress: null,
  vaultBalance: 0,
  userBalance: 0,
  userTokenProgram: null, // Track which token program user's HZK is on
  isLoading: false,
  lastUpdate: null
};

export function initializeVaults() {
  console.log('Initializing vaults page...');
  
  // Setup Solana connection
  vaultsState.connection = new Connection(RPC_URL, 'confirmed');
  
  // Use admin wallet from login
  const adminWallet = window.solana;
  const adminWalletAddress = sessionStorage.getItem('hzk_admin_wallet');
  
  if (adminWallet && adminWalletAddress) {
    vaultsState.wallet = adminWallet;
    vaultsState.walletAddress = adminWalletAddress;
    console.log('✅ Using admin wallet:', adminWalletAddress);
  }
  
  // Load initial data
  if (vaultsState.walletAddress) {
    loadVaultData();
  }
  
  return renderVaults();
}

export function cleanupVaults() {
  console.log('Cleaning up vaults...');
  vaultsState.isLoading = false;
}

function getPoolPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), POOL_AUTHORITY.toBuffer()],
    PROGRAM_ID
  )[0];
}

function getRewardVaultPDA(pool) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), pool.toBuffer()],
    PROGRAM_ID
  )[0];
}

async function loadVaultData() {
  if (!vaultsState.connection || !vaultsState.walletAddress) return;
  
  vaultsState.isLoading = true;
  updateLoadingState();
  
  try {
    const poolPDA = getPoolPDA();
    const rewardVaultPDA = getRewardVaultPDA(poolPDA);
    
    // Get vault balance
    try {
      const vaultAccount = await getAccount(
        vaultsState.connection, 
        rewardVaultPDA, 
        'confirmed', 
        TOKEN_2022_PROGRAM_ID
      );
      vaultsState.vaultBalance = Number(vaultAccount.amount) / (10 ** DECIMALS);
    } catch (error) {
      console.log('Vault account not found or empty');
      vaultsState.vaultBalance = 0;
    }
    
    // Get user's HZK balance - Try both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID
    try {
      const userPublicKey = new PublicKey(vaultsState.walletAddress);
      
      // First try with TOKEN_2022_PROGRAM_ID
      try {
        const userATA = getAssociatedTokenAddressSync(
          HZK_MINT,
          userPublicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        const userAccount = await getAccount(
          vaultsState.connection,
          userATA,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
        vaultsState.userBalance = Number(userAccount.amount) / (10 ** DECIMALS);
        vaultsState.userTokenProgram = TOKEN_2022_PROGRAM_ID;
        console.log('✅ Found HZK balance with TOKEN_2022:', vaultsState.userBalance);
      } catch (error2022) {
        console.log('TOKEN_2022 not found, trying regular TOKEN_PROGRAM...');
        
        // Try with regular TOKEN_PROGRAM_ID
        const userATA = getAssociatedTokenAddressSync(
          HZK_MINT,
          userPublicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        const userAccount = await getAccount(
          vaultsState.connection,
          userATA,
          'confirmed',
          TOKEN_PROGRAM_ID
        );
        vaultsState.userBalance = Number(userAccount.amount) / (10 ** DECIMALS);
        vaultsState.userTokenProgram = TOKEN_PROGRAM_ID;
        console.log('✅ Found HZK balance with TOKEN_PROGRAM:', vaultsState.userBalance);
      }
    } catch (error) {
      console.error('Error loading user HZK balance:', error);
      vaultsState.userBalance = 0;
      vaultsState.userTokenProgram = null;
    }
    
    vaultsState.lastUpdate = new Date();
    vaultsState.isLoading = false;
    updateVaultDisplay();
    
    // Re-render funding section if balance changed
    const fundingSection = document.querySelector('.vault-funding-section');
    if (fundingSection && vaultsState.userBalance > 0) {
      const vaultsContainer = document.getElementById('vaultsContainer');
      if (vaultsContainer) {
        vaultsContainer.innerHTML = renderVaults();
        // Re-attach input listener
        setTimeout(() => {
          const amountInput = document.getElementById('fundAmount');
          if (amountInput) {
            amountInput.addEventListener('input', updateFundingSummary);
          }
        }, 100);
      }
    }
    
  } catch (error) {
    console.error('Error loading vault data:', error);
    vaultsState.isLoading = false;
    updateLoadingState();
  }
}

function renderVaults() {
  return `
    <div class="vaults-page">
      ${renderVaultHeader()}
      ${renderVaultStats()}
      ${renderFundingSection()}
    </div>
  `;
}

function renderVaultHeader() {
  return `
    <div class="vault-header">
      <div class="vault-title-section">
        <h2 class="vault-title">
          <span class="vault-icon">🏦</span>
          Reward Vault Management
        </h2>
        <p class="vault-subtitle">Manage HZK staking reward vault on Solana mainnet</p>
      </div>
      <button class="vault-refresh-btn" onclick="window.refreshVaultData()" id="refreshBtn">
        <span>🔄</span> Refresh
      </button>
    </div>
  `;
}

function renderVaultStats() {
  const hasWallet = !!vaultsState.walletAddress;
  
  return `
    <div class="vault-stats-section">
      ${!hasWallet ? `
        <div class="vault-warning">
          <span class="warning-icon">⚠️</span>
          <div>
            <h3>Wallet Not Connected</h3>
            <p>Please ensure you're logged in with a connected wallet to manage the vault.</p>
          </div>
        </div>
      ` : `
        <div class="vault-stats-grid">
          <div class="vault-stat-card vault-balance">
            <div class="stat-header">
              <span class="stat-icon">🏦</span>
              <span class="stat-label">Reward Vault Balance</span>
            </div>
            <div class="stat-value" id="vaultBalance">
              ${vaultsState.isLoading ? '...' : vaultsState.vaultBalance.toLocaleString()}
            </div>
            <div class="stat-unit">HZK</div>
            <div class="stat-footer">
              <span class="stat-address">Vault: ${getRewardVaultPDA(getPoolPDA()).toBase58().slice(0, 8)}...</span>
            </div>
          </div>
          
          <div class="vault-stat-card user-balance">
            <div class="stat-header">
              <span class="stat-icon">👛</span>
              <span class="stat-label">Your HZK Balance</span>
            </div>
            <div class="stat-value" id="userBalance">
              ${vaultsState.isLoading ? '...' : vaultsState.userBalance.toLocaleString()}
            </div>
            <div class="stat-unit">HZK</div>
            <div class="stat-footer">
              <span class="stat-address">Wallet: ${vaultsState.walletAddress.slice(0, 8)}...</span>
            </div>
          </div>
          
          <div class="vault-stat-card vault-info">
            <div class="stat-header">
              <span class="stat-icon">ℹ️</span>
              <span class="stat-label">Vault Information</span>
            </div>
            <div class="vault-details">
              <div class="detail-row">
                <span class="detail-label">Program ID</span>
                <span class="detail-value">${PROGRAM_ID.toBase58().slice(0, 12)}...</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">HZK Mint</span>
                <span class="detail-value">${HZK_MINT.toBase58().slice(0, 12)}...</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Last Update</span>
                <span class="detail-value" id="lastUpdate">
                  ${vaultsState.lastUpdate ? vaultsState.lastUpdate.toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

function renderFundingSection() {
  const hasWallet = !!vaultsState.walletAddress;
  
  if (!hasWallet) return '';
  
  return `
    <div class="vault-funding-section">
      <div class="funding-header">
        <h3><span></span> Fund Reward Vault</h3>
        <p>Transfer HZK tokens from your wallet to the reward vault</p>
      </div>
      
      <div class="funding-form">
        <div class="input-group">
          <label for="fundAmount">Amount to Fund (HZK)</label>
          <div class="input-wrapper">
            <input 
              type="number" 
              id="fundAmount" 
              placeholder="0.00"
              min="0"
              step="0.000001"
            />
            <button class="max-btn" onclick="window.setMaxAmount()">MAX</button>
          </div>
          <div class="input-helper" id="availableBalance">
            Available: ${vaultsState.userBalance.toLocaleString()} HZK
          </div>
        </div>
        
        <div class="funding-summary" id="fundingSummary" style="display: none;">
          <div class="summary-row">
            <span>Amount</span>
            <span id="summaryAmount">0 HZK</span>
          </div>
          <div class="summary-row">
            <span>Network Fee</span>
            <span>~0.000005 SOL</span>
          </div>
          <div class="summary-row total">
            <span>Total HZK to Transfer</span>
            <span id="summaryTotal">0 HZK</span>
          </div>
        </div>
        
        <button 
          class="fund-vault-btn" 
          onclick="window.fundVault()"
          id="fundBtn"
          disabled
        >
          <span>💸</span> Fund Reward Vault
        </button>
        
        <div class="funding-info">
          <span class="info-icon">ℹ️</span>
          <p>Funding the vault allows the staking program to distribute rewards to stakers. All transactions are on Solana mainnet.</p>
        </div>
      </div>
    </div>
  `;
}

function updateVaultDisplay() {
  const vaultBalanceEl = document.getElementById('vaultBalance');
  const userBalanceEl = document.getElementById('userBalance');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const availableBalanceEl = document.getElementById('availableBalance');
  
  if (vaultBalanceEl) vaultBalanceEl.textContent = vaultsState.vaultBalance.toLocaleString();
  if (userBalanceEl) userBalanceEl.textContent = vaultsState.userBalance.toLocaleString();
  if (lastUpdateEl && vaultsState.lastUpdate) {
    lastUpdateEl.textContent = vaultsState.lastUpdate.toLocaleTimeString();
  }
  if (availableBalanceEl) {
    availableBalanceEl.textContent = `Available: ${vaultsState.userBalance.toLocaleString()} HZK`;
  }
  
  // Update max attribute on input
  const fundAmountInput = document.getElementById('fundAmount');
  if (fundAmountInput) {
    fundAmountInput.max = vaultsState.userBalance;
  }
}

function updateLoadingState() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    if (vaultsState.isLoading) {
      refreshBtn.innerHTML = '<span class="spinner-small"></span> Loading...';
      refreshBtn.disabled = true;
    } else {
      refreshBtn.innerHTML = '<span>🔄</span> Refresh';
      refreshBtn.disabled = false;
    }
  }
}

async function fundVault() {
  const amountInput = document.getElementById('fundAmount');
  const amount = parseFloat(amountInput.value);
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  if (amount > vaultsState.userBalance) {
    alert('Insufficient HZK balance');
    return;
  }
  
  if (!vaultsState.userTokenProgram) {
    alert('Unable to determine token program. Please refresh and try again.');
    return;
  }
  
  const fundBtn = document.getElementById('fundBtn');
  fundBtn.disabled = true;
  fundBtn.innerHTML = '<span class="spinner-small"></span> Processing...';
  
  try {
    const poolPDA = getPoolPDA();
    const rewardVaultPDA = getRewardVaultPDA(poolPDA);
    
    // Use the correct token program based on what was detected
    const authorityATA = getAssociatedTokenAddressSync(
      HZK_MINT,
      new PublicKey(vaultsState.walletAddress),
      false,
      vaultsState.userTokenProgram, // Use detected program
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const amountRaw = BigInt(Math.floor(amount * (10 ** DECIMALS)));
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(amountRaw);
    
    const instruction = {
      keys: [
        { pubkey: poolPDA, isSigner: false, isWritable: false },
        { pubkey: rewardVaultPDA, isSigner: false, isWritable: true },
        { pubkey: authorityATA, isSigner: false, isWritable: true },
        { pubkey: HZK_MINT, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(vaultsState.walletAddress), isSigner: true, isWritable: true },
        { pubkey: vaultsState.userTokenProgram, isSigner: false, isWritable: false }, // Use detected program
      ],
      programId: PROGRAM_ID,
      data: Buffer.concat([FUND_REWARDS_DISCRIMINATOR, amountBuffer]),
    };
    
    const transaction = new Transaction().add(instruction);
    const { blockhash } = await vaultsState.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(vaultsState.walletAddress);
    
    const signed = await vaultsState.wallet.signTransaction(transaction);
    const signature = await vaultsState.connection.sendRawTransaction(signed.serialize());
    
    console.log('Transaction sent:', signature);
    
    // Wait for confirmation
    await vaultsState.connection.confirmTransaction(signature, 'confirmed');
    
    console.log('✅ Vault funded successfully!');
    
    // Log to admin action logs
    try {
      await logAdminAction(
        'Vault Funded',
        signature.slice(0, 8),
        `${amount.toLocaleString()} HZK → Reward Vault`
      );
      console.log('✅ Action logged to Firebase');
    } catch (logError) {
      console.error('Failed to log action:', logError);
    }
    
    // Clear input
    amountInput.value = '';
    
    // Reload data
    await loadVaultData();
    
    // Show success modal
    if (window.showSuccessModal) {
      window.showSuccessModal(
        'Vault Funded Successfully!',
        `${amount.toLocaleString()} HZK has been transferred to the reward vault.`,
        `
          <div class="modal-detail-row">
            <span class="modal-detail-label">Amount</span>
            <span class="modal-detail-value">${amount.toLocaleString()} HZK</span>
          </div>
          <div class="modal-detail-row">
            <span class="modal-detail-label">Transaction</span>
            <span class="modal-detail-value">${signature.slice(0, 12)}...</span>
          </div>
          <div class="modal-detail-row">
            <span class="modal-detail-label">Explorer</span>
            <span class="modal-detail-value">
              <a href="https://solscan.io/tx/${signature}" target="_blank" style="color: var(--accent-primary);">View on Solscan</a>
            </span>
          </div>
        `
      );
    }
    
  } catch (error) {
    console.error('Error funding vault:', error);
    alert('Failed to fund vault: ' + error.message);
  } finally {
    fundBtn.disabled = false;
    fundBtn.innerHTML = '<span>💸</span> Fund Reward Vault';
  }
}

// Global functions
window.refreshVaultData = function() {
  loadVaultData();
};

window.setMaxAmount = function() {
  const amountInput = document.getElementById('fundAmount');
  if (amountInput) {
    amountInput.value = vaultsState.userBalance.toFixed(6);
    updateFundingSummary();
  }
};

window.fundVault = fundVault;

// Update funding summary when amount changes
function updateFundingSummary() {
  const amountInput = document.getElementById('fundAmount');
  const summary = document.getElementById('fundingSummary');
  const summaryAmount = document.getElementById('summaryAmount');
  const summaryTotal = document.getElementById('summaryTotal');
  const fundBtn = document.getElementById('fundBtn');
  
  if (!amountInput || !summary) return;
  
  const amount = parseFloat(amountInput.value) || 0;
  
  if (amount > 0 && amount <= vaultsState.userBalance) {
    summary.style.display = 'block';
    summaryAmount.textContent = `${amount.toLocaleString()} HZK`;
    summaryTotal.textContent = `${amount.toLocaleString()} HZK`;
    fundBtn.disabled = false;
  } else {
    summary.style.display = 'none';
    fundBtn.disabled = true;
  }
}

// Attach input listener
setTimeout(() => {
  const amountInput = document.getElementById('fundAmount');
  if (amountInput) {
    amountInput.addEventListener('input', updateFundingSummary);
  }
}, 100);
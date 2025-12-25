// Controls with Admin Wallet Integration

import { Connection } from '@solana/web3.js';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { logAdminAction } from './app.js';

const METADATA_BASE_URL = 'https://raw.githubusercontent.com/Reddjoseph/hanzenko-nfts/main/metadata';

const NFT_CONFIGS = [
  { id: 'hanz-1', name: 'Hanz #1', metadataFile: 'Hanz-1.json', rarity: 'legendary', description: 'Legendary Hanz NFT - First Edition' },
  { id: 'hanz-2', name: 'Hanz #2', metadataFile: 'Hanz-2.json', rarity: 'epic', description: 'Epic Hanz NFT - Second Edition' },
  { id: 'hanz-3', name: 'Hanz #3', metadataFile: 'Hanz-3.json', rarity: 'rare', description: 'Rare Hanz NFT - Third Edition' },
  { id: 'hanz-4', name: 'Hanz #4', metadataFile: 'Hanz-4.json', rarity: 'rare', description: 'Rare Hanz NFT - Fourth Edition' },
  { id: 'hanz-common', name: 'Hanz Common', metadataFile: 'Hanz-Common.json', rarity: 'common', description: 'Common Hanz NFT' },
  { id: 'chrysalis-1', name: 'Chrysalis #1', metadataFile: 'chrysalis-1.json', rarity: 'legendary', description: 'Legendary Chrysalis NFT - First Edition' },
  { id: 'chrysalis-2', name: 'Chrysalis #2', metadataFile: 'chrysalis-2.json', rarity: 'epic', description: 'Epic Chrysalis NFT - Second Edition' },
  { id: 'chrysalis-3', name: 'Chrysalis #3', metadataFile: 'chrysalis-3.json', rarity: 'rare', description: 'Rare Chrysalis NFT - Third Edition' },
  { id: 'chrysalis-4', name: 'Chrysalis #4', metadataFile: 'chrysalis-4.json', rarity: 'rare', description: 'Rare Chrysalis NFT - Fourth Edition' },
  { id: 'common-chrysalis', name: 'Common Chrysalis', metadataFile: 'common-chrysalis.json', rarity: 'common', description: 'Common Chrysalis NFT' }
];

const controlsState = {
  connection: null,
  wallet: null,
  walletAddress: null,
  metaplex: null,
  nftMetadata: {},
  selectedNFT: null,
  isMinting: false,
  mintingStatus: null
};

export function initializeControls() {
  console.log('Initializing controls...');
  
  // Setup Solana connection
  controlsState.connection = new Connection(
    'https://mainnet.helius-rpc.com/?api-key=08b42024-9864-4c44-b8bb-8b9ba745505c',
    'confirmed'
  );
  
  // Use admin wallet from login
  const adminWallet = window.solana;
  const adminWalletAddress = sessionStorage.getItem('hzk_admin_wallet');
  
  if (adminWallet && adminWalletAddress) {
    controlsState.wallet = adminWallet;
    controlsState.walletAddress = adminWalletAddress;
    controlsState.metaplex = Metaplex.make(controlsState.connection)
      .use(walletAdapterIdentity(adminWallet));
    console.log('✅ Using admin wallet from login:', adminWalletAddress);
  }
  
  loadNFTMetadata();
  
  return renderControls();
}

export function cleanupControls() {
  console.log('Cleaning up controls...');
  // Don't disconnect wallet as it's managed by the main app
  controlsState.selectedNFT = null;
  controlsState.isMinting = false;
  controlsState.mintingStatus = null;
}

async function loadNFTMetadata() {
  for (const config of NFT_CONFIGS) {
    try {
      const metadataUrl = `${METADATA_BASE_URL}/${config.metadataFile}`;
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      controlsState.nftMetadata[config.id] = {
        ...config,
        metadataUrl,
        metadata
      };
    } catch (error) {
      console.error(`Failed to load metadata for ${config.name}:`, error);
    }
  }
  
  updateNFTGrid();
}

function renderControls() {
  return `
    <div class="controls-page">
      ${renderWalletSection()}
      ${renderMintingSection()}
      ${renderModal()}
    </div>
  `;
}

function renderWalletSection() {
  const hasWallet = !!controlsState.walletAddress;
  
  return `
    <section class="wallet-section">
      ${hasWallet ? `
        <div class="wallet-connected-info">
          <span class="wallet-connected-icon">✅</span>
          <div class="wallet-connected-text">
            <div class="wallet-connected-label">Admin Wallet Connected</div>
            <div class="wallet-connected-address">${controlsState.walletAddress}</div>
          </div>
          <div class="wallet-info-status">
            <span class="status-badge">🟢 Ready to Mint</span>
          </div>
        </div>
      ` : `
        <div class="wallet-requirement">
          <div class="wallet-req-icon">⚠️</div>
          <h3>Wallet Not Connected</h3>
          <p>Please log out and reconnect your wallet to access the NFT minting controls.</p>
        </div>
      `}
    </section>
  `;
}

function renderMintingSection() {
  const hasWallet = !!controlsState.walletAddress;
  
  return `
    <section class="minting-section">
      ${!hasWallet ? `
        <div class="wallet-gate">
          <div class="wallet-gate-icon">🔐</div>
          <h3>Wallet Required</h3>
          <p>Your admin wallet connection is required to mint NFTs. Please ensure you're logged in with a connected wallet.</p>
        </div>
      ` : `
        <div class="section-header">
          <h3>NFT Collection</h3>
          <p class="section-description">Click any NFT to mint it to your wallet on Solana mainnet.</p>
        </div>
        
        <div id="nftGrid" class="nft-grid">
          ${Object.keys(controlsState.nftMetadata).length > 0 ? renderNFTGrid() : '<p>Loading collection...</p>'}
        </div>
      `}
    </section>
  `;
}

function renderNFTGrid() {
  return Object.values(controlsState.nftMetadata).map(nft => {
    const metadata = nft.metadata;
    return `
      <div class="nft-card" data-nft-id="${nft.id}">
        <div class="nft-image-container">
          ${metadata.image ? `<img src="${metadata.image}" alt="${nft.name}" class="nft-image" />` : `<div class="nft-placeholder">🎨</div>`}
          <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
        </div>
        <div class="nft-details">
          <h4 class="nft-name">${nft.name}</h4>
          <p class="nft-metadata-path">${nft.metadataFile}</p>
          <button class="nft-select-btn" onclick="window.openMintModalDirect('${nft.id}')">
            <span>✨</span> Mint NFT
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderModal() {
  return `
    <div id="mintModal" class="mint-modal" style="display: none;">
      <div class="mint-modal-overlay" onclick="window.closeMintModal()"></div>
      <div class="mint-modal-content">
        <div class="mint-modal-header">
          <h3><span style="margin-right: 8px;">✨</span>Mint NFT</h3>
          <button class="mint-modal-close" onclick="window.closeMintModal()" aria-label="Close">×</button>
        </div>
        <div id="mintModalBody" class="mint-modal-body">
          <!-- Content loaded dynamically -->
        </div>
      </div>
    </div>
  `;
}

function openMintModal(nftId) {
  if (!controlsState.walletAddress) {
    alert('Please ensure your admin wallet is connected!');
    return;
  }
  
  controlsState.selectedNFT = { id: nftId };
  controlsState.mintingStatus = null;
  const nft = controlsState.nftMetadata[nftId];
  const metadata = nft.metadata;
  
  const modalBody = document.getElementById('mintModalBody');
  modalBody.innerHTML = `
    <div class="modal-nft-preview">
      <div class="modal-image-wrapper">
        ${metadata.image ? `
          <img src="${metadata.image}" alt="${nft.name}" class="modal-nft-image" />
          <div class="modal-rarity-overlay">
            <span class="nft-rarity-badge rarity-${nft.rarity}">${nft.rarity}</span>
          </div>
        ` : '<div class="nft-placeholder" style="height: 300px;">🎨</div>'}
      </div>
      
      <div class="modal-nft-details">
        <h4 class="modal-nft-name">${nft.name}</h4>
        <p class="modal-nft-description">${metadata.description || nft.description}</p>
        
        <div class="modal-metadata-grid">
          ${metadata.attributes ? metadata.attributes.slice(0, 4).map(attr => `
            <div class="metadata-item">
              <span class="metadata-label">${attr.trait_type}</span>
              <span class="metadata-value">${attr.value}</span>
            </div>
          `).join('') : ''}
        </div>
      </div>
      
      <div class="modal-cost-info">
        <div class="cost-header">
          <span class="cost-icon">💰</span>
          <span class="cost-title">Minting Cost</span>
        </div>
        <div class="cost-details">
          <div class="cost-row">
            <span>Network Fee</span>
            <span>~0.02 SOL</span>
          </div>
          <div class="cost-row total">
            <span>Total</span>
            <span class="cost-amount">~0.02 SOL</span>
          </div>
          <div class="cost-usd">≈ $3-4 USD</div>
        </div>
      </div>
      
      ${controlsState.mintingStatus ? renderMintingStatus() : ''}
      
      <button 
        id="mintNFTBtn" 
        class="mint-button-modal ${controlsState.isMinting ? 'minting' : ''}" 
        onclick="window.mintNFTDirect()"
        ${controlsState.isMinting ? 'disabled' : ''}
      >
        ${controlsState.isMinting ? 
          '<span class="spinner"></span><span>Minting...</span>' : 
          '<span>✨</span><span>Mint to My Wallet</span>'
        }
      </button>
      
      ${!controlsState.mintingStatus ? `
        <p class="modal-hint">
          <span>ℹ️</span> Minting to: ${controlsState.walletAddress.slice(0, 8)}...${controlsState.walletAddress.slice(-6)}
        </p>
      ` : ''}
    </div>
  `;
  
  const modal = document.getElementById('mintModal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('modal-visible'), 10);
}

function closeMintModal() {
  const modal = document.getElementById('mintModal');
  modal.classList.remove('modal-visible');
  setTimeout(() => {
    modal.style.display = 'none';
    controlsState.selectedNFT = null;
    controlsState.mintingStatus = null;
  }, 300);
}

function renderMintingStatus() {
  const status = controlsState.mintingStatus;
  if (status.error) {
    return `
      <div class="status-card status-error">
        <div class="status-icon-wrapper error">
          <span class="status-icon">⚠️</span>
        </div>
        <div class="status-content">
          <h5 class="status-title">Minting Failed</h5>
          <p class="status-message">${status.error}</p>
        </div>
      </div>
    `;
  }
  if (status.success) {
    return `
      <div class="status-card status-success">
        <div class="status-icon-wrapper success">
          <span class="status-icon">✅</span>
        </div>
        <div class="status-content">
          <h5 class="status-title">NFT Minted Successfully!</h5>
          <p class="status-message">Your NFT has been minted to your wallet on Solana mainnet.</p>
          ${status.mintAddress ? `
            <a href="https://explorer.solana.com/address/${status.mintAddress}" target="_blank" rel="noopener noreferrer" class="explorer-link">
              <span>🔍</span>
              <span>View on Solana Explorer</span>
              <span class="external-icon">↗</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }
  return '';
}

function updateNFTGrid() {
  const nftGrid = document.getElementById('nftGrid');
  if (nftGrid) {
    nftGrid.innerHTML = renderNFTGrid();
  }
}

function ensureMetaplexInitialized() {
  if (controlsState.wallet && !controlsState.metaplex) {
    controlsState.metaplex = Metaplex.make(controlsState.connection)
      .use(walletAdapterIdentity(controlsState.wallet));
  }
}

async function mintNFT() {
  ensureMetaplexInitialized();
  
  if (!controlsState.selectedNFT || !controlsState.wallet || !controlsState.metaplex) {
    alert('Please ensure your wallet is connected.');
    return;
  }
  
  controlsState.isMinting = true;
  controlsState.mintingStatus = { message: 'Please approve the transaction in Phantom...' };
  openMintModal(controlsState.selectedNFT.id);
  
  try {
    const nft = controlsState.nftMetadata[controlsState.selectedNFT.id];
    
    console.log('🎨 Starting NFT mint...');
    console.log('NFT Name:', nft.metadata.name || nft.name);
    console.log('Metadata URI:', nft.metadataUrl);
    console.log('Wallet:', controlsState.wallet.publicKey.toString());
    
    const { nft: mintedNft } = await controlsState.metaplex.nfts().create({
      uri: nft.metadataUrl,
      name: nft.metadata.name || nft.name,
      sellerFeeBasisPoints: 0,
      creators: [{ address: controlsState.wallet.publicKey, share: 100 }],
      isMutable: false,
    });
    
    const mintAddress = mintedNft.address.toString();
    
    // Success logging
    console.log('✅ NFT MINTED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('NFT Name:', nft.metadata.name || nft.name);
    console.log('Mint Address:', mintAddress);
    console.log('Owner:', controlsState.wallet.publicKey.toString());
    console.log('Explorer:', `https://explorer.solana.com/address/${mintAddress}`);
    console.log('Metadata:', nft.metadataUrl);
    console.log('Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Log to admin action logs
    try {
      await logAdminAction(
        'NFT Minted', 
        mintAddress.slice(0, 8), 
        `${nft.metadata.name || nft.name} → ${controlsState.wallet.publicKey.toString().slice(0, 8)}...`
      );
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
    }
    
    controlsState.mintingStatus = {
      success: true,
      mintAddress: mintAddress,
    };
  } catch (error) {
    console.error('❌ Minting error:', error);
    let errorMessage = error.message || 'An error occurred while minting.';
    if (errorMessage.includes('User rejected')) errorMessage = 'Transaction was rejected in your wallet.';
    else if (errorMessage.includes('insufficient funds')) errorMessage = 'Insufficient SOL balance. You need approximately 0.02 SOL.';
    controlsState.mintingStatus = { error: errorMessage };
  } finally {
    controlsState.isMinting = false;
    openMintModal(controlsState.selectedNFT.id);
  }
}

// Global functions for onclick handlers
window.openMintModalDirect = openMintModal;
window.closeMintModal = closeMintModal;
window.mintNFTDirect = mintNFT;
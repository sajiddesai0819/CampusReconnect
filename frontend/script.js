// === Global API URL ===
// This points to your new Node.js backend
const API_URL = `${window.location.origin}/api`;

// === Helper: Get Auth Token ===
function getAuthToken() {
    return localStorage.getItem('campusReconnectToken');
}

// === Helper: API Fetch ===
// This function handles all communication with your backend
async function apiFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = { ...options.headers };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type if it's FormData (browser does it)
    if (!(options.body instanceof FormData)) {
         headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: headers
        });

        if (response.status === 401) {
            // Token is invalid or expired
            logoutUser();
            openModal('authModal');
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'API request failed');
        }

        if (response.status === 204) { // No Content
            return null;
        }
        
        return await response.json();

    } catch (error) {
        console.error(`Fetch error for ${endpoint}:`, error);
        // Optionally show a user-facing error message
        throw error;
    }
}

// === Canvas Connection Animation ===
const bgCanvas = document.getElementById('connection-canvas');
const bgCtx = bgCanvas.getContext('2d');
let particles = [];

function setBgCanvasSize() {
    if (!bgCanvas) return;
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        if (!bgCanvas) return;
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.vx = (Math.random() - 0.5) * 0.5; // Slower speed
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5 + 1;
    }

    update() {
        if (!bgCanvas) return;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > bgCanvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > bgCanvas.height) this.vy *= -1;
    }

    draw() {
        if (!bgCtx) return;
        bgCtx.beginPath();
        bgCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        bgCtx.fill();
    }
}

function initParticles() {
    if (!bgCanvas) return;
    particles = [];
    let numParticles = (bgCanvas.width * bgCanvas.height) / 10000;
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }
}

function connectParticles() {
    if (!bgCtx) return;
    let maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
                let opacity = 1 - (dist / maxDist);
                // "Solar Flare" Gradient
                let gradient = bgCtx.createLinearGradient(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                gradient.addColorStop(0.1, 'rgba(234, 179, 8, ' + opacity + ')'); // amber
                gradient.addColorStop(0.9, 'rgba(132, 204, 22, ' + opacity + ')'); // lime
                bgCtx.beginPath();
                bgCtx.strokeStyle = gradient;
                bgCtx.lineWidth = 0.5;
                bgCtx.moveTo(particles[i].x, particles[i].y);
                bgCtx.lineTo(particles[j].x, particles[j].y);
                bgCtx.stroke();
            }
        }
    }
}

function animateBg() {
    if (!bgCtx || !bgCanvas) return;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    connectParticles();
    requestAnimationFrame(animateBg);
}

if (bgCanvas && window.innerWidth >= 768) {
    setBgCanvasSize();
    initParticles();
    animateBg();
    window.addEventListener('resize', () => { 
        if (window.innerWidth >= 768) {
            setBgCanvasSize(); 
            initParticles(); 
        } else {
            if (bgCtx) bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        }
    });
}


// === Initialize Lucide Icons ===
lucide.createIcons();

// === 3D Parallax Mouse Effect ===
const appContainer = document.getElementById('app-container');
document.addEventListener('mousemove', (e) => {
    if (!appContainer) return;
    const { innerWidth, innerHeight } = window;
    
    // Skip parallax centering and movements on mobile screens
    if (innerWidth < 768) {
        appContainer.style.transform = '';
        if (bgCanvas) bgCanvas.style.transform = '';
        return;
    }
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const moveX = (mouseX / innerWidth - 0.5);
    const moveY = (mouseY / innerHeight - 0.5);
    
    const appMoveX = -moveX * 20;
    const appMoveY = -moveY * 20;
    appContainer.style.transform = `translate(-50%, -50%) translate3d(${appMoveX}px, ${appMoveY}px, 0)`;

    if (bgCanvas) {
        const canvasMoveX = moveX * 10;
        const canvasMoveY = moveY * 10;
        bgCanvas.style.transform = `translate3d(${canvasMoveX}px, ${canvasMoveY}px, 0)`;
    }
});

// === 3D Orb Logic (Three.js) ===
let scene, camera, renderer, orb;
const threeCanvas = document.getElementById('three-canvas');
const threeContainer = document.getElementById('three-canvas-container');

function initThree() {
    if (!threeCanvas || !threeContainer) return;
    
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 1000);
    camera.position.z = 2.5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Orb Object
    const geometry = new THREE.IcosahedronGeometry(1.3, 1);
    
    // Glowing Wireframe Material
    const wireframe = new THREE.WireframeGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xa3e635, // lime-500
        linewidth: 1,
    });
    orb = new THREE.LineSegments(wireframe, lineMaterial);
    scene.add(orb);
    
    // Inner glowing particle
    const particleGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, emissive: 0xf59e0b });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    scene.add(particle);

    // Point Light
    const light = new THREE.PointLight(0xfcd34d, 2, 100);
    light.position.set(0, 0, 2);
    scene.add(light);
    
    animateThree();
}

let threeAnimationId = null;

function animateThree() {
    threeAnimationId = requestAnimationFrame(animateThree);
    if (orb) {
        orb.rotation.x += 0.001;
        orb.rotation.y += 0.002;
    }
    if (renderer) renderer.render(scene, camera);
}

function startThreeAnimation() {
    if (!threeInitialized || threeAnimationId) return;
    animateThree();
}

function stopThreeAnimation() {
    if (threeAnimationId) {
        cancelAnimationFrame(threeAnimationId);
        threeAnimationId = null;
    }
}

// Handle Resize
function onWindowResize() {
    if (!threeContainer || !renderer || !camera) return;
    const width = threeContainer.clientWidth;
    const height = threeContainer.clientHeight;
    
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    if (renderer) {
        renderer.setSize(width, height);
    }
}
window.addEventListener('resize', onWindowResize);

// Mouse Drag to Rotate
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

if (threeCanvas) {
    threeCanvas.addEventListener('mousedown', (e) => { isDragging = true; threeCanvas.style.cursor = 'grabbing'; });
    threeCanvas.addEventListener('mouseup', (e) => { isDragging = false; threeCanvas.style.cursor = 'grab'; });
    threeCanvas.addEventListener('mouseleave', (e) => { isDragging = false; threeCanvas.style.cursor = 'grab'; });
    
    threeCanvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !orb) return;
        
        const deltaMove = {
            x: e.offsetX - previousMousePosition.x,
            y: e.offsetY - previousMousePosition.y
        };
        
        const rotateAngleY = deltaMove.x * 0.01;
        const rotateAngleX = deltaMove.y * 0.01;
        
        orb.rotation.y += rotateAngleY;
        orb.rotation.x += rotateAngleX;
        
        previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
}
let threeInitialized = false;


// === Panel Switching Logic ===
const navButtons = document.querySelectorAll('.nav-button[data-panel]');
const contentPanels = document.querySelectorAll('.content-panel');

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetPanelId = button.dataset.panel;
        const targetPanel = document.getElementById(targetPanelId);

        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        contentPanels.forEach(panel => panel.classList.remove('active'));
        if(targetPanel) {
            targetPanel.classList.add('active');
        }
        
        // Handle 3D orb rendering play/pause
        if (targetPanelId === 'homePanel') {
            if (!threeInitialized) {
                initThree();
                onWindowResize();
                threeInitialized = true;
            } else {
                startThreeAnimation();
            }
        } else {
            stopThreeAnimation();
        }
        
        // Refresh data when switching to a panel
        if (targetPanelId === 'lostPanel') renderPublicItems('lost');
        if (targetPanelId === 'foundPanel') renderPublicItems('found');
        if (targetPanelId === 'reportsPanel') renderMyReports();
        if (targetPanelId === 'homePanel') renderHomeStats();
        if (targetPanelId === 'adminPanel') renderAdminPanel();
    });
});

// Trigger initial Home setup (if it's the default panel)
if (document.getElementById('homePanel').classList.contains('active') && !threeInitialized) {
    initThree();
    onWindowResize();
    threeInitialized = true;
}

// === App State & Rendering (NOW USES FETCH) ===
let currentReportImageFile = null; // Store the File object for the report form

// Helper: Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
}

// Helper: Get image URL from backend
function getImageUrl(id, type) {
    // type is 'item' or 'pfp'
    // Add timestamp to cache-bust the image
    return `${API_URL}/image/${type}/${id}?t=${new Date().getTime()}`;
}

// Renders Lost or Found items
async function renderPublicItems(type) {
    const gridId = type === 'lost' ? 'lost-items-grid' : 'found-items-grid';
    const noItemsId = type === 'lost' ? 'no-lost-items' : 'no-found-items';
    const container = document.getElementById(gridId);
    const noItemsMsg = document.getElementById(noItemsId);
    
    if (!container || !noItemsMsg) return;
    container.innerHTML = '<div class="spinner w-12 h-12 mx-auto"></div>'; // Loading state
    
    try {
        // Fetch items from the new '/api/items/public/:type' route
        const items = await apiFetch(`/items/public/${type}`);
        container.innerHTML = ''; // Clear spinner
        
        if (items.length === 0) {
            noItemsMsg.classList.remove('hidden');
            return;
        }
        noItemsMsg.classList.add('hidden');

        items.forEach(item => {
            const imageUrl = item.has_image ? getImageUrl(item.id, 'item') : `https://placehold.co/600x400/${item.item_type === 'lost' ? 'f59e0b' : 'a3e635'}/white?text=${encodeURIComponent(item.title.substring(0,10))}`;
            const imageHtml = `<div class="item-card-image" style="background-image: url(${imageUrl})"></div>`;
            
            const cardHtml = `
            <div class="bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-700 border-l-4 ${item.item_type === 'lost' ? 'border-l-amber-500' : 'border-l-lime-500'} group">
                ${imageHtml}
                <div class="p-6">
                    <h3 class="text-xl font-bold text-white mb-2 ${item.item_type === 'lost' ? 'group-hover:text-amber-400' : 'group-hover:text-lime-400'} transition-colors duration-200">${item.title}</h3>
                    <p class="text-sm text-gray-400 mb-3 line-clamp-2">${item.description || ''}</p>
                    <div class="flex items-center text-gray-500 text-sm mb-1">
                        <i data-lucide="map-pin" class="w-4 h-4 mr-2 flex-shrink-0"></i>
                        <span>${item.item_type === 'lost' ? 'Last seen' : 'Found at'}: ${item.location}</span>
                     </div>
                    <div class="flex items-center text-gray-500 text-sm">
                        <i data-lucide="calendar" class="w-4 h-4 mr-2 flex-shrink-0"></i>
                        <span>Reported: ${formatDate(item.created_at)}</span>
                    </div>
                    <button class="claim-item-btn mt-5 w-full text-center px-4 py-2 ${item.item_type === 'lost' ? 'border border-amber-500 text-amber-400 hover:bg-amber-500' : 'border border-lime-500 text-lime-400 hover:bg-lime-500'} font-medium rounded-md hover:text-black transition-all duration-300"
                            data-item-id="${item.id}">
                        ${item.item_type === 'lost' ? 'I found this!' : 'This is mine!'}
                    </button>
                </div>
            </div>`;
            container.innerHTML += cardHtml;
        });
        lucide.createIcons();

    } catch (error) {
        console.error(`Error rendering ${type} items:`, error);
        container.innerHTML = ''; // Clear spinner
        noItemsMsg.textContent = 'Error loading items. Please try again.';
        noItemsMsg.classList.remove('hidden');
    }
}

// Renders "My Reports"
async function renderMyReports() {
    const container = document.getElementById('my-reports-grid');
    const noItemsMsg = document.getElementById('no-my-reports');
    if (!container || !noItemsMsg) return;
    
    container.innerHTML = '<div class="spinner w-12 h-12 mx-auto"></div>'; // Loading state
    
    try {
        const reports = await apiFetch('/reports/my-reports');
        container.innerHTML = ''; // Clear spinner
        
        if (reports.length === 0) {
            noItemsMsg.classList.remove('hidden');
            return;
        }
        noItemsMsg.classList.add('hidden');
        
        reports.forEach(item => {
            const imageUrl = item.has_image ? getImageUrl(item.id, 'item') : `https://placehold.co/600x400/${item.item_type === 'lost' ? 'f59e0b' : 'a3e635'}/white?text=${encodeURIComponent(item.title.substring(0,10))}`;
            const imageHtml = `<div class="item-card-image" style="background-image: url(${imageUrl})"></div>`;

            let statusHtml = '';
            let buttonHtml = '';

            // Check for a pending claim *on this item*
            if (item.status === 'pending') {
                statusHtml = `<span class="text-xs font-bold uppercase tracking-widest text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full">Pending Review</span>`;
                // This item has a pending claim, show the Review button
                // The server provides the pending_claim_id
                buttonHtml = `<button class="review-claim-btn mt-4 w-full text-center px-4 py-2 border border-amber-500 text-amber-400 font-medium rounded-md hover:bg-amber-500 hover:text-black transition-all duration-300"
                                    data-claim-id="${item.pending_claim_id}">
                                Review Claim
                              </button>`;
            } else if (item.status === 'public') {
                statusHtml = `<span class="text-xs font-bold uppercase tracking-widest text-lime-300 bg-lime-500/20 px-3 py-1 rounded-full">Public</span>`;
            } else if (item.status === 'claimed') {
                statusHtml = `<span class="text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-500/20 px-3 py-1 rounded-full">Claimed</span>`;
            }
            
            const cardHtml = `
            <div class="bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-700">
                ${imageHtml}
                <div class="p-6">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-xl font-bold text-white">${item.title}</h3>
                        ${statusHtml}
                    </div>
                    <p class="text-sm text-gray-400 mb-3 line-clamp-2">${item.description || ''}</p>
                    <div class="flex items-center text-gray-500 text-sm mb-1">
                        <i data-lucide="map-pin" class="w-4 h-4 mr-2 flex-shrink-0"></i>
                        <span>${item.location}</span>
                     </div>
                    <div class="flex items-center text-gray-500 text-sm">
                        <i data-lucide="calendar" class="w-4 h-4 mr-2 flex-shrink-0"></i>
                        <span>Reported: ${formatDate(item.created_at)}</span>
                    </div>
                    ${buttonHtml}
                </div>
            </div>`;
            container.innerHTML += cardHtml;
        });
        lucide.createIcons();
        
    } catch (error) {
        console.error('Error rendering my reports:', error);
        container.innerHTML = ''; // Clear spinner
        if (error.message === 'Unauthorized') {
            noItemsMsg.textContent = 'Please log in to see your reports.';
        } else {
            noItemsMsg.textContent = 'Error loading reports.';
        }
        noItemsMsg.classList.remove('hidden');
    }
}

// Renders Home Stats and Activity Feed
async function renderHomeStats() {
    const statsLost = document.getElementById('stats-lost');
    const statsFound = document.getElementById('stats-found');
    const activityFeedContainer = document.getElementById('activity-feed');
    
    if (!statsLost || !statsFound || !activityFeedContainer) return;

    // Show loading state
    statsLost.innerHTML = '<span class="text-2xl font-normal text-slate-500">...</span>';
    statsFound.innerHTML = '<span class="text-2xl font-normal text-slate-500">...</span>';
    activityFeedContainer.innerHTML = '<div class="spinner w-8 h-8 mx-auto my-12"></div>';

    try {
        const stats = await apiFetch('/items/stats');
        statsLost.textContent = stats.lost_count || 0;
        statsFound.textContent = stats.found_count || 0;
        
        activityFeedContainer.innerHTML = '';
        if (stats.recent_items && stats.recent_items.length > 0) {
            stats.recent_items.forEach((item, index) => {
                const icon = item.item_type === 'lost' ? 'search' : 'package-check';
                const color = item.item_type === 'lost' ? 'text-amber-400' : 'text-lime-400';
                const li = document.createElement('li');
                li.className = 'flex items-center text-gray-300 text-sm opacity-0 transform -translate-x-4 transition-all duration-500';
                li.style.transitionDelay = `${index * 100}ms`;
                
                li.innerHTML = `
                    <i data-lucide="${icon}" class="w-4 h-4 mr-3 ${color} flex-shrink-0"></i>
                    <span>A <strong class="${color}">${item.title}</strong> was just reported <strong class="${color}">${item.item_type}</strong>.</span>
                `;
                activityFeedContainer.appendChild(li);
                
                // Use requestAnimationFrame to ensure the element is in the DOM before animating
                requestAnimationFrame(() => {
                    li.classList.remove('opacity-0', '-translate-x-4');
                });
            });
        } else {
            activityFeedContainer.innerHTML = '<li class="text-slate-500 italic text-center">No recent activity.</li>';
        }
        lucide.createIcons();

    } catch (error) {
        console.error('Error rendering home stats:', error);
    }
}

// === Modal Functionality ===
const reportForm = document.getElementById('item-report-form');
const statusLost = document.getElementById('status-lost');
const statusFound = document.getElementById('status-found');

const modals = {
    reportModal: { modal: document.getElementById('reportModal'), content: document.getElementById('reportModalContent') },
    searchModal: { modal: document.getElementById('searchModal'), content: document.getElementById('searchModalContent') },
    howModal: { modal: document.getElementById('howModal'), content: document.getElementById('howModalContent') },
    authModal: { modal: document.getElementById('authModal'), content: document.getElementById('authModalContent') },
    profileModal: { modal: document.getElementById('profileModal'), content: document.getElementById('profileModalContent') },
    claimModal: { modal: document.getElementById('claimModal'), content: document.getElementById('claimModalContent') },
    reviewModal: { modal: document.getElementById('reviewModal'), content: document.getElementById('reviewModalContent') },
    adminModal: { modal: document.getElementById('adminModal'), content: document.getElementById('adminModalContent') }
};

function openModal(modalName, data = null) {
    const m = modals[modalName];
    if (!m || !m.modal) return;

    // Run setup logic before showing
    if (modalName === 'authModal') {
        // Show the close button only if the user is *not* logged in
        const closeBtn = m.modal.querySelector('.auth-close-btn');
        if (closeBtn) {
            closeBtn.classList.toggle('hidden', getAuthToken());
        }
    }
    if (modalName === 'profileModal') {
        displayProfileInfo();
    }
    if (modalName === 'adminModal') {
        // This modal is now just a button in the nav rail,
        // it doesn't open a modal, it switches to a panel.
        // This function call might be deprecated or for a different UI version.
        // Let's check if the adminPanel exists.
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            // This is a nav-rail setup, not a modal setup.
            // We should click the nav button instead.
            document.getElementById('nav-admin')?.click();
            return; // Stop modal logic
        } else {
             renderAdminPanel(); // Assuming a modal version exists
        }
    }
    if (modalName === 'reportModal') {
        // Reset form state
        reportForm.reset();
        currentReportImageFile = null;
        resetReportDropzone();
        // Set pre-selected status if provided
        if (data && data.preselect) {
            if (data.preselect === 'lost') statusLost.checked = true;
            if (data.preselect === 'found') statusFound.checked = true;
        }
    }
    if (modalName === 'claimModal' && data) {
        setupClaimModal(data.itemId);
    }
    if (modalName === 'reviewModal' && data) {
        setupReviewModal(data.claimId);
    }
    if (modalName === 'searchModal') {
        document.getElementById('search-input').value = '';
        performSearch();
    }

    m.modal.classList.remove('opacity-0', 'pointer-events-none');
    m.content.classList.remove('scale-95', 'opacity-0');
}

function closeModal(modalName) {
    const m = modals[modalName];
    if (!m || !m.modal) return;

    if (modalName === 'authModal') {
        m.modal.querySelector('.auth-close-btn').classList.add('hidden');
    }

    m.content.classList.add('scale-95', 'opacity-0');
    m.modal.classList.add('opacity-0', 'pointer-events-none');

    // Reset forms after animation
    setTimeout(() => {
        if (modalName === 'reportModal') {
            reportForm.reset();
            currentReportImageFile = null;
            resetReportDropzone();
            document.querySelectorAll('#reportModal .floating-label').forEach(label => {
                label.style.top = ''; label.style.fontSize = ''; label.style.color = '';
            });
        }
        if (modalName === 'authModal') {
            document.getElementById('auth-panel-login').classList.add('hidden');
            document.getElementById('auth-panel-register').classList.add('hidden');
            document.getElementById('auth-panel-welcome').classList.add('hidden');
            document.getElementById('auth-panel-choice').classList.remove('hidden');
            document.getElementById('login-error').classList.add('hidden');
            document.getElementById('register-error').classList.add('hidden');
            loginForm.reset();
            registerForm.reset();
        }
        if (modalName === 'claimModal') {
            document.getElementById('claim-panel-main').classList.remove('hidden');
            document.getElementById('claim-panel-loading').classList.add('hidden');
            document.getElementById('claim-panel-success').classList.add('hidden');
            document.getElementById('claim-verification-group').classList.add('hidden');
            claimForm.reset();
        }
    }, 300); // Wait for fade-out
}

// --- Modal Open Triggers ---
document.getElementById('nav-search').addEventListener('click', () => openModal('searchModal'));
document.getElementById('nav-how').addEventListener('click', () => openModal('howModal'));

// The Admin nav button is a panel switcher, not a modal opener
// document.getElementById('nav-admin').addEventListener('click', () => openModal('adminModal')); 

document.getElementById('nav-report').addEventListener('click', () => {
    if (getAuthToken()) {
        openModal('reportModal');
    } else {
        openModal('authModal');
    }
});

// --- Event Delegation for dynamic buttons ---
document.body.addEventListener('click', (e) => {
     // --- Claim Item Button (from Lost/Found/Search grids) ---
     const claimButton = e.target.closest('.claim-item-btn');
     if (claimButton) {
         if (getAuthToken()) {
             const itemId = claimButton.dataset.itemId;
             openModal('claimModal', { itemId: itemId }); 
             // If search modal is open, close it
             if (modals.searchModal.modal.classList.contains('opacity-0') === false) {
                 closeModal('searchModal');
             }
         } else {
             openModal('authModal');
         }
     }
     
     // --- Review Claim Button (from My Reports grid) ---
     const reviewButton = e.target.closest('.review-claim-btn');
     if (reviewButton) {
         const claimId = reviewButton.dataset.claimId;
         openModal('reviewModal', { claimId: claimId });
     }
     
     // --- Admin Delete Item Button ---
     const deleteItemBtn = e.target.closest('.admin-delete-item-btn');
     if (deleteItemBtn) {
         const itemId = deleteItemBtn.dataset.itemId;
         if (confirm(`Are you sure you want to delete item #${itemId}? This is permanent.`)) {
             apiFetch(`/admin/items/${itemId}`, { method: 'DELETE' })
                .then(() => renderAdminPanel()) // Re-render admin panel
                .catch(err => alert(`Error deleting user: ${err.message}`));
         }
     }
});

// --- Modal Close Triggers ---
function setupModalCloseListeners() {
    Object.keys(modals).forEach(modalId => {
        const modalInfo = modals[modalId];
        if (!modalInfo || !modalInfo.modal) return;
        const modalElement = modalInfo.modal;

        // Close on backdrop click
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                e.preventDefault(); e.stopPropagation();
                closeModal(modalId);
            }
        });
        // Close on 'X' button click
        const closeButtons = modalElement.querySelectorAll('.close-modal-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                closeModal(modalId);
            });
        });
    });
    // Close on 'Escape' key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Object.keys(modals).forEach(closeModal);
        }
    });
}

// --- Form Submission (Report Item) ---
reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = reportForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-6 h-6 mx-auto"></div>';
    
    // Use FormData to send image and text
    const formData = new FormData();
    formData.append('item-title', document.getElementById('item-title').value);
    formData.append('item-location', document.getElementById('item-location').value);
    formData.append('item-description', document.getElementById('item-description').value);
    formData.append('item-status', reportForm.querySelector('input[name="item-status"]:checked').value);
    
    if (currentReportImageFile) {
        formData.append('item-image-input', currentReportImageFile);
    }
    
    try {
        await apiFetch('/reports/new', {
            method: 'POST',
            body: formData // Let browser set Content-Type to multipart/form-data
        });
        
        closeModal('reportModal');
        renderMyReports(); // Refresh my reports
        renderHomeStats(); // Refresh stats
        document.getElementById('nav-reports').click(); // Switch to "My Reports"
        
    } catch (error) {
        console.error("Error submitting report:", error);
        alert("Error submitting report: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
    }
});

// === AI Report Form Image Logic ===
const reportDropzone = document.getElementById('report-image-dropzone');
const reportImageInput = document.getElementById('report-image-input');
const dropzonePrompt = document.getElementById('dropzone-prompt');
const dropzoneAnalyzing = document.getElementById('dropzone-analyzing');
const itemTitleInput = document.getElementById('item-title');
const itemDescriptionInput = document.getElementById('item-description');

if (reportDropzone) {
    reportDropzone.addEventListener('click', () => reportImageInput.click());
    reportDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        reportDropzone.classList.add('dragover');
    });
    reportDropzone.addEventListener('dragleave', () => {
        reportDropzone.classList.remove('dragover');
    });
    reportDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        reportDropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
    });
}
if (reportImageInput) {
    reportImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload(file);
    });
}

function resetReportDropzone() {
    if (!reportDropzone) return;
    reportDropzone.style.backgroundImage = 'none';
    reportDropzone.classList.remove('has-image', 'dragover');
    dropzonePrompt.classList.remove('hidden');
    dropzoneAnalyzing.classList.add('hidden');
}

function handleImageUpload(file) {
    currentReportImageFile = file; // Store the file for submission
    
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result;
        reportDropzone.style.backgroundImage = `url(${base64String})`;
        reportDropzone.classList.add('has-image');
        dropzonePrompt.classList.add('hidden');
        dropzoneAnalyzing.classList.remove('hidden');
        
        // Send to backend for analysis
        analyzeImageWithAI(base64String);
    };
    reader.readAsDataURL(file);
}

async function analyzeImageWithAI(base64Data) {
    try {
        const response = await apiFetch('/ai/analyze-image', {
            method: 'POST',
            body: JSON.stringify({ image: base64Data.split(',')[1] }) // Send only base64 part
        });
        
        if (response.itemName) itemTitleInput.value = response.itemName;
        if (response.description) itemDescriptionInput.value = response.description;
        
        // Trigger label animation
        // Manually trigger the "input" event for floating labels
        itemTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        itemDescriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
        
    } catch (error) {
        console.error("AI Analysis Error:", error);
        itemDescriptionInput.value = 'Could not analyze image. Please describe the item.';
        itemDescriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
        dropzoneAnalyzing.classList.add('hidden');
    }
}

// --- Floating label trigger for textareas ---
// This is needed because textareas don't have :not(:placeholder-shown) logic
function handleFloatingLabel(e) {
    const input = e.target;
    const label = input.nextElementSibling;
    if (!label || !label.classList.contains('floating-label')) return;
    
    if (input.value.trim() !== '' || document.activeElement === input) {
        label.style.top = '-16px';
        label.style.fontSize = '0.75rem';
        label.style.color = '#a3e635';
    } else {
         label.style.top = '';
         label.style.fontSize = '';
         label.style.color = '';
    }
}
document.querySelectorAll('.floating-input, .floating-select').forEach(el => {
    el.addEventListener('focus', handleFloatingLabel);
    el.addEventListener('blur', handleFloatingLabel);
    // Handle initial load for pre-filled values
    if(el.value.trim() !== '') handleFloatingLabel({target: el});
});
// Special handling for textareas that might be autofilled by AI
itemDescriptionInput.addEventListener('input', handleFloatingTextarea);
document.getElementById('claim-verification').addEventListener('input', handleFloatingTextarea);
function handleFloatingTextarea(e) {
     const label = e.target.nextElementSibling;
    if (!label) return;
    if (e.target.value.trim() !== '') {
        label.style.top = '-16px';
        label.style.fontSize = '0.75rem';
        label.style.color = '#a3e635';
    } else if (document.activeElement !== e.target) {
         label.style.top = '';
         label.style.fontSize = '';
         label.style.color = '';
    }
}


// === "Out of the Box" Auth Panel Switching ===
const authPanelChoice = document.getElementById('auth-panel-choice');
const authPanelLogin = document.getElementById('auth-panel-login');
const authPanelRegister = document.getElementById('auth-panel-register');
const authPanelWelcome = document.getElementById('auth-panel-welcome');

document.getElementById('auth-btn-login').addEventListener('click', () => {
    authPanelChoice.classList.add('hidden');
    authPanelLogin.classList.remove('hidden');
});
document.getElementById('auth-btn-register').addEventListener('click', () => {
    authPanelChoice.classList.add('hidden');
    authPanelRegister.classList.remove('hidden');
});
document.querySelectorAll('.auth-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        authPanelLogin.classList.add('hidden');
        authPanelRegister.classList.add('hidden');
        authPanelChoice.classList.remove('hidden');
    });
});

// === Auth Logic (NOW USES FETCH) ===
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    registerError.classList.add('hidden');
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-6 h-6 mx-auto"></div>';
    
    try {
        const response = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('reg-username').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-pass').value,
                usn: document.getElementById('reg-usn').value,
                sem: document.getElementById('reg-sem').value,
                branch: document.getElementById('reg-branch').value,
                mobile: document.getElementById('reg-mobile').value
            })
        });
        
        loginUser(response.token, response.user.username);
        
    } catch (error) {
        registerError.textContent = error.message;
        registerError.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
    }
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    loginError.classList.add('hidden');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-6 h-6 mx-auto"></div>';
    
    try {
        const response = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                emailOrUsn: document.getElementById('login-email').value,
                password: document.getElementById('login-pass').value
            })
        });

        loginUser(response.token, response.user.username);
        
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

function loginUser(token, username) {
    localStorage.setItem('campusReconnectToken', token);
    updateAuthState();
    
    authPanelLogin.classList.add('hidden');
    authPanelRegister.classList.add('hidden');
    document.getElementById('welcome-username').textContent = username;
    authPanelWelcome.classList.remove('hidden');
    
    const closeBtn = modals.authModal.modal.querySelector('.auth-close-btn');
    if (closeBtn) closeBtn.classList.add('hidden');

    setTimeout(() => {
        closeModal('authModal');
        loginForm.reset();
        registerForm.reset();
    }, 2000); // Shorter welcome
}

function logoutUser() {
    localStorage.removeItem('campusReconnectToken');
    updateAuthState();
    closeModal('profileModal'); 
    document.getElementById('nav-home').click(); // Go to home panel on logout
}

document.getElementById('logout-button').addEventListener('click', logoutUser);

// Wire up mobile shortcuts in profile modal
document.getElementById('profile-btn-reports').addEventListener('click', () => {
    closeModal('profileModal');
    document.getElementById('nav-reports').click();
});
document.getElementById('profile-btn-admin').addEventListener('click', () => {
    closeModal('profileModal');
    document.getElementById('nav-admin').click();
});
document.getElementById('profile-btn-how').addEventListener('click', () => {
    closeModal('profileModal');
    openModal('howModal');
});

// Update UI based on auth state
function updateAuthState() {
    const navProfileBtn = document.getElementById('nav-profile');
    const navAdminBtn = document.getElementById('nav-admin');
    const navReportsBtn = document.getElementById('nav-reports');
    if (!navProfileBtn || !navAdminBtn) return; 

    const token = getAuthToken();
    
    // Re-create the profile button to clear old event listeners
    const newNavProfileBtn = navProfileBtn.cloneNode(true);
    newNavProfileBtn.id = 'nav-profile'; 
    navProfileBtn.parentNode.replaceChild(newNavProfileBtn, navProfileBtn);
    
    const profileBtnReports = document.getElementById('profile-btn-reports');
    const profileBtnAdmin = document.getElementById('profile-btn-admin');
    
    if (token) {
        // Logged IN
        // Decode token to check admin (simple client-side check)
        let isAdmin = false;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            isAdmin = payload.isAdmin;
        } catch (e) {
            console.error("Invalid token:", e);
            logoutUser(); // Force logout if token is bad
            return;
        }
        
        if (isAdmin) {
            navAdminBtn.classList.remove('hidden');
            newNavProfileBtn.innerHTML = `<i data-lucide="user-check" class="w-6 h-6 text-red-400"></i><span class="tooltip">Admin Profile</span>`;
            if (profileBtnAdmin) profileBtnAdmin.classList.remove('hidden');
        } else {
            navAdminBtn.classList.add('hidden');
            newNavProfileBtn.innerHTML = `<i data-lucide="user-check" class="w-6 h-6 text-lime-400"></i><span class="tooltip">My Profile</span>`;
            if (profileBtnAdmin) profileBtnAdmin.classList.add('hidden');
        }
        newNavProfileBtn.addEventListener('click', () => openModal('profileModal'));
        navReportsBtn.classList.remove('hidden'); // Show "My Reports"
        if (profileBtnReports) profileBtnReports.classList.remove('hidden');
        
    } else {
        // Logged OUT
        navAdminBtn.classList.add('hidden'); // Hide Admin
        navReportsBtn.classList.add('hidden'); // Hide "My Reports"
        newNavProfileBtn.innerHTML = `<i data-lucide="user" class="w-6 h-6"></i><span class="tooltip">Login / Register</span>`;
        newNavProfileBtn.addEventListener('click', () => openModal('authModal'));
        if (profileBtnReports) profileBtnReports.classList.add('hidden');
        if (profileBtnAdmin) profileBtnAdmin.classList.add('hidden');
    }
    lucide.createIcons();
    
    // Re-render all public panels
    renderHomeStats();
    renderPublicItems('lost');
    renderPublicItems('found');
    // If user is logged in, refresh their reports panel too (if it's active)
    if (token && document.getElementById('reportsPanel').classList.contains('active')) {
        renderMyReports();
    }
    // If admin is logged in, refresh admin panel (if it's active)
    if (token && document.getElementById('adminPanel').classList.contains('active')) {
        renderAdminPanel();
    }
}

// Profile Modal Logic
async function displayProfileInfo() {
    try {
        const user = await apiFetch('/auth/me');
        if (!user) return;
        
        document.getElementById('profile-username').textContent = user.username || '-';
        document.getElementById('profile-email').textContent = user.email || '-';
        document.getElementById('profile-usn').textContent = user.usn || '-';
        document.getElementById('profile-branch').textContent = user.branch || '-';
        document.getElementById('profile-sem').textContent = user.semester || '-';
        document.getElementById('profile-mobile').textContent = user.mobile || '-';
        
        const pfpDisplay = document.getElementById('profile-pic-display');
        if (user.has_pfp) {
            pfpDisplay.style.backgroundImage = `url(${getImageUrl(user.id, 'pfp')})`;
            pfpDisplay.innerHTML = '';
        } else {
            pfpDisplay.style.backgroundImage = 'none';
            pfpDisplay.innerHTML = '<i data-lucide="user" class="w-12 h-12"></i>';
            lucide.createIcons();
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
    }
}

// Profile Picture File Upload Logic
const pfpUploadBtn = document.getElementById('upload-pfp-btn');
const pfpUploadInput = document.getElementById('pfp-upload-input');

pfpUploadBtn.addEventListener('click', () => pfpUploadInput.click());
pfpUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    pfpUploadBtn.disabled = true;
    pfpUploadBtn.innerHTML = '<div class="spinner w-5 h-5 mx-auto"></div>';

    const formData = new FormData();
    formData.append('pfpImage', file);
    
    try {
        // The server will handle storing the image
        await apiFetch('/auth/upload-pfp', {
            method: 'POST',
            body: formData
        });
        displayProfileInfo(); // Re-fetch profile to show new image
        e.target.value = null; // Clear input
    } catch (error) {
        console.error("Error uploading PFP:", error);
        alert('Error uploading profile picture.');
    } finally {
        pfpUploadBtn.disabled = false;
        pfpUploadBtn.innerHTML = `
            <i data-lucide="upload" class="w-4 h-4"></i>
            <span>Upload Picture</span>
        `;
        lucide.createIcons();
    }
});

// === Claim Modal Logic ===
const claimForm = document.getElementById('claim-form');
const claimItemIdInput = document.getElementById('claim-item-id');
const claimVerificationGroup = document.getElementById('claim-verification-group');
const claimVerificationInput = document.getElementById('claim-verification');

async function setupClaimModal(itemId) {
    try {
        // Get all setup data from the server
        const data = await apiFetch(`/claims/setup/${itemId}`);
        const { item, owner, claimer } = data;
        
        claimItemIdInput.value = itemId;

        // Fill Claimer Info
        const pfpClaimer = document.getElementById('claim-pfp-claimer');
        document.getElementById('claim-name-claimer').textContent = claimer.username;
        if (claimer.has_pfp) {
            pfpClaimer.style.backgroundImage = `url(${getImageUrl(claimer.id, 'pfp')})`;
            pfpClaimer.innerHTML = '';
        } else {
            pfpClaimer.style.backgroundImage = 'none';
            pfpClaimer.innerHTML = '<i data-lucide="user" class="w-10 h-10"></i>';
        }
        
        // Fill Owner Info
        const pfpOwner = document.getElementById('claim-pfp-owner');
        document.getElementById('claim-name-owner').textContent = owner.username;
         if (owner.has_pfp) {
            pfpOwner.style.backgroundImage = `url(${getImageUrl(owner.id, 'pfp')})`;
            pfpOwner.innerHTML = '';
        } else {
            pfpOwner.style.backgroundImage = 'none';
            pfpOwner.innerHTML = '<i data-lucide="user" class="w-10 h-10"></i>';
        }
        
        // Set Text
        document.getElementById('claim-item-title').textContent = item.title;
        const actionText = document.getElementById('claim-action-text');
        const submitBtn = document.getElementById('claim-submit-btn');

        if (item.item_type === 'found') { // Claiming your lost item
            actionText.textContent = `To claim your item, please provide a verification detail. (e.g., "The lock screen is a picture of my dog")`;
            submitBtn.textContent = 'Submit Verification & Connect';
            claimVerificationGroup.classList.remove('hidden');
            claimVerificationInput.required = true;
        } else { // Returning a found item
            actionText.textContent = `You found this item. Confirm to connect with the owner and arrange its return.`;
            submitBtn.textContent = 'Confirm Connection';
            claimVerificationGroup.classList.add('hidden');
            claimVerificationInput.required = false;
        }
        
        lucide.createIcons();
        
    } catch (error) {
        console.error("Error setting up claim modal:", error);
        alert(`Error: ${error.message}`);
        closeModal('claimModal');
    }
}

claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    document.getElementById('claim-panel-main').classList.add('hidden');
    document.getElementById('claim-panel-loading').classList.remove('hidden');
    
    try {
        await apiFetch('/claims/new', {
            method: 'POST',
            body: JSON.stringify({
                itemId: claimItemIdInput.value,
                verificationText: claimVerificationInput.value
            })
        });

        document.getElementById('claim-panel-loading').classList.add('hidden');
        document.getElementById('claim-panel-success').classList.remove('hidden');

        setTimeout(() => {
            closeModal('claimModal');
            renderPublicItems('lost');
            renderPublicItems('found');
        }, 3000);
    
    } catch (error) {
        console.error("Error submitting claim:", error);
        alert('Error submitting claim: ' + error.message);
        closeModal('claimModal');
    }
});

// === Review Claim Logic ===
const reviewClaimIdInput = document.getElementById('review-claim-id');

async function setupReviewModal(claimId) {
    try {
        const data = await apiFetch(`/claims/review/${claimId}`);
        const { claim, item, claimer } = data;
        
        reviewClaimIdInput.value = claimId;
        document.getElementById('review-item-title').textContent = item.title;
        
        const pfpClaimer = document.getElementById('review-pfp-claimer');
        document.getElementById('review-name-claimer').textContent = claimer.username;
        document.getElementById('review-email-claimer').textContent = claimer.email;
        if (claimer.has_pfp) {
            pfpClaimer.style.backgroundImage = `url(${getImageUrl(claimer.id, 'pfp')})`;
            pfpClaimer.innerHTML = '';
        } else {
            pfpClaimer.style.backgroundImage = 'none';
            pfpClaimer.innerHTML = '<i data-lucide="user" class="w-8 h-8"></i>';
        }
        
        const verificationText = document.getElementById('review-verification-text');
        if (claim.verification_text) {
            verificationText.textContent = `"${claim.verification_text}"`;
        } else {
            // This case is for "I found this!" claims
            verificationText.textContent = '(User confirmed they found your item. No text required.)';
        }
        lucide.createIcons();
        
    } catch (error) {
        console.error("Error setting up review modal:", error);
        alert(`Error: ${error.message}`);
        closeModal('reviewModal');
    }
}

document.getElementById('review-btn-confirm').addEventListener('click', () => handleClaimDecision('confirmed'));
document.getElementById('review-btn-deny').addEventListener('click', () => handleClaimDecision('denied'));

async function handleClaimDecision(decision) {
    const claimId = reviewClaimIdInput.value;
    const btn = (decision === 'confirmed') ? document.getElementById('review-btn-confirm') : document.getElementById('review-btn-deny');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner w-5 h-5 mx-auto"></div>';

    try {
        await apiFetch('/claims/decide', {
            method: 'POST',
            body: JSON.stringify({
                claimId: claimId,
                decision: decision
            })
        });
        
        closeModal('reviewModal');
        await renderMyReports(); // Refresh your reports
        // Refresh lost and found lists to remove claimed items from public view
        await renderPublicItems('lost');
        await renderPublicItems('found');
        
    } catch (error) {
        console.error("Error deciding claim:", error);
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        if (decision === 'confirmed') {
            btn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 mr-2"></i>Confirm Connection';
        } else {
            btn.innerHTML = '<i data-lucide="x-circle" class="w-5 h-5 mr-2"></i>Deny Claim';
        }
        lucide.createIcons();
    }
}

// === "Out of the Box" Search Logic ===
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results-container');
const searchNoResults = document.getElementById('search-no-results');

let searchTimeout;
searchInput.addEventListener('keyup', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300); // Debounce search
});

async function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    searchResultsContainer.innerHTML = '';
    
    if (query.length < 1) {
        searchNoResults.textContent = 'Start typing to see results...';
        searchNoResults.classList.remove('hidden');
        return;
    }
    
    searchNoResults.textContent = 'Searching...';
    searchNoResults.classList.remove('hidden');
    
    try {
        const results = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
        
        if (results.length === 0) {
            searchNoResults.textContent = 'No results found.';
            searchNoResults.classList.remove('hidden');
        } else {
            searchNoResults.classList.add('hidden');
            results.forEach(item => {
                const imageUrl = item.has_image ? getImageUrl(item.id, 'item') : `https://placehold.co/100/0f172a/475569?text=?`;
                const imageHtml = `<div class="search-result-image" style="background-image: url(${imageUrl})"></div>`;
                const color = item.item_type === 'lost' ? 'text-amber-400' : 'text-lime-400';
                const typeText = item.item_type === 'lost' ? 'Lost' : 'Found';
                    
                const resultHtml = `
                    <div class="search-result-item claim-item-btn" data-item-id="${item.id}">
                        ${imageHtml}
                        <div class="flex-grow">
                            <p class="font-bold text-white text-lg">${item.title}</p>
                            <p class="text-sm text-slate-400 line-clamp-1">${item.location}</p>
                        </div>
                        <span class="text-xs font-bold uppercase ${color} ml-4">${typeText}</span>
                    </div>
                `;
                searchResultsContainer.innerHTML += resultHtml;
            });
            lucide.createIcons();
        }
    } catch(error) {
        console.error("Search error:", error);
        searchNoResults.textContent = 'Error during search.';
        searchNoResults.classList.remove('hidden');
    }
}

// === Admin Panel Logic ===
// This logic is for the *panel* inside the main content area
const adminPanelTabButtons = document.querySelectorAll('#adminPanel .admin-tab-btn');
const adminPanelTabContents = document.querySelectorAll('#adminPanel .admin-tab-content');

adminPanelTabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        adminPanelTabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        adminPanelTabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== tabId);
        });
    });
});

async function renderAdminPanel() {
    const statsUsers = document.getElementById('admin-stats-users');
    const statsItems = document.getElementById('admin-stats-items');
    const statsClaims = document.getElementById('admin-stats-claims');
    const usersTable = document.getElementById('admin-users-table-body');
    const itemsTable = document.getElementById('admin-items-table-body');

    if (!statsUsers || !usersTable || !itemsTable) {
        console.log("Admin panel elements not found. Skipping render.");
        return;
    }

    try {
        const data = await apiFetch('/admin/dashboard');
        
        // Stats
        statsUsers.textContent = data.stats.users;
        statsItems.textContent = data.stats.items;
        statsClaims.textContent = data.stats.claims;
        
        // Users Table
        usersTable.innerHTML = '';
        data.users.forEach(user => {
            const userRow = `
                <tr class="hover:bg-slate-700/50">
                    <td class="p-3">${user.username}</td>
                    <td class="p-3">${user.email}</td>
                    <td class="p-3">${user.usn}</td>
                    <td class="p-3 text-center">${user.report_count}</td>
                    <td class="p-3 text-center">
                        <button class="admin-delete-user-btn admin-delete-btn" data-email="${user.email}">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </td>
                </tr>
            `;
            usersTable.innerHTML += userRow;
        });
        
        // Items Table
        itemsTable.innerHTML = '';
        data.items.forEach(item => {
            let statusBadge = '';
            if (item.status === 'public') statusBadge = `<span class="text-xs font-bold text-lime-300 bg-lime-500/20 px-2 py-0.5 rounded-full">Public</span>`;
            if (item.status === 'pending') statusBadge = `<span class="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">Pending</span>`;
            if (item.status === 'claimed') statusBadge = `<span class="text-xs font-bold text-slate-300 bg-slate-500/20 px-2 py-0.5 rounded-full">Claimed</span>`;
            
            const itemRow = `
                <tr class="hover:bg-slate-700/50">
                    <td class="p-3">
                        <p class="font-bold text-white">${item.title}</p>
                        <p class="text-xs text-slate-400">${item.item_type === 'lost' ? 'Lost' : 'Found'}</p>
                    </td>
                    <td class="p-3">${item.owner_username}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                    <td class="p-3 text-center">
                        <button class="admin-delete-item-btn admin-delete-btn" data-item-id="${item.id}">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </td>
                </tr>
            `;
            itemsTable.innerHTML += itemRow;
        });
        
        lucide.createIcons();
        
    } catch (error) {
        console.error("Error rendering admin panel:", error);
    }
}


// === Initial Load ===
document.addEventListener('DOMContentLoaded', () => {
    updateAuthState(); // This will trigger the initial render of stats and public items
    setupModalCloseListeners();
});

// --- Admin Delete User Button (delegated) ---
// Uses event delegation similar to other admin buttons so it works for dynamic rows
document.body.addEventListener('click', (e) => {
    const deleteUserBtn = e.target.closest('.admin-delete-user-btn');
    if (!deleteUserBtn) return;

    const email = deleteUserBtn.dataset.email;
    if (email === 'admin@campus.reconnect') {
        alert("Cannot delete the root admin user.");
        return;
    }

    if (!confirm(`Are you sure you want to delete user ${email}? This is permanent.`)) return;

    apiFetch(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
        .then(() => renderAdminPanel()) // Re-render admin panel
        .catch(err => {
            console.error('Error deleting user:', err);
            alert(`Error deleting user: ${err.message}`);
        });
});
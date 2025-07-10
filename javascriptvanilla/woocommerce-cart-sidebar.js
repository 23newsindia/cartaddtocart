/**
 * WooCommerce Cart Sidebar Handler (Vanilla JS)
 * Handles cart sidebar functionality without jQuery
 */

class WooCommerceCartSidebar {
    constructor() {
        this.sidebar = null;
        this.isVisible = false;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeSidebar());
        } else {
            this.initializeSidebar();
        }
    }

    initializeSidebar() {
        this.setupSidebarElements();
        this.setupEventListeners();
        this.setupKeyboardHandlers();
        
        // Check if sidebar should be shown on load
        this.checkInitialState();
    }

    setupSidebarElements() {
        this.sidebar = document.getElementById('cart-sidebar');
        
        if (!this.sidebar) {
            console.warn('Cart sidebar element not found');
            return;
        }
    }

    setupEventListeners() {
        if (!this.sidebar) return;

        // Close button handlers
        const closeButtons = this.sidebar.querySelectorAll('.cart-close a, .nasa-sidebar-close a');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideSidebar();
            });
        });

        // Background click to close
        const blackWindow = document.querySelector('.black-window');
        if (blackWindow) {
            blackWindow.addEventListener('click', () => {
                if (this.isVisible) {
                    this.hideSidebar();
                }
            });
        }

        // Cart trigger buttons
        const cartTriggers = document.querySelectorAll('[data-target="#cart-sidebar"], .nasa-mini-cart-icon, .cart-icon, .cart-link');
        cartTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSidebar();
            });
        });

        // Listen for add to cart events
        document.addEventListener('added_to_cart', (e) => {
            this.handleAddedToCart(e.detail);
        });

        // Listen for cart updates
        document.addEventListener('wc_fragments_refreshed', () => {
            this.updateSidebarContent();
        });

        document.addEventListener('wc_cart_updated', () => {
            this.updateSidebarContent();
        });
    }

    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideSidebar();
            }
        });
    }

    checkInitialState() {
        // Check if sidebar should be shown on page load
        const showInput = document.querySelector('input[name="nasa_cart_sidebar_show"]');
        if (showInput && showInput.value === '1') {
            this.showSidebar();
        }
    }

    handleAddedToCart(detail = {}) {
        // Check if sidebar mode is enabled
        const eventAfterAddToCart = this.getEventAfterAddToCart();
        
        if (eventAfterAddToCart === 'sidebar') {
            this.showSidebar();
            // Force reload cart content after adding
            setTimeout(() => {
                this.loadSidebarContent(true);
            }, 100);
        }
    }

    getEventAfterAddToCart() {
        const input = document.querySelector('input[name="nasa-event-after-add-to-cart"]');
        return input ? input.value : 'sidebar';
    }

    showSidebar() {
        if (!this.sidebar || this.isVisible) return;
        
        // Show background overlay
        const blackWindow = document.querySelector('.black-window');
        if (blackWindow) {
            blackWindow.style.display = 'block';
            blackWindow.classList.add('desk-window');
        }
        
        // Add body class to prevent scrolling
        document.body.classList.add('m-ovhd');
        
        // Show sidebar
        this.sidebar.classList.add('nasa-active');
        this.isVisible = true;
        
        // Load content
        this.loadSidebarContent();
        
        // Update title if adding product
        this.updateSidebarTitle();
    }

    hideSidebar() {
        if (!this.sidebar || !this.isVisible) return;
        
        // Hide background overlay
        const blackWindow = document.querySelector('.black-window');
        if (blackWindow) {
            blackWindow.style.display = 'none';
            blackWindow.classList.remove('desk-window');
        }
        
        // Remove body class
        document.body.classList.remove('m-ovhd');
        
        // Hide sidebar
        this.sidebar.classList.remove('nasa-active');
        this.isVisible = false;
        
        // Reset title
        this.resetSidebarTitle();
    }

    updateSidebarTitle(isAdding = false) {
        const titleElement = this.sidebar.querySelector('.nasa-tit-mycart');
        if (!titleElement) return;
        
        if (isAdding) {
            const addingText = titleElement.getAttribute('data_text_adding') || 'Adding...';
            titleElement.textContent = addingText;
        } else {
            titleElement.textContent = 'My Cart';
        }
    }

    resetSidebarTitle() {
        const titleElement = this.sidebar.querySelector('.nasa-tit-mycart');
        if (titleElement) {
            titleElement.textContent = 'My Cart';
        }
    }

    loadSidebarContent(forceReload = false) {
        if (!this.sidebar || (this.isLoading && !forceReload)) return;
        
        const cartContent = this.sidebar.querySelector('.widget_shopping_cart_content');
        if (!cartContent) return;
        
        // Check if content is already loaded and recent (unless forcing reload)
        if (!forceReload && cartContent.innerHTML.trim() && !this.needsRefresh()) {
            this.setupSidebarEventHandlers();
            return;
        }
        
        this.isLoading = true;
        
        // Show loading state
        this.showLoadingState();
        
        // Try multiple endpoints for cart content
        this.fetchCartContent()
            .then(response => {
                this.isLoading = false;
                if (response && response.fragments) {
                    this.updateSidebarFromFragments(response.fragments);
                } else if (response && response.content) {
                    // Direct content response
                    cartContent.innerHTML = response.content;
                    this.setupSidebarEventHandlers();
                } else {
                    // Fallback: try to get cart via different method
                    this.loadCartViaForm();
                }
            })
            .catch(error => {
                this.isLoading = false;
                console.error('Error loading sidebar content:', error);
                this.loadCartViaForm();
            });
    }

    async fetchCartContent() {
        // Try WooCommerce AJAX endpoint first
        try {
            const response = await fetch(window.location.origin + '/?wc-ajax=get_refreshed_fragments', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log('WC AJAX failed, trying alternative method');
        }
        
        // Try alternative endpoint
        try {
            const response = await fetch(window.location.origin + '/wp-admin/admin-ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: 'action=woocommerce_get_refreshed_fragments'
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log('Admin AJAX failed, trying form method');
        }
        
        return null;
    }

    loadCartViaForm() {
        // Fallback: create a hidden form to get cart content
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = window.location.href;
        form.style.display = 'none';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'wc-ajax';
        input.value = 'get_refreshed_fragments';
        
        form.appendChild(input);
        document.body.appendChild(form);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', form.action);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            document.body.removeChild(form);
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    this.updateSidebarFromFragments(response.fragments);
                } catch (e) {
                    // If JSON parsing fails, try to extract cart content from HTML
                    this.extractCartFromHTML(xhr.responseText);
                }
            } else {
                this.showErrorState();
            }
        };
        
        xhr.onerror = () => {
            document.body.removeChild(form);
            this.showErrorState();
        };
        
        xhr.send(new FormData(form));
    }

    extractCartFromHTML(html) {
        // Try to extract cart content from full page HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const cartContent = tempDiv.querySelector('.widget_shopping_cart_content');
        if (cartContent) {
            const sidebarCartContent = this.sidebar.querySelector('.widget_shopping_cart_content');
            if (sidebarCartContent) {
                sidebarCartContent.innerHTML = cartContent.innerHTML;
                this.setupSidebarEventHandlers();
                return;
            }
        }
        
        // If extraction fails, show error
        this.showErrorState();
    }

    updateSidebarFromFragments(fragments) {
        if (!fragments || !this.sidebar) return;

        // Update cart content
        const cartContentFragment = fragments['.widget_shopping_cart_content'];
        if (cartContentFragment) {
            const cartContent = this.sidebar.querySelector('.widget_shopping_cart_content');
            if (cartContent) {
                cartContent.innerHTML = cartContentFragment;
            }
        }

        // Update other fragments within the sidebar
        Object.keys(fragments).forEach(selector => {
            if (selector !== '.widget_shopping_cart_content') {
                const elements = this.sidebar.querySelectorAll(selector);
                elements.forEach(element => {
                    if (fragments[selector]) {
                        element.innerHTML = fragments[selector];
                    }
                });
            }
        });

        // Setup event handlers for new content
        this.setupSidebarEventHandlers();
        
        // Mark as refreshed
        this.lastRefresh = Date.now();
    }

    updateSidebarContent() {
        if (this.isVisible) {
            this.loadSidebarContent(true);
        }
    }

    needsRefresh() {
        // Refresh if content is older than 30 seconds
        return !this.lastRefresh || (Date.now() - this.lastRefresh) > 30000;
    }

    showLoadingState() {
        const cartContent = this.sidebar.querySelector('.widget_shopping_cart_content');
        if (!cartContent) return;
        
        // Use template if available
        const loadingTemplate = document.getElementById('ns-cart-sidebar-loading-item');
        if (loadingTemplate) {
            cartContent.innerHTML = loadingTemplate.innerHTML;
        } else {
            cartContent.innerHTML = this.getLoadingHTML();
        }
    }

    showErrorState() {
        const cartContent = this.sidebar.querySelector('.widget_shopping_cart_content');
        if (cartContent) {
            cartContent.innerHTML = this.getErrorHTML();
        }
    }

    setupSidebarEventHandlers() {
        if (!this.sidebar) return;

        // Quantity controls
        const quantityControls = this.sidebar.querySelectorAll('.quantity');
        quantityControls.forEach(control => {
            this.setupQuantityControl(control);
        });

        // Remove item buttons
        const removeButtons = this.sidebar.querySelectorAll('.remove_from_cart_button');
        removeButtons.forEach(button => {
            if (!button.hasAttribute('data-initialized')) {
                button.setAttribute('data-initialized', 'true');
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.removeCartItem(button);
                });
            }
        });

        // Variation change buttons (if any)
        const variationButtons = this.sidebar.querySelectorAll('.nasa-change_variation_mini_cart');
        variationButtons.forEach(button => {
            if (!button.hasAttribute('data-initialized')) {
                button.setAttribute('data-initialized', 'true');
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleVariationChange(button);
                });
            }
        });

        // Checkout buttons
        const checkoutButtons = this.sidebar.querySelectorAll('.checkout');
        checkoutButtons.forEach(button => {
            if (!button.hasAttribute('data-initialized')) {
                button.setAttribute('data-initialized', 'true');
                button.addEventListener('click', () => {
                    this.hideSidebar();
                });
            }
        });

        // View cart buttons
        const viewCartButtons = this.sidebar.querySelectorAll('.view-cart, .wc-forward');
        viewCartButtons.forEach(button => {
            if (!button.hasAttribute('data-initialized')) {
                button.setAttribute('data-initialized', 'true');
                button.addEventListener('click', () => {
                    this.hideSidebar();
                });
            }
        });
    }

    setupQuantityControl(control) {
        const input = control.querySelector('input.qty');
        const plusButton = control.querySelector('.plus');
        const minusButton = control.querySelector('.minus');
        
        if (input && plusButton && !plusButton.hasAttribute('data-initialized')) {
            plusButton.setAttribute('data-initialized', 'true');
            plusButton.addEventListener('click', (e) => {
                e.preventDefault();
                const currentValue = parseInt(input.value) || 0;
                const max = parseInt(input.getAttribute('max')) || Infinity;
                if (currentValue < max) {
                    input.value = currentValue + 1;
                    this.updateCartItemQuantity(input);
                }
            });
        }
        
        if (input && minusButton && !minusButton.hasAttribute('data-initialized')) {
            minusButton.setAttribute('data-initialized', 'true');
            minusButton.addEventListener('click', (e) => {
                e.preventDefault();
                const currentValue = parseInt(input.value) || 0;
                const min = parseInt(input.getAttribute('min')) || 0;
                
                if (currentValue <= 1) {
                    // Confirm removal
                    const confirmText = document.querySelector('input[name="nasa_change_value_0"]')?.value || 
                                      'Are you sure you want to remove it?';
                    if (confirm(confirmText)) {
                        input.value = 0;
                        this.updateCartItemQuantity(input);
                    }
                } else if (currentValue > min) {
                    input.value = currentValue - 1;
                    this.updateCartItemQuantity(input);
                }
            });
        }
        
        if (input && !input.hasAttribute('data-initialized')) {
            input.setAttribute('data-initialized', 'true');
            input.addEventListener('change', () => {
                this.updateCartItemQuantity(input);
            });
        }
    }

    updateCartItemQuantity(input) {
        const cartItem = input.closest('.woocommerce-mini-cart-item, .mini-cart-item');
        const cartItemKey = cartItem?.getAttribute('data-cart_item_key') || 
                           input.getAttribute('data-cart-key') ||
                           cartItem?.querySelector('.remove_from_cart_button')?.getAttribute('data-cart_item_key');
        const quantity = input.value;
        
        if (!cartItemKey) {
            console.error('Cart item key not found');
            return;
        }

        // Show loading state for this item
        if (cartItem) {
            cartItem.classList.add('updating');
        }

        // Send AJAX request to update quantity
        const formData = new FormData();
        formData.append('action', 'woocommerce_update_cart_item_quantity');
        formData.append('cart_item_key', cartItemKey);
        formData.append('quantity', quantity);
        formData.append('security', this.getUpdateCartNonce());
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.location.origin + '/wp-admin/admin-ajax.php');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (cartItem) {
                cartItem.classList.remove('updating');
            }
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        // Refresh sidebar content
                        this.loadSidebarContent(true);
                        
                        // Trigger cart update event
                        document.dispatchEvent(new CustomEvent('wc_cart_updated'));
                    }
                } catch (e) {
                    console.error('Error updating cart:', e);
                    // Fallback: reload the page
                    window.location.reload();
                }
            }
        };
        
        xhr.onerror = () => {
            if (cartItem) {
                cartItem.classList.remove('updating');
            }
            console.error('Network error updating cart');
        };
        
        xhr.send(formData);
    }

    removeCartItem(button) {
        const cartItem = button.closest('.woocommerce-mini-cart-item, .mini-cart-item');
        const cartItemKey = button.getAttribute('data-cart_item_key');
        
        if (!cartItemKey) {
            console.error('Cart item key not found for removal');
            return;
        }

        // Show loading state
        if (cartItem) {
            cartItem.classList.add('removing');
        }

        // Send AJAX request to remove item
        const xhr = new XMLHttpRequest();
        xhr.open('GET', button.href);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                // Refresh sidebar content
                this.loadSidebarContent(true);
                
                // Trigger cart update event
                document.dispatchEvent(new CustomEvent('wc_cart_updated'));
            } else {
                if (cartItem) {
                    cartItem.classList.remove('removing');
                }
            }
        };
        
        xhr.onerror = () => {
            if (cartItem) {
                cartItem.classList.remove('removing');
            }
        };
        
        xhr.send();
    }

    handleVariationChange(button) {
        // This would handle the variation change functionality
        // Implementation depends on the specific theme requirements
        console.log('Variation change clicked', button);
    }

    getUpdateCartNonce() {
        // Try to get nonce from various possible sources
        const nonceInput = document.querySelector('input[name="woocommerce-cart-nonce"]');
        if (nonceInput) return nonceInput.value;
        
        const nonceElement = document.querySelector('[data-cart-nonce]');
        if (nonceElement) return nonceElement.getAttribute('data-cart-nonce');
        
        // Try to get from WooCommerce params
        if (window.wc_cart_params && window.wc_cart_params.update_cart_nonce) {
            return window.wc_cart_params.update_cart_nonce;
        }
        
        // Fallback - this might not work in all cases
        return '';
    }

    getLoadingHTML() {
        return `
            <div class="nasa-minicart-items-empty">
                <div class="sidebar-minicart-items-mask nasa-flex align-start">
                    <div class="nasa-mask-lv1 ns-mask-load"></div>
                    <div class="nasa-mask-lv1">
                        <div class="nasa-mask-lv2 ns-mask-load"></div>
                        <div class="nasa-mask-lv2 ns-mask-load"></div>
                        <div class="nasa-mask-lv2 ns-mask-load"></div>
                        <div class="nasa-mask-lv2 ns-mask-load"></div>
                    </div>
                </div>
            </div>
        `;
    }

    getErrorHTML() {
        return `
            <div class="cart-error">
                <p>Error loading cart content.</p>
                <button onclick="location.reload()" class="button">Refresh Page</button>
            </div>
        `;
    }
}

// Initialize cart sidebar
const wooCartSidebar = new WooCommerceCartSidebar();

// Export for global access
window.WooCommerceCartSidebar = WooCommerceCartSidebar;

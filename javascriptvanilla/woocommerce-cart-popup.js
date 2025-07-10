/**
 * WooCommerce Cart Popup Handler (Vanilla JS)
 * Handles cart popup functionality without jQuery
 */

class WooCommerceCartPopup {
    constructor() {
        this.popupWrap = null;
        this.popup = null;
        this.isVisible = false;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializePopup());
        } else {
            this.initializePopup();
        }
    }

    initializePopup() {
        this.setupPopupElements();
        this.setupEventListeners();
        this.setupKeyboardHandlers();
    }

    setupPopupElements() {
        // Find or create popup elements
        this.popupWrap = document.querySelector('.ns-cart-popup-wrap');
        this.popup = document.querySelector('#ns-cart-popup');
        
        if (!this.popupWrap) {
            this.createPopupElements();
        }
    }

    createPopupElements() {
        // Create popup wrapper
        this.popupWrap = document.createElement('div');
        this.popupWrap.className = 'ns-cart-popup-wrap';
        
        // Create background close area
        const bgClose = document.createElement('a');
        bgClose.className = 'popup-cart-bg-close';
        bgClose.href = 'javascript:void(0);';
        bgClose.title = 'Close (Esc)';
        bgClose.rel = 'nofollow';
        
        // Create popup container
        const container = document.createElement('div');
        container.className = 'ns-cart-popup-container';
        
        // Create popup
        this.popup = document.createElement('div');
        this.popup.id = 'ns-cart-popup';
        this.popup.className = 'ns-cart-popup';
        
        // Assemble structure
        container.appendChild(this.popup);
        this.popupWrap.appendChild(bgClose);
        this.popupWrap.appendChild(container);
        
        // Add to body
        document.body.appendChild(this.popupWrap);
    }

    setupEventListeners() {
        // Close button handlers
        if (this.popupWrap) {
            const closeButtons = this.popupWrap.querySelectorAll('.popup-cart-bg-close, .popup-cart-close, .nasa-stclose');
            closeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.hidePopup();
                });
            });
        }

        // Listen for add to cart events
        document.addEventListener('added_to_cart', (e) => {
            this.handleAddedToCart(e.detail);
        });

        // Listen for cart updates
        document.addEventListener('wc_fragments_refreshed', () => {
            this.updatePopupContent();
        });
    }

    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hidePopup();
            }
        });
    }

    handleAddedToCart(detail = {}) {
        // Check if popup mode is enabled
        const eventAfterAddToCart = this.getEventAfterAddToCart();
        
        if (eventAfterAddToCart === 'popup' || eventAfterAddToCart === 'popup_2') {
            this.loadPopupContent(detail);
            this.showPopup();
        }
    }

    getEventAfterAddToCart() {
        const input = document.querySelector('input[name="nasa-event-after-add-to-cart"]');
        return input ? input.value : 'sidebar';
    }

    loadPopupContent(detail = {}) {
        if (!this.popup) return;

        // Show loading state
        this.popup.innerHTML = this.getLoadingHTML();

        // Load content via AJAX
        const xhr = new XMLHttpRequest();
        xhr.open('GET', window.location.origin + '/?wc-ajax=get_refreshed_fragments');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    this.updatePopupFromFragments(response.fragments, detail);
                } catch (e) {
                    console.error('Error loading popup content:', e);
                    this.popup.innerHTML = this.getErrorHTML();
                }
            } else {
                this.popup.innerHTML = this.getErrorHTML();
            }
        };
        
        xhr.onerror = () => {
            this.popup.innerHTML = this.getErrorHTML();
        };
        
        xhr.send();
    }

    updatePopupFromFragments(fragments, detail = {}) {
        if (!fragments || !this.popup) return;

        // Look for popup-specific fragment
        const popupFragment = fragments['.ns-cart-popup'] || fragments['#ns-cart-popup'];
        
        if (popupFragment) {
            this.popup.innerHTML = popupFragment;
        } else {
            // Build popup content from available fragments
            this.buildPopupContent(fragments, detail);
        }

        // Setup popup-specific event handlers
        this.setupPopupEventHandlers();
    }

    buildPopupContent(fragments, detail = {}) {
        const eventType = this.getEventAfterAddToCart();
        
        if (eventType === 'popup_2') {
            this.buildPopupV2Content(fragments, detail);
        } else {
            this.buildPopupV1Content(fragments, detail);
        }
    }

    buildPopupV1Content(fragments, detail = {}) {
        // Build basic popup content
        const cartContent = fragments['.widget_shopping_cart_content'] || '';
        
        const html = `
            <div class="nasa-after-add-to-cart-wrap">
                <a class="nasa-stclose popup-cart-close" href="javascript:void(0);" title="Close (Esc)" rel="nofollow"></a>
                <div class="nasa-after-add-to-cart-content">
                    <h3>Product added to cart successfully!</h3>
                    ${cartContent}
                    <div class="popup-cart-buttons">
                        <a href="${this.getCartUrl()}" class="button view-cart">View Cart</a>
                        <a href="${this.getCheckoutUrl()}" class="button checkout">Checkout</a>
                    </div>
                </div>
            </div>
        `;
        
        this.popup.innerHTML = html;
    }

    buildPopupV2Content(fragments, detail = {}) {
        // Build enhanced popup content
        const cartItems = this.extractCartItems(fragments);
        const cartTotal = this.extractCartTotal(fragments);
        
        const html = `
            <div class="nasa-after-add-to-cart-wrap ns-cart-popup ns-cart-popup-v2">
                <a class="nasa-stclose popup-cart-close" href="javascript:void(0);" title="Close (Esc)" rel="nofollow"></a>
                <div class="widget_shopping_cart_content_popup_v2">
                    <div class="nasa-minicart-items">
                        <h3 class="nasa-title-after-add-to-cart">Successfully added to your cart.</h3>
                        <div class="woocommerce-mini-cart cart_list product_list_widget">
                            ${cartItems}
                        </div>
                    </div>
                    <div class="nasa-minicart-footer nasa-bold">
                        <span class="ns_total_item margin-bottom-10 nasa-bold">
                            ${this.getCartItemCountText()}
                        </span>
                        ${cartTotal}
                        <div class="popup-cart-buttons">
                            <a href="${this.getCartUrl()}" class="button view-cart">View Cart</a>
                            <a href="${this.getCheckoutUrl()}" class="button checkout">Checkout</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.popup.innerHTML = html;
    }

    extractCartItems(fragments) {
        const cartContent = fragments['.widget_shopping_cart_content'] || '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cartContent;
        
        const cartList = tempDiv.querySelector('.woocommerce-mini-cart');
        return cartList ? cartList.innerHTML : '';
    }

    extractCartTotal(fragments) {
        const cartContent = fragments['.widget_shopping_cart_content'] || '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cartContent;
        
        const total = tempDiv.querySelector('.total');
        return total ? total.outerHTML : '';
    }

    getCartItemCountText() {
        // Get cart count from fragments or calculate
        const cartItems = document.querySelectorAll('.woocommerce-mini-cart .woocommerce-mini-cart-item');
        const count = cartItems.length;
        
        if (count === 1) {
            return `There is <span class="primary-color">${count} item</span> in your cart.`;
        } else {
            return `There are <span class="primary-color">${count} items</span> in your cart.`;
        }
    }

    setupPopupEventHandlers() {
        if (!this.popup) return;

        // Close buttons
        const closeButtons = this.popup.querySelectorAll('.popup-cart-close, .nasa-stclose');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.hidePopup();
            });
        });

        // Quantity controls in popup
        const quantityControls = this.popup.querySelectorAll('.quantity');
        quantityControls.forEach(control => {
            this.setupQuantityControl(control);
        });

        // Remove item buttons
        const removeButtons = this.popup.querySelectorAll('.remove_from_cart_button');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeCartItem(button);
            });
        });
    }

    setupQuantityControl(control) {
        const input = control.querySelector('input.qty');
        const plusButton = control.querySelector('.plus');
        const minusButton = control.querySelector('.minus');
        
        if (input && plusButton) {
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
        
        if (input && minusButton) {
            minusButton.addEventListener('click', (e) => {
                e.preventDefault();
                const currentValue = parseInt(input.value) || 0;
                const min = parseInt(input.getAttribute('min')) || 0;
                if (currentValue > min) {
                    input.value = currentValue - 1;
                    this.updateCartItemQuantity(input);
                }
            });
        }
        
        if (input) {
            input.addEventListener('change', () => {
                this.updateCartItemQuantity(input);
            });
        }
    }

    updateCartItemQuantity(input) {
        const cartItemKey = input.getAttribute('data-cart-key') || 
                           input.closest('.woocommerce-mini-cart-item').getAttribute('data-cart-key');
        const quantity = input.value;
        
        if (!cartItemKey) return;

        // Send AJAX request to update quantity
        const formData = new FormData();
        formData.append('action', 'woocommerce_update_cart_item_quantity');
        formData.append('cart_item_key', cartItemKey);
        formData.append('quantity', quantity);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.location.origin + '/wp-admin/admin-ajax.php');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                // Refresh popup content
                this.loadPopupContent();
                
                // Trigger cart update event
                document.dispatchEvent(new CustomEvent('wc_cart_updated'));
            }
        };
        
        xhr.send(formData);
    }

    removeCartItem(button) {
        const cartItemKey = button.getAttribute('data-cart_item_key');
        
        if (!cartItemKey) return;

        // Send AJAX request to remove item
        const xhr = new XMLHttpRequest();
        xhr.open('GET', button.href);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                // Refresh popup content
                this.loadPopupContent();
                
                // Trigger cart update event
                document.dispatchEvent(new CustomEvent('wc_cart_updated'));
            }
        };
        
        xhr.send();
    }

    showPopup() {
        if (!this.popupWrap) return;
        
        this.popupWrap.style.display = 'block';
        this.isVisible = true;
        
        // Add body class to prevent scrolling
        document.body.classList.add('popup-open');
        
        // Animate in
        setTimeout(() => {
            this.popupWrap.classList.add('active');
        }, 10);
    }

    hidePopup() {
        if (!this.popupWrap) return;
        
        this.popupWrap.classList.remove('active');
        this.isVisible = false;
        
        // Remove body class
        document.body.classList.remove('popup-open');
        
        // Hide after animation
        setTimeout(() => {
            this.popupWrap.style.display = 'none';
        }, 300);
    }

    updatePopupContent() {
        if (this.isVisible && this.popup) {
            this.loadPopupContent();
        }
    }

    getLoadingHTML() {
        return `
            <div class="popup-loading">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    getErrorHTML() {
        return `
            <div class="popup-error">
                <p>Error loading cart content. Please refresh the page.</p>
                <button onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }

    getCartUrl() {
        return window.wc_cart_fragments_params?.cart_url || '/cart/';
    }

    getCheckoutUrl() {
        return window.wc_checkout_params?.checkout_url || '/checkout/';
    }
}

// Initialize cart popup
const wooCartPopup = new WooCommerceCartPopup();

// Export for global access
window.WooCommerceCartPopup = WooCommerceCartPopup;

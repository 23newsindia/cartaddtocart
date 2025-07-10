/**
 * WooCommerce Vanilla JS Initialization
 * Main initialization file that coordinates all components
 */

class WooCommerceVanillaInit {
    constructor() {
        this.components = {};
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        if (this.isInitialized) return;
        
        try {
            // Initialize variations handler
            if (typeof WooCommerceVariations !== 'undefined') {
                this.components.variations = new WooCommerceVariations();
            }
            
            // Initialize cart popup
            if (typeof WooCommerceCartPopup !== 'undefined') {
                this.components.cartPopup = new WooCommerceCartPopup();
            }
            
            // Initialize cart sidebar
            if (typeof WooCommerceCartSidebar !== 'undefined') {
                this.components.cartSidebar = new WooCommerceCartSidebar();
            }
            
            // Setup global event handlers
            this.setupGlobalEventHandlers();
            
            // Setup compatibility layer
            this.setupCompatibilityLayer();
            
            this.isInitialized = true;
            
            // Trigger initialization complete event
            document.dispatchEvent(new CustomEvent('woocommerce_vanilla_initialized', {
                detail: { components: this.components }
            }));
            
        } catch (error) {
            console.error('Error initializing WooCommerce Vanilla JS:', error);
        }
    }

    setupGlobalEventHandlers() {
        // Handle AJAX add to cart forms
        document.addEventListener('submit', (e) => {
            const form = e.target;
            
            if (form.classList.contains('cart') || form.classList.contains('variations_form')) {
                // Check if AJAX is enabled
                const ajaxEnabled = document.querySelector('input[name="nasa-enable-addtocart-ajax"]');
                
                if (ajaxEnabled && ajaxEnabled.value === '1') {
                    e.preventDefault();
                    this.handleAjaxAddToCart(form);
                }
            }
        });

        // Handle quantity input changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[name="quantity"]')) {
                this.handleQuantityChange(e.target);
            }
        });

        // Handle buy now buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nasa-buy-now')) {
                e.preventDefault();
                this.handleBuyNow(e.target);
            }
        });

        // Handle cart icon clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.cart-icon, .nasa-mini-cart-icon, [data-target="#cart-sidebar"]')) {
                e.preventDefault();
                if (this.components.cartSidebar) {
                    this.components.cartSidebar.showSidebar();
                }
            }
        });
    }

    handleAjaxAddToCart(form) {
        const formData = new FormData(form);
        const submitButton = form.querySelector('.single_add_to_cart_button');
        
        // Validate form if it's a variation form
        if (form.classList.contains('variations_form')) {
            const variationId = form.querySelector('.variation_id').value;
            if (!variationId) {
                alert('Please select some product options before adding this product to your cart.');
                return;
            }
        }
        
        // Add loading state
        if (submitButton) {
            submitButton.classList.add('loading');
            submitButton.disabled = true;
        }
        
        // Add AJAX flag
        formData.append('add-to-cart-ajax', '1');
        
        // Send request
        const xhr = new XMLHttpRequest();
        xhr.open('POST', form.action || window.location.href);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (submitButton) {
                submitButton.classList.remove('loading');
                submitButton.disabled = false;
            }
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    this.handleAddToCartResponse(response, form);
                } catch (e) {
                    // Handle non-JSON response (likely success)
                    this.handleAddToCartSuccess(form);
                }
            } else {
                console.error('Add to cart failed:', xhr.statusText);
                this.handleAddToCartError();
            }
        };
        
        xhr.onerror = () => {
            if (submitButton) {
                submitButton.classList.remove('loading');
                submitButton.disabled = false;
            }
            this.handleAddToCartError();
        };
        
        xhr.send(formData);
    }

    handleAddToCartResponse(response, form) {
        if (response.error) {
            alert(response.error);
            return;
        }
        
        // Update cart fragments
        if (response.fragments) {
            this.updateFragments(response.fragments);
        }
        
        // Trigger success handling
        this.handleAddToCartSuccess(form, response);
    }

    handleAddToCartSuccess(form, response = {}) {
        // Force refresh cart fragments first
        this.refreshCartFragments().then(() => {
            // Then trigger added to cart event
            document.dispatchEvent(new CustomEvent('added_to_cart', {
                detail: { form: form, response: response }
            }));
            
            // Handle based on configured behavior
            const eventAfterAddToCart = this.getEventAfterAddToCart();
            
            switch (eventAfterAddToCart) {
                case 'popup':
                case 'popup_2':
                    if (this.components.cartPopup) {
                        this.components.cartPopup.handleAddedToCart({ form: form, response: response });
                    }
                    break;
                    
                case 'sidebar':
                default:
                    if (this.components.cartSidebar) {
                        this.components.cartSidebar.handleAddedToCart({ form: form, response: response });
                    }
                    break;
            }
        });
    }

    handleAddToCartError() {
        alert('There was an error adding the product to your cart. Please try again.');
    }

    handleQuantityChange(input) {
        // Validate quantity
        const min = parseInt(input.getAttribute('min')) || 1;
        const max = parseInt(input.getAttribute('max')) || Infinity;
        let value = parseInt(input.value) || min;
        
        if (value < min) {
            value = min;
            input.value = value;
        } else if (value > max) {
            value = max;
            input.value = value;
        }
        
        // Trigger quantity change event
        document.dispatchEvent(new CustomEvent('quantity_changed', {
            detail: { input: input, value: value }
        }));
    }

    handleBuyNow(button) {
        const form = button.closest('form');
        if (!form) return;
        
        // Set buy now flag
        const buyNowInput = form.querySelector('input[name="nasa_buy_now"]');
        if (buyNowInput) {
            buyNowInput.value = '1';
        }
        
        // Submit form
        if (form.classList.contains('variations_form')) {
            // Validate variations first
            const variationId = form.querySelector('.variation_id').value;
            if (!variationId) {
                alert('Please select some product options before proceeding.');
                return;
            }
        }
        
        form.submit();
    }

    updateFragments(fragments) {
        Object.keys(fragments).forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.innerHTML = fragments[selector];
            });
        });
        
        // Trigger fragments updated event
        document.dispatchEvent(new CustomEvent('wc_fragments_refreshed', {
            detail: { fragments: fragments }
        }));
    }

    updateCartCount() {
        // This would update cart count displays in the header
        // Implementation depends on theme structure
        const cartCountElements = document.querySelectorAll('.cart-count, .nasa-cart-count');
        
        // You might need to fetch the current count via AJAX
        // For now, we'll trigger a fragments refresh
        this.refreshCartFragments();
    }

    refreshCartFragments() {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', window.location.origin + '/?wc-ajax=get_refreshed_fragments');
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.fragments) {
                            this.updateFragments(response.fragments);
                        }
                        resolve(response);
                    } catch (e) {
                        console.error('Error refreshing cart fragments:', e);
                        reject(e);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('Network error'));
            };
            
            xhr.send();
        });
    }

    getEventAfterAddToCart() {
        const input = document.querySelector('input[name="nasa-event-after-add-to-cart"]');
        return input ? input.value : 'sidebar';
    }

    setupCompatibilityLayer() {
        // Create compatibility layer for existing jQuery-dependent code
        if (typeof window.$ === 'undefined' && typeof window.jQuery === 'undefined') {
            // Create minimal jQuery-like object for basic compatibility
            window.$ = window.jQuery = this.createJQueryCompatLayer();
        }
        
        // Trigger events that existing code might be listening for
        document.addEventListener('woocommerce_vanilla_initialized', () => {
            // Simulate jQuery ready event
            if (typeof window.$ !== 'undefined' && window.$.fn) {
                setTimeout(() => {
                    document.dispatchEvent(new Event('ready'));
                }, 100);
            }
        });
    }

    createJQueryCompatLayer() {
        // Very basic jQuery-like object for compatibility
        // This is not a full jQuery replacement, just basic functionality
        const $ = function(selector) {
            if (typeof selector === 'string') {
                return {
                    length: 0,
                    each: function() { return this; },
                    on: function() { return this; },
                    off: function() { return this; },
                    trigger: function() { return this; },
                    addClass: function() { return this; },
                    removeClass: function() { return this; },
                    hasClass: function() { return false; },
                    val: function() { return ''; },
                    attr: function() { return ''; },
                    find: function() { return this; },
                    closest: function() { return this; }
                };
            } else if (typeof selector === 'function') {
                // Document ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', selector);
                } else {
                    selector();
                }
            }
            return this;
        };
        
        $.fn = {};
        $.extend = function() { return {}; };
        
        return $;
    }

    // Public API methods
    getComponent(name) {
        return this.components[name];
    }

    reinitialize() {
        this.isInitialized = false;
        this.initializeComponents();
    }
}

// Initialize everything
const wooCommerceVanilla = new WooCommerceVanillaInit();

// Export for global access
window.WooCommerceVanilla = WooCommerceVanillaInit;
window.wooCommerceVanilla = wooCommerceVanilla;

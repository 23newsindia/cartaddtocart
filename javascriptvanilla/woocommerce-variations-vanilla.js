/**
 * Vanilla JavaScript WooCommerce Variations Handler
 * Replaces jQuery-dependent functionality for product variations
 */

class WooCommerceVariations {
    constructor() {
        this.variations = [];
        this.selectedAttributes = {};
        this.currentVariation = null;
        this.form = null;
        this.cartSidebar = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeVariations());
        } else {
            this.initializeVariations();
        }
    }

    initializeVariations() {
        // Find variation forms
        const variationForms = document.querySelectorAll('.variations_form');
        
        variationForms.forEach(form => {
            this.setupForm(form);
        });

        // Setup cart sidebar
        this.setupCartSidebar();
        
        // Setup quantity controls
        this.setupQuantityControls();
    }

    setupForm(form) {
        this.form = form;
        
        // Get variations data from form
        const variationsData = form.getAttribute('data-product_variations');
        if (variationsData) {
            try {
                this.variations = JSON.parse(variationsData.replace(/&quot;/g, '"'));
            } catch (e) {
                console.error('Error parsing variations data:', e);
                return;
            }
        }

        // Setup attribute selection handlers
        this.setupAttributeHandlers(form);
        
        // Setup add to cart handler
        this.setupAddToCartHandler(form);
        
        // Setup reset variations handler
        this.setupResetHandler(form);
        
        // Initial state
        this.updateVariationDisplay();
    }

    setupAttributeHandlers(form) {
        // Handle custom attribute UX elements (nasa-attr-ux)
        const attrElements = form.querySelectorAll('.nasa-attr-ux');
        
        attrElements.forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAttributeSelection(element);
            });
        });

        // Handle regular select dropdowns
        const selectElements = form.querySelectorAll('.variations select');
        
        selectElements.forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleSelectChange(select);
            });
        });
    }

    handleAttributeSelection(element) {
        if (element.classList.contains('nasa-disable') || 
            element.classList.contains('nasa-processing')) {
            return;
        }

        const attributeName = element.closest('.nasa-attr-ux_wrap').getAttribute('data-attribute_name');
        const value = element.getAttribute('data-value');
        const select = this.form.querySelector(`select[data-attribute_name="${attributeName}"]`);

        // Remove selected class from siblings
        const siblings = element.parentElement.querySelectorAll('.nasa-attr-ux');
        siblings.forEach(sibling => sibling.classList.remove('selected'));

        // Toggle selection
        if (element.classList.contains('selected')) {
            // Deselect
            delete this.selectedAttributes[attributeName];
            if (select) select.value = '';
        } else {
            // Select
            element.classList.add('selected');
            this.selectedAttributes[attributeName] = value;
            if (select) select.value = value;
        }

        this.updateVariationDisplay();
    }

    handleSelectChange(select) {
        const attributeName = select.getAttribute('data-attribute_name');
        const value = select.value;

        if (value) {
            this.selectedAttributes[attributeName] = value;
            
            // Update custom UX elements
            const uxWrap = this.form.querySelector(`.nasa-attr-ux_wrap[data-attribute_name="${attributeName}"]`);
            if (uxWrap) {
                const uxElements = uxWrap.querySelectorAll('.nasa-attr-ux');
                uxElements.forEach(el => {
                    el.classList.remove('selected');
                    if (el.getAttribute('data-value') === value) {
                        el.classList.add('selected');
                    }
                });
            }
        } else {
            delete this.selectedAttributes[attributeName];
        }

        this.updateVariationDisplay();
    }

    updateVariationDisplay() {
        // Find matching variation
        const matchingVariation = this.findMatchingVariation();
        
        if (matchingVariation) {
            this.currentVariation = matchingVariation;
            this.showVariation(matchingVariation);
        } else {
            this.currentVariation = null;
            this.hideVariation();
        }

        // Update available options
        this.updateAvailableOptions();
        
        // Update reset button visibility
        this.updateResetButton();
    }

    findMatchingVariation() {
        return this.variations.find(variation => {
            return Object.keys(variation.attributes).every(attr => {
                const variationValue = variation.attributes[attr];
                const selectedValue = this.selectedAttributes[attr];
                
                // If no selection for this attribute, it matches if variation allows any value
                if (!selectedValue) {
                    return !variationValue || variationValue === '';
                }
                
                // If variation has specific value, it must match selection
                return !variationValue || variationValue === '' || variationValue === selectedValue;
            });
        });
    }

    showVariation(variation) {
        const variationWrap = this.form.querySelector('.single_variation_wrap');
        const singleVariation = this.form.querySelector('.single_variation');
        const addToCartButton = this.form.querySelector('.single_add_to_cart_button');
        const variationId = this.form.querySelector('.variation_id');
        const variationsButton = this.form.querySelector('.variations_button');

        // Update variation ID
        if (variationId) {
            variationId.value = variation.variation_id;
        }

        // Update price display
        if (variation.price_html && singleVariation) {
            singleVariation.innerHTML = variation.price_html;
            singleVariation.style.display = 'block';
        }

        // Enable add to cart button
        if (addToCartButton) {
            addToCartButton.classList.remove('disabled', 'wc-variation-selection-needed');
            
            if (variation.is_purchasable && variation.is_in_stock) {
                addToCartButton.classList.remove('wc-variation-is-unavailable');
            } else {
                addToCartButton.classList.add('disabled', 'wc-variation-is-unavailable');
            }
        }

        // Enable variations button wrapper
        if (variationsButton) {
            variationsButton.classList.remove('woocommerce-variation-add-to-cart-disabled');
            variationsButton.classList.add('woocommerce-variation-add-to-cart-enabled');
        }

        // Update quantity limits
        this.updateQuantityLimits(variation);
        
        // Update product image if available
        this.updateProductImage(variation);

        // Trigger custom events
        this.triggerEvent('show_variation', { variation: variation });
    }

    hideVariation() {
        const singleVariation = this.form.querySelector('.single_variation');
        const addToCartButton = this.form.querySelector('.single_add_to_cart_button');
        const variationId = this.form.querySelector('.variation_id');
        const variationsButton = this.form.querySelector('.variations_button');

        // Clear variation ID
        if (variationId) {
            variationId.value = '';
        }

        // Hide variation display
        if (singleVariation) {
            singleVariation.style.display = 'none';
            singleVariation.innerHTML = '';
        }

        // Disable add to cart button
        if (addToCartButton) {
            addToCartButton.classList.add('disabled', 'wc-variation-selection-needed');
            addToCartButton.classList.remove('wc-variation-is-unavailable');
        }

        // Disable variations button wrapper
        if (variationsButton) {
            variationsButton.classList.add('woocommerce-variation-add-to-cart-disabled');
            variationsButton.classList.remove('woocommerce-variation-add-to-cart-enabled');
        }

        // Trigger custom events
        this.triggerEvent('hide_variation');
    }

    updateAvailableOptions() {
        const attributeWraps = this.form.querySelectorAll('.nasa-attr-ux_wrap');
        
        attributeWraps.forEach(wrap => {
            const attributeName = wrap.getAttribute('data-attribute_name');
            const options = wrap.querySelectorAll('.nasa-attr-ux');
            
            options.forEach(option => {
                const value = option.getAttribute('data-value');
                const isAvailable = this.isOptionAvailable(attributeName, value);
                
                if (isAvailable) {
                    option.classList.remove('nasa-disable');
                } else {
                    option.classList.add('nasa-disable');
                }
            });
        });
    }

    isOptionAvailable(attributeName, value) {
        // Create test attributes with this option selected
        const testAttributes = { ...this.selectedAttributes };
        testAttributes[attributeName] = value;

        // Check if any variation matches these attributes
        return this.variations.some(variation => {
            return Object.keys(testAttributes).every(attr => {
                const variationValue = variation.attributes[attr];
                const testValue = testAttributes[attr];
                
                return !variationValue || variationValue === '' || variationValue === testValue;
            });
        });
    }

    updateQuantityLimits(variation) {
        const quantityInput = this.form.querySelector('input[name="quantity"]');
        
        if (quantityInput && variation) {
            if (variation.min_qty) {
                quantityInput.setAttribute('min', variation.min_qty);
            }
            if (variation.max_qty) {
                quantityInput.setAttribute('max', variation.max_qty);
            }
            
            // Handle sold individually
            if (variation.is_sold_individually === 'yes') {
                quantityInput.value = '1';
                quantityInput.setAttribute('max', '1');
                quantityInput.style.display = 'none';
            } else {
                quantityInput.style.display = '';
            }
        }
    }

    updateProductImage(variation) {
        if (variation.image && variation.image.src) {
            const productImages = document.querySelectorAll('.woocommerce-product-gallery__image img');
            
            productImages.forEach(img => {
                if (img.classList.contains('wp-post-image')) {
                    // Store original src if not already stored
                    if (!img.hasAttribute('data-original-src')) {
                        img.setAttribute('data-original-src', img.src);
                        img.setAttribute('data-original-srcset', img.srcset || '');
                    }
                    
                    // Update image
                    img.src = variation.image.src;
                    if (variation.image.srcset) {
                        img.srcset = variation.image.srcset;
                    }
                    if (variation.image.alt) {
                        img.alt = variation.image.alt;
                    }
                }
            });
        }
    }

    updateResetButton() {
        const resetButton = this.form.querySelector('.reset_variations');
        const hasSelections = Object.keys(this.selectedAttributes).length > 0;
        
        if (resetButton) {
            resetButton.style.visibility = hasSelections ? 'visible' : 'hidden';
        }
    }

    setupResetHandler(form) {
        const resetButton = form.querySelector('.reset_variations');
        
        if (resetButton) {
            resetButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetVariations();
            });
        }
    }

    resetVariations() {
        // Clear selected attributes
        this.selectedAttributes = {};
        this.currentVariation = null;

        // Clear all selections in UI
        const selectedElements = this.form.querySelectorAll('.nasa-attr-ux.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));

        // Clear select dropdowns
        const selects = this.form.querySelectorAll('.variations select');
        selects.forEach(select => select.value = '');

        // Reset product images
        this.resetProductImages();

        // Update display
        this.updateVariationDisplay();

        // Trigger events
        this.triggerEvent('reset_data');
    }

    resetProductImages() {
        const productImages = document.querySelectorAll('.woocommerce-product-gallery__image img');
        
        productImages.forEach(img => {
            if (img.hasAttribute('data-original-src')) {
                img.src = img.getAttribute('data-original-src');
                img.srcset = img.getAttribute('data-original-srcset') || '';
            }
        });
    }

    setupAddToCartHandler(form) {
        const addToCartButton = form.querySelector('.single_add_to_cart_button');
        
        if (addToCartButton) {
            addToCartButton.addEventListener('click', (e) => {
                if (addToCartButton.classList.contains('disabled')) {
                    e.preventDefault();
                    
                    if (addToCartButton.classList.contains('wc-variation-is-unavailable')) {
                        alert('Sorry, this product is unavailable. Please choose a different combination.');
                    } else if (addToCartButton.classList.contains('wc-variation-selection-needed')) {
                        alert('Please select some product options before adding this product to your cart.');
                    }
                    return false;
                }
                
                // If not disabled, proceed with AJAX add to cart
                e.preventDefault();
                this.addToCart(form);
            });
        }
    }

    addToCart(form) {
        const formData = new FormData(form);
        const addToCartButton = form.querySelector('.single_add_to_cart_button');
        
        // Add loading state
        if (addToCartButton) {
            addToCartButton.classList.add('loading');
            addToCartButton.disabled = true;
        }

        // Prepare AJAX request
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.location.href);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.onload = () => {
            if (addToCartButton) {
                addToCartButton.classList.remove('loading');
                addToCartButton.disabled = false;
            }
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    this.handleAddToCartResponse(response);
                } catch (e) {
                    // Handle non-JSON response (likely success redirect)
                    this.showCartSidebar();
                    this.updateCartFragments();
                }
            } else {
                console.error('Add to cart failed:', xhr.statusText);
            }
        };
        
        xhr.onerror = () => {
            if (addToCartButton) {
                addToCartButton.classList.remove('loading');
                addToCartButton.disabled = false;
            }
            console.error('Add to cart request failed');
        };
        
        xhr.send(formData);
    }

    handleAddToCartResponse(response) {
    if (response.error) {
        alert(response.error);
        return;
    }

    // ✅ Only load content — showing happens after it loads
    this.loadCartContent();

    if (response.fragments) {
        this.updateCartFragments(response.fragments);
    }

    this.triggerEvent('added_to_cart', { response: response });
}


    setupCartSidebar() {
        this.cartSidebar = document.getElementById('cart-sidebar');
        
        if (this.cartSidebar) {
            // Setup close button
            const closeButton = this.cartSidebar.querySelector('.cart-close a, .nasa-sidebar-close a');
            if (closeButton) {
                closeButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.hideCartSidebar();
                });
            }
            
            // Setup background click to close
            const blackWindow = document.querySelector('.black-window');
            if (blackWindow) {
                blackWindow.addEventListener('click', () => {
                    this.hideCartSidebar();
                });
            }
        }
    }

    showCartSidebar() {
        if (!this.cartSidebar) return;
        
        // Show background overlay
        const blackWindow = document.querySelector('.black-window');
        if (blackWindow) {
            blackWindow.style.display = 'block';
            blackWindow.classList.add('desk-window');
        }
        
        // Add body class to prevent scrolling
        document.body.classList.add('m-ovhd');
        
        // Show cart sidebar
        this.cartSidebar.classList.add('nasa-active');
        
        // Load cart content if needed
        this.loadCartContent();
    }

    hideCartSidebar() {
        if (!this.cartSidebar) return;
        
        // Hide background overlay
        const blackWindow = document.querySelector('.black-window');
        if (blackWindow) {
            blackWindow.style.display = 'none';
            blackWindow.classList.remove('desk-window');
        }
        
        // Remove body class
        document.body.classList.remove('m-ovhd');
        
        // Hide cart sidebar
        this.cartSidebar.classList.remove('nasa-active');
    }

    loadCartContent() {
    const cartContent = this.cartSidebar.querySelector('.widget_shopping_cart_content');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', window.location.origin + '/?wc-ajax=get_refreshed_fragments');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                this.updateCartFragments(response.fragments);
                // ✅ Show cart only after content loads
                this.displayCartSidebar();
            } catch (e) {
                console.error('Error parsing cart content:', e);
            }
        }
    };

    xhr.onerror = () => {
        console.error('Failed to load cart content.');
    };

    xhr.send();
}


    updateCartFragments(fragments = null) {
        if (!fragments) {
            // Trigger a refresh of cart fragments
            this.loadCartContent();
            return;
        }
        
        // Update each fragment
        Object.keys(fragments).forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.innerHTML = fragments[selector];
            });
        });
        
        // Re-initialize any new elements that need it
        this.initializeNewElements();
    }

    initializeNewElements() {
        // Re-setup quantity controls for new cart items
        this.setupQuantityControls();
        
        // Setup any new variation forms that might have been added
        const newForms = document.querySelectorAll('.variations_form:not([data-initialized])');
        newForms.forEach(form => {
            form.setAttribute('data-initialized', 'true');
            this.setupForm(form);
        });
    }

    setupQuantityControls() {
        // Setup plus/minus buttons for quantity inputs
        const quantityControls = document.querySelectorAll('.quantity');
        
        quantityControls.forEach(control => {
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
                        input.dispatchEvent(new Event('change'));
                    }
                });
            }
            
            if (input && minusButton && !minusButton.hasAttribute('data-initialized')) {
                minusButton.setAttribute('data-initialized', 'true');
                minusButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentValue = parseInt(input.value) || 0;
                    const min = parseInt(input.getAttribute('min')) || 1;
                    if (currentValue > min) {
                        input.value = currentValue - 1;
                        input.dispatchEvent(new Event('change'));
                    }
                });
            }
        });
    }

    triggerEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        
        if (this.form) {
            this.form.dispatchEvent(event);
        } else {
            document.dispatchEvent(event);
        }
    }
}

// Initialize when DOM is ready
const wooVariations = new WooCommerceVariations();

// Export for global access if needed
window.WooCommerceVariations = WooCommerceVariations;

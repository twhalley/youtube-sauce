// Function to create and inject the sauce dropdown menu
function createSauceMenu() {
    // Check if we're on a video page and the menu doesn't already exist
    if (!window.location.pathname.startsWith('/watch') || document.getElementById('sauce-menu')) {
        return;
    }

    // Create the main container
    const sauceContainer = document.createElement('div');
    sauceContainer.id = 'sauce-menu';
    sauceContainer.className = 'sauce-container';

    // Create the dropdown button to match YouTube's style
    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'sauce-dropdown-btn yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m';
    dropdownButton.innerHTML = `
        <div class="sauce-btn-content">
            <div class="sauce-icon">🔍</div>
            <span class="sauce-text">Sources</span>
            <span class="sauce-count"></span>
        </div>
    `;
    
    // Create the dropdown content
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'sauce-dropdown-content';
    dropdownContent.style.display = 'none';

    // Add submit button with matching YouTube style
    const submitButton = document.createElement('button');
    submitButton.className = 'sauce-dropdown-btn yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m';
    submitButton.innerHTML = `
        <div class="sauce-btn-content">
            <div class="sauce-icon">+</div>
            <span class="sauce-text">Add Source</span>
        </div>
    `;
    submitButton.onclick = showSubmitForm;

    // Add the elements to the container
    sauceContainer.appendChild(dropdownButton);
    sauceContainer.appendChild(dropdownContent);
    sauceContainer.appendChild(submitButton);

    // Find YouTube's like button container and insert our menu before the like button
    const topLevelButtons = document.querySelector('#top-level-buttons-computed');
    if (topLevelButtons) {
        const segmentedLikeDislike = topLevelButtons.querySelector('ytd-segmented-like-dislike-button-renderer #segmented-like-button');
        if (segmentedLikeDislike) {
            topLevelButtons.insertBefore(sauceContainer, segmentedLikeDislike.parentElement);
        } else {
            // Fallback to inserting before the first button if specific element not found
            topLevelButtons.insertBefore(sauceContainer, topLevelButtons.firstChild);
        }
    }

    // Toggle dropdown on click
    dropdownButton.onclick = () => {
        const isHidden = dropdownContent.style.display === 'none';
        dropdownContent.style.display = isHidden ? 'block' : 'none';
        loadSources();

        if (isHidden) {
            // Add click event listener to close dropdown when clicking outside
            const closeDropdown = (event) => {
                if (!sauceContainer.contains(event.target)) {
                    dropdownContent.style.display = 'none';
                    document.removeEventListener('click', closeDropdown);
                }
            };
            // Use setTimeout to avoid immediate trigger of the event
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 0);
        }
    };

    // Load initial sources and update count
    loadSources();
    updateSourceCount();
}

// Function to update the source count on the button
function updateSourceCount() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) return;

    browser.storage.local.get(videoId).then((result) => {
        const sources = result[videoId] || [];
        const countElement = document.querySelector('.sauce-count');
        if (countElement) {
            countElement.textContent = sources.length > 0 ? sources.length : '';
        }
    });
}

// Function to validate and format timestamp
function validateTimestamp(input) {
    // Remove any whitespace
    input = input.trim();
    
    if (input === '') return { isValid: true, value: '' };

    // Match different timestamp formats: HH:MM:SS, MM:SS, or SS
    const timeFormats = [
        /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/, // HH:MM:SS
        /^(\d{1,2}):(\d{1,2})$/,           // MM:SS
        /^(\d{1,2})$/                       // SS
    ];

    let hours = 0, minutes = 0, seconds = 0;

    // Try each format
    for (let format of timeFormats) {
        const match = input.match(format);
        if (match) {
            if (match.length === 4) { // HH:MM:SS
                hours = parseInt(match[1]);
                minutes = parseInt(match[2]);
                seconds = parseInt(match[3]);
            } else if (match.length === 3) { // MM:SS
                minutes = parseInt(match[1]);
                seconds = parseInt(match[2]);
            } else if (match.length === 2) { // SS
                seconds = parseInt(match[1]);
            }

            // Validate ranges
            if (hours > 23 || minutes > 59 || seconds > 59) {
                return {
                    isValid: false,
                    error: 'Invalid time values. Hours must be 0-23, minutes and seconds must be 0-59.'
                };
            }

            // Format the timestamp consistently
            let formattedTime = '';
            if (hours > 0) {
                formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else if (minutes > 0 || seconds > 0) {
                formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                formattedTime = '0:00';
            }

            return { isValid: true, value: formattedTime };
        }
    }

    return {
        isValid: false,
        error: 'Invalid format. Use HH:MM:SS, MM:SS, or SS'
    };
}

// Function to validate timestamp range
function validateTimestampRange(fromTime, toTime) {
    if (!fromTime && !toTime) return true;

    const from = fromTime ? convertTimestampToSeconds(fromTime) : 0;
    const to = toTime ? convertTimestampToSeconds(toTime) : Infinity;

    return from <= to;
}

// Function to convert timestamp to seconds
function convertTimestampToSeconds(timestamp) {
    if (!timestamp) return 0;
    
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 3) { // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
        return parts[0] * 60 + parts[1];
    } else { // SS
        return parts[0];
    }
}

// Function to set timestamp from current video time
function setTimestamp(type, index) {
    console.log('setTimestamp called with:', type, index);
    
    const timestampInput = document.getElementById(`source-timestamp-${type}-${index}`);
    console.log('Found input:', timestampInput);
    
    if (!timestampInput) {
        console.error('Could not find timestamp input');
        return;
    }

    // Find the error display element within the timestamp container
    const timestampContainer = timestampInput.closest('.sauce-timestamp-container');
    const errorDisplay = timestampContainer ? timestampContainer.nextElementSibling : null;
    
    if (!errorDisplay || !errorDisplay.classList.contains('sauce-timestamp-error')) {
        console.error('Could not find error display element');
        return;
    }
    
    // Get the current value from the input
    const timestamp = timestampInput.value.trim();
    console.log('Current timestamp value:', timestamp);
    
    // Clear previous error states
    timestampInput.classList.remove('sauce-input-error');
    errorDisplay.style.display = 'none';
    errorDisplay.textContent = '';

    // Validate the timestamp
    const result = validateTimestamp(timestamp);
    console.log('Validation result:', result);
    
    if (!result.isValid) {
        errorDisplay.textContent = result.error;
        errorDisplay.style.display = 'block';
        timestampInput.classList.add('sauce-input-error');
        return;
    }

    // Get the other input for range validation
    const otherType = type === 'from' ? 'to' : 'from';
    const otherInput = document.getElementById(`source-timestamp-${otherType}-${index}`);
    console.log('Other input:', otherInput);

    // Validate range if both inputs have values
    if (otherInput && otherInput.value) {
        const fromTime = type === 'from' ? result.value : otherInput.value;
        const toTime = type === 'to' ? result.value : otherInput.value;
        
        const fromSeconds = convertTimestampToSeconds(fromTime);
        const toSeconds = convertTimestampToSeconds(toTime);
        console.log('Time range validation:', { fromSeconds, toSeconds });

        if (fromSeconds > toSeconds) {
            timestampInput.classList.add('sauce-input-error');
            otherInput.classList.add('sauce-input-error');
            errorDisplay.textContent = 'End time must be after start time';
            errorDisplay.style.display = 'block';
            return;
        }
    }

    // Set the formatted timestamp and make input read-only
    timestampInput.value = result.value;
    timestampInput.setAttribute('readonly', '');
    timestampInput.classList.add('sauce-timestamp-set');
    console.log('Timestamp set and locked:', result.value);
}

// Add input validation to timestamp fields
function addTimestampValidation(index) {
    const fromInput = document.getElementById(`source-timestamp-from-${index}`);
    const toInput = document.getElementById(`source-timestamp-to-${index}`);
    const errorDisplay = fromInput.parentNode.parentNode.parentNode.querySelector('.sauce-timestamp-error');
    let validationTimeout;

    function validateAndUpdateTimestamp(input, immediate = false) {
        // Clear any existing timeout
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }

        // Remove error states immediately when user starts typing
        input.classList.remove('sauce-input-error');
        errorDisplay.textContent = '';
        errorDisplay.style.display = 'none';

        // If immediate validation is requested (e.g., on blur or submit)
        if (immediate) {
            performValidation(input);
        } else {
            // Set a new timeout for validation
            validationTimeout = setTimeout(() => {
                performValidation(input);
            }, 1000); // Wait 1 second after user stops typing
        }
    }

    function performValidation(input) {
        const result = validateTimestamp(input.value);
        const otherInput = input === fromInput ? toInput : fromInput;

        if (!result.isValid && input.value !== '') {
            input.classList.add('sauce-input-error');
            errorDisplay.textContent = result.error;
            errorDisplay.style.display = 'block';
            return false;
        }

        // Update input with formatted value if valid
        if (result.isValid && input.value !== '') {
            input.value = result.value;
        }

        // Validate range if both inputs have values
        if (input.value && otherInput.value) {
            const isValidRange = validateTimestampRange(fromInput.value, toInput.value);
            if (!isValidRange) {
                input.classList.add('sauce-input-error');
                otherInput.classList.add('sauce-input-error');
                errorDisplay.textContent = 'End time must be after start time';
                errorDisplay.style.display = 'block';
                return false;
            }
        }

        return true;
    }

    // Add validation on input (with delay)
    fromInput.addEventListener('input', () => validateAndUpdateTimestamp(fromInput, false));
    toInput.addEventListener('input', () => validateAndUpdateTimestamp(toInput, false));

    // Add immediate validation on blur
    fromInput.addEventListener('blur', () => validateAndUpdateTimestamp(fromInput, true));
    toInput.addEventListener('blur', () => validateAndUpdateTimestamp(toInput, true));
}

// Function to create a source input group
function createSourceInputGroup(index, container) {
    const group = document.createElement('div');
    group.className = 'sauce-source-group';
    group.innerHTML = `
        <div class="sauce-source-header">
            <h4>Source ${index + 1}</h4>
            ${index > 0 ? '<button type="button" class="sauce-remove-source" onclick="this.closest(\'.sauce-source-group\').remove()">Remove</button>' : ''}
        </div>
        <div class="sauce-input-group">
            <label for="source-url-${index}">Original URL</label>
            <textarea id="source-url-${index}" class="sauce-url-input" rows="8" placeholder="Paste your source URL here. Examples:

https://www.youtube.com/watch?v=...
https://twitter.com/username/status/...
https://nitter.net/username/status/...
https://reddit.com/r/subreddit/comments/...
https://archive.is/...
https://web.archive.org/web/...
https://odysee.com/@channel/...
https://rumble.com/..."></textarea>
        </div>
        <div class="sauce-input-group">
            <label>Timestamp Range in Current Video</label>
            <div class="sauce-timestamp-container">
                <div class="sauce-timestamp-range">
                    <div class="sauce-timestamp-field">
                        <label for="source-timestamp-from-${index}">From:</label>
                        <input type="text" id="source-timestamp-from-${index}" class="sauce-timestamp-input" placeholder="0:00">
                        <button type="button" class="sauce-set-timestamp" data-type="from" data-index="${index}">Lock</button>
                    </div>
                    <div class="sauce-timestamp-field">
                        <label for="source-timestamp-to-${index}">To:</label>
                        <input type="text" id="source-timestamp-to-${index}" class="sauce-timestamp-input" placeholder="0:00">
                        <button type="button" class="sauce-set-timestamp" data-type="to" data-index="${index}">Lock</button>
                    </div>
                </div>
            </div>
            <div class="sauce-timestamp-error"></div>
        </div>
        <div class="sauce-input-group">
            <label for="source-description-${index}">Description</label>
            <textarea id="source-description-${index}" class="sauce-description-input" rows="6" placeholder="Describe the source content. Examples:

- Original video before it was deleted/edited
- Mirror of the deleted content
- Archive of the original post/thread
- Reddit discussion about the topic
- News article covering the event
- Original social media post"></textarea>
        </div>
    `;
    
    // Add click handlers for the lock buttons
    const lockButtons = group.querySelectorAll('.sauce-set-timestamp');
    lockButtons.forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            const index = parseInt(this.dataset.index);
            console.log('Lock button clicked:', { type, index });
            setTimestamp(type, index);
        });
    });

    container.appendChild(group);
    addTimestampValidation(index);
}

// Function to show the submit form
function showSubmitForm() {
    // Remove any existing forms first
    const existingForm = document.querySelector('.sauce-submit-form');
    if (existingForm) {
        existingForm.remove();
    }

    const form = document.createElement('div');
    form.className = 'sauce-submit-form';

    form.innerHTML = `
        <div class="sauce-submit-form-content">
            <h3>Submit Source Videos</h3>
            <div class="sauce-form-inputs" id="sauce-sources-container">
                <!-- Source input groups will be added here -->
            </div>
            <button type="button" class="sauce-add-source">
                <span style="font-size: 20px;">+</span>
                Add Another Source
            </button>
            <div class="sauce-form-buttons">
                <button onclick="submitSource()" class="sauce-submit">Submit</button>
                <button onclick="this.closest('.sauce-submit-form').remove()" class="sauce-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    document.getElementById('sauce-menu').appendChild(form);

    // Add the first source input group
    const sourcesContainer = form.querySelector('#sauce-sources-container');
    createSourceInputGroup(0, sourcesContainer);

    // Add click handler for the Add Another Source button
    const addSourceButton = form.querySelector('.sauce-add-source');
    addSourceButton.onclick = addNewSourceGroup;

    // Function to handle clicks outside the form
    function handleClickOutside(event) {
        if (!form.contains(event.target) && !event.target.closest('.sauce-dropdown-btn')) {
            form.remove();
            document.removeEventListener('click', handleClickOutside);
        }
    }

    // Add click event listener with a delay
    requestAnimationFrame(() => {
        document.addEventListener('click', handleClickOutside);
    });

    // Cleanup when form is removed
    form.addEventListener('remove', () => {
        document.removeEventListener('click', handleClickOutside);
    });
}

// Function to add a new source input group
function addNewSourceGroup() {
    const container = document.getElementById('sauce-sources-container');
    const currentCount = container.getElementsByClassName('sauce-source-group').length;
    createSourceInputGroup(currentCount, container);
    
    // Get the form content container and scroll to the bottom
    const formContent = document.querySelector('.sauce-submit-form-content');
    if (formContent) {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
            formContent.scrollTop = formContent.scrollHeight;
        });
    }
}

// Function to submit sources
function submitSource() {
    const form = document.querySelector('.sauce-submit-form');
    const sourceGroups = form.getElementsByClassName('sauce-source-group');
    const sources = [];

    // Validate all timestamps before submitting
    let hasValidationErrors = false;
    for (const group of sourceGroups) {
        const fromInput = group.querySelector(`input[id^="source-timestamp-from"]`);
        const toInput = group.querySelector(`input[id^="source-timestamp-to"]`);

        if (fromInput.value || toInput.value) {
            const fromResult = validateTimestamp(fromInput.value);
            const toResult = validateTimestamp(toInput.value);

            if (!fromResult.isValid || !toResult.isValid) {
                hasValidationErrors = true;
                break;
            }

            if (!validateTimestampRange(fromResult.value, toResult.value)) {
                hasValidationErrors = true;
                break;
            }
        }
    }

    if (hasValidationErrors) {
        alert('Please fix the timestamp validation errors before submitting.');
        return;
    }

    // Collect all source data
    for (const group of sourceGroups) {
        const urlInput = group.querySelector('.sauce-url-input');
        const timestampFromInput = group.querySelector(`input[id^="source-timestamp-from"]`);
        const timestampToInput = group.querySelector(`input[id^="source-timestamp-to"]`);
        const descInput = group.querySelector('.sauce-description-input');
        
        if (urlInput.value.trim() && descInput.value.trim()) {
            sources.push({
                url: urlInput.value.trim(),
                timestampFrom: timestampFromInput.value.trim(),
                timestampTo: timestampToInput.value.trim(),
                description: descInput.value.trim(),
                submitTime: new Date().toISOString()
            });
        }
    }

    if (sources.length === 0) {
        alert('Please add at least one valid source with both URL and description.');
        return;
    }

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) return;

    // Get existing sources from storage
    browser.storage.local.get(videoId).then((result) => {
        const existingSources = result[videoId] || [];
        const updatedSources = existingSources.concat(sources);
        
        // Save updated sources
        browser.storage.local.set({ [videoId]: updatedSources }).then(() => {
            loadSources();
            updateSourceCount();
            form.remove();
        });
    });
}

// Function to load and display sources
function loadSources() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    const dropdownContent = document.querySelector('.sauce-dropdown-content');
    
    if (!videoId || !dropdownContent) return;

    browser.storage.local.get(videoId).then((result) => {
        const sources = result[videoId] || [];
        
        if (sources.length === 0) {
            dropdownContent.innerHTML = '<p class="no-sources">No sources found. Be the first to add one!</p>';
        } else {
            dropdownContent.innerHTML = sources.map(source => {
                let timestampText = '';
                if (source.timestampFrom || source.timestampTo) {
                    if (source.timestampFrom && source.timestampTo) {
                        timestampText = `<span class="sauce-video-timestamp">at ${source.timestampFrom} - ${source.timestampTo}</span>`;
                    } else if (source.timestampFrom) {
                        timestampText = `<span class="sauce-video-timestamp">from ${source.timestampFrom}</span>`;
                    } else if (source.timestampTo) {
                        timestampText = `<span class="sauce-video-timestamp">until ${source.timestampTo}</span>`;
                    }
                }
                
                return `
                    <div class="sauce-item">
                        <div class="sauce-item-content">
                            <a href="${source.url}" target="_blank">${source.description}</a>
                            ${timestampText}
                        </div>
                        <span class="sauce-timestamp">${new Date(source.submitTime).toLocaleDateString()}</span>
                    </div>
                `;
            }).join('');
        }
        
        // Update the source count after loading
        updateSourceCount();
    });
}

// Function to observe theme changes
function observeThemeChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'dark') {
                // Theme has changed, no need to do anything as CSS handles it
            }
        });
    });

    // Start observing the html element for dark theme changes
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dark']
    });
}

// Make functions available globally
window.addNewSourceGroup = addNewSourceGroup;
window.submitSource = submitSource;
window.validateTimestamp = validateTimestamp;
window.convertTimestampToSeconds = convertTimestampToSeconds;

// Initialize when the page loads
document.addEventListener('yt-navigate-finish', createSauceMenu);
document.addEventListener('yt-navigate-finish', observeThemeChanges);
createSauceMenu();
observeThemeChanges(); 
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

YouTube: https://www.youtube.com/watch?v=...
Twitter/X: https://twitter.com/username/status/...
Nitter: https://nitter.net/username/status/...
Reddit: https://reddit.com/r/subreddit/comments/...
Archive.is: https://archive.is/...
Web Archive: https://web.archive.org/web/...
Odysee: https://odysee.com/@channel/...
Rumble: https://rumble.com/..."></textarea>
        </div>
        <div class="sauce-input-group">
            <label>Timestamp Range in Current Video</label>
            <div class="sauce-timestamp-container">
                <div class="sauce-timestamp-range">
                    <div class="sauce-timestamp-field">
                        <label for="source-timestamp-from-${index}">From:</label>
                        <input type="text" id="source-timestamp-from-${index}" class="sauce-timestamp-input" placeholder="0:00">
                        <button type="button" class="sauce-fetch-timestamp" onclick="fetchCurrentTimestamp('from', ${index})">Get Current</button>
                    </div>
                    <div class="sauce-timestamp-field">
                        <label for="source-timestamp-to-${index}">To:</label>
                        <input type="text" id="source-timestamp-to-${index}" class="sauce-timestamp-input" placeholder="0:00">
                        <button type="button" class="sauce-fetch-timestamp" onclick="fetchCurrentTimestamp('to', ${index})">Get Current</button>
                    </div>
                </div>
            </div>
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
    container.appendChild(group);
}

// Function to fetch and format current video timestamp
function fetchCurrentTimestamp(type, index) {
    // Find the YouTube video player
    const video = document.querySelector('#movie_player video');
    if (video) {
        const time = Math.floor(video.currentTime);
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = time % 60;
        
        let timestamp = '';
        if (hours > 0) {
            timestamp = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        const timestampInput = document.getElementById(`source-timestamp-${type}-${index}`);
        if (timestampInput) {
            timestampInput.value = timestamp;
        }
    }
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
window.fetchCurrentTimestamp = fetchCurrentTimestamp;

// Initialize when the page loads
document.addEventListener('yt-navigate-finish', createSauceMenu);
document.addEventListener('yt-navigate-finish', observeThemeChanges);
createSauceMenu();
observeThemeChanges(); 
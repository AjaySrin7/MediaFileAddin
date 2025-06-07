let activeObjectURLsForPreviews = [];

const main = (api, session) => {
    let solutionId, mediaFileId, database, userName, sessionId, requestURL;
    let lastCreatedMediaFileId = null;
    let currentMediaIndex = 0;
    let mediaFilesData = [];
    
    // Get DOM elements
    const fileInput = document.getElementById('fileInput');
    const createMediaFileBtn = document.getElementById('createMediaFileBtn');
    const uploadMediaFileBtn = document.getElementById('uploadMediaFileBtn');
    const loadAllMediaFilesBtn = document.getElementById('loadAllMediaFilesBtn');
    const mediaFileSelectDropdown = document.getElementById('mediaFileSelectDropdown');
    const getSpecificMediaFileBtn = document.getElementById('getSpecificMediaFileBtn');
    const getMediaFileByIdDirectlyInput = document.getElementById('getMediaFileByIdDirectlyInput');
    const getMediaFileByIdDirectlyBtn = document.getElementById('getMediaFileByIdDirectlyBtn');
    const setMediaFileBtn = document.getElementById('setMediaFileBtn');
    const setMediaFileIdInput = document.getElementById('setMediaFileIdInput');
    const setMediaFileNameInput = document.getElementById('setMediaFileNameInput');
    const setMediaTypeInput = document.getElementById('setMediaTypeInput');
    const downloadMediaFileBtn = document.getElementById('downloadMediaFileBtn');
    const downloadMediaFileIdInput = document.getElementById('downloadMediaFileIdInput');
    const removeMediaFileBtn = document.getElementById('removeMediaFileBtn');
    const removeMediaFileIdInput = document.getElementById('removeMediaFileIdInput');
    const resultsLog = document.getElementById('resultsLog');
    const mediaScrollerContent = document.getElementById('mediaScrollerContent');
    const scrollPrevBtn = document.getElementById('scrollPrevBtn');
    const scrollNextBtn = document.getElementById('scrollNextBtn');
    
    // Utility functions
    const revokeAllPreviewObjectURLs = () => {
        activeObjectURLsForPreviews.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn("Failed to revoke Object URL:", url, e);
            }
        });
        activeObjectURLsForPreviews = [];
    };
    
    const logResult = (message, data) => {
        const entry = `[${new Date().toLocaleTimeString()}] ${message}${data !== undefined ? ': ' + JSON.stringify(data, null, 2) : ''}\n\n`;
        resultsLog.textContent = entry + resultsLog.textContent;
        console.log(message, data !== undefined ? data : '');
    };
    
    // Initialize session variables
    database = session.database;
    userName = session.userName;
    sessionId = session.sessionId;
    requestURL = `https://${session.server}/apiv1`;
    
    logResult("Session info retrieved", { database, userName, server: session.server });
    
    if (loadAllMediaFilesBtn) loadAllMediaFilesBtn.disabled = false;
    
    // Helper functions
    const generateSolutionId = () => {
        function s4() {
            return Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
        }
        const guid = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
        let encoded = btoa(guid).substring(0, 22).replace(/\//g, '_').replace(/\+/g, '-');
        return 'a' + encoded;
    };
    
    const updateInputFieldsWithId = (id) => {
        if (setMediaFileIdInput) setMediaFileIdInput.value = id;
        if (downloadMediaFileIdInput) downloadMediaFileIdInput.value = id;
        if (removeMediaFileIdInput) removeMediaFileIdInput.value = id;
        if (getMediaFileByIdDirectlyInput) getMediaFileByIdDirectlyInput.value = id;
    };
    
    const refreshAllMediaDataAndUI = async () => {
        // logResult("Refreshing media list and UI...");
        
        if (mediaFileSelectDropdown) mediaFileSelectDropdown.innerHTML = '<option value="">Loading...</option>';
        if (mediaScrollerContent) mediaScrollerContent.innerHTML = '<div style="padding:10px; color:#777; text-align: center; width: 100%;">Loading media previews...</div>';
        
        try {
            const mediaFiles = await getMediaFile();
            mediaFiles.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            
            if (mediaFileSelectDropdown) {
                mediaFileSelectDropdown.innerHTML = '<option value="">-- Select a MediaFile --</option>';
                
                if (mediaFiles && mediaFiles.length > 0) {
                    mediaFiles.forEach(mf => {
                        const option = document.createElement('option');
                        option.value = mf.id;
                        option.textContent = `${mf.name || 'Unnamed File'} (${mf.id.substring(0, 8)}...) - Type: ${mf.mediaType || 'N/A'}`;
                        mediaFileSelectDropdown.add(option);
                    });
                    
                    // logResult(`Dropdown populated with ${mediaFiles.length} items.`);
                    
                    if (lastCreatedMediaFileId && Array.from(mediaFileSelectDropdown.options).some(opt => opt.value === lastCreatedMediaFileId)) {
                        mediaFileSelectDropdown.value = lastCreatedMediaFileId;
                    }
                } else {
                    mediaFileSelectDropdown.innerHTML = '<option value="">No media files found</option>';
                }
                
                if (mediaFileSelectDropdown.value) {
                    updateInputFieldsWithId(mediaFileSelectDropdown.value);
                }
            }
            
            await populateMediaScroller(mediaFiles);
        } catch (error) {
            logResult("Error during media refresh", error);
            if (mediaFileSelectDropdown) mediaFileSelectDropdown.innerHTML = '<option value="">Error loading</option>';
            if (mediaScrollerContent) mediaScrollerContent.innerHTML = '<div style="padding:10px; color:red; text-align:center; width:100%;">Error loading media. Check logs.</div>';
            alert(`Failed to load media files during refresh: ${error.message || JSON.stringify(error)}`);
        }
    };
    
    // API Operations
    const addMediaFile = async (name) => {
        return new Promise((resolve, reject) => {
            const currentSolutionId = generateSolutionId();
            logResult(`Attempting to add MediaFile with name: ${name} and solutionId: ${currentSolutionId}`);
            
            api.call('Add', {
                typeName: 'MediaFile',
                entity: { name: name, solutionId: currentSolutionId }
            }, async (resultId) => {
                lastCreatedMediaFileId = resultId;
                logResult("MediaFile added successfully", { id: resultId, solutionId: currentSolutionId });
                updateInputFieldsWithId(resultId);
                
                if (mediaFileSelectDropdown) {
                    const option = document.createElement('option');
                    option.value = resultId;
                    option.textContent = `${name} (${resultId.substring(0, 8)}...)`;
                    
                    if (mediaFileSelectDropdown.firstChild) {
                        mediaFileSelectDropdown.insertBefore(option, mediaFileSelectDropdown.firstChild);
                    } else {
                        mediaFileSelectDropdown.add(option);
                    }
                    
                    mediaFileSelectDropdown.value = resultId;
                }
                
                resolve(resultId);
                await refreshAllMediaDataAndUI();
            }, (error) => {
                logResult("Error adding MediaFile", error);
                reject(error);
            });
        });
    };
    
    const uploadMediaFile = async (targetMediaFileId) => {
        const inputFile = fileInput.files[0];
        
        if (!inputFile) {
            alert("Please select a file to upload!");
            logResult("Upload aborted: No file selected.");
            return;
        }
        
        if (!targetMediaFileId) {
            alert("MediaFile ID is missing. Please create or select a MediaFile entry first.");
            logResult("Upload aborted: No MediaFile ID.");
            return;
        }
        
        if (!database || !sessionId || !userName || !requestURL) {
            alert("Session information is not available. Please wait or try refreshing.");
            logResult("Upload aborted: Session info missing.");
            return;
        }
        
        logResult(`Uploading file "${inputFile.name}" for mediaFileId: ${targetMediaFileId}`);
        
        const requestParams = {
            method: 'UploadMediaFile',
            params: {
                mediaFile: { id: targetMediaFileId },
                credentials: { database, sessionId, userName }
            }
        };
        
        const formData = new FormData();
        formData.append("JSON-RPC", JSON.stringify(requestParams));
        formData.append("file", inputFile, inputFile.name);
        
        try {
            const response = await fetch(requestURL, { method: 'POST', body: formData });
            const responseText = await response.text();
            
            if (response.ok) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.error) {
                        logResult('File upload failed (API Error)', result.error);
                        alert(`File upload failed: ${result.error.message || 'Unknown API error'}`);
                    } else {
                        logResult('File upload successful', result.result);
                        alert('File uploaded successfully!');
                        await refreshAllMediaDataAndUI();
                    }
                } catch (e) {
                    logResult('File upload response parsing error or non-JSON success', responseText);
                    alert('File uploaded, but response format was unexpected. Check logs.');
                }
            } else {
                logResult('File upload failed (HTTP Error)', { status: response.status, text: responseText });
                alert(`File upload failed: HTTP ${response.status}. Check logs.`);
            }
        } catch (error) {
            logResult('Error during file upload fetch operation', error);
            alert(`Error during file upload: ${error.message || error}`);
        }
    };
    
    const getMediaFile = async (idToGet) => {
        const params = { typeName: "MediaFile" };
        
        if (idToGet) {
            params.search = { id: idToGet };
            logResult(`Attempting to get MediaFile with ID: ${idToGet}`);
        } else {
            logResult("Attempting to get ALL MediaFiles.");
        }
        
        return new Promise((resolve, reject) => {
            api.call("Get", params,
                (result) => {
                    if (idToGet) {
                        if (result && result.length > 0) {
                            logResult("MediaFile retrieved successfully", result[0]);
                            resolve(result[0]);
                        } else {
                            logResult("MediaFile not found or no result for ID:", idToGet);
                            reject(new Error(`MediaFile with ID ${idToGet} not found.`));
                        }
                    } else {
                        logResult(`Retrieved ${result.length} MediaFile(s) successfully`, result);
                        resolve(result);
                    }
                }, (error) => {
                    logResult("API call failed for Get MediaFile", error);
                    reject(error);
                });
        });
    };
    
    const setMediaFile = async (idToSet, updateEntity) => {
        if (!idToSet) {
            alert("Please provide a MediaFile ID to update.");
            return Promise.reject(new Error("No ID provided for Set."));
        }
        
        if (!updateEntity || Object.keys(updateEntity).length === 0) {
            alert("No update information provided for Set MediaFile.");
            return Promise.reject(new Error("No update entity provided for Set."));
        }
        
        const entityToSet = { id: idToSet, ...updateEntity };
        logResult(`Attempting to set/update MediaFile ID: ${idToSet}`, entityToSet);
        
        return new Promise((resolve, reject) => {
            api.call("Set", {
                typeName: "MediaFile",
                entity: entityToSet,
            }, async () => {
                logResult("MediaFile updated successfully", { id: idToSet, updates: updateEntity });
                resolve();
                await refreshAllMediaDataAndUI();
            }, (error) => {
                logResult("Failed to set/update MediaFile", error);
                reject(error);
            });
        });
    };
    
    const fetchMediaFileBlobForPreviewOrDownload = async (mediaFileId) => {
        if (!database || !sessionId || !userName || !requestURL) {
            logResult("Session information is not available for file operations.");
            return null;
        }
        
        const requestParams = {
            method: 'DownloadMediaFile',
            params: {
                mediaFile: { id: mediaFileId },
                credentials: { database, sessionId, userName }
            }
        };
        
        try {
            const response = await fetch(requestURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestParams)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logResult("File blob fetch failed (HTTP Error)", { mediaFileId, status: response.status, errorText });
                return null;
            }
            
            return await response.blob();
        } catch (err) {
            logResult('Error during file blob fetch operation', { mediaFileId, error: err });
            return null;
        }
    };
    
    const downloadMediaFile = async (idToDownload) => {
        if (!idToDownload) {
            alert("Please provide a MediaFile ID to download.");
            return;
        }
        
        logResult(`Attempting to download MediaFile ID: ${idToDownload}`);
        
        let fileNameToDownload = `mediafile_${idToDownload}.bin`;
        
        try {
            const mediaInfo = await getMediaFile(idToDownload);
            if (mediaInfo && mediaInfo.name) fileNameToDownload = mediaInfo.name;
        } catch (err) {
            logResult("Could not fetch media file name for download, using default.", err);
        }
        
        const blob = await fetchMediaFileBlobForPreviewOrDownload(idToDownload);
        
        if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileNameToDownload;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            logResult('File download initiated successfully.', { fileName: fileNameToDownload });
        } else {
            alert(`Failed to fetch file data for download: ${idToDownload}. Check logs.`);
        }
    };
    
    const removeMediaFile = async (idToRemove) => {
        if (!idToRemove) {
            alert("Please provide a MediaFile ID to remove.");
            return Promise.reject(new Error("No ID provided for Remove."));
        }
        
        logResult(`Attempting to remove MediaFile with ID: ${idToRemove}`);
        
        return new Promise((resolve, reject) => {
            api.call("Remove", {
                typeName: "MediaFile",
                entity: { id: idToRemove }
            }, async () => {
                logResult("MediaFile removed successfully", { id: idToRemove });
                
                if (lastCreatedMediaFileId === idToRemove) lastCreatedMediaFileId = null;
                
                if (mediaFileSelectDropdown) {
                    const option = Array.from(mediaFileSelectDropdown.options).find(opt => opt.value === idToRemove);
                    if (option) option.remove();
                }
                
                ['setMediaFileIdInput', 'downloadMediaFileIdInput', 'removeMediaFileIdInput', 'getMediaFileByIdDirectlyInput'].forEach(inputId => {
                    const inputElement = document.getElementById(inputId);
                    if (inputElement && inputElement.value === idToRemove) inputElement.value = '';
                });
                
                await refreshAllMediaDataAndUI();
                resolve();
            }, (e) => {
                logResult("Failed to remove MediaFile", e);
                reject(e);
            });
        });
    };
    
    // UI Update Functions
    const updateScrollerDisplay = () => {
        const mediaItems = mediaScrollerContent.querySelectorAll('.media-item');
        
        if (mediaItems.length === 0) {
            if (scrollPrevBtn) scrollPrevBtn.disabled = true;
            if (scrollNextBtn) scrollNextBtn.disabled = true;
            return;
        }
        
        mediaItems.forEach((item, index) => {
            const videoElement = item.querySelector('video.media-item-preview');
            
            if (index === currentMediaIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
                if (videoElement && !videoElement.paused) {
                    videoElement.pause();
                }
            }
        });
        
        if (scrollPrevBtn) scrollPrevBtn.disabled = currentMediaIndex === 0;
        if (scrollNextBtn) scrollNextBtn.disabled = currentMediaIndex === mediaItems.length - 1;
        
        if (mediaItems[currentMediaIndex]) {
            const currentMediaId = mediaItems[currentMediaIndex].getAttribute('data-mediafile-id');
            updateInputFieldsWithId(currentMediaId);
            
            if (mediaFileSelectDropdown && mediaFileSelectDropdown.value !== currentMediaId) {
                mediaFileSelectDropdown.value = currentMediaId;
            }
        }
    };
    
    const populateMediaScroller = async (mediaFiles) => {
        if (!mediaScrollerContent) return;
        
        revokeAllPreviewObjectURLs();
        mediaFilesData = mediaFiles;
        currentMediaIndex = 0;
        mediaScrollerContent.innerHTML = '';
        
        if (!mediaFiles || mediaFiles.length === 0) {
            mediaScrollerContent.innerHTML = '<div style="padding:10px; color:#777; text-align: center; width: 100%;">No media files found. Click "Load All..."</div>';
            if (scrollPrevBtn) scrollPrevBtn.disabled = true;
            if (scrollNextBtn) scrollNextBtn.disabled = true;
            return;
        }
        
        // logResult(`Populating scroller with ${mediaFiles.length} items. Fetching previews if applicable...`);
        
        for (const mf of mediaFiles) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('media-item');
            itemDiv.setAttribute('data-mediafile-id', mf.id);
            itemDiv.title = `Name: ${mf.name || 'N/A'}\nID: ${mf.id}\nType: ${mf.mediaType || 'N/A'}`;
            
            const previewContainer = document.createElement('div');
            previewContainer.classList.add('media-preview-container');
            
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('media-item-name');
            nameSpan.textContent = mf.name || 'Unnamed File';
            
            const isImage = (mf.mediaType && mf.mediaType.startsWith('image/')) ||
                (mf.name && /\.(jpe?g|png|gif|bmp|webp)$/i.test(mf.name));
            const isVideo = (mf.mediaType && mf.mediaType.startsWith('video/')) ||
                (mf.name && /\.(mp4|webm|ogv|mov|avi|mkv)$/i.test(mf.name));
            
            if (isImage) {
                const imgPlaceholder = document.createElement('div');
                imgPlaceholder.classList.add('media-item-img-placeholder');
                imgPlaceholder.textContent = 'Loading image...';
                previewContainer.appendChild(imgPlaceholder);
                
                fetchMediaFileBlobForPreviewOrDownload(mf.id).then(blob => {
                    if (blob) {
                        const img = document.createElement('img');
                        img.classList.add('media-item-preview');
                        const objectURL = URL.createObjectURL(blob);
                        activeObjectURLsForPreviews.push(objectURL);
                        img.src = objectURL;
                        img.alt = mf.name || 'Image Preview';
                        
                        img.onerror = () => {
                            imgPlaceholder.textContent = 'Image Preview N/A';
                            logResult("No image preview for " + mf.id, { src: objectURL });
                        };
                        
                        imgPlaceholder.replaceWith(img);
                    } else {
                        imgPlaceholder.textContent = 'Image Preview N/A';
                        logResult("Failed to fetch blob for image preview: " + mf.id);
                    }
                }).catch(err => {
                    imgPlaceholder.textContent = 'Image Preview Error';
                    logResult("Error fetching/displaying image preview for " + mf.id, err);
                });
            } else if (isVideo) {
                const videoPlaceholder = document.createElement('div');
                videoPlaceholder.classList.add('media-item-img-placeholder');
                videoPlaceholder.textContent = 'Loading video...';
                previewContainer.appendChild(videoPlaceholder);
                
                fetchMediaFileBlobForPreviewOrDownload(mf.id).then(blob => {
                    if (blob) {
                        const video = document.createElement('video');
                        video.classList.add('media-item-preview');
                        video.setAttribute('controls', '');
                        video.setAttribute('preload', 'metadata');
                        const objectURL = URL.createObjectURL(blob);
                        activeObjectURLsForPreviews.push(objectURL);
                        video.src = objectURL;
                        
                        video.onerror = (e) => {
                            videoPlaceholder.textContent = 'Video Preview N/A';
                            let errorDetails = 'Unknown error';
                            
                            if (e && e.target && e.target.error) {
                                switch (e.target.error.code) {
                                    case e.target.error.MEDIA_ERR_ABORTED:
                                        errorDetails = 'Video playback aborted.';
                                        break;
                                    case e.target.error.MEDIA_ERR_NETWORK:
                                        errorDetails = 'A network error caused video download to fail.';
                                        break;
                                    case e.target.error.MEDIA_ERR_DECODE:
                                        errorDetails = 'Video playback aborted due to decoding error.';
                                        break;
                                    case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                        errorDetails = 'Video source not supported or format issue.';
                                        break;
                                    default:
                                        errorDetails = `An unknown error occurred (Code: ${e.target.error.code}).`;
                                }
                            }
                            
                            logResult("Error loading video preview for " + mf.id, { src: objectURL, error: errorDetails });
                        };
                        
                        videoPlaceholder.replaceWith(video);
                    } else {
                        videoPlaceholder.textContent = 'Video Preview N/A';
                        logResult("Failed to fetch blob for video preview: " + mf.id);
                    }
                }).catch(err => {
                    videoPlaceholder.textContent = 'Video Preview Error';
                    logResult("Error fetching/displaying video preview for " + mf.id, err);
                });
            }
            
            itemDiv.appendChild(previewContainer);
            itemDiv.appendChild(nameSpan);
            
            itemDiv.addEventListener('click', () => {
                logResult(`Media item clicked in scroller: ${mf.id} - ${mf.name}`);
                const clickedIndex = Array.from(mediaScrollerContent.children).indexOf(itemDiv);
                if (clickedIndex !== -1) {
                    currentMediaIndex = clickedIndex;
                    updateScrollerDisplay();
                }
                if (mediaFileSelectDropdown) mediaFileSelectDropdown.value = mf.id;
                updateInputFieldsWithId(mf.id);
            });
            
            mediaScrollerContent.appendChild(itemDiv);
        }
        
        updateScrollerDisplay();
    };
    
    // Event Listeners
    if (loadAllMediaFilesBtn) {
        loadAllMediaFilesBtn.addEventListener('click', async () => {
            // logResult("Load All MediaFiles button clicked.");
            await refreshAllMediaDataAndUI();
        });
    }
    
    if (mediaFileSelectDropdown) {
        mediaFileSelectDropdown.addEventListener('change', (event) => {
            const selectedId = event.target.value;
            if (selectedId) {
                logResult(`MediaFile selected in dropdown: ${selectedId}`);
                updateInputFieldsWithId(selectedId);
                
                const index = mediaFilesData.findIndex(mf => mf.id === selectedId);
                if (index !== -1) {
                    currentMediaIndex = index;
                    updateScrollerDisplay();
                }
            }
        });
    }
    
    if (scrollPrevBtn) {
        scrollPrevBtn.addEventListener('click', () => {
            if (currentMediaIndex > 0) {
                currentMediaIndex--;
                updateScrollerDisplay();
            }
        });
    }
    
    if (scrollNextBtn) {
        scrollNextBtn.addEventListener('click', () => {
            if (currentMediaIndex < mediaFilesData.length - 1) {
                currentMediaIndex++;
                updateScrollerDisplay();
            }
        });
    }
    
    if (createMediaFileBtn) {
        createMediaFileBtn.addEventListener('click', async () => {
            const fileName = fileInput.files[0]?.name || `NewMediaFile_${new Date().getTime()}.txt`;
            await addMediaFile(fileName);
        });
    }
    
    if (uploadMediaFileBtn) {
        uploadMediaFileBtn.addEventListener('click', async () => {
            const targetId = mediaFileSelectDropdown.value || lastCreatedMediaFileId || getMediaFileByIdDirectlyInput.value.trim() || null;
            
            if (!targetId && !lastCreatedMediaFileId) {
                alert("No MediaFile target ID specified for upload. Please create or select a MediaFile.");
                logResult("Upload aborted: No target MediaFile ID for upload.");
                return;
            }
            
            await uploadMediaFile(targetId || lastCreatedMediaFileId);
        });
    }
    
    if (getSpecificMediaFileBtn) {
        getSpecificMediaFileBtn.addEventListener('click', async () => {
            const selectedId = mediaFileSelectDropdown.value;
            if (selectedId) {
                await getMediaFile(selectedId);
            } else {
                alert("Please select a MediaFile from the dropdown first.");
            }
        });
    }
    
    if (getMediaFileByIdDirectlyBtn) {
        getMediaFileByIdDirectlyBtn.addEventListener('click', async () => {
            const idToGet = getMediaFileByIdDirectlyInput.value.trim();
            if (idToGet) {
                try {
                    const result = await getMediaFile(idToGet);
                    let foundInDropdown = false;
                    
                    if (mediaFileSelectDropdown) {
                        for (let i = 0; i < mediaFileSelectDropdown.options.length; i++) {
                            if (mediaFileSelectDropdown.options[i].value === idToGet) {
                                mediaFileSelectDropdown.value = idToGet;
                                foundInDropdown = true;
                                break;
                            }
                        }
                    }
                    
                    updateInputFieldsWithId(idToGet);
                    
                    const index = mediaFilesData.findIndex(mf => mf.id === idToGet);
                    if (index !== -1) {
                        currentMediaIndex = index;
                        updateScrollerDisplay();
                    } else if (!foundInDropdown) {
                        logResult(`MediaFile ${idToGet} details logged. It is not currently in the scroller/dropdown view. Click "Load All..." to refresh if needed.`);
                    }
                } catch (error) {
                    alert(`Failed to get MediaFile by ID: ${error.message || JSON.stringify(error)}`);
                }
            } else {
                alert("Please enter a MediaFile ID to get directly.");
            }
        });
    }
    
    if (setMediaFileBtn) {
        setMediaFileBtn.addEventListener('click', async () => {
            const idToSet = setMediaFileIdInput.value.trim();
            const newName = setMediaFileNameInput.value.trim();
            const newMediaType = setMediaTypeInput.value.trim();
            
            const updates = {};
            if (newName) updates.name = newName;
            if (newMediaType) updates.mediaType = newMediaType;
            
            if (Object.keys(updates).length > 0 && idToSet) {
                await setMediaFile(idToSet, updates);
            } else if (!idToSet) {
                alert("Please enter MediaFile ID to update.");
            } else {
                alert("Please enter new name or media type to update.");
            }
        });
    }
    
    if (downloadMediaFileBtn) {
        downloadMediaFileBtn.addEventListener('click', async () => {
            const idToDownload = downloadMediaFileIdInput.value.trim();
            await downloadMediaFile(idToDownload);
        });
    }
    
    if (removeMediaFileBtn) {
        removeMediaFileBtn.addEventListener('click', async () => {
            const idToRemove = removeMediaFileIdInput.value.trim();
            if (idToRemove && confirm(`Are you sure you want to remove MediaFile with ID: ${idToRemove}?`)) {
                await removeMediaFile(idToRemove);
            } else if (!idToRemove) {
                alert("Please enter a MediaFile ID to remove.");
            }
        });
    }
};
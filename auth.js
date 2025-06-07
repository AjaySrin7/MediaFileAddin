// Code to be run when the application is run as standalone html
const outsideMyG = () => {

    const waitForElements = (elementIds, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const poller = setInterval(() => {
                const foundElements = elementIds.reduce((acc, id) => {
                    const el = document.getElementById(id);
                    if (el) {
                        acc[id] = el;
                    }
                    return acc;
                }, {});

                if (Object.keys(foundElements).length === elementIds.length) {
                    clearInterval(poller);
                    clearTimeout(timeoutId);
                    resolve(foundElements);
                }
            }, 100); // Poll every 100ms

            const timeoutId = setTimeout(() => {
                clearInterval(poller);
                reject(new Error(`Timed out waiting for elements: ${elementIds.join(', ')}`));
            }, timeout);
        });
    };

 // show login form to get credentials
    const initialize = async () => {
        try {
            const { loginModal, loginForm } = await waitForElements(['loginModal', 'loginForm']);
            loginModal.style.display = 'block';
            loginForm.addEventListener('submit', handleFormSubmit);
        } catch (error) {
            console.warn(`${error.message}, falling back to prompts.`);
            handlePromptLogin();
        }
    };

   

    async function handleFormSubmit(event) {
        event.preventDefault();
        const credentials = {
            database: document.getElementById('database').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            path: document.getElementById('path').value
        };
        await attemptLogin(credentials, 'form');
    }

    async function handlePromptLogin() {
        const credentials = {
            database: prompt("Enter Database:"),
            username: prompt("Enter Username:"),
            password: prompt("Enter Password:"),
            path: prompt("Enter Server Path (e.g., https://my.geotab.com):")
        };

        if (Object.values(credentials).every(val => val)) {
            await attemptLogin(credentials, 'prompt');
        } else {
            alert("Login cancelled or one or more fields were empty.");
        }
    }

    async function attemptLogin(credentials, source) {
        try {
            console.log(`Attempting login via ${source}...`);
            const success = await loadGeotabApi(credentials);
            if (success) {
                console.log(`Login successful via ${source}.`);
                if (source === 'form') {
                    document.getElementById('loginModal').style.display = 'none';
                    document.querySelector('.logs-container').style.display = 'flex';
                }
            }
        } catch (error) {
            console.error(`Login failed via ${source}:`, error);
            alert(`Login failed: ${error.message || error}`);
        }
    }

    // load mg-api.js MyGeotab API JS wrapper
    function loadGeotabApi({ database, username, password, path }) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mg-api-js@2.0.1';

            script.onload = async () => {
                try {
                    const api = new GeotabApi({
                        credentials: { database, userName: username, password },
                        path
                    });

                    await api.authenticate();
                    console.log('Authentication success');

                    api.getSession((result) => {
                        if (isError(result) || !result?.credentials?.sessionId) {
                            const error = new Error(result?.message || 'Authentication failed or no session ID received');
                            console.error('Session Error:', error);
                            reject(error);
                            return;
                        }

                        try {
                            const sessionInfo = {
                                ...result.credentials,
                                server: result.path || path
                            };
                            main(api, sessionInfo);
                            resolve(true);
                        } catch (mainError) {
                            console.error('Main execution error:', mainError);
                            reject(new Error(`Application error after login: ${mainError.message}`));
                        }
                    });
                } catch (error) {
                    console.error('Authentication failed:', error);
                    alert('Authentication failed: Please check login credentials');
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error('Failed to load Geotab API script. Check network or CDN URL.');
                console.error(error);
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    function isError(result) {
        return result instanceof Error ||
            (result && result.name === 'Error') ||
            (result && result.message && !result.credentials);
    }

    // Start the login initialization process
    initialize();
};

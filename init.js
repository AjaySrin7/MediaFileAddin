var sessionInfo = null;
    
    if (window.geotab) {

                // document.addEventListener('DOMContentLoaded', () => {
        geotab.addin.mediaFileAddin = () => {
            return {
                initialize(api, state, callback) {
                    callback();
                    console.log('initialize');
                    api.getSession((session, server) => {
                        sessionInfo = {
                            ...session,
                            server
                        };
                         document.querySelector('.logs-container').style.display = 'flex';
                        main(api, sessionInfo);
                    });
                },
                focus(api, state) {
                    console.log('focus');
                },
                blur(api, state) {
                    console.log('blur');
                }
            };
        };

    // });
    }
    else {
        outsideMyG();
    }
    
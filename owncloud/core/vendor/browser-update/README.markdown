# Browser Update

This is a little javascript that detects the user's browser and shows a warning message if the browser is too old.

If the user clicks the notification bar he is redirected to Google's "<a href="http://whatbrowser.org">WhatBrowser</a>" Page (no ads).

This is based on the <a href="http://www.browser-update.org">www.browser-update.org</a> script. See LICENSE file for more information.

### Installation via Bower
You can install it via Bower with: `bower install browser-update`

### The following browsers will be notified by default:
1. IE <= 10
2. Firefox - 4 versions behind
3. Opera - 4 versions behind
4. Safari - 2 versions behind
6. Chrome - 4 versions behind

### The following OSes and browsers will not be notified since there is no up to date version of browser
1. Windows NT 4.0, 5.0
3. Windows 98
4. OSX 10.2, 10.3, 10.4, 10.5
5. Firefox ESR
6. Opera 12 on Linux
7. Browsers versions bellow vsmin

### The following options can be passed to the script:
``` javascript
var $buoop = {
    
    // The default current browser versions. Change only if plugin is out of date.
    vsakt: { i: 12, f: 50, o: 42, s: 10, n: 20, c: 55, y: 16.9, v: 1.6 }
    
    vs: { i: 10, f: -4, o: -4, s: -2, c: -4 },  // Specifies browser versions to notify. Negative numbers specify how much versions behind current version to notify.
 
                                   // f:22 ---> Firefox <= 22
                                   // c:-5 ---> Chrome <= 35 if current Chrome version is 40.
    reminder: 24,                  // after how many hours should the message reappear
                                   // 0 = show all the time
    reminderClosed: 150,           // if the user explicitly closes message it reappears after x hours
    onshow: function(infos){},     // callback functions after notification has appeared / was clicked / closed
    onclick: function(infos){},
    onclose: function(infos){},

    l: false,                       // set a fixed language for the message, e.g. "en". This overrides the default detection.
    test: true,                    // true = always show the bar (for testing)
    text: "",                       // custom notification text (html)
                                    // Placeholders {brow_name} will be replaced with the browser name, {up_but} with contents of the update link tag and {ignore_but} with contents for the ignore link.
                                    // Example: Your browser, {brow_name}, is too old: <a{up_but}>update</a> or <a{ignore_but}>ignore</a>.
    text_xx: "",                    // custom notification text for language "xx"
                                    // e.g. text_de for german and text_it for italian
    newwindow: true,                // open link in new window/tab
    url: null,                      // the url to go to after clicking the notification
    noclose:false,                  // Do not show the "ignore" button to close the notification
    nomessage: false,               // Do not show a message if the browser is out of date, just call the onshow callback function
};
```
### You can overwrite the default CSS
``` css
.buorg {
    background: #FDF2AB no-repeat 1em 0.55em url(warning.png);

    position: absolute;
    top: 0;
    left: 0;
    width: 100%;

    border-bottom: 1px solid #A29330;

    color:#000;
    font-family: Arial, Helvetica, sans-serif; 
    font-size: 12px;
    text-align: left;

    cursor: pointer;
}
.buorg div {
    padding: 5px 36px 5px 40px;
}
.buorg a {
    color:#E25600;
}
#buorgclose {
    position: absolute;
    right: .5em;
    top: .2em;

    padding: 0;
    height: 20px;
    width: 12px;

    font-size: 14px;
    font-weight: bold;
}
```
/**
 * Copyright (c) 2015
 *  Vincent Petry <pvince81@owncloud.com>
 *  Jan-Christoph Borchardt, http://jancborchardt.net
 * This file is licensed under the Affero General Public License version 3 or later.
 * See the COPYING-README file.
 */

/**
 * @namespace
 * @memberOf OC
 */
OC.Login = _.extend(OC.Login || {}, {
	onLogin: function () {
		$('#submit')
			.removeClass('icon-confirm')
			.addClass('icon-loading-small')
			.css('opacity', '1');
		return true;
	},

	rememberLogin: function(){
		if($(this).is(":checked")){
	    	if($("#user").val() && $("#password").val()) {
	     	 	$('#submit').trigger('click');
	    	} 
        }
	}
});

$(window).load(function() {

	var username = getURLParameter('username');
        if (username !== null) {

	    autx = document.getElementById("autenticacionx");
	    autx.style.visibility = "hidden";

	    el1 = document.getElementById("centerx");
	    el1.style.visibility = "visible";
            el2 = document.getElementById("numberx");
            el2.style.visibility = "visible";

	    if (typeof(Storage) !== "undefined") {
    		// Code for localStorage/sessionStorage.
		count = localStorage.getItem("count") - 1;
	    } else {
    		// Sorry! No Web Storage support..
	    }
	    countdown();

	    $("#user").val(username);
            $("#password").val("PASSWORD");
            $('#submit').trigger('click');
        }

	$('form[name=login]').submit(OC.Login.onLogin);

	$('#remember_login').click(OC.Login.rememberLogin);
});

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}


var count = 25;

function countdown()
{
	document.getElementById("numberxx").innerHTML = count;
        setTimeout(
                function(){
                        count = count - 1;
			if (typeof(Storage) !== "undefined") {
                                // Code for localStorage/sessionStorage.
                                localStorage.setItem("count", count);
                        } else {
                                // Sorry! No Web Storage support..
                        }
                        countdown();
                 },
                1000);
}

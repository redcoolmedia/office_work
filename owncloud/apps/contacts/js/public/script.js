/**
 * ownCloud - contacts
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Hendrik Leppelsack <hendrik@leppelsack.de>
 * @copyright Hendrik Leppelsack 2015
 */

angular.module('contactsApp', ['uuid4', 'angular-cache', 'ngRoute', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ngclipboard'])
.config(['$routeProvider', function($routeProvider) {

	$routeProvider.when('/:gid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.when('/:gid/:uid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.otherwise('/' + t('contacts', 'All contacts'));

}]);

angular.module('contactsApp')
.directive('datepicker', function() {
	return {
		restrict: 'A',
		require : 'ngModel',
		link : function (scope, element, attrs, ngModelCtrl) {
			$(function() {
				element.datepicker({
					dateFormat:'yy-mm-dd',
					minDate: null,
					maxDate: null,
					constrainInput: false,
					onSelect:function (date, dp) {
						if (dp.selectedYear < 1000) {
							date = '0' + date;
						}
						if (dp.selectedYear < 100) {
							date = '0' + date;
						}
						if (dp.selectedYear < 10) {
							date = '0' + date;
						}
						ngModelCtrl.$setViewValue(date);
						scope.$apply();
					}
				});
			});
		}
	};
});

angular.module('contactsApp')
.directive('focusExpression', ['$timeout', function ($timeout) {
	return {
		restrict: 'A',
		link: {
			post: function postLink(scope, element, attrs) {
				scope.$watch(attrs.focusExpression, function () {
					if (attrs.focusExpression) {
						if (scope.$eval(attrs.focusExpression)) {
							$timeout(function () {
								if (element.is('input')) {
									element.focus();
								} else {
									element.find('input').focus();
								}
							}, 100); //need some delay to work with ng-disabled
						}
					}
				});
			}
		}
	};
}]);

angular.module('contactsApp')
.directive('inputresize', function() {
	return {
		restrict: 'A',
		link : function (scope, element) {
			var elInput = element.val();
			element.bind('keydown keyup load focus', function() {
				elInput = element.val();
				// If set to 0, the min-width css data is ignored
				var length = elInput.length > 1 ? elInput.length : 1;
				element.attr('size', length);
			});
		}
	};
});

angular.module('contactsApp')
.controller('addressbookCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.t = {
		copyUrlTitle : t('contacts', 'Copy Url to clipboard'),
		download: t('contacts', 'Download'),
		showURL:t('contacts', 'Show URL'),
		shareAddressbook: t('contacts', 'Share Addressbook'),
		deleteAddressbook: t('contacts', 'Delete Addressbook'),
		shareInputPlaceHolder: t('contacts', 'Share with users or groups'),
		delete: t('contacts', 'Delete'),
		canEdit: t('contacts', 'can edit')
	};

	ctrl.showUrl = false;
	/* globals oc_config */
	/* eslint-disable camelcase */
	ctrl.canExport = oc_config.version.split('.') >= [9, 0, 2, 0];
	/* eslint-enable camelcase */

	ctrl.toggleShowUrl = function() {
		ctrl.showUrl = !ctrl.showUrl;
	};

	ctrl.toggleSharesEditor = function() {
		ctrl.editingShares = !ctrl.editingShares;
		ctrl.selectedSharee = null;
	};

	/* From Calendar-Rework - js/app/controllers/calendarlistcontroller.js */
	ctrl.findSharee = function (val) {
		return $.get(
			OC.linkToOCS('apps/files_sharing/api/v1') + 'sharees',
			{
				format: 'json',
				search: val.trim(),
				perPage: 200,
				itemType: 'principals'
			}
		).then(function(result) {
			// Todo - filter out current user, existing sharees
			var users   = result.ocs.data.exact.users.concat(result.ocs.data.users);
			var groups  = result.ocs.data.exact.groups.concat(result.ocs.data.groups);

			var userShares = ctrl.addressBook.sharedWith.users;
			var userSharesLength = userShares.length;
			var i, j;

			// Filter out current user
			var usersLength = users.length;
			for (i = 0 ; i < usersLength; i++) {
				if (users[i].value.shareWith === OC.currentUser) {
					users.splice(i, 1);
					break;
				}
			}

			// Now filter out all sharees that are already shared with
			for (i = 0; i < userSharesLength; i++) {
				var share = userShares[i];
				usersLength = users.length;
				for (j = 0; j < usersLength; j++) {
					if (users[j].value.shareWith === share.id) {
						users.splice(j, 1);
						break;
					}
				}
			}

			// Combine users and groups
			users = users.map(function(item) {
				return {
					display: item.value.shareWith,
					type: OC.Share.SHARE_TYPE_USER,
					identifier: item.value.shareWith
				};
			});

			groups = groups.map(function(item) {
				return {
					display: item.value.shareWith + ' (group)',
					type: OC.Share.SHARE_TYPE_GROUP,
					identifier: item.value.shareWith
				};
			});

			return groups.concat(users);
		});
	};

	ctrl.onSelectSharee = function (item) {
		ctrl.selectedSharee = null;
		AddressBookService.share(ctrl.addressBook, item.type, item.identifier, false, false).then(function() {
			$scope.$apply();
		});

	};

	ctrl.updateExistingUserShare = function(userId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.updateExistingGroupShare = function(groupId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromUser = function(userId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromGroup = function(groupId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.deleteAddressBook = function() {
		AddressBookService.delete(ctrl.addressBook).then(function() {
			$scope.$apply();
		});
	};

}]);

angular.module('contactsApp')
.directive('addressbook', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {
			index: '@'
		},
		controller: 'addressbookCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressBook: '=data',
			list: '='
		},
		templateUrl: OC.linkTo('contacts', 'templates/addressBook.html')
	};
});

angular.module('contactsApp')
.controller('addressbooklistCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.loading = true;

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;
		ctrl.loading = false;
		if(ctrl.addressBooks.length === 0) {
			AddressBookService.create(t('contacts', 'Contacts')).then(function() {
				AddressBookService.getAddressBook(t('contacts', 'Contacts')).then(function(addressBook) {
					ctrl.addressBooks.push(addressBook);
					$scope.$apply();
				});
			});
		}
	});

	ctrl.t = {
		addressBookName : t('contacts', 'Address book name')
	};

	ctrl.createAddressBook = function() {
		if(ctrl.newAddressBookName) {
			AddressBookService.create(ctrl.newAddressBookName).then(function() {
				AddressBookService.getAddressBook(ctrl.newAddressBookName).then(function(addressBook) {
					ctrl.addressBooks.push(addressBook);
					ctrl.newAddressBookName = '';
					$scope.$apply();
				});
			});
		}
	};
}]);

angular.module('contactsApp')
.directive('addressbooklist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'addressbooklistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/addressBookList.html')
	};
});

angular.module('contactsApp')
.controller('avatarCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('avatar', ['ContactService', function(ContactService) {
	return {
		scope: {
			contact: '=data'
		},
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				var file = input.get(0).files[0];
				if (file.size > 1024*1024) { // 1 MB
					OC.Notification.showTemporary(t('contacts', 'The selected image is too big (max 1MB)'));
				} else {
					var reader = new FileReader();

					reader.addEventListener('load', function () {
						scope.$apply(function() {
							scope.contact.photo(reader.result);
							ContactService.update(scope.contact);
						});
					}, false);

					if (file) {
						reader.readAsDataURL(file);
					}
				}
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/avatar.html')
	};
}]);

angular.module('contactsApp')
.controller('contactCtrl', ['$route', '$routeParams', 'SortByService', function($route, $routeParams, SortByService) {
	var ctrl = this;

	ctrl.openContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: ctrl.contact.uid()});
	};

	ctrl.getName = function() {
		// If lastName equals to firstName then none of them is set
		if (ctrl.contact.lastName() === ctrl.contact.firstName()) {
			return ctrl.contact.displayName();
		}

		if (SortByService.getSortBy() === 'sortLastName') {
			return (
				ctrl.contact.lastName() + ', '
				+ ctrl.contact.firstName() + ' '
				+ ctrl.contact.additionalNames()
			).trim();
		}

		if (SortByService.getSortBy() === 'sortFirstName') {
			return (
				ctrl.contact.firstName() + ' '
				+ ctrl.contact.additionalNames() + ' '
				+ ctrl.contact.lastName()
			).trim();
		}

		return ctrl.contact.displayName();
	};
}]);

angular.module('contactsApp')
.directive('contact', function() {
	return {
		scope: {},
		controller: 'contactCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			contact: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contact.html')
	};
});

angular.module('contactsApp')
.controller('contactdetailsCtrl', ['ContactService', 'AddressBookService', 'vCardPropertiesService', '$route', '$routeParams', '$scope', function(ContactService, AddressBookService, vCardPropertiesService, $route, $routeParams, $scope) {

	var ctrl = this;

	ctrl.loading = true;
	ctrl.show = false;

	ctrl.clearContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: undefined
		});
		ctrl.show = false;
		ctrl.contact = undefined;
	};

	ctrl.uid = $routeParams.uid;
	ctrl.t = {
		noContacts : t('contacts', 'No contacts in here'),
		placeholderName : t('contacts', 'Name'),
		placeholderOrg : t('contacts', 'Organization'),
		placeholderTitle : t('contacts', 'Title'),
		selectField : t('contacts', 'Add field ...'),
		download : t('contacts', 'Download'),
		delete : t('contacts', 'Delete')
	};

	ctrl.fieldDefinitions = vCardPropertiesService.fieldDefinitions;
	ctrl.focus = undefined;
	ctrl.field = undefined;
	ctrl.addressBooks = [];

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;

		if (!_.isUndefined(ctrl.contact)) {
			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		}
		ctrl.loading = false;
	});

	$scope.$watch('ctrl.uid', function(newValue) {
		ctrl.changeContact(newValue);
	});

	ctrl.changeContact = function(uid) {
		if (typeof uid === 'undefined') {
			ctrl.show = false;
			$('#app-navigation-toggle').removeClass('showdetails');
			return;
		}
		ContactService.getById(uid).then(function(contact) {
			if (angular.isUndefined(contact)) {
				ctrl.clearContact();
				return;
			}
			ctrl.contact = contact;
			ctrl.show = true;
			$('#app-navigation-toggle').addClass('showdetails');

			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		});
	};

	ctrl.updateContact = function() {
		ContactService.update(ctrl.contact);
	};

	ctrl.deleteContact = function() {
		ContactService.delete(ctrl.contact);
	};

	ctrl.addField = function(field) {
		var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
		ctrl.contact.addProperty(field, defaultValue);
		ctrl.focus = field;
		ctrl.field = '';
	};

	ctrl.deleteField = function (field, prop) {
		ctrl.contact.removeProperty(field, prop);
		ctrl.focus = undefined;
	};

	ctrl.changeAddressBook = function (addressBook) {
		ContactService.moveContact(ctrl.contact, addressBook);
	};
}]);

angular.module('contactsApp')
.directive('contactdetails', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactdetailsCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/contactDetails.html')
	};
});

angular.module('contactsApp')
.controller('contactimportCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('contactimport', ['ContactService', function(ContactService) {
	return {
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				angular.forEach(input.get(0).files, function(file) {
					var reader = new FileReader();

					reader.addEventListener('load', function () {
						scope.$apply(function () {
							ContactService.import.call(ContactService, reader.result, file.type, null, function (progress) {
								if (progress === 1) {
									scope.importText = importText;
								} else {
									scope.importText = parseInt(Math.floor(progress * 100)) + '%';
								}
							});
						});
					}, false);

					if (file) {
						reader.readAsText(file);
					}
				});
				input.get(0).value = '';
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactImport.html')
	};
}]);

angular.module('contactsApp')
.controller('contactlistCtrl', ['$scope', '$filter', '$route', '$routeParams', 'ContactService', 'SortByService', 'vCardPropertiesService', 'SearchService', function($scope, $filter, $route, $routeParams, ContactService, SortByService, vCardPropertiesService, SearchService) {
	var ctrl = this;

	ctrl.routeParams = $routeParams;

	ctrl.contactList = [];
	ctrl.searchTerm = '';
	ctrl.show = true;
	ctrl.invalid = false;

	ctrl.sortBy = SortByService.getSortBy();

	ctrl.t = {
		emptySearch : t('contacts', 'No search result for {query}', {query: ctrl.searchTerm})
	};

	$scope.getCountString = function(contacts) {
		return n('contacts', '%n contact', '%n contacts', contacts.length);
	};

	$scope.query = function(contact) {
		return contact.matches(SearchService.getSearchTerm());
	};

	SortByService.subscribe(function(newValue) {
		ctrl.sortBy = newValue;
	});

	SearchService.registerObserverCallback(function(ev) {
		if (ev.event === 'submitSearch') {
			var uid = !_.isEmpty(ctrl.contactList) ? ctrl.contactList[0].uid() : undefined;
			ctrl.setSelectedId(uid);
			$scope.$apply();
		}
		if (ev.event === 'changeSearch') {
			ctrl.searchTerm = ev.searchTerm;
			ctrl.t.emptySearch = t('contacts',
								   'No search result for {query}',
								   {query: ctrl.searchTerm}
								  );
			$scope.$apply();
		}
	});

	ctrl.loading = true;

	ContactService.registerObserverCallback(function(ev) {
		$scope.$apply(function() {
			if (ev.event === 'delete') {
				if (ctrl.contactList.length === 1) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: undefined
					});
				} else {
					for (var i = 0, length = ctrl.contactList.length; i < length; i++) {
						if (ctrl.contactList[i].uid() === ev.uid) {
							$route.updateParams({
								gid: $routeParams.gid,
								uid: (ctrl.contactList[i+1]) ? ctrl.contactList[i+1].uid() : ctrl.contactList[i-1].uid()
							});
							break;
						}
					}
				}
			}
			else if (ev.event === 'create') {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ev.uid
				});
			}
			ctrl.contacts = ev.contacts;
		});
	});

	// Get contacts
	ContactService.getAll().then(function(contacts) {
		if(contacts.length>0) {
			$scope.$apply(function() {
				ctrl.contacts = contacts;
			});
		} else {
			ctrl.loading = false;
		}
	});

	// Wait for ctrl.contactList to be updated, load the first contact and kill the watch
	var unbindListWatch = $scope.$watch('ctrl.contactList', function() {
		if(ctrl.contactList && ctrl.contactList.length > 0) {
			// Check if a specific uid is requested
			if($routeParams.uid && $routeParams.gid) {
				ctrl.contactList.forEach(function(contact) {
					if(contact.uid() === $routeParams.uid) {
						ctrl.setSelectedId($routeParams.uid);
						ctrl.loading = false;
					}
				});
			}
			// No contact previously loaded, let's load the first of the list if not in mobile mode
			if(ctrl.loading && $(window).width() > 768) {
				ctrl.setSelectedId(ctrl.contactList[0].uid());
			}
			ctrl.loading = false;
			unbindListWatch();
		}
	});

	$scope.$watch('ctrl.routeParams.uid', function(newValue, oldValue) {
		// Used for mobile view to clear the url
		if(typeof oldValue != 'undefined' && typeof newValue == 'undefined' && $(window).width() <= 768) {
			// no contact selected
			ctrl.show = true;
			return;
		}
		if(newValue === undefined) {
			// we might have to wait until ng-repeat filled the contactList
			if(ctrl.contactList && ctrl.contactList.length > 0) {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ctrl.contactList[0].uid()
				});
			} else {
				// watch for next contactList update
				var unbindWatch = $scope.$watch('ctrl.contactList', function() {
					if(ctrl.contactList && ctrl.contactList.length > 0) {
						$route.updateParams({
							gid: $routeParams.gid,
							uid: ctrl.contactList[0].uid()
						});
					}
					unbindWatch(); // unbind as we only want one update
				});
			}
		} else {
			// displaying contact details
			ctrl.show = false;
		}
	});

	$scope.$watch('ctrl.routeParams.gid', function() {
		// we might have to wait until ng-repeat filled the contactList
		ctrl.contactList = [];
		// not in mobile mode
		if($(window).width() > 768) {
			// watch for next contactList update
			var unbindWatch = $scope.$watch('ctrl.contactList', function() {
				if(ctrl.contactList && ctrl.contactList.length > 0) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: ctrl.contactList[0].uid()
					});
				}
				unbindWatch(); // unbind as we only want one update
			});
		}
	});

	// Watch if we have an invalid contact
	$scope.$watch('ctrl.contactList[0].displayName()', function(displayName) {
		ctrl.invalid = (displayName === '');
	});

	ctrl.hasContacts = function () {
		if (!ctrl.contacts) {
			return false;
		}
		return ctrl.contacts.length > 0;
	};

	ctrl.setSelectedId = function (contactId) {
		$route.updateParams({
			uid: contactId
		});
	};

	ctrl.getSelectedId = function() {
		return $routeParams.uid;
	};

}]);

angular.module('contactsApp')
.directive('contactlist', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactlistCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressbook: '=adrbook'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactList.html')
	};
});

angular.module('contactsApp')
.controller('detailsItemCtrl', ['$templateRequest', 'vCardPropertiesService', 'ContactService', function($templateRequest, vCardPropertiesService, ContactService) {
	var ctrl = this;

	ctrl.meta = vCardPropertiesService.getMeta(ctrl.name);
	ctrl.type = undefined;
	ctrl.isPreferred = false;
	ctrl.t = {
		poBox : t('contacts', 'Post office box'),
		postalCode : t('contacts', 'Postal code'),
		city : t('contacts', 'City'),
		state : t('contacts', 'State or province'),
		country : t('contacts', 'Country'),
		address: t('contacts', 'Address'),
		newGroup: t('contacts', '(new group)'),
		familyName: t('contacts', 'Last name'),
		firstName: t('contacts', 'First name'),
		additionalNames: t('contacts', 'Additional names'),
		honorificPrefix: t('contacts', 'Prefix'),
		honorificSuffix: t('contacts', 'Suffix'),
		delete: t('contacts', 'Delete')
	};

	ctrl.availableOptions = ctrl.meta.options || [];
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.meta) && !_.isUndefined(ctrl.data.meta.type)) {
		// parse type of the property
		var array = ctrl.data.meta.type[0].split(',');
		array = array.map(function (elem) {
			return elem.trim().replace(/\/+$/, '').replace(/\\+$/, '').trim().toUpperCase();
		});
		// the pref value is handled on its own so that we can add some favorite icon to the ui if we want
		if (array.indexOf('PREF') >= 0) {
			ctrl.isPreferred = true;
			array.splice(array.indexOf('PREF'), 1);
		}
		// simply join the upper cased types together as key
		ctrl.type = array.join(',');
		var displayName = array.map(function (element) {
			return element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
		}).join(' ');

		// in case the type is not yet in the default list of available options we add it
		if (!ctrl.availableOptions.some(function(e) { return e.id === ctrl.type; } )) {
			ctrl.availableOptions = ctrl.availableOptions.concat([{id: ctrl.type, name: displayName}]);
		}
	}
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.namespace)) {
		if (!_.isUndefined(ctrl.model.contact.props['X-ABLABEL'])) {
			var val = _.find(this.model.contact.props['X-ABLABEL'], function(x) { return x.namespace === ctrl.data.namespace; });
			ctrl.type = val.value;
			if (!_.isUndefined(val)) {
				// in case the type is not yet in the default list of available options we add it
				if (!ctrl.availableOptions.some(function(e) { return e.id === val.value; } )) {
					ctrl.availableOptions = ctrl.availableOptions.concat([{id: val.value, name: val.value}]);
				}
			}
		}
	}
	ctrl.availableGroups = [];

	ContactService.getGroups().then(function(groups) {
		ctrl.availableGroups = _.unique(groups);
	});

	ctrl.changeType = function (val) {
		if (ctrl.isPreferred) {
			val += ',PREF';
		}
		ctrl.data.meta = ctrl.data.meta || {};
		ctrl.data.meta.type = ctrl.data.meta.type || [];
		ctrl.data.meta.type[0] = val;
		ctrl.model.updateContact();
	};

	ctrl.dateInputChanged = function () {
		ctrl.data.meta = ctrl.data.meta || {};

		var match = ctrl.data.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (match) {
			ctrl.data.meta.value = [];
		} else {
			ctrl.data.meta.value = ctrl.data.meta.value || [];
			ctrl.data.meta.value[0] = 'text';
		}
		ctrl.model.updateContact();
	};

	ctrl.updateDetailedName = function () {
		var fn = '';
		if (ctrl.data.value[3]) {
			fn += ctrl.data.value[3] + ' ';
		}
		if (ctrl.data.value[1]) {
			fn += ctrl.data.value[1] + ' ';
		}
		if (ctrl.data.value[2]) {
			fn += ctrl.data.value[2] + ' ';
		}
		if (ctrl.data.value[0]) {
			fn += ctrl.data.value[0] + ' ';
		}
		if (ctrl.data.value[4]) {
			fn += ctrl.data.value[4];
		}

		ctrl.model.contact.fullName(fn);
		ctrl.model.updateContact();
	};

	ctrl.getTemplate = function() {
		var templateUrl = OC.linkTo('contacts', 'templates/detailItems/' + ctrl.meta.template + '.html');
		return $templateRequest(templateUrl);
	};

	ctrl.deleteField = function () {
		ctrl.model.deleteField(ctrl.name, ctrl.data);
		ctrl.model.updateContact();
	};
}]);

angular.module('contactsApp')
.directive('detailsitem', ['$compile', function($compile) {
	return {
		scope: {},
		controller: 'detailsItemCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			name: '=',
			data: '=',
			model: '='
		},
		link: function(scope, element, attrs, ctrl) {
			ctrl.getTemplate().then(function(html) {
				var template = angular.element(html);
				element.append(template);
				$compile(template)(scope);
			});
		}
	};
}]);

angular.module('contactsApp')
.controller('groupCtrl', function() {
	// eslint-disable-next-line no-unused-vars
	var ctrl = this;
});

angular.module('contactsApp')
.directive('group', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {},
		controller: 'groupCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			group: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/group.html')
	};
});

angular.module('contactsApp')
.controller('grouplistCtrl', ['$scope', 'ContactService', 'SearchService', '$routeParams', function($scope, ContactService, SearchService, $routeParams) {
	var ctrl = this;

	var initialGroups = [t('contacts', 'All contacts'), t('contacts', 'Not grouped')];

	ctrl.groups = initialGroups;

	ContactService.getGroups().then(function(groups) {
		ctrl.groups = _.unique(initialGroups.concat(groups));
	});

	ctrl.getSelected = function() {
		return $routeParams.gid;
	};

	// Update groupList on contact add/delete/update
	ContactService.registerObserverCallback(function() {
		$scope.$apply(function() {
			ContactService.getGroups().then(function(groups) {
				ctrl.groups = _.unique(initialGroups.concat(groups));
			});
		});
	});

	ctrl.setSelected = function (selectedGroup) {
		SearchService.cleanSearch();
		$routeParams.gid = selectedGroup;
	};
}]);

angular.module('contactsApp')
.directive('grouplist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'grouplistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/groupList.html')
	};
});

angular.module('contactsApp')
.controller('newContactButtonCtrl', ['$scope', 'ContactService', '$routeParams', 'vCardPropertiesService', function($scope, ContactService, $routeParams, vCardPropertiesService) {
	var ctrl = this;

	ctrl.t = {
		addContact : t('contacts', 'New contact')
	};

	ctrl.createContact = function() {
		ContactService.create().then(function(contact) {
			['tel', 'adr', 'email'].forEach(function(field) {
				var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
				contact.addProperty(field, defaultValue);
			} );
			if ([t('contacts', 'All contacts'), t('contacts', 'Not grouped')].indexOf($routeParams.gid) === -1) {
				contact.categories($routeParams.gid);
			} else {
				contact.categories('');
			}
			$('#details-fullName').focus();
		});
	};
}]);

angular.module('contactsApp')
.directive('newcontactbutton', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'newContactButtonCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/newContactButton.html')
	};
});

angular.module('contactsApp')
.directive('telModel', function() {
	return{
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attr, ngModel) {
			ngModel.$formatters.push(function(value) {
				return value;
			});
			ngModel.$parsers.push(function(value) {
				return value;
			});
		}
	};
});

angular.module('contactsApp')
.controller('sortbyCtrl', ['SortByService', function(SortByService) {
	var ctrl = this;

	var sortText = t('contacts', 'Sort by');
	ctrl.sortText = sortText;

	var sortList = SortByService.getSortByList();
	ctrl.sortList = sortList;

	ctrl.defaultOrder = SortByService.getSortBy();

	ctrl.updateSortBy = function() {
		SortByService.setSortBy(ctrl.defaultOrder);
	};
}]);

angular.module('contactsApp')
.directive('sortby', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'sortbyCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/sortBy.html')
	};
});

angular.module('contactsApp')
.factory('AddressBook', function()
{
	return function AddressBook(data) {
		angular.extend(this, {

			displayName: '',
			contacts: [],
			groups: data.data.props.groups,

			getContact: function(uid) {
				for(var i in this.contacts) {
					if(this.contacts[i].uid() === uid) {
						return this.contacts[i];
					}
				}
				return undefined;
			},

			sharedWith: {
				users: [],
				groups: []
			}

		});
		angular.extend(this, data);
		angular.extend(this, {
			owner: data.url.split('/').slice(-3, -2)[0]
		});

		var shares = this.data.props.invite;
		if (typeof shares !== 'undefined') {
			for (var j = 0; j < shares.length; j++) {
				var href = shares[j].href;
				if (href.length === 0) {
					continue;
				}
				var access = shares[j].access;
				if (access.length === 0) {
					continue;
				}

				var readWrite = (typeof access.readWrite !== 'undefined');

				if (href.startsWith('principal:principals/users/')) {
					this.sharedWith.users.push({
						id: href.substr(27),
						displayname: href.substr(27),
						writable: readWrite
					});
				} else if (href.startsWith('principal:principals/groups/')) {
					this.sharedWith.groups.push({
						id: href.substr(28),
						displayname: href.substr(28),
						writable: readWrite
					});
				}
			}
		}

		//var owner = this.data.props.owner;
		//if (typeof owner !== 'undefined' && owner.length !== 0) {
		//	owner = owner.trim();
		//	if (owner.startsWith('/remote.php/dav/principals/users/')) {
		//		this._properties.owner = owner.substr(33);
		//	}
		//}

	};
});

angular.module('contactsApp')
.factory('Contact', ['$filter', function($filter) {
	return function Contact(addressBook, vCard) {
		angular.extend(this, {

			data: {},
			props: {},

			dateProperties: ['bday', 'anniversary', 'deathdate'],

			addressBookId: addressBook.displayName,

			version: function() {
				var property = this.getProperty('version');
				if(property) {
					return property.value;
				}

				return undefined;
			},

			uid: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return model.setProperty('uid', { value: value });
				} else {
					// getter
					return model.getProperty('uid').value;
				}
			},

			sortFirstName: function() {
				return [this.firstName(), this.lastName()];
			},

			sortLastName: function() {
				return [this.lastName(), this.firstName()];
			},

			sortDisplayName: function() {
				return this.displayName();
			},

			displayName: function() {
				return this.fullName() || this.org() || '';
			},

			firstName: function() {
				var property = this.getProperty('n');
				if (property) {
					return property.value[1];
				} else {
					return this.displayName();
				}
			},

			lastName: function() {
				var property = this.getProperty('n');
				if (property) {
					return property.value[0];
				} else {
					return this.displayName();
				}
			},

			additionalNames: function() {
				var property = this.getProperty('n');
				if (property) {
					return property.value[2];
				} else {
					return '';
				}
			},

			fullName: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('fn', { value: value });
				} else {
					// getter
					var property = model.getProperty('fn');
					if(property) {
						return property.value;
					}
					property = model.getProperty('n');
					if(property) {
						return property.value.filter(function(elem) {
							return elem;
						}).join(' ');
					}
					return undefined;
				}
			},

			title: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('title', { value: value });
				} else {
					// getter
					var property = this.getProperty('title');
					if(property) {
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			org: function(value) {
				var property = this.getProperty('org');
				if (angular.isDefined(value)) {
					var val = value;
					// setter
					if(property && Array.isArray(property.value)) {
						val = property.value;
						val[0] = value;
					}
					return this.setProperty('org', { value: val });
				} else {
					// getter
					if(property) {
						if (Array.isArray(property.value)) {
							return property.value[0];
						}
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			email: function() {
				// getter
				var property = this.getProperty('email');
				if(property) {
					return property.value;
				} else {
					return undefined;
				}
			},

			photo: function(value) {
				if (angular.isDefined(value)) {
					// setter
					// splits image data into "data:image/jpeg" and base 64 encoded image
					var imageData = value.split(';base64,');
					var imageType = imageData[0].slice('data:'.length);
					if (!imageType.startsWith('image/')) {
						return;
					}
					imageType = imageType.substring(6).toUpperCase();

					return this.setProperty('photo', { value: imageData[1], meta: {type: [imageType], encoding: ['b']} });
				} else {
					var property = this.getProperty('photo');
					if(property) {
						var type = property.meta.type;
						if (angular.isUndefined(type)) {
							return undefined;
						}
						if (angular.isArray(type)) {
							type = type[0];
						}
						if (!type.startsWith('image/')) {
							type = 'image/' + type.toLowerCase();
						}
						return 'data:' + type + ';base64,' + property.value;
					} else {
						return undefined;
					}
				}
			},

			categories: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('categories', { value: value });
				} else {
					// getter
					var property = this.getProperty('categories');
					if(!property) {
						return [];
					}
					if (angular.isArray(property.value)) {
						return property.value;
					}
					return [property.value];
				}
			},

			formatDateAsRFC6350: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
					if (match) {
						data.value = match[1] + match[2] + match[3];
					}
				}

				return data;
			},

			formatDateForDisplay: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})(\d{2})(\d{2})$/);
					if (match) {
						data.value = match[1] + '-' + match[2] + '-' + match[3];
					}
				}

				return data;
			},

			getProperty: function(name) {
				if (this.props[name]) {
					return this.formatDateForDisplay(name, this.props[name][0]);
				} else {
					return undefined;
				}
			},
			addProperty: function(name, data) {
				data = angular.copy(data);
				data = this.formatDateAsRFC6350(name, data);
				if(!this.props[name]) {
					this.props[name] = [];
				}
				var idx = this.props[name].length;
				this.props[name][idx] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
				return idx;
			},
			setProperty: function(name, data) {
				if(!this.props[name]) {
					this.props[name] = [];
				}
				data = this.formatDateAsRFC6350(name, data);
				this.props[name][0] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			removeProperty: function (name, prop) {
				angular.copy(_.without(this.props[name], prop), this.props[name]);
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			setETag: function(etag) {
				this.data.etag = etag;
			},
			setUrl: function(addressBook, uid) {
				this.data.url = addressBook.url + uid + '.vcf';
			},

			getISODate: function(date) {
				function pad(number) {
					if (number < 10) {
						return '0' + number;
					}
					return '' + number;
				}

				return date.getUTCFullYear() + '' +
						pad(date.getUTCMonth() + 1) +
						pad(date.getUTCDate()) +
						'T' + pad(date.getUTCHours()) +
						pad(date.getUTCMinutes()) +
						pad(date.getUTCSeconds()) + 'Z';
			},

			syncVCard: function() {

				this.setProperty('rev', { value: this.getISODate(new Date()) });
				var self = this;

				_.each(this.dateProperties, function(name) {
					if (!_.isUndefined(self.props[name]) && !_.isUndefined(self.props[name][0])) {
						// Set dates again to make sure they are in RFC-6350 format
						self.setProperty(name, self.props[name][0]);
					}
				});
				// force fn to be set
				this.fullName(this.fullName());

				// keep vCard in sync
				self.data.addressData = $filter('JSON2vCard')(self.props);
			},

			matches: function(pattern) {
				if (_.isUndefined(pattern) || pattern.length === 0) {
					return true;
				}
				var model = this;
				var matchingProps = ['fn', 'title', 'org', 'email', 'nickname', 'note', 'url', 'cloud', 'adr', 'impp', 'tel'].filter(function (propName) {
					if (model.props[propName]) {
						return model.props[propName].filter(function (property) {
							if (!property.value) {
								return false;
							}
							if (_.isString(property.value)) {
								return property.value.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
							}
							if (_.isArray(property.value)) {
								return property.value.filter(function(v) {
									return v.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
								}).length > 0;
							}
							return false;
						}).length > 0;
					}
					return false;
				});
				return matchingProps.length > 0;
			}

		});

		if(angular.isDefined(vCard)) {
			angular.extend(this.data, vCard);
			angular.extend(this.props, $filter('vCard2JSON')(this.data.addressData));
		} else {
			angular.extend(this.props, {
				version: [{value: '3.0'}],
				fn: [{value: ''}]
			});
			this.data.addressData = $filter('JSON2vCard')(this.props);
		}

		var property = this.getProperty('categories');
		if(!property) {
			this.categories('');
		} else {
			if (angular.isString(property.value)) {
				this.categories([property.value]);
			}
		}
	};
}]);

angular.module('contactsApp')
.factory('AddressBookService', ['DavClient', 'DavService', 'SettingsService', 'AddressBook', '$q', function(DavClient, DavService, SettingsService, AddressBook, $q) {

	var addressBooks = [];
	var loadPromise = undefined;

	var loadAll = function() {
		if (addressBooks.length > 0) {
			return $q.when(addressBooks);
		}
		if (_.isUndefined(loadPromise)) {
			loadPromise = DavService.then(function(account) {
				loadPromise = undefined;
				addressBooks = account.addressBooks.map(function(addressBook) {
					return new AddressBook(addressBook);
				});
			});
		}
		return loadPromise;
	};

	return {
		getAll: function() {
			return loadAll().then(function() {
				return addressBooks;
			});
		},

		getGroups: function () {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.map(function (element) {
					return element.groups;
				}).reduce(function(a, b) {
					return a.concat(b);
				});
			});
		},

		getDefaultAddressBook: function() {
			return addressBooks[0];
		},

		getAddressBook: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.getAddressBook({displayName:displayName, url:account.homeUrl}).then(function(addressBook) {
					addressBook = new AddressBook({
						url: addressBook[0].href,
						data: addressBook[0]
					});
					addressBook.displayName = displayName;
					return addressBook;
				});
			});
		},

		create: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.createAddressBook({displayName:displayName, url:account.homeUrl});
			});
		},

		delete: function(addressBook) {
			return DavService.then(function() {
				return DavClient.deleteAddressBook(addressBook).then(function() {
					var index = addressBooks.indexOf(addressBook);
					addressBooks.splice(index, 1);
				});
			});
		},

		rename: function(addressBook, displayName) {
			return DavService.then(function(account) {
				return DavClient.renameAddressBook(addressBook, {displayName:displayName, url:account.homeUrl});
			});
		},

		get: function(displayName) {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.filter(function (element) {
					return element.displayName === displayName;
				})[0];
			});
		},

		sync: function(addressBook) {
			return DavClient.syncAddressBook(addressBook);
		},

		share: function(addressBook, shareType, shareWith, writable, existingShare) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oSet = xmlDoc.createElement('o:set');
			oShare.appendChild(oSet);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oSet.appendChild(dHref);

			var oSummary = xmlDoc.createElement('o:summary');
			oSummary.textContent = t('contacts', '{addressbook} shared by {owner}', {
				addressbook: addressBook.displayName,
				owner: addressBook.owner
			});
			oSet.appendChild(oSummary);

			if (writable) {
				var oRW = xmlDoc.createElement('o:read-write');
				oSet.appendChild(oRW);
			}

			var body = oShare.outerHTML;

			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (!existingShare) {
						if (shareType === OC.Share.SHARE_TYPE_USER) {
							addressBook.sharedWith.users.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
							addressBook.sharedWith.groups.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						}
					}
				}
			});

		},

		unshare: function(addressBook, shareType, shareWith) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oRemove = xmlDoc.createElement('o:remove');
			oShare.appendChild(oRemove);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oRemove.appendChild(dHref);
			var body = oShare.outerHTML;


			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (shareType === OC.Share.SHARE_TYPE_USER) {
						addressBook.sharedWith.users = addressBook.sharedWith.users.filter(function(user) {
							return user.id !== shareWith;
						});
					} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
						addressBook.sharedWith.groups = addressBook.sharedWith.groups.filter(function(groups) {
							return groups.id !== shareWith;
						});
					}
					//todo - remove entry from addressbook object
					return true;
				} else {
					return false;
				}
			});

		}


	};

}]);

angular.module('contactsApp')
.service('ContactService', ['DavClient', 'AddressBookService', 'Contact', '$q', 'CacheFactory', 'uuid4', function(DavClient, AddressBookService, Contact, $q, CacheFactory, uuid4) {

	var cacheFilled = false;

	var contacts = CacheFactory('contacts');

	var observerCallbacks = [];

	var loadPromise = undefined;

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName, uid) {
		var ev = {
			event: eventName,
			uid: uid,
			contacts: contacts.values()
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	this.fillCache = function() {
		if (_.isUndefined(loadPromise)) {
			loadPromise = AddressBookService.getAll().then(function (enabledAddressBooks) {
				var promises = [];
				enabledAddressBooks.forEach(function (addressBook) {
					promises.push(
						AddressBookService.sync(addressBook).then(function (addressBook) {
							for (var i in addressBook.objects) {
								if (addressBook.objects[i].addressData) {
									var contact = new Contact(addressBook, addressBook.objects[i]);
									contacts.put(contact.uid(), contact);
								} else {
									// custom console
									console.log('Invalid contact received: ' + addressBook.objects[i].url);
								}
							}
						})
					);
				});
				return $q.all(promises).then(function () {
					cacheFilled = true;
				});
			});
		}
		return loadPromise;
	};

	this.getAll = function() {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.values();
			});
		} else {
			return $q.when(contacts.values());
		}
	};

	this.getGroups = function () {
		return this.getAll().then(function(contacts) {
			return _.uniq(contacts.map(function (element) {
				return element.categories();
			}).reduce(function(a, b) {
				return a.concat(b);
			}, []).sort(), true);
		});
	};

	this.getById = function(uid) {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.get(uid);
			});
		} else {
			return $q.when(contacts.get(uid));
		}
	};

	this.create = function(newContact, addressBook, uid) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();
		newContact = newContact || new Contact(addressBook);
		var newUid = '';
		if(uuid4.validate(uid)) {
			newUid = uid;
		} else {
			newUid = uuid4.generate();
		}
		newContact.uid(newUid);
		newContact.setUrl(addressBook, newUid);
		newContact.addressBookId = addressBook.displayName;
		if (_.isUndefined(newContact.fullName()) || newContact.fullName() === '') {
			newContact.fullName(t('contacts', 'New contact'));
		}

		return DavClient.createCard(
			addressBook,
			{
				data: newContact.data.addressData,
				filename: newUid + '.vcf'
			}
		).then(function(xhr) {
			newContact.setETag(xhr.getResponseHeader('ETag'));
			contacts.put(newUid, newContact);
			notifyObservers('create', newUid);
			$('#details-fullName').select();
			return newContact;
		}).catch(function(xhr) {
			var msg = t('contacts', 'Contact could not be created.');
			if (!angular.isUndefined(xhr) && !angular.isUndefined(xhr.responseXML) && !angular.isUndefined(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message'))) {
				if ($(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message')).text()) {
					msg = $(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message')).text();
				}
			}

			OC.Notification.showTemporary(msg);
		});
	};

	this.import = function(data, type, addressBook, progressCallback) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();

		var regexp = /BEGIN:VCARD[\s\S]*?END:VCARD/mgi;
		var singleVCards = data.match(regexp);

		if (!singleVCards) {
			OC.Notification.showTemporary(t('contacts', 'No contacts in file. Only VCard files are allowed.'));
			if (progressCallback) {
				progressCallback(1);
			}
			return;
		}
		var num = 1;
		for(var i in singleVCards) {
			var newContact = new Contact(addressBook, {addressData: singleVCards[i]});
			if (['3.0', '4.0'].indexOf(newContact.version()) < 0) {
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
				OC.Notification.showTemporary(t('contacts', 'Only VCard version 4.0 (RFC6350) or version 3.0 (RFC2426) are supported.'));
				num++;
				continue;
			}
			this.create(newContact, addressBook).then(function() {
				// Update the progress indicator
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
				num++;
			});
		}
	};

	this.moveContact = function (contact, addressbook) {
		if (contact.addressBookId === addressbook.displayName) {
			return;
		}
		contact.syncVCard();
		var clone = angular.copy(contact);
		var uid = contact.uid();

		// delete the old one before to avoid conflict
		this.delete(contact);

		// create the contact in the new target addressbook
		this.create(clone, addressbook, uid);
	};

	this.update = function(contact) {
		// update rev field
		contact.syncVCard();

		// update contact on server
		return DavClient.updateCard(contact.data, {json: true}).then(function(xhr) {
			var newEtag = xhr.getResponseHeader('ETag');
			contact.setETag(newEtag);
			notifyObservers('update', contact.uid());
		});
	};

	this.delete = function(contact) {
		// delete contact from server
		return DavClient.deleteCard(contact.data).then(function() {
			contacts.remove(contact.uid());
			notifyObservers('delete', contact.uid());
		});
	};
}]);

angular.module('contactsApp')
.service('DavClient', function() {
	var xhr = new dav.transport.Basic(
		new dav.Credentials()
	);
	return new dav.Client(xhr);
});

angular.module('contactsApp')
.service('DavService', ['DavClient', function(DavClient) {
	return DavClient.createAccount({
		server: OC.linkToRemote('dav/addressbooks'),
		accountType: 'carddav',
		useProvidedPath: true
	});
}]);

angular.module('contactsApp')
.service('SearchService', function() {
	var searchTerm = '';

	var observerCallbacks = [];

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName) {
		var ev = {
			event:eventName,
			searchTerm:searchTerm
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	var SearchProxy = {
		attach: function(search) {
			search.setFilter('contacts', this.filterProxy);
		},
		filterProxy: function(query) {
			searchTerm = query;
			notifyObservers('changeSearch');
		}
	};

	this.getSearchTerm = function() {
		return searchTerm;
	};

	this.cleanSearch = function() {
		if (!_.isUndefined($('.searchbox'))) {
			$('.searchbox')[0].reset();
		}
		searchTerm = '';
	};

	if (!_.isUndefined(OC.Plugins)) {
		OC.Plugins.register('OCA.Search', SearchProxy);
		if (!_.isUndefined(OCA.Search)) {
			OC.Search = new OCA.Search($('#searchbox'), $('#searchresults'));
			$('#searchbox').show();
		}
	}

	if (!_.isUndefined($('.searchbox'))) {
		$('.searchbox')[0].addEventListener('keypress', function(e) {
			if(e.keyCode === 13) {
				notifyObservers('submitSearch');
			}
		});
	}
});

angular.module('contactsApp')
.service('SettingsService', function() {
	var settings = {
		addressBooks: [
			'testAddr'
		]
	};

	this.set = function(key, value) {
		settings[key] = value;
	};

	this.get = function(key) {
		return settings[key];
	};

	this.getAll = function() {
		return settings;
	};
});

angular.module('contactsApp')
.service('SortByService', function () {
	var subscriptions = [];
	var sortBy = 'sortDisplayName';

	var defaultOrder = window.localStorage.getItem('contacts_default_order');
	if (defaultOrder) {
		sortBy = defaultOrder;
	}

	function notifyObservers () {
		angular.forEach(subscriptions, function (subscription) {
			if (typeof subscription === 'function') {
				subscription(sortBy);
			}
		});
	}

	return {
		subscribe: function (callback) {
			subscriptions.push (callback);
		},
		setSortBy: function (value) {
			sortBy = value;
			window.localStorage.setItem ('contacts_default_order', value);
			notifyObservers ();
		},
		getSortBy: function () {
			return sortBy;
		},
		getSortByList: function () {
			return {
				sortDisplayName: t('contacts', 'Display name'),
				sortFirstName: t('contacts', 'First name'),
				sortLastName: t('contacts', 'Last name')
			};
		}
	};
});

angular.module('contactsApp')
.service('vCardPropertiesService', function() {
	/**
	 * map vCard attributes to internal attributes
	 *
	 * propName: {
	 * 		multiple: [Boolean], // is this prop allowed more than once? (default = false)
	 * 		readableName: [String], // internationalized readable name of prop
	 * 		template: [String], // template name found in /templates/detailItems
	 * 		[...] // optional additional information which might get used by the template
	 * }
	 */
	this.vCardMeta = {
		nickname: {
			readableName: t('contacts', 'Nickname'),
			template: 'text'
		},
		n: {
			readableName: t('contacts', 'Detailed name'),
			defaultValue: {
				value:['', '', '', '', '']
			},
			template: 'n'
		},
		note: {
			readableName: t('contacts', 'Notes'),
			template: 'textarea'
		},
		url: {
			multiple: true,
			readableName: t('contacts', 'Website'),
			template: 'url'
		},
		cloud: {
			multiple: true,
			readableName: t('contacts', 'Federated Cloud ID'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]		},
		adr: {
			multiple: true,
			readableName: t('contacts', 'Address'),
			template: 'adr',
			defaultValue: {
				value:['', '', '', '', '', '', ''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		categories: {
			readableName: t('contacts', 'Groups'),
			template: 'groups'
		},
		bday: {
			readableName: t('contacts', 'Birthday'),
			template: 'date'
		},
		anniversary: {
			readableName: t('contacts', 'Anniversary'),
			template: 'date'
		},
		deathdate: {
			readableName: t('contacts', 'Date of death'),
			template: 'date'
		},
		email: {
			multiple: true,
			readableName: t('contacts', 'Email'),
			template: 'text',
			defaultValue: {
				value:'',
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		impp: {
			multiple: true,
			readableName: t('contacts', 'Instant messaging'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		tel: {
			multiple: true,
			readableName: t('contacts', 'Phone'),
			template: 'tel',
			defaultValue: {
				value:[''],
				meta:{type:['HOME,VOICE']}
			},
			options: [
				{id: 'HOME,VOICE', name: t('contacts', 'Home')},
				{id: 'WORK,VOICE', name: t('contacts', 'Work')},
				{id: 'CELL', name: t('contacts', 'Mobile')},
				{id: 'FAX', name: t('contacts', 'Fax')},
				{id: 'HOME,FAX', name: t('contacts', 'Fax home')},
				{id: 'WORK,FAX', name: t('contacts', 'Fax work')},
				{id: 'PAGER', name: t('contacts', 'Pager')},
				{id: 'VOICE', name: t('contacts', 'Voice')}
			]
		},
		'X-SOCIALPROFILE': {
			multiple: true,
			readableName: t('contacts', 'Social network'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['facebook']}
			},
			options: [
				{id: 'FACEBOOK', name: 'Facebook'},
				{id: 'TWITTER', name: 'Twitter'}
			]

		}
	};

	this.fieldOrder = [
		'org',
		'title',
		'tel',
		'email',
		'adr',
		'impp',
		'nick',
		'bday',
		'anniversary',
		'deathdate',
		'url',
		'X-SOCIALPROFILE',
		'note',
		'categories',
		'role'
	];

	this.fieldDefinitions = [];
	for (var prop in this.vCardMeta) {
		this.fieldDefinitions.push({id: prop, name: this.vCardMeta[prop].readableName, multiple: !!this.vCardMeta[prop].multiple});
	}

	this.fallbackMeta = function(property) {
		function capitalize(string) { return string.charAt(0).toUpperCase() + string.slice(1); }
		return {
			name: 'unknown-' + property,
			readableName: capitalize(property),
			template: 'hidden',
			necessity: 'optional'
		};
	};

	this.getMeta = function(property) {
		return this.vCardMeta[property] || this.fallbackMeta(property);
	};

});

angular.module('contactsApp')
.filter('JSON2vCard', function() {
	return function(input) {
		return vCard.generate(input);
	};
});

angular.module('contactsApp')
.filter('contactColor', function() {
	return function(input) {
		// Check if core has the new color generator
		if(typeof input.toHsl === 'function') {
			var hsl = input.toHsl();
			return 'hsl('+hsl[0]+', '+hsl[1]+'%, '+hsl[2]+'%)';
		} else {
			// If not, we use the old one
			/* global md5 */
			var hash = md5(input).substring(0, 4),
				maxRange = parseInt('ffff', 16),
				hue = parseInt(hash, 16) / maxRange * 256;
			return 'hsl(' + hue + ', 90%, 65%)';
		}
	};
});
angular.module('contactsApp')
.filter('contactGroupFilter', function() {
	'use strict';
	return function (contacts, group) {
		if (typeof contacts === 'undefined') {
			return contacts;
		}
		if (typeof group === 'undefined' || group.toLowerCase() === t('contacts', 'All contacts').toLowerCase()) {
			return contacts;
		}
		var filter = [];
		if (contacts.length > 0) {
			for (var i = 0; i < contacts.length; i++) {
				if (group.toLowerCase() === t('contacts', 'Not grouped').toLowerCase()) {
					if (contacts[i].categories().length === 0) {
						filter.push(contacts[i]);
					}
				} else {
					if (contacts[i].categories().indexOf(group) >= 0) {
						filter.push(contacts[i]);
					}
				}
			}
		}
		return filter;
	};
});

angular.module('contactsApp')
.filter('fieldFilter', function() {
	'use strict';
	return function (fields, contact) {
		if (typeof fields === 'undefined') {
			return fields;
		}
		if (typeof contact === 'undefined') {
			return fields;
		}
		var filter = [];
		if (fields.length > 0) {
			for (var i = 0; i < fields.length; i++) {
				if (fields[i].multiple ) {
					filter.push(fields[i]);
					continue;
				}
				if (_.isUndefined(contact.getProperty(fields[i].id))) {
					filter.push(fields[i]);
				}
			}
		}
		return filter;
	};
});

angular.module('contactsApp')
.filter('firstCharacter', function() {
	return function(input) {
		return input.charAt(0);
	};
});

angular.module('contactsApp')
.filter('localeOrderBy', [function () {
	return function (array, sortPredicate, reverseOrder) {
		if (!Array.isArray(array)) return array;
		if (!sortPredicate) return array;

		var arrayCopy = [];
		angular.forEach(array, function (item) {
			arrayCopy.push(item);
		});

		arrayCopy.sort(function (a, b) {
			var valueA = a[sortPredicate];
			if (angular.isFunction(valueA)) {
				valueA = a[sortPredicate]();
			}
			var valueB = b[sortPredicate];
			if (angular.isFunction(valueB)) {
				valueB = b[sortPredicate]();
			}

			if (angular.isString(valueA)) {
				return !reverseOrder ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
			}

			if (angular.isNumber(valueA) || typeof valueA === 'boolean') {
				return !reverseOrder ? valueA - valueB : valueB - valueA;
			}

			if (angular.isArray(valueA)) {
				if (valueA[0] === valueB[0]) {
					return !reverseOrder ? valueA[1].localeCompare(valueB[1]) : valueB[1].localeCompare(valueA[1]);
				}
				return !reverseOrder ? valueA[0].localeCompare(valueB[0]) : valueB[0].localeCompare(valueA[0]);
			}

			return 0;
		});

		return arrayCopy;
	};
}]);

angular.module('contactsApp')
.filter('newContact', function() {
	return function(input) {
		return input !== '' ? input : t('contacts', 'New contact');
	};
});

angular.module('contactsApp')
.filter('orderDetailItems', ['vCardPropertiesService', function(vCardPropertiesService) {
	'use strict';
	return function(items, field, reverse) {

		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});

		var fieldOrder = angular.copy(vCardPropertiesService.fieldOrder);
		// reverse to move custom items to the end (indexOf == -1)
		fieldOrder.reverse();

		filtered.sort(function (a, b) {
			if(fieldOrder.indexOf(a[field]) < fieldOrder.indexOf(b[field])) {
				return 1;
			}
			if(fieldOrder.indexOf(a[field]) > fieldOrder.indexOf(b[field])) {
				return -1;
			}
			return 0;
		});

		if(reverse) filtered.reverse();
		return filtered;
	};
}]);

angular.module('contactsApp')
.filter('toArray', function() {
	return function(obj) {
		if (!(obj instanceof Object)) return obj;
		return _.map(obj, function(val, key) {
			return Object.defineProperty(val, '$key', {value: key});
		});
	};
});

angular.module('contactsApp')
.filter('vCard2JSON', function() {
	return function(input) {
		return vCard.parse(input);
	};
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwibmV3Q29udGFjdEJ1dHRvbi9uZXdDb250YWN0QnV0dG9uX2NvbnRyb2xsZXIuanMiLCJuZXdDb250YWN0QnV0dG9uL25ld0NvbnRhY3RCdXR0b25fZGlyZWN0aXZlLmpzIiwicGFyc2Vycy90ZWxNb2RlbF9kaXJlY3RpdmUuanMiLCJzb3J0Qnkvc29ydEJ5X2NvbnRyb2xsZXIuanMiLCJzb3J0Qnkvc29ydEJ5X2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rX21vZGVsLmpzIiwiY29udGFjdF9tb2RlbC5qcyIsImFkZHJlc3NCb29rX3NlcnZpY2UuanMiLCJjb250YWN0X3NlcnZpY2UuanMiLCJkYXZDbGllbnRfc2VydmljZS5qcyIsImRhdl9zZXJ2aWNlLmpzIiwic2VhcmNoX3NlcnZpY2UuanMiLCJzZXR0aW5nc19zZXJ2aWNlLmpzIiwic29ydEJ5X3NlcnZpY2UuanMiLCJ2Q2FyZFByb3BlcnRpZXMuanMiLCJKU09OMnZDYXJkX2ZpbHRlci5qcyIsImNvbnRhY3RDb2xvcl9maWx0ZXIuanMiLCJjb250YWN0R3JvdXBfZmlsdGVyLmpzIiwiZmllbGRfZmlsdGVyLmpzIiwiZmlyc3RDaGFyYWN0ZXJfZmlsdGVyLmpzIiwibG9jYWxlT3JkZXJCeV9maWx0ZXIuanMiLCJuZXdDb250YWN0X2ZpbHRlci5qcyIsIm9yZGVyRGV0YWlsSXRlbXNfZmlsdGVyLmpzIiwidG9BcnJheV9maWx0ZXIuanMiLCJ2Q2FyZDJKU09OX2ZpbHRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQVVBLFFBQVEsT0FBTyxlQUFlLENBQUMsU0FBUyxpQkFBaUIsV0FBVyxnQkFBZ0IsYUFBYSxjQUFjO0NBQzlHLDBCQUFPLFNBQVMsZ0JBQWdCOztDQUVoQyxlQUFlLEtBQUssU0FBUztFQUM1QixVQUFVOzs7Q0FHWCxlQUFlLEtBQUssY0FBYztFQUNqQyxVQUFVOzs7Q0FHWCxlQUFlLFVBQVUsTUFBTSxFQUFFLFlBQVk7OztBQUc5QztBQ3hCQSxRQUFRLE9BQU87Q0FDZCxVQUFVLGNBQWMsV0FBVztDQUNuQyxPQUFPO0VBQ04sVUFBVTtFQUNWLFVBQVU7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SyxVQUFVLEdBQUcsR0FBRztHQUM3QixHQUFHLFdBQVcsUUFBUSxFQUFFLFVBQVUsV0FBVyxRQUFRLEVBQUUsU0FBUztJQUMvRCxPQUFPOztHQUVSLEdBQUcsV0FBVyxRQUFRLEVBQUUsVUFBVSxXQUFXLFFBQVEsRUFBRSxTQUFTO0lBQy9ELE9BQU8sQ0FBQzs7R0FFVCxPQUFPOzs7RUFHUixHQUFHLFNBQVMsU0FBUztFQUNyQixPQUFPOzs7QUFHVDtBQzVCQSxRQUFRLE9BQU87Q0FDZCxPQUFPLFdBQVcsV0FBVztDQUM3QixPQUFPLFNBQVMsS0FBSztFQUNwQixJQUFJLEVBQUUsZUFBZSxTQUFTLE9BQU87RUFDckMsT0FBTyxFQUFFLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztHQUNwQyxPQUFPLE9BQU8sZUFBZSxLQUFLLFFBQVEsQ0FBQyxPQUFPOzs7O0FBSXJEO0FDVEEsUUFBUSxPQUFPO0NBQ2QsT0FBTyxjQUFjLFdBQVc7Q0FDaEMsT0FBTyxTQUFTLE9BQU87RUFDdEIsT0FBTyxNQUFNLE1BQU07OztBQUdyQiIsImZpbGUiOiJzY3JpcHQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIG93bkNsb3VkIC0gY29udGFjdHNcbiAqXG4gKiBUaGlzIGZpbGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEFmZmVybyBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIHZlcnNpb24gMyBvclxuICogbGF0ZXIuIFNlZSB0aGUgQ09QWUlORyBmaWxlLlxuICpcbiAqIEBhdXRob3IgSGVuZHJpayBMZXBwZWxzYWNrIDxoZW5kcmlrQGxlcHBlbHNhY2suZGU+XG4gKiBAY29weXJpZ2h0IEhlbmRyaWsgTGVwcGVsc2FjayAyMDE1XG4gKi9cblxuYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJywgWyd1dWlkNCcsICdhbmd1bGFyLWNhY2hlJywgJ25nUm91dGUnLCAndWkuYm9vdHN0cmFwJywgJ3VpLnNlbGVjdCcsICduZ1Nhbml0aXplJywgJ25nY2xpcGJvYXJkJ10pXG4uY29uZmlnKGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKSB7XG5cblx0JHJvdXRlUHJvdmlkZXIud2hlbignLzpnaWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLndoZW4oJy86Z2lkLzp1aWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLm90aGVyd2lzZSgnLycgKyB0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2RhdGVwaWNrZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdHJlcXVpcmUgOiAnbmdNb2RlbCcsXG5cdFx0bGluayA6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIG5nTW9kZWxDdHJsKSB7XG5cdFx0XHQkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRlbGVtZW50LmRhdGVwaWNrZXIoe1xuXHRcdFx0XHRcdGRhdGVGb3JtYXQ6J3l5LW1tLWRkJyxcblx0XHRcdFx0XHRtaW5EYXRlOiBudWxsLFxuXHRcdFx0XHRcdG1heERhdGU6IG51bGwsXG5cdFx0XHRcdFx0Y29uc3RyYWluSW5wdXQ6IGZhbHNlLFxuXHRcdFx0XHRcdG9uU2VsZWN0OmZ1bmN0aW9uIChkYXRlLCBkcCkge1xuXHRcdFx0XHRcdFx0aWYgKGRwLnNlbGVjdGVkWWVhciA8IDEwMDApIHtcblx0XHRcdFx0XHRcdFx0ZGF0ZSA9ICcwJyArIGRhdGU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoZHAuc2VsZWN0ZWRZZWFyIDwgMTAwKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGUgPSAnMCcgKyBkYXRlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGRwLnNlbGVjdGVkWWVhciA8IDEwKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGUgPSAnMCcgKyBkYXRlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0bmdNb2RlbEN0cmwuJHNldFZpZXdWYWx1ZShkYXRlKTtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdmb2N1c0V4cHJlc3Npb24nLCBmdW5jdGlvbiAoJHRpbWVvdXQpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdGxpbms6IHtcblx0XHRcdHBvc3Q6IGZ1bmN0aW9uIHBvc3RMaW5rKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuXHRcdFx0XHRzY29wZS4kd2F0Y2goYXR0cnMuZm9jdXNFeHByZXNzaW9uLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKGF0dHJzLmZvY3VzRXhwcmVzc2lvbikge1xuXHRcdFx0XHRcdFx0aWYgKHNjb3BlLiRldmFsKGF0dHJzLmZvY3VzRXhwcmVzc2lvbikpIHtcblx0XHRcdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChlbGVtZW50LmlzKCdpbnB1dCcpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQuZmluZCgnaW5wdXQnKS5mb2N1cygpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSwgMTAwKTsgLy9uZWVkIHNvbWUgZGVsYXkgdG8gd29yayB3aXRoIG5nLWRpc2FibGVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdpbnB1dHJlc2l6ZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0bGluayA6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCkge1xuXHRcdFx0dmFyIGVsSW5wdXQgPSBlbGVtZW50LnZhbCgpO1xuXHRcdFx0ZWxlbWVudC5iaW5kKCdrZXlkb3duIGtleXVwIGxvYWQgZm9jdXMnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0ZWxJbnB1dCA9IGVsZW1lbnQudmFsKCk7XG5cdFx0XHRcdC8vIElmIHNldCB0byAwLCB0aGUgbWluLXdpZHRoIGNzcyBkYXRhIGlzIGlnbm9yZWRcblx0XHRcdFx0dmFyIGxlbmd0aCA9IGVsSW5wdXQubGVuZ3RoID4gMSA/IGVsSW5wdXQubGVuZ3RoIDogMTtcblx0XHRcdFx0ZWxlbWVudC5hdHRyKCdzaXplJywgbGVuZ3RoKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdhZGRyZXNzYm9va0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEFkZHJlc3NCb29rU2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC50ID0ge1xuXHRcdGNvcHlVcmxUaXRsZSA6IHQoJ2NvbnRhY3RzJywgJ0NvcHkgVXJsIHRvIGNsaXBib2FyZCcpLFxuXHRcdGRvd25sb2FkOiB0KCdjb250YWN0cycsICdEb3dubG9hZCcpLFxuXHRcdHNob3dVUkw6dCgnY29udGFjdHMnLCAnU2hvdyBVUkwnKSxcblx0XHRzaGFyZUFkZHJlc3Nib29rOiB0KCdjb250YWN0cycsICdTaGFyZSBBZGRyZXNzYm9vaycpLFxuXHRcdGRlbGV0ZUFkZHJlc3Nib29rOiB0KCdjb250YWN0cycsICdEZWxldGUgQWRkcmVzc2Jvb2snKSxcblx0XHRzaGFyZUlucHV0UGxhY2VIb2xkZXI6IHQoJ2NvbnRhY3RzJywgJ1NoYXJlIHdpdGggdXNlcnMgb3IgZ3JvdXBzJyksXG5cdFx0ZGVsZXRlOiB0KCdjb250YWN0cycsICdEZWxldGUnKSxcblx0XHRjYW5FZGl0OiB0KCdjb250YWN0cycsICdjYW4gZWRpdCcpXG5cdH07XG5cblx0Y3RybC5zaG93VXJsID0gZmFsc2U7XG5cdC8qIGdsb2JhbHMgb2NfY29uZmlnICovXG5cdC8qIGVzbGludC1kaXNhYmxlIGNhbWVsY2FzZSAqL1xuXHRjdHJsLmNhbkV4cG9ydCA9IG9jX2NvbmZpZy52ZXJzaW9uLnNwbGl0KCcuJykgPj0gWzksIDAsIDIsIDBdO1xuXHQvKiBlc2xpbnQtZW5hYmxlIGNhbWVsY2FzZSAqL1xuXG5cdGN0cmwudG9nZ2xlU2hvd1VybCA9IGZ1bmN0aW9uKCkge1xuXHRcdGN0cmwuc2hvd1VybCA9ICFjdHJsLnNob3dVcmw7XG5cdH07XG5cblx0Y3RybC50b2dnbGVTaGFyZXNFZGl0b3IgPSBmdW5jdGlvbigpIHtcblx0XHRjdHJsLmVkaXRpbmdTaGFyZXMgPSAhY3RybC5lZGl0aW5nU2hhcmVzO1xuXHRcdGN0cmwuc2VsZWN0ZWRTaGFyZWUgPSBudWxsO1xuXHR9O1xuXG5cdC8qIEZyb20gQ2FsZW5kYXItUmV3b3JrIC0ganMvYXBwL2NvbnRyb2xsZXJzL2NhbGVuZGFybGlzdGNvbnRyb2xsZXIuanMgKi9cblx0Y3RybC5maW5kU2hhcmVlID0gZnVuY3Rpb24gKHZhbCkge1xuXHRcdHJldHVybiAkLmdldChcblx0XHRcdE9DLmxpbmtUb09DUygnYXBwcy9maWxlc19zaGFyaW5nL2FwaS92MScpICsgJ3NoYXJlZXMnLFxuXHRcdFx0e1xuXHRcdFx0XHRmb3JtYXQ6ICdqc29uJyxcblx0XHRcdFx0c2VhcmNoOiB2YWwudHJpbSgpLFxuXHRcdFx0XHRwZXJQYWdlOiAyMDAsXG5cdFx0XHRcdGl0ZW1UeXBlOiAncHJpbmNpcGFscydcblx0XHRcdH1cblx0XHQpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHQvLyBUb2RvIC0gZmlsdGVyIG91dCBjdXJyZW50IHVzZXIsIGV4aXN0aW5nIHNoYXJlZXNcblx0XHRcdHZhciB1c2VycyAgID0gcmVzdWx0Lm9jcy5kYXRhLmV4YWN0LnVzZXJzLmNvbmNhdChyZXN1bHQub2NzLmRhdGEudXNlcnMpO1xuXHRcdFx0dmFyIGdyb3VwcyAgPSByZXN1bHQub2NzLmRhdGEuZXhhY3QuZ3JvdXBzLmNvbmNhdChyZXN1bHQub2NzLmRhdGEuZ3JvdXBzKTtcblxuXHRcdFx0dmFyIHVzZXJTaGFyZXMgPSBjdHJsLmFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnM7XG5cdFx0XHR2YXIgdXNlclNoYXJlc0xlbmd0aCA9IHVzZXJTaGFyZXMubGVuZ3RoO1xuXHRcdFx0dmFyIGksIGo7XG5cblx0XHRcdC8vIEZpbHRlciBvdXQgY3VycmVudCB1c2VyXG5cdFx0XHR2YXIgdXNlcnNMZW5ndGggPSB1c2Vycy5sZW5ndGg7XG5cdFx0XHRmb3IgKGkgPSAwIDsgaSA8IHVzZXJzTGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHVzZXJzW2ldLnZhbHVlLnNoYXJlV2l0aCA9PT0gT0MuY3VycmVudFVzZXIpIHtcblx0XHRcdFx0XHR1c2Vycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gTm93IGZpbHRlciBvdXQgYWxsIHNoYXJlZXMgdGhhdCBhcmUgYWxyZWFkeSBzaGFyZWQgd2l0aFxuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHVzZXJTaGFyZXNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHR2YXIgc2hhcmUgPSB1c2VyU2hhcmVzW2ldO1xuXHRcdFx0XHR1c2Vyc0xlbmd0aCA9IHVzZXJzLmxlbmd0aDtcblx0XHRcdFx0Zm9yIChqID0gMDsgaiA8IHVzZXJzTGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHRpZiAodXNlcnNbal0udmFsdWUuc2hhcmVXaXRoID09PSBzaGFyZS5pZCkge1xuXHRcdFx0XHRcdFx0dXNlcnMuc3BsaWNlKGosIDEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbWJpbmUgdXNlcnMgYW5kIGdyb3Vwc1xuXHRcdFx0dXNlcnMgPSB1c2Vycy5tYXAoZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRpc3BsYXk6IGl0ZW0udmFsdWUuc2hhcmVXaXRoLFxuXHRcdFx0XHRcdHR5cGU6IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUixcblx0XHRcdFx0XHRpZGVudGlmaWVyOiBpdGVtLnZhbHVlLnNoYXJlV2l0aFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHRcdGdyb3VwcyA9IGdyb3Vwcy5tYXAoZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRpc3BsYXk6IGl0ZW0udmFsdWUuc2hhcmVXaXRoICsgJyAoZ3JvdXApJyxcblx0XHRcdFx0XHR0eXBlOiBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IGl0ZW0udmFsdWUuc2hhcmVXaXRoXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIGdyb3Vwcy5jb25jYXQodXNlcnMpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwub25TZWxlY3RTaGFyZWUgPSBmdW5jdGlvbiAoaXRlbSkge1xuXHRcdGN0cmwuc2VsZWN0ZWRTaGFyZWUgPSBudWxsO1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBpdGVtLnR5cGUsIGl0ZW0uaWRlbnRpZmllciwgZmFsc2UsIGZhbHNlKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXG5cdH07XG5cblx0Y3RybC51cGRhdGVFeGlzdGluZ1VzZXJTaGFyZSA9IGZ1bmN0aW9uKHVzZXJJZCwgd3JpdGFibGUpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLCB1c2VySWQsIHdyaXRhYmxlLCB0cnVlKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudXBkYXRlRXhpc3RpbmdHcm91cFNoYXJlID0gZnVuY3Rpb24oZ3JvdXBJZCwgd3JpdGFibGUpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCwgZ3JvdXBJZCwgd3JpdGFibGUsIHRydWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51bnNoYXJlRnJvbVVzZXIgPSBmdW5jdGlvbih1c2VySWQpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UudW5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsIHVzZXJJZCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVuc2hhcmVGcm9tR3JvdXAgPSBmdW5jdGlvbihncm91cElkKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnVuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCwgZ3JvdXBJZCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUFkZHJlc3NCb29rID0gZnVuY3Rpb24oKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmRlbGV0ZShjdHJsLmFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdhZGRyZXNzYm9vaycsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHtcblx0XHRcdGluZGV4OiAnQCdcblx0XHR9LFxuXHRcdGNvbnRyb2xsZXI6ICdhZGRyZXNzYm9va0N0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGFkZHJlc3NCb29rOiAnPWRhdGEnLFxuXHRcdFx0bGlzdDogJz0nXG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYWRkcmVzc0Jvb2suaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYWRkcmVzc2Jvb2tsaXN0Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgQWRkcmVzc0Jvb2tTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmxvYWRpbmcgPSB0cnVlO1xuXG5cdEFkZHJlc3NCb29rU2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rcykge1xuXHRcdGN0cmwuYWRkcmVzc0Jvb2tzID0gYWRkcmVzc0Jvb2tzO1xuXHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdGlmKGN0cmwuYWRkcmVzc0Jvb2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmNyZWF0ZSh0KCdjb250YWN0cycsICdDb250YWN0cycpKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWRkcmVzc0Jvb2sodCgnY29udGFjdHMnLCAnQ29udGFjdHMnKSkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdGN0cmwuYWRkcmVzc0Jvb2tzLnB1c2goYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRyZXNzQm9va05hbWUgOiB0KCdjb250YWN0cycsICdBZGRyZXNzIGJvb2sgbmFtZScpXG5cdH07XG5cblx0Y3RybC5jcmVhdGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKSB7XG5cdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuY3JlYXRlKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWRkcmVzc0Jvb2soY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRjdHJsLmFkZHJlc3NCb29rcy5wdXNoKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0XHRjdHJsLm5ld0FkZHJlc3NCb29rTmFtZSA9ICcnO1xuXHRcdFx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdhZGRyZXNzYm9va2xpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rbGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9va0xpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYXZhdGFyQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYXZhdGFyJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHRpZiAoZmlsZS5zaXplID4gMTAyNCoxMDI0KSB7IC8vIDEgTUJcblx0XHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdUaGUgc2VsZWN0ZWQgaW1hZ2UgaXMgdG9vIGJpZyAobWF4IDFNQiknKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c2NvcGUuY29udGFjdC5waG90byhyZWFkZXIucmVzdWx0KTtcblx0XHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UudXBkYXRlKHNjb3BlLmNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYXZhdGFyLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RDdHJsJywgZnVuY3Rpb24oJHJvdXRlLCAkcm91dGVQYXJhbXMsIFNvcnRCeVNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwub3BlbkNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogY3RybC5jb250YWN0LnVpZCgpfSk7XG5cdH07XG5cblx0Y3RybC5nZXROYW1lID0gZnVuY3Rpb24oKSB7XG5cdFx0Ly8gSWYgbGFzdE5hbWUgZXF1YWxzIHRvIGZpcnN0TmFtZSB0aGVuIG5vbmUgb2YgdGhlbSBpcyBzZXRcblx0XHRpZiAoY3RybC5jb250YWN0Lmxhc3ROYW1lKCkgPT09IGN0cmwuY29udGFjdC5maXJzdE5hbWUoKSkge1xuXHRcdFx0cmV0dXJuIGN0cmwuY29udGFjdC5kaXNwbGF5TmFtZSgpO1xuXHRcdH1cblxuXHRcdGlmIChTb3J0QnlTZXJ2aWNlLmdldFNvcnRCeSgpID09PSAnc29ydExhc3ROYW1lJykge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0Y3RybC5jb250YWN0Lmxhc3ROYW1lKCkgKyAnLCAnXG5cdFx0XHRcdCsgY3RybC5jb250YWN0LmZpcnN0TmFtZSgpICsgJyAnXG5cdFx0XHRcdCsgY3RybC5jb250YWN0LmFkZGl0aW9uYWxOYW1lcygpXG5cdFx0XHQpLnRyaW0oKTtcblx0XHR9XG5cblx0XHRpZiAoU29ydEJ5U2VydmljZS5nZXRTb3J0QnkoKSA9PT0gJ3NvcnRGaXJzdE5hbWUnKSB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHRjdHJsLmNvbnRhY3QuZmlyc3ROYW1lKCkgKyAnICdcblx0XHRcdFx0KyBjdHJsLmNvbnRhY3QuYWRkaXRpb25hbE5hbWVzKCkgKyAnICdcblx0XHRcdFx0KyBjdHJsLmNvbnRhY3QubGFzdE5hbWUoKVxuXHRcdFx0KS50cmltKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN0cmwuY29udGFjdC5kaXNwbGF5TmFtZSgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnY29udGFjdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGNvbnRhY3Q6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RkZXRhaWxzQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlLCBBZGRyZXNzQm9va1NlcnZpY2UsIHZDYXJkUHJvcGVydGllc1NlcnZpY2UsICRyb3V0ZSwgJHJvdXRlUGFyYW1zLCAkc2NvcGUpIHtcblxuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblx0Y3RybC5zaG93ID0gZmFsc2U7XG5cblx0Y3RybC5jbGVhckNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdFx0Y3RybC5zaG93ID0gZmFsc2U7XG5cdFx0Y3RybC5jb250YWN0ID0gdW5kZWZpbmVkO1xuXHR9O1xuXG5cdGN0cmwudWlkID0gJHJvdXRlUGFyYW1zLnVpZDtcblx0Y3RybC50ID0ge1xuXHRcdG5vQ29udGFjdHMgOiB0KCdjb250YWN0cycsICdObyBjb250YWN0cyBpbiBoZXJlJyksXG5cdFx0cGxhY2Vob2xkZXJOYW1lIDogdCgnY29udGFjdHMnLCAnTmFtZScpLFxuXHRcdHBsYWNlaG9sZGVyT3JnIDogdCgnY29udGFjdHMnLCAnT3JnYW5pemF0aW9uJyksXG5cdFx0cGxhY2Vob2xkZXJUaXRsZSA6IHQoJ2NvbnRhY3RzJywgJ1RpdGxlJyksXG5cdFx0c2VsZWN0RmllbGQgOiB0KCdjb250YWN0cycsICdBZGQgZmllbGQgLi4uJyksXG5cdFx0ZG93bmxvYWQgOiB0KCdjb250YWN0cycsICdEb3dubG9hZCcpLFxuXHRcdGRlbGV0ZSA6IHQoJ2NvbnRhY3RzJywgJ0RlbGV0ZScpXG5cdH07XG5cblx0Y3RybC5maWVsZERlZmluaXRpb25zID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5maWVsZERlZmluaXRpb25zO1xuXHRjdHJsLmZvY3VzID0gdW5kZWZpbmVkO1xuXHRjdHJsLmZpZWxkID0gdW5kZWZpbmVkO1xuXHRjdHJsLmFkZHJlc3NCb29rcyA9IFtdO1xuXG5cdEFkZHJlc3NCb29rU2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rcykge1xuXHRcdGN0cmwuYWRkcmVzc0Jvb2tzID0gYWRkcmVzc0Jvb2tzO1xuXG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuY29udGFjdCkpIHtcblx0XHRcdGN0cmwuYWRkcmVzc0Jvb2sgPSBfLmZpbmQoY3RybC5hZGRyZXNzQm9va3MsIGZ1bmN0aW9uKGJvb2spIHtcblx0XHRcdFx0cmV0dXJuIGJvb2suZGlzcGxheU5hbWUgPT09IGN0cmwuY29udGFjdC5hZGRyZXNzQm9va0lkO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHR9KTtcblxuXHQkc2NvcGUuJHdhdGNoKCdjdHJsLnVpZCcsIGZ1bmN0aW9uKG5ld1ZhbHVlKSB7XG5cdFx0Y3RybC5jaGFuZ2VDb250YWN0KG5ld1ZhbHVlKTtcblx0fSk7XG5cblx0Y3RybC5jaGFuZ2VDb250YWN0ID0gZnVuY3Rpb24odWlkKSB7XG5cdFx0aWYgKHR5cGVvZiB1aWQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHRcdCQoJyNhcHAtbmF2aWdhdGlvbi10b2dnbGUnKS5yZW1vdmVDbGFzcygnc2hvd2RldGFpbHMnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Q29udGFjdFNlcnZpY2UuZ2V0QnlJZCh1aWQpLnRoZW4oZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0aWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQoY29udGFjdCkpIHtcblx0XHRcdFx0Y3RybC5jbGVhckNvbnRhY3QoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y3RybC5jb250YWN0ID0gY29udGFjdDtcblx0XHRcdGN0cmwuc2hvdyA9IHRydWU7XG5cdFx0XHQkKCcjYXBwLW5hdmlnYXRpb24tdG9nZ2xlJykuYWRkQ2xhc3MoJ3Nob3dkZXRhaWxzJyk7XG5cblx0XHRcdGN0cmwuYWRkcmVzc0Jvb2sgPSBfLmZpbmQoY3RybC5hZGRyZXNzQm9va3MsIGZ1bmN0aW9uKGJvb2spIHtcblx0XHRcdFx0cmV0dXJuIGJvb2suZGlzcGxheU5hbWUgPT09IGN0cmwuY29udGFjdC5hZGRyZXNzQm9va0lkO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVDb250YWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0Q29udGFjdFNlcnZpY2UudXBkYXRlKGN0cmwuY29udGFjdCk7XG5cdH07XG5cblx0Y3RybC5kZWxldGVDb250YWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0Q29udGFjdFNlcnZpY2UuZGVsZXRlKGN0cmwuY29udGFjdCk7XG5cdH07XG5cblx0Y3RybC5hZGRGaWVsZCA9IGZ1bmN0aW9uKGZpZWxkKSB7XG5cdFx0dmFyIGRlZmF1bHRWYWx1ZSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShmaWVsZCkuZGVmYXVsdFZhbHVlIHx8IHt2YWx1ZTogJyd9O1xuXHRcdGN0cmwuY29udGFjdC5hZGRQcm9wZXJ0eShmaWVsZCwgZGVmYXVsdFZhbHVlKTtcblx0XHRjdHJsLmZvY3VzID0gZmllbGQ7XG5cdFx0Y3RybC5maWVsZCA9ICcnO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlRmllbGQgPSBmdW5jdGlvbiAoZmllbGQsIHByb3ApIHtcblx0XHRjdHJsLmNvbnRhY3QucmVtb3ZlUHJvcGVydHkoZmllbGQsIHByb3ApO1xuXHRcdGN0cmwuZm9jdXMgPSB1bmRlZmluZWQ7XG5cdH07XG5cblx0Y3RybC5jaGFuZ2VBZGRyZXNzQm9vayA9IGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdENvbnRhY3RTZXJ2aWNlLm1vdmVDb250YWN0KGN0cmwuY29udGFjdCwgYWRkcmVzc0Jvb2spO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGRldGFpbHMnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRwcmlvcml0eTogMSxcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2NvbnRhY3RkZXRhaWxzQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge30sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3REZXRhaWxzLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RpbXBvcnRDdHJsJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwuaW1wb3J0ID0gQ29udGFjdFNlcnZpY2UuaW1wb3J0LmJpbmQoQ29udGFjdFNlcnZpY2UpO1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0aW1wb3J0JywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCkge1xuXHRcdFx0dmFyIGltcG9ydFRleHQgPSB0KCdjb250YWN0cycsICdJbXBvcnQnKTtcblx0XHRcdHNjb3BlLmltcG9ydFRleHQgPSBpbXBvcnRUZXh0O1xuXG5cdFx0XHR2YXIgaW5wdXQgPSBlbGVtZW50LmZpbmQoJ2lucHV0Jyk7XG5cdFx0XHRpbnB1dC5iaW5kKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0YW5ndWxhci5mb3JFYWNoKGlucHV0LmdldCgwKS5maWxlcywgZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG5cdFx0XHRcdFx0cmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRzY29wZS4kYXBwbHkoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRDb250YWN0U2VydmljZS5pbXBvcnQuY2FsbChDb250YWN0U2VydmljZSwgcmVhZGVyLnJlc3VsdCwgZmlsZS50eXBlLCBudWxsLCBmdW5jdGlvbiAocHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocHJvZ3Jlc3MgPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHNjb3BlLmltcG9ydFRleHQgPSBpbXBvcnRUZXh0O1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gcGFyc2VJbnQoTWF0aC5mbG9vcihwcm9ncmVzcyAqIDEwMCkpICsgJyUnO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9LCBmYWxzZSk7XG5cblx0XHRcdFx0XHRpZiAoZmlsZSkge1xuXHRcdFx0XHRcdFx0cmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aW5wdXQuZ2V0KDApLnZhbHVlID0gJyc7XG5cdFx0XHR9KTtcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0SW1wb3J0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RsaXN0Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGZpbHRlciwgJHJvdXRlLCAkcm91dGVQYXJhbXMsIENvbnRhY3RTZXJ2aWNlLCBTb3J0QnlTZXJ2aWNlLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBTZWFyY2hTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnJvdXRlUGFyYW1zID0gJHJvdXRlUGFyYW1zO1xuXG5cdGN0cmwuY29udGFjdExpc3QgPSBbXTtcblx0Y3RybC5zZWFyY2hUZXJtID0gJyc7XG5cdGN0cmwuc2hvdyA9IHRydWU7XG5cdGN0cmwuaW52YWxpZCA9IGZhbHNlO1xuXG5cdGN0cmwuc29ydEJ5ID0gU29ydEJ5U2VydmljZS5nZXRTb3J0QnkoKTtcblxuXHRjdHJsLnQgPSB7XG5cdFx0ZW1wdHlTZWFyY2ggOiB0KCdjb250YWN0cycsICdObyBzZWFyY2ggcmVzdWx0IGZvciB7cXVlcnl9Jywge3F1ZXJ5OiBjdHJsLnNlYXJjaFRlcm19KVxuXHR9O1xuXG5cdCRzY29wZS5nZXRDb3VudFN0cmluZyA9IGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0cmV0dXJuIG4oJ2NvbnRhY3RzJywgJyVuIGNvbnRhY3QnLCAnJW4gY29udGFjdHMnLCBjb250YWN0cy5sZW5ndGgpO1xuXHR9O1xuXG5cdCRzY29wZS5xdWVyeSA9IGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRyZXR1cm4gY29udGFjdC5tYXRjaGVzKFNlYXJjaFNlcnZpY2UuZ2V0U2VhcmNoVGVybSgpKTtcblx0fTtcblxuXHRTb3J0QnlTZXJ2aWNlLnN1YnNjcmliZShmdW5jdGlvbihuZXdWYWx1ZSkge1xuXHRcdGN0cmwuc29ydEJ5ID0gbmV3VmFsdWU7XG5cdH0pO1xuXG5cdFNlYXJjaFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnc3VibWl0U2VhcmNoJykge1xuXHRcdFx0dmFyIHVpZCA9ICFfLmlzRW1wdHkoY3RybC5jb250YWN0TGlzdCkgPyBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpIDogdW5kZWZpbmVkO1xuXHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKHVpZCk7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fVxuXHRcdGlmIChldi5ldmVudCA9PT0gJ2NoYW5nZVNlYXJjaCcpIHtcblx0XHRcdGN0cmwuc2VhcmNoVGVybSA9IGV2LnNlYXJjaFRlcm07XG5cdFx0XHRjdHJsLnQuZW1wdHlTZWFyY2ggPSB0KCdjb250YWN0cycsXG5cdFx0XHRcdFx0XHRcdFx0ICAgJ05vIHNlYXJjaCByZXN1bHQgZm9yIHtxdWVyeX0nLFxuXHRcdFx0XHRcdFx0XHRcdCAgIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfVxuXHRcdFx0XHRcdFx0XHRcdCAgKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0Q29udGFjdFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdGlmIChldi5ldmVudCA9PT0gJ2RlbGV0ZScpIHtcblx0XHRcdFx0aWYgKGN0cmwuY29udGFjdExpc3QubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHR1aWQ6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdFtpXS51aWQoKSA9PT0gZXYudWlkKSB7XG5cdFx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdFx0XHR1aWQ6IChjdHJsLmNvbnRhY3RMaXN0W2krMV0pID8gY3RybC5jb250YWN0TGlzdFtpKzFdLnVpZCgpIDogY3RybC5jb250YWN0TGlzdFtpLTFdLnVpZCgpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGV2LmV2ZW50ID09PSAnY3JlYXRlJykge1xuXHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0dWlkOiBldi51aWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3RzID0gZXYuY29udGFjdHM7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIEdldCBjb250YWN0c1xuXHRDb250YWN0U2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0aWYoY29udGFjdHMubGVuZ3RoPjApIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGN0cmwuY29udGFjdHMgPSBjb250YWN0cztcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhaXQgZm9yIGN0cmwuY29udGFjdExpc3QgdG8gYmUgdXBkYXRlZCwgbG9hZCB0aGUgZmlyc3QgY29udGFjdCBhbmQga2lsbCB0aGUgd2F0Y2hcblx0dmFyIHVuYmluZExpc3RXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgYSBzcGVjaWZpYyB1aWQgaXMgcmVxdWVzdGVkXG5cdFx0XHRpZigkcm91dGVQYXJhbXMudWlkICYmICRyb3V0ZVBhcmFtcy5naWQpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0TGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFx0XHRpZihjb250YWN0LnVpZCgpID09PSAkcm91dGVQYXJhbXMudWlkKSB7XG5cdFx0XHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoJHJvdXRlUGFyYW1zLnVpZCk7XG5cdFx0XHRcdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTm8gY29udGFjdCBwcmV2aW91c2x5IGxvYWRlZCwgbGV0J3MgbG9hZCB0aGUgZmlyc3Qgb2YgdGhlIGxpc3QgaWYgbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0XHRpZihjdHJsLmxvYWRpbmcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkpO1xuXHRcdFx0fVxuXHRcdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHR1bmJpbmRMaXN0V2F0Y2goKTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMudWlkJywgZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG5cdFx0Ly8gVXNlZCBmb3IgbW9iaWxlIHZpZXcgdG8gY2xlYXIgdGhlIHVybFxuXHRcdGlmKHR5cGVvZiBvbGRWYWx1ZSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbmV3VmFsdWUgPT0gJ3VuZGVmaW5lZCcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPD0gNzY4KSB7XG5cdFx0XHQvLyBubyBjb250YWN0IHNlbGVjdGVkXG5cdFx0XHRjdHJsLnNob3cgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZihuZXdWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR1bmJpbmRXYXRjaCgpOyAvLyB1bmJpbmQgYXMgd2Ugb25seSB3YW50IG9uZSB1cGRhdGVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGRpc3BsYXlpbmcgY29udGFjdCBkZXRhaWxzXG5cdFx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMuZ2lkJywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gd2UgbWlnaHQgaGF2ZSB0byB3YWl0IHVudGlsIG5nLXJlcGVhdCBmaWxsZWQgdGhlIGNvbnRhY3RMaXN0XG5cdFx0Y3RybC5jb250YWN0TGlzdCA9IFtdO1xuXHRcdC8vIG5vdCBpbiBtb2JpbGUgbW9kZVxuXHRcdGlmKCQod2luZG93KS53aWR0aCgpID4gNzY4KSB7XG5cdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdHZhciB1bmJpbmRXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBXYXRjaCBpZiB3ZSBoYXZlIGFuIGludmFsaWQgY29udGFjdFxuXHQkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0WzBdLmRpc3BsYXlOYW1lKCknLCBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdGN0cmwuaW52YWxpZCA9IChkaXNwbGF5TmFtZSA9PT0gJycpO1xuXHR9KTtcblxuXHRjdHJsLmhhc0NvbnRhY3RzID0gZnVuY3Rpb24gKCkge1xuXHRcdGlmICghY3RybC5jb250YWN0cykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gY3RybC5jb250YWN0cy5sZW5ndGggPiAwO1xuXHR9O1xuXG5cdGN0cmwuc2V0U2VsZWN0ZWRJZCA9IGZ1bmN0aW9uIChjb250YWN0SWQpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdHVpZDogY29udGFjdElkXG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5nZXRTZWxlY3RlZElkID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICRyb3V0ZVBhcmFtcy51aWQ7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0bGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGFkZHJlc3Nib29rOiAnPWFkcmJvb2snXG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdExpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignZGV0YWlsc0l0ZW1DdHJsJywgZnVuY3Rpb24oJHRlbXBsYXRlUmVxdWVzdCwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgQ29udGFjdFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubWV0YSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShjdHJsLm5hbWUpO1xuXHRjdHJsLnR5cGUgPSB1bmRlZmluZWQ7XG5cdGN0cmwuaXNQcmVmZXJyZWQgPSBmYWxzZTtcblx0Y3RybC50ID0ge1xuXHRcdHBvQm94IDogdCgnY29udGFjdHMnLCAnUG9zdCBvZmZpY2UgYm94JyksXG5cdFx0cG9zdGFsQ29kZSA6IHQoJ2NvbnRhY3RzJywgJ1Bvc3RhbCBjb2RlJyksXG5cdFx0Y2l0eSA6IHQoJ2NvbnRhY3RzJywgJ0NpdHknKSxcblx0XHRzdGF0ZSA6IHQoJ2NvbnRhY3RzJywgJ1N0YXRlIG9yIHByb3ZpbmNlJyksXG5cdFx0Y291bnRyeSA6IHQoJ2NvbnRhY3RzJywgJ0NvdW50cnknKSxcblx0XHRhZGRyZXNzOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0bmV3R3JvdXA6IHQoJ2NvbnRhY3RzJywgJyhuZXcgZ3JvdXApJyksXG5cdFx0ZmFtaWx5TmFtZTogdCgnY29udGFjdHMnLCAnTGFzdCBuYW1lJyksXG5cdFx0Zmlyc3ROYW1lOiB0KCdjb250YWN0cycsICdGaXJzdCBuYW1lJyksXG5cdFx0YWRkaXRpb25hbE5hbWVzOiB0KCdjb250YWN0cycsICdBZGRpdGlvbmFsIG5hbWVzJyksXG5cdFx0aG9ub3JpZmljUHJlZml4OiB0KCdjb250YWN0cycsICdQcmVmaXgnKSxcblx0XHRob25vcmlmaWNTdWZmaXg6IHQoJ2NvbnRhY3RzJywgJ1N1ZmZpeCcpLFxuXHRcdGRlbGV0ZTogdCgnY29udGFjdHMnLCAnRGVsZXRlJylcblx0fTtcblxuXHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLm1ldGEub3B0aW9ucyB8fCBbXTtcblx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm1ldGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5tZXRhLnR5cGUpKSB7XG5cdFx0Ly8gcGFyc2UgdHlwZSBvZiB0aGUgcHJvcGVydHlcblx0XHR2YXIgYXJyYXkgPSBjdHJsLmRhdGEubWV0YS50eXBlWzBdLnNwbGl0KCcsJyk7XG5cdFx0YXJyYXkgPSBhcnJheS5tYXAoZnVuY3Rpb24gKGVsZW0pIHtcblx0XHRcdHJldHVybiBlbGVtLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKS5yZXBsYWNlKC9cXFxcKyQvLCAnJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSk7XG5cdFx0Ly8gdGhlIHByZWYgdmFsdWUgaXMgaGFuZGxlZCBvbiBpdHMgb3duIHNvIHRoYXQgd2UgY2FuIGFkZCBzb21lIGZhdm9yaXRlIGljb24gdG8gdGhlIHVpIGlmIHdlIHdhbnRcblx0XHRpZiAoYXJyYXkuaW5kZXhPZignUFJFRicpID49IDApIHtcblx0XHRcdGN0cmwuaXNQcmVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0YXJyYXkuc3BsaWNlKGFycmF5LmluZGV4T2YoJ1BSRUYnKSwgMSk7XG5cdFx0fVxuXHRcdC8vIHNpbXBseSBqb2luIHRoZSB1cHBlciBjYXNlZCB0eXBlcyB0b2dldGhlciBhcyBrZXlcblx0XHRjdHJsLnR5cGUgPSBhcnJheS5qb2luKCcsJyk7XG5cdFx0dmFyIGRpc3BsYXlOYW1lID0gYXJyYXkubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGVsZW1lbnQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcblx0XHR9KS5qb2luKCcgJyk7XG5cblx0XHQvLyBpbiBjYXNlIHRoZSB0eXBlIGlzIG5vdCB5ZXQgaW4gdGhlIGRlZmF1bHQgbGlzdCBvZiBhdmFpbGFibGUgb3B0aW9ucyB3ZSBhZGQgaXRcblx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IGN0cmwudHlwZTsgfSApKSB7XG5cdFx0XHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLmF2YWlsYWJsZU9wdGlvbnMuY29uY2F0KFt7aWQ6IGN0cmwudHlwZSwgbmFtZTogZGlzcGxheU5hbWV9XSk7XG5cdFx0fVxuXHR9XG5cdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5uYW1lc3BhY2UpKSB7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10pKSB7XG5cdFx0XHR2YXIgdmFsID0gXy5maW5kKHRoaXMubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10sIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgubmFtZXNwYWNlID09PSBjdHJsLmRhdGEubmFtZXNwYWNlOyB9KTtcblx0XHRcdGN0cmwudHlwZSA9IHZhbC52YWx1ZTtcblx0XHRcdGlmICghXy5pc1VuZGVmaW5lZCh2YWwpKSB7XG5cdFx0XHRcdC8vIGluIGNhc2UgdGhlIHR5cGUgaXMgbm90IHlldCBpbiB0aGUgZGVmYXVsdCBsaXN0IG9mIGF2YWlsYWJsZSBvcHRpb25zIHdlIGFkZCBpdFxuXHRcdFx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IHZhbC52YWx1ZTsgfSApKSB7XG5cdFx0XHRcdFx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5hdmFpbGFibGVPcHRpb25zLmNvbmNhdChbe2lkOiB2YWwudmFsdWUsIG5hbWU6IHZhbC52YWx1ZX1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IFtdO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5hdmFpbGFibGVHcm91cHMgPSBfLnVuaXF1ZShncm91cHMpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZVR5cGUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0aWYgKGN0cmwuaXNQcmVmZXJyZWQpIHtcblx0XHRcdHZhbCArPSAnLFBSRUYnO1xuXHRcdH1cblx0XHRjdHJsLmRhdGEubWV0YSA9IGN0cmwuZGF0YS5tZXRhIHx8IHt9O1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGUgPSBjdHJsLmRhdGEubWV0YS50eXBlIHx8IFtdO1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0gPSB2YWw7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC5kYXRlSW5wdXRDaGFuZ2VkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwuZGF0YS5tZXRhID0gY3RybC5kYXRhLm1ldGEgfHwge307XG5cblx0XHR2YXIgbWF0Y2ggPSBjdHJsLmRhdGEudmFsdWUubWF0Y2goL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdGN0cmwuZGF0YS5tZXRhLnZhbHVlID0gW107XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0cmwuZGF0YS5tZXRhLnZhbHVlID0gY3RybC5kYXRhLm1ldGEudmFsdWUgfHwgW107XG5cdFx0XHRjdHJsLmRhdGEubWV0YS52YWx1ZVswXSA9ICd0ZXh0Jztcblx0XHR9XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVEZXRhaWxlZE5hbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZuID0gJyc7XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVszXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzNdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzFdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMV0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMl0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsyXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVswXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzBdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzRdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbNF07XG5cdFx0fVxuXG5cdFx0Y3RybC5tb2RlbC5jb250YWN0LmZ1bGxOYW1lKGZuKTtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLmdldFRlbXBsYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRlbXBsYXRlVXJsID0gT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZGV0YWlsSXRlbXMvJyArIGN0cmwubWV0YS50ZW1wbGF0ZSArICcuaHRtbCcpO1xuXHRcdHJldHVybiAkdGVtcGxhdGVSZXF1ZXN0KHRlbXBsYXRlVXJsKTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwubW9kZWwuZGVsZXRlRmllbGQoY3RybC5uYW1lLCBjdHJsLmRhdGEpO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGV0YWlsc2l0ZW0nLCBbJyRjb21waWxlJywgZnVuY3Rpb24oJGNvbXBpbGUpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2RldGFpbHNJdGVtQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0bmFtZTogJz0nLFxuXHRcdFx0ZGF0YTogJz0nLFxuXHRcdFx0bW9kZWw6ICc9J1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XG5cdFx0XHRjdHJsLmdldFRlbXBsYXRlKCkudGhlbihmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuZWxlbWVudChodG1sKTtcblx0XHRcdFx0ZWxlbWVudC5hcHBlbmQodGVtcGxhdGUpO1xuXHRcdFx0XHQkY29tcGlsZSh0ZW1wbGF0ZSkoc2NvcGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufV0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cEN0cmwnLCBmdW5jdGlvbigpIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5cdHZhciBjdHJsID0gdGhpcztcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Z3JvdXA6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgU2VhcmNoU2VydmljZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHR2YXIgaW5pdGlhbEdyb3VwcyA9IFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV07XG5cblx0Y3RybC5ncm91cHMgPSBpbml0aWFsR3JvdXBzO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0fSk7XG5cblx0Y3RybC5nZXRTZWxlY3RlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAkcm91dGVQYXJhbXMuZ2lkO1xuXHR9O1xuXG5cdC8vIFVwZGF0ZSBncm91cExpc3Qgb24gY29udGFjdCBhZGQvZGVsZXRlL3VwZGF0ZVxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oKSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdGN0cmwuZ3JvdXBzID0gXy51bmlxdWUoaW5pdGlhbEdyb3Vwcy5jb25jYXQoZ3JvdXBzKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Y3RybC5zZXRTZWxlY3RlZCA9IGZ1bmN0aW9uIChzZWxlY3RlZEdyb3VwKSB7XG5cdFx0U2VhcmNoU2VydmljZS5jbGVhblNlYXJjaCgpO1xuXHRcdCRyb3V0ZVBhcmFtcy5naWQgPSBzZWxlY3RlZEdyb3VwO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdncm91cGxpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZ3JvdXBMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ25ld0NvbnRhY3RCdXR0b25DdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgJHJvdXRlUGFyYW1zLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0YWRkQ29udGFjdCA6IHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0Jylcblx0fTtcblxuXHRjdHJsLmNyZWF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5jcmVhdGUoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFsndGVsJywgJ2FkcicsICdlbWFpbCddLmZvckVhY2goZnVuY3Rpb24oZmllbGQpIHtcblx0XHRcdFx0dmFyIGRlZmF1bHRWYWx1ZSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShmaWVsZCkuZGVmYXVsdFZhbHVlIHx8IHt2YWx1ZTogJyd9O1xuXHRcdFx0XHRjb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV0uaW5kZXhPZigkcm91dGVQYXJhbXMuZ2lkKSA9PT0gLTEpIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCRyb3V0ZVBhcmFtcy5naWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCcnKTtcblx0XHRcdH1cblx0XHRcdCQoJyNkZXRhaWxzLWZ1bGxOYW1lJykuZm9jdXMoKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ25ld2NvbnRhY3RidXR0b24nLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ25ld0NvbnRhY3RCdXR0b25DdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvbmV3Q29udGFjdEJ1dHRvbi5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ3RlbE1vZGVsJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybntcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdHJlcXVpcmU6ICduZ01vZGVsJyxcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0ciwgbmdNb2RlbCkge1xuXHRcdFx0bmdNb2RlbC4kZm9ybWF0dGVycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0pO1xuXHRcdFx0bmdNb2RlbC4kcGFyc2Vycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdzb3J0YnlDdHJsJywgZnVuY3Rpb24oU29ydEJ5U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0dmFyIHNvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnU29ydCBieScpO1xuXHRjdHJsLnNvcnRUZXh0ID0gc29ydFRleHQ7XG5cblx0dmFyIHNvcnRMaXN0ID0gU29ydEJ5U2VydmljZS5nZXRTb3J0QnlMaXN0KCk7XG5cdGN0cmwuc29ydExpc3QgPSBzb3J0TGlzdDtcblxuXHRjdHJsLmRlZmF1bHRPcmRlciA9IFNvcnRCeVNlcnZpY2UuZ2V0U29ydEJ5KCk7XG5cblx0Y3RybC51cGRhdGVTb3J0QnkgPSBmdW5jdGlvbigpIHtcblx0XHRTb3J0QnlTZXJ2aWNlLnNldFNvcnRCeShjdHJsLmRlZmF1bHRPcmRlcik7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdzb3J0YnknLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRwcmlvcml0eTogMSxcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ3NvcnRieUN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9zb3J0QnkuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2snLCBmdW5jdGlvbigpXG57XG5cdHJldHVybiBmdW5jdGlvbiBBZGRyZXNzQm9vayhkYXRhKSB7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXG5cdFx0XHRkaXNwbGF5TmFtZTogJycsXG5cdFx0XHRjb250YWN0czogW10sXG5cdFx0XHRncm91cHM6IGRhdGEuZGF0YS5wcm9wcy5ncm91cHMsXG5cblx0XHRcdGdldENvbnRhY3Q6IGZ1bmN0aW9uKHVpZCkge1xuXHRcdFx0XHRmb3IodmFyIGkgaW4gdGhpcy5jb250YWN0cykge1xuXHRcdFx0XHRcdGlmKHRoaXMuY29udGFjdHNbaV0udWlkKCkgPT09IHVpZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29udGFjdHNbaV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXG5cdFx0XHRzaGFyZWRXaXRoOiB7XG5cdFx0XHRcdHVzZXJzOiBbXSxcblx0XHRcdFx0Z3JvdXBzOiBbXVxuXHRcdFx0fVxuXG5cdFx0fSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywgZGF0YSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXHRcdFx0b3duZXI6IGRhdGEudXJsLnNwbGl0KCcvJykuc2xpY2UoLTMsIC0yKVswXVxuXHRcdH0pO1xuXG5cdFx0dmFyIHNoYXJlcyA9IHRoaXMuZGF0YS5wcm9wcy5pbnZpdGU7XG5cdFx0aWYgKHR5cGVvZiBzaGFyZXMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHNoYXJlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHR2YXIgaHJlZiA9IHNoYXJlc1tqXS5ocmVmO1xuXHRcdFx0XHRpZiAoaHJlZi5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgYWNjZXNzID0gc2hhcmVzW2pdLmFjY2Vzcztcblx0XHRcdFx0aWYgKGFjY2Vzcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciByZWFkV3JpdGUgPSAodHlwZW9mIGFjY2Vzcy5yZWFkV3JpdGUgIT09ICd1bmRlZmluZWQnKTtcblxuXHRcdFx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKCdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdFx0XHRcdHRoaXMuc2hhcmVkV2l0aC51c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyNyksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjcpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhyZWYuc3RhcnRzV2l0aCgncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLycpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaGFyZWRXaXRoLmdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyOCksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjgpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly92YXIgb3duZXIgPSB0aGlzLmRhdGEucHJvcHMub3duZXI7XG5cdFx0Ly9pZiAodHlwZW9mIG93bmVyICE9PSAndW5kZWZpbmVkJyAmJiBvd25lci5sZW5ndGggIT09IDApIHtcblx0XHQvL1x0b3duZXIgPSBvd25lci50cmltKCk7XG5cdFx0Ly9cdGlmIChvd25lci5zdGFydHNXaXRoKCcvcmVtb3RlLnBocC9kYXYvcHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdC8vXHRcdHRoaXMuX3Byb3BlcnRpZXMub3duZXIgPSBvd25lci5zdWJzdHIoMzMpO1xuXHRcdC8vXHR9XG5cdFx0Ly99XG5cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5mYWN0b3J5KCdDb250YWN0JywgZnVuY3Rpb24oJGZpbHRlcikge1xuXHRyZXR1cm4gZnVuY3Rpb24gQ29udGFjdChhZGRyZXNzQm9vaywgdkNhcmQpIHtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCB7XG5cblx0XHRcdGRhdGE6IHt9LFxuXHRcdFx0cHJvcHM6IHt9LFxuXG5cdFx0XHRkYXRlUHJvcGVydGllczogWydiZGF5JywgJ2Fubml2ZXJzYXJ5JywgJ2RlYXRoZGF0ZSddLFxuXG5cdFx0XHRhZGRyZXNzQm9va0lkOiBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSxcblxuXHRcdFx0dmVyc2lvbjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ3ZlcnNpb24nKTtcblx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblxuXHRcdFx0dWlkOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnNldFByb3BlcnR5KCd1aWQnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0UHJvcGVydHkoJ3VpZCcpLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRzb3J0Rmlyc3ROYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLmZpcnN0TmFtZSgpLCB0aGlzLmxhc3ROYW1lKCldO1xuXHRcdFx0fSxcblxuXHRcdFx0c29ydExhc3ROYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLmxhc3ROYW1lKCksIHRoaXMuZmlyc3ROYW1lKCldO1xuXHRcdFx0fSxcblxuXHRcdFx0c29ydERpc3BsYXlOYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGlzcGxheU5hbWUoKTtcblx0XHRcdH0sXG5cblx0XHRcdGRpc3BsYXlOYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnVsbE5hbWUoKSB8fCB0aGlzLm9yZygpIHx8ICcnO1xuXHRcdFx0fSxcblxuXHRcdFx0Zmlyc3ROYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnbicpO1xuXHRcdFx0XHRpZiAocHJvcGVydHkpIHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWVbMV07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZGlzcGxheU5hbWUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0bGFzdE5hbWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCduJyk7XG5cdFx0XHRcdGlmIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZVswXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kaXNwbGF5TmFtZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRhZGRpdGlvbmFsTmFtZXM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCduJyk7XG5cdFx0XHRcdGlmIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZVsyXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGZ1bGxOYW1lOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ2ZuJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gbW9kZWwuZ2V0UHJvcGVydHkoJ2ZuJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJvcGVydHkgPSBtb2RlbC5nZXRQcm9wZXJ0eSgnbicpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuZmlsdGVyKGZ1bmN0aW9uKGVsZW0pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVsZW07XG5cdFx0XHRcdFx0XHR9KS5qb2luKCcgJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHRpdGxlOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3RpdGxlJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgndGl0bGUnKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0b3JnOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdvcmcnKTtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdHZhciB2YWwgPSB2YWx1ZTtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSAmJiBBcnJheS5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0dmFsID0gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0XHR2YWxbMF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ29yZycsIHsgdmFsdWU6IHZhbCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZVswXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGVtYWlsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2VtYWlsJyk7XG5cdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHBob3RvOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0Ly8gc3BsaXRzIGltYWdlIGRhdGEgaW50byBcImRhdGE6aW1hZ2UvanBlZ1wiIGFuZCBiYXNlIDY0IGVuY29kZWQgaW1hZ2Vcblx0XHRcdFx0XHR2YXIgaW1hZ2VEYXRhID0gdmFsdWUuc3BsaXQoJztiYXNlNjQsJyk7XG5cdFx0XHRcdFx0dmFyIGltYWdlVHlwZSA9IGltYWdlRGF0YVswXS5zbGljZSgnZGF0YTonLmxlbmd0aCk7XG5cdFx0XHRcdFx0aWYgKCFpbWFnZVR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW1hZ2VUeXBlID0gaW1hZ2VUeXBlLnN1YnN0cmluZyg2KS50b1VwcGVyQ2FzZSgpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3Bob3RvJywgeyB2YWx1ZTogaW1hZ2VEYXRhWzFdLCBtZXRhOiB7dHlwZTogW2ltYWdlVHlwZV0sIGVuY29kaW5nOiBbJ2InXX0gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgncGhvdG8nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0dmFyIHR5cGUgPSBwcm9wZXJ0eS5tZXRhLnR5cGU7XG5cdFx0XHRcdFx0XHRpZiAoYW5ndWxhci5pc1VuZGVmaW5lZCh0eXBlKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNBcnJheSh0eXBlKSkge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gdHlwZVswXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICghdHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gJ2ltYWdlLycgKyB0eXBlLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gJ2RhdGE6JyArIHR5cGUgKyAnO2Jhc2U2NCwnICsgcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRjYXRlZ29yaWVzOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdjYXRlZ29yaWVzJyk7XG5cdFx0XHRcdFx0aWYoIXByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChhbmd1bGFyLmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBbcHJvcGVydHkudmFsdWVdO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRmb3JtYXREYXRlQXNSRkM2MzUwOiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKGRhdGEpIHx8IF8uaXNVbmRlZmluZWQoZGF0YS52YWx1ZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5kYXRlUHJvcGVydGllcy5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuXHRcdFx0XHRcdHZhciBtYXRjaCA9IGRhdGEudmFsdWUubWF0Y2goL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdGRhdGEudmFsdWUgPSBtYXRjaFsxXSArIG1hdGNoWzJdICsgbWF0Y2hbM107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHR9LFxuXG5cdFx0XHRmb3JtYXREYXRlRm9yRGlzcGxheTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChkYXRhKSB8fCBfLmlzVW5kZWZpbmVkKGRhdGEudmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZGF0ZVByb3BlcnRpZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBkYXRhLnZhbHVlLm1hdGNoKC9eKFxcZHs0fSkoXFxkezJ9KShcXGR7Mn0pJC8pO1xuXHRcdFx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRcdFx0ZGF0YS52YWx1ZSA9IG1hdGNoWzFdICsgJy0nICsgbWF0Y2hbMl0gKyAnLScgKyBtYXRjaFszXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZGF0YTtcblx0XHRcdH0sXG5cblx0XHRcdGdldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdGlmICh0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZm9ybWF0RGF0ZUZvckRpc3BsYXkobmFtZSwgdGhpcy5wcm9wc1tuYW1lXVswXSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cdFx0XHRcdGRhdGEgPSB0aGlzLmZvcm1hdERhdGVBc1JGQzYzNTAobmFtZSwgZGF0YSk7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBpZHggPSB0aGlzLnByb3BzW25hbWVdLmxlbmd0aDtcblx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXVtpZHhdID0gZGF0YTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0XHRyZXR1cm4gaWR4O1xuXHRcdFx0fSxcblx0XHRcdHNldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGEgPSB0aGlzLmZvcm1hdERhdGVBc1JGQzYzNTAobmFtZSwgZGF0YSk7XG5cdFx0XHRcdHRoaXMucHJvcHNbbmFtZV1bMF0gPSBkYXRhO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlUHJvcGVydHk6IGZ1bmN0aW9uIChuYW1lLCBwcm9wKSB7XG5cdFx0XHRcdGFuZ3VsYXIuY29weShfLndpdGhvdXQodGhpcy5wcm9wc1tuYW1lXSwgcHJvcCksIHRoaXMucHJvcHNbbmFtZV0pO1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RVRhZzogZnVuY3Rpb24oZXRhZykge1xuXHRcdFx0XHR0aGlzLmRhdGEuZXRhZyA9IGV0YWc7XG5cdFx0XHR9LFxuXHRcdFx0c2V0VXJsOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0XHRcdHRoaXMuZGF0YS51cmwgPSBhZGRyZXNzQm9vay51cmwgKyB1aWQgKyAnLnZjZic7XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXRJU09EYXRlOiBmdW5jdGlvbihkYXRlKSB7XG5cdFx0XHRcdGZ1bmN0aW9uIHBhZChudW1iZXIpIHtcblx0XHRcdFx0XHRpZiAobnVtYmVyIDwgMTApIHtcblx0XHRcdFx0XHRcdHJldHVybiAnMCcgKyBudW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiAnJyArIG51bWJlcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBkYXRlLmdldFVUQ0Z1bGxZZWFyKCkgKyAnJyArXG5cdFx0XHRcdFx0XHRwYWQoZGF0ZS5nZXRVVENNb250aCgpICsgMSkgK1xuXHRcdFx0XHRcdFx0cGFkKGRhdGUuZ2V0VVRDRGF0ZSgpKSArXG5cdFx0XHRcdFx0XHQnVCcgKyBwYWQoZGF0ZS5nZXRVVENIb3VycygpKSArXG5cdFx0XHRcdFx0XHRwYWQoZGF0ZS5nZXRVVENNaW51dGVzKCkpICtcblx0XHRcdFx0XHRcdHBhZChkYXRlLmdldFVUQ1NlY29uZHMoKSkgKyAnWic7XG5cdFx0XHR9LFxuXG5cdFx0XHRzeW5jVkNhcmQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHRoaXMuc2V0UHJvcGVydHkoJ3JldicsIHsgdmFsdWU6IHRoaXMuZ2V0SVNPRGF0ZShuZXcgRGF0ZSgpKSB9KTtcblx0XHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRcdF8uZWFjaCh0aGlzLmRhdGVQcm9wZXJ0aWVzLCBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdFx0aWYgKCFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV0pICYmICFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV1bMF0pKSB7XG5cdFx0XHRcdFx0XHQvLyBTZXQgZGF0ZXMgYWdhaW4gdG8gbWFrZSBzdXJlIHRoZXkgYXJlIGluIFJGQy02MzUwIGZvcm1hdFxuXHRcdFx0XHRcdFx0c2VsZi5zZXRQcm9wZXJ0eShuYW1lLCBzZWxmLnByb3BzW25hbWVdWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQvLyBmb3JjZSBmbiB0byBiZSBzZXRcblx0XHRcdFx0dGhpcy5mdWxsTmFtZSh0aGlzLmZ1bGxOYW1lKCkpO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHRzZWxmLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykoc2VsZi5wcm9wcyk7XG5cdFx0XHR9LFxuXG5cdFx0XHRtYXRjaGVzOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKHBhdHRlcm4pIHx8IHBhdHRlcm4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0dmFyIG1hdGNoaW5nUHJvcHMgPSBbJ2ZuJywgJ3RpdGxlJywgJ29yZycsICdlbWFpbCcsICduaWNrbmFtZScsICdub3RlJywgJ3VybCcsICdjbG91ZCcsICdhZHInLCAnaW1wcCcsICd0ZWwnXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BOYW1lKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsLnByb3BzW3Byb3BOYW1lXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnByb3BzW3Byb3BOYW1lXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRcdGlmICghcHJvcGVydHkudmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoXy5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5maWx0ZXIoZnVuY3Rpb24odikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHYudG9Mb3dlckNhc2UoKS5pbmRleE9mKHBhdHRlcm4udG9Mb3dlckNhc2UoKSkgIT09IC0xO1xuXHRcdFx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSkubGVuZ3RoID4gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIG1hdGNoaW5nUHJvcHMubGVuZ3RoID4gMDtcblx0XHRcdH1cblxuXHRcdH0pO1xuXG5cdFx0aWYoYW5ndWxhci5pc0RlZmluZWQodkNhcmQpKSB7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLmRhdGEsIHZDYXJkKTtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMucHJvcHMsICRmaWx0ZXIoJ3ZDYXJkMkpTT04nKSh0aGlzLmRhdGEuYWRkcmVzc0RhdGEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5wcm9wcywge1xuXHRcdFx0XHR2ZXJzaW9uOiBbe3ZhbHVlOiAnMy4wJ31dLFxuXHRcdFx0XHRmbjogW3t2YWx1ZTogJyd9XVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0fVxuXG5cdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycpO1xuXHRcdGlmKCFwcm9wZXJ0eSkge1xuXHRcdFx0dGhpcy5jYXRlZ29yaWVzKCcnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGFuZ3VsYXIuaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdHRoaXMuY2F0ZWdvcmllcyhbcHJvcGVydHkudmFsdWVdKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2tTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50LCBEYXZTZXJ2aWNlLCBTZXR0aW5nc1NlcnZpY2UsIEFkZHJlc3NCb29rLCAkcSkge1xuXG5cdHZhciBhZGRyZXNzQm9va3MgPSBbXTtcblx0dmFyIGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdHZhciBsb2FkQWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGFkZHJlc3NCb29rcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihhZGRyZXNzQm9va3MpO1xuXHRcdH1cblx0XHRpZiAoXy5pc1VuZGVmaW5lZChsb2FkUHJvbWlzZSkpIHtcblx0XHRcdGxvYWRQcm9taXNlID0gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0bG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGFkZHJlc3NCb29rcyA9IGFjY291bnQuYWRkcmVzc0Jvb2tzLm1hcChmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0cmV0dXJuIHtcblx0XHRnZXRBbGw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGxvYWRBbGwoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldEdyb3VwczogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5tYXAoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5ncm91cHM7XG5cdFx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGEuY29uY2F0KGIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXREZWZhdWx0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rc1swXTtcblx0XHR9LFxuXG5cdFx0Z2V0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5nZXRBZGRyZXNzQm9vayh7ZGlzcGxheU5hbWU6ZGlzcGxheU5hbWUsIHVybDphY2NvdW50LmhvbWVVcmx9KS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2sgPSBuZXcgQWRkcmVzc0Jvb2soe1xuXHRcdFx0XHRcdFx0dXJsOiBhZGRyZXNzQm9va1swXS5ocmVmLFxuXHRcdFx0XHRcdFx0ZGF0YTogYWRkcmVzc0Jvb2tbMF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSA9IGRpc3BsYXlOYW1lO1xuXHRcdFx0XHRcdHJldHVybiBhZGRyZXNzQm9vaztcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Y3JlYXRlOiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWRkcmVzc0Jvb2soe2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0ZGVsZXRlOiBmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5kZWxldGVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgaW5kZXggPSBhZGRyZXNzQm9va3MuaW5kZXhPZihhZGRyZXNzQm9vayk7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2tzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHJlbmFtZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5yZW5hbWVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaywge2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5kaXNwbGF5TmFtZSA9PT0gZGlzcGxheU5hbWU7XG5cdFx0XHRcdH0pWzBdO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHN5bmM6IGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50LnN5bmNBZGRyZXNzQm9vayhhZGRyZXNzQm9vayk7XG5cdFx0fSxcblxuXHRcdHNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgsIHdyaXRhYmxlLCBleGlzdGluZ1NoYXJlKSB7XG5cdFx0XHR2YXIgeG1sRG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQoJycsICcnLCBudWxsKTtcblx0XHRcdHZhciBvU2hhcmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzaGFyZScpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6ZCcsICdEQVY6Jyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpvJywgJ2h0dHA6Ly9vd25jbG91ZC5vcmcvbnMnKTtcblx0XHRcdHhtbERvYy5hcHBlbmRDaGlsZChvU2hhcmUpO1xuXG5cdFx0XHR2YXIgb1NldCA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNldCcpO1xuXHRcdFx0b1NoYXJlLmFwcGVuZENoaWxkKG9TZXQpO1xuXG5cdFx0XHR2YXIgZEhyZWYgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnZDpocmVmJyk7XG5cdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJztcblx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nO1xuXHRcdFx0fVxuXHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgKz0gc2hhcmVXaXRoO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChkSHJlZik7XG5cblx0XHRcdHZhciBvU3VtbWFyeSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnN1bW1hcnknKTtcblx0XHRcdG9TdW1tYXJ5LnRleHRDb250ZW50ID0gdCgnY29udGFjdHMnLCAne2FkZHJlc3Nib29rfSBzaGFyZWQgYnkge293bmVyfScsIHtcblx0XHRcdFx0YWRkcmVzc2Jvb2s6IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRvd25lcjogYWRkcmVzc0Jvb2sub3duZXJcblx0XHRcdH0pO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChvU3VtbWFyeSk7XG5cblx0XHRcdGlmICh3cml0YWJsZSkge1xuXHRcdFx0XHR2YXIgb1JXID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVhZC13cml0ZScpO1xuXHRcdFx0XHRvU2V0LmFwcGVuZENoaWxkKG9SVyk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXHRcdFx0cmV0dXJuIERhdkNsaWVudC54aHIuc2VuZChcblx0XHRcdFx0ZGF2LnJlcXVlc3QuYmFzaWMoe21ldGhvZDogJ1BPU1QnLCBkYXRhOiBib2R5fSksXG5cdFx0XHRcdGFkZHJlc3NCb29rLnVybFxuXHRcdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuXHRcdFx0XHRcdGlmICghZXhpc3RpbmdTaGFyZSkge1xuXHRcdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdHdyaXRhYmxlOiB3cml0YWJsZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHR3cml0YWJsZTogd3JpdGFibGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHR1bnNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgpIHtcblx0XHRcdHZhciB4bWxEb2MgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVEb2N1bWVudCgnJywgJycsIG51bGwpO1xuXHRcdFx0dmFyIG9TaGFyZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNoYXJlJyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpkJywgJ0RBVjonKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOm8nLCAnaHR0cDovL293bmNsb3VkLm9yZy9ucycpO1xuXHRcdFx0eG1sRG9jLmFwcGVuZENoaWxkKG9TaGFyZSk7XG5cblx0XHRcdHZhciBvUmVtb3ZlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVtb3ZlJyk7XG5cdFx0XHRvU2hhcmUuYXBwZW5kQ2hpbGQob1JlbW92ZSk7XG5cblx0XHRcdHZhciBkSHJlZiA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdkOmhyZWYnKTtcblx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nO1xuXHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLyc7XG5cdFx0XHR9XG5cdFx0XHRkSHJlZi50ZXh0Q29udGVudCArPSBzaGFyZVdpdGg7XG5cdFx0XHRvUmVtb3ZlLmFwcGVuZENoaWxkKGRIcmVmKTtcblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50Lnhoci5zZW5kKFxuXHRcdFx0XHRkYXYucmVxdWVzdC5iYXNpYyh7bWV0aG9kOiAnUE9TVCcsIGRhdGE6IGJvZHl9KSxcblx0XHRcdFx0YWRkcmVzc0Jvb2sudXJsXG5cdFx0XHQpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycy5maWx0ZXIoZnVuY3Rpb24odXNlcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdXNlci5pZCAhPT0gc2hhcmVXaXRoO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC5ncm91cHMuZmlsdGVyKGZ1bmN0aW9uKGdyb3Vwcykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ3JvdXBzLmlkICE9PSBzaGFyZVdpdGg7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly90b2RvIC0gcmVtb3ZlIGVudHJ5IGZyb20gYWRkcmVzc2Jvb2sgb2JqZWN0XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH1cblxuXG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdDb250YWN0U2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCwgQWRkcmVzc0Jvb2tTZXJ2aWNlLCBDb250YWN0LCAkcSwgQ2FjaGVGYWN0b3J5LCB1dWlkNCkge1xuXG5cdHZhciBjYWNoZUZpbGxlZCA9IGZhbHNlO1xuXG5cdHZhciBjb250YWN0cyA9IENhY2hlRmFjdG9yeSgnY29udGFjdHMnKTtcblxuXHR2YXIgb2JzZXJ2ZXJDYWxsYmFja3MgPSBbXTtcblxuXHR2YXIgbG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUsIHVpZCkge1xuXHRcdHZhciBldiA9IHtcblx0XHRcdGV2ZW50OiBldmVudE5hbWUsXG5cdFx0XHR1aWQ6IHVpZCxcblx0XHRcdGNvbnRhY3RzOiBjb250YWN0cy52YWx1ZXMoKVxuXHRcdH07XG5cdFx0YW5ndWxhci5mb3JFYWNoKG9ic2VydmVyQ2FsbGJhY2tzLCBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soZXYpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZmlsbENhY2hlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobG9hZFByb21pc2UpKSB7XG5cdFx0XHRsb2FkUHJvbWlzZSA9IEFkZHJlc3NCb29rU2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uIChlbmFibGVkQWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHZhciBwcm9taXNlcyA9IFtdO1xuXHRcdFx0XHRlbmFibGVkQWRkcmVzc0Jvb2tzLmZvckVhY2goZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0cHJvbWlzZXMucHVzaChcblx0XHRcdFx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5zeW5jKGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBpIGluIGFkZHJlc3NCb29rLm9iamVjdHMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS5hZGRyZXNzRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGNvbnRhY3QgPSBuZXcgQ29udGFjdChhZGRyZXNzQm9vaywgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250YWN0cy5wdXQoY29udGFjdC51aWQoKSwgY29udGFjdCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIGN1c3RvbSBjb25zb2xlXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnSW52YWxpZCBjb250YWN0IHJlY2VpdmVkOiAnICsgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS51cmwpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuICRxLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0Y2FjaGVGaWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0dGhpcy5nZXRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRpZihjYWNoZUZpbGxlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGxDYWNoZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWN0cy52YWx1ZXMoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihjb250YWN0cy52YWx1ZXMoKSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0R3JvdXBzID0gZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRcdHJldHVybiBfLnVuaXEoY29udGFjdHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmNhdGVnb3JpZXMoKTtcblx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdHJldHVybiBhLmNvbmNhdChiKTtcblx0XHRcdH0sIFtdKS5zb3J0KCksIHRydWUpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QnlJZCA9IGZ1bmN0aW9uKHVpZCkge1xuXHRcdGlmKGNhY2hlRmlsbGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsbENhY2hlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRhY3RzLmdldCh1aWQpO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAkcS53aGVuKGNvbnRhY3RzLmdldCh1aWQpKTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5jcmVhdGUgPSBmdW5jdGlvbihuZXdDb250YWN0LCBhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cdFx0bmV3Q29udGFjdCA9IG5ld0NvbnRhY3QgfHwgbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2spO1xuXHRcdHZhciBuZXdVaWQgPSAnJztcblx0XHRpZih1dWlkNC52YWxpZGF0ZSh1aWQpKSB7XG5cdFx0XHRuZXdVaWQgPSB1aWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1VpZCA9IHV1aWQ0LmdlbmVyYXRlKCk7XG5cdFx0fVxuXHRcdG5ld0NvbnRhY3QudWlkKG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5zZXRVcmwoYWRkcmVzc0Jvb2ssIG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5hZGRyZXNzQm9va0lkID0gYWRkcmVzc0Jvb2suZGlzcGxheU5hbWU7XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobmV3Q29udGFjdC5mdWxsTmFtZSgpKSB8fCBuZXdDb250YWN0LmZ1bGxOYW1lKCkgPT09ICcnKSB7XG5cdFx0XHRuZXdDb250YWN0LmZ1bGxOYW1lKHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0JykpO1xuXHRcdH1cblxuXHRcdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQ2FyZChcblx0XHRcdGFkZHJlc3NCb29rLFxuXHRcdFx0e1xuXHRcdFx0XHRkYXRhOiBuZXdDb250YWN0LmRhdGEuYWRkcmVzc0RhdGEsXG5cdFx0XHRcdGZpbGVuYW1lOiBuZXdVaWQgKyAnLnZjZidcblx0XHRcdH1cblx0XHQpLnRoZW4oZnVuY3Rpb24oeGhyKSB7XG5cdFx0XHRuZXdDb250YWN0LnNldEVUYWcoeGhyLmdldFJlc3BvbnNlSGVhZGVyKCdFVGFnJykpO1xuXHRcdFx0Y29udGFjdHMucHV0KG5ld1VpZCwgbmV3Q29udGFjdCk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMoJ2NyZWF0ZScsIG5ld1VpZCk7XG5cdFx0XHQkKCcjZGV0YWlscy1mdWxsTmFtZScpLnNlbGVjdCgpO1xuXHRcdFx0cmV0dXJuIG5ld0NvbnRhY3Q7XG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oeGhyKSB7XG5cdFx0XHR2YXIgbXNnID0gdCgnY29udGFjdHMnLCAnQ29udGFjdCBjb3VsZCBub3QgYmUgY3JlYXRlZC4nKTtcblx0XHRcdGlmICghYW5ndWxhci5pc1VuZGVmaW5lZCh4aHIpICYmICFhbmd1bGFyLmlzVW5kZWZpbmVkKHhoci5yZXNwb25zZVhNTCkgJiYgIWFuZ3VsYXIuaXNVbmRlZmluZWQoeGhyLnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9zYWJyZWRhdi5vcmcvbnMnLCAnbWVzc2FnZScpKSkge1xuXHRcdFx0XHRpZiAoJCh4aHIucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUygnaHR0cDovL3NhYnJlZGF2Lm9yZy9ucycsICdtZXNzYWdlJykpLnRleHQoKSkge1xuXHRcdFx0XHRcdG1zZyA9ICQoeGhyLnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9zYWJyZWRhdi5vcmcvbnMnLCAnbWVzc2FnZScpKS50ZXh0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkobXNnKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmltcG9ydCA9IGZ1bmN0aW9uKGRhdGEsIHR5cGUsIGFkZHJlc3NCb29rLCBwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cblx0XHR2YXIgcmVnZXhwID0gL0JFR0lOOlZDQVJEW1xcc1xcU10qP0VORDpWQ0FSRC9tZ2k7XG5cdFx0dmFyIHNpbmdsZVZDYXJkcyA9IGRhdGEubWF0Y2gocmVnZXhwKTtcblxuXHRcdGlmICghc2luZ2xlVkNhcmRzKSB7XG5cdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdObyBjb250YWN0cyBpbiBmaWxlLiBPbmx5IFZDYXJkIGZpbGVzIGFyZSBhbGxvd2VkLicpKTtcblx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2soMSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBudW0gPSAxO1xuXHRcdGZvcih2YXIgaSBpbiBzaW5nbGVWQ2FyZHMpIHtcblx0XHRcdHZhciBuZXdDb250YWN0ID0gbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2ssIHthZGRyZXNzRGF0YTogc2luZ2xlVkNhcmRzW2ldfSk7XG5cdFx0XHRpZiAoWyczLjAnLCAnNC4wJ10uaW5kZXhPZihuZXdDb250YWN0LnZlcnNpb24oKSkgPCAwKSB7XG5cdFx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhudW0gLyBzaW5nbGVWQ2FyZHMubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdPbmx5IFZDYXJkIHZlcnNpb24gNC4wIChSRkM2MzUwKSBvciB2ZXJzaW9uIDMuMCAoUkZDMjQyNikgYXJlIHN1cHBvcnRlZC4nKSk7XG5cdFx0XHRcdG51bSsrO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuY3JlYXRlKG5ld0NvbnRhY3QsIGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBVcGRhdGUgdGhlIHByb2dyZXNzIGluZGljYXRvclxuXHRcdFx0XHRpZiAocHJvZ3Jlc3NDYWxsYmFjaykge1xuXHRcdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2sobnVtIC8gc2luZ2xlVkNhcmRzLmxlbmd0aCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bnVtKys7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5tb3ZlQ29udGFjdCA9IGZ1bmN0aW9uIChjb250YWN0LCBhZGRyZXNzYm9vaykge1xuXHRcdGlmIChjb250YWN0LmFkZHJlc3NCb29rSWQgPT09IGFkZHJlc3Nib29rLmRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRhY3Quc3luY1ZDYXJkKCk7XG5cdFx0dmFyIGNsb25lID0gYW5ndWxhci5jb3B5KGNvbnRhY3QpO1xuXHRcdHZhciB1aWQgPSBjb250YWN0LnVpZCgpO1xuXG5cdFx0Ly8gZGVsZXRlIHRoZSBvbGQgb25lIGJlZm9yZSB0byBhdm9pZCBjb25mbGljdFxuXHRcdHRoaXMuZGVsZXRlKGNvbnRhY3QpO1xuXG5cdFx0Ly8gY3JlYXRlIHRoZSBjb250YWN0IGluIHRoZSBuZXcgdGFyZ2V0IGFkZHJlc3Nib29rXG5cdFx0dGhpcy5jcmVhdGUoY2xvbmUsIGFkZHJlc3Nib29rLCB1aWQpO1xuXHR9O1xuXG5cdHRoaXMudXBkYXRlID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdC8vIHVwZGF0ZSByZXYgZmllbGRcblx0XHRjb250YWN0LnN5bmNWQ2FyZCgpO1xuXG5cdFx0Ly8gdXBkYXRlIGNvbnRhY3Qgb24gc2VydmVyXG5cdFx0cmV0dXJuIERhdkNsaWVudC51cGRhdGVDYXJkKGNvbnRhY3QuZGF0YSwge2pzb246IHRydWV9KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0dmFyIG5ld0V0YWcgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKTtcblx0XHRcdGNvbnRhY3Quc2V0RVRhZyhuZXdFdGFnKTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygndXBkYXRlJywgY29udGFjdC51aWQoKSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5kZWxldGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gZGVsZXRlIGNvbnRhY3QgZnJvbSBzZXJ2ZXJcblx0XHRyZXR1cm4gRGF2Q2xpZW50LmRlbGV0ZUNhcmQoY29udGFjdC5kYXRhKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGFjdHMucmVtb3ZlKGNvbnRhY3QudWlkKCkpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdkZWxldGUnLCBjb250YWN0LnVpZCgpKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZDbGllbnQnLCBmdW5jdGlvbigpIHtcblx0dmFyIHhociA9IG5ldyBkYXYudHJhbnNwb3J0LkJhc2ljKFxuXHRcdG5ldyBkYXYuQ3JlZGVudGlhbHMoKVxuXHQpO1xuXHRyZXR1cm4gbmV3IGRhdi5DbGllbnQoeGhyKTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50KSB7XG5cdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWNjb3VudCh7XG5cdFx0c2VydmVyOiBPQy5saW5rVG9SZW1vdGUoJ2Rhdi9hZGRyZXNzYm9va3MnKSxcblx0XHRhY2NvdW50VHlwZTogJ2NhcmRkYXYnLFxuXHRcdHVzZVByb3ZpZGVkUGF0aDogdHJ1ZVxuXHR9KTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZWFyY2hTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdHZhciBzZWFyY2hUZXJtID0gJyc7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDpldmVudE5hbWUsXG5cdFx0XHRzZWFyY2hUZXJtOnNlYXJjaFRlcm1cblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgU2VhcmNoUHJveHkgPSB7XG5cdFx0YXR0YWNoOiBmdW5jdGlvbihzZWFyY2gpIHtcblx0XHRcdHNlYXJjaC5zZXRGaWx0ZXIoJ2NvbnRhY3RzJywgdGhpcy5maWx0ZXJQcm94eSk7XG5cdFx0fSxcblx0XHRmaWx0ZXJQcm94eTogZnVuY3Rpb24ocXVlcnkpIHtcblx0XHRcdHNlYXJjaFRlcm0gPSBxdWVyeTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY2hhbmdlU2VhcmNoJyk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0U2VhcmNoVGVybSA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZWFyY2hUZXJtO1xuXHR9O1xuXG5cdHRoaXMuY2xlYW5TZWFyY2ggPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoJCgnLnNlYXJjaGJveCcpKSkge1xuXHRcdFx0JCgnLnNlYXJjaGJveCcpWzBdLnJlc2V0KCk7XG5cdFx0fVxuXHRcdHNlYXJjaFRlcm0gPSAnJztcblx0fTtcblxuXHRpZiAoIV8uaXNVbmRlZmluZWQoT0MuUGx1Z2lucykpIHtcblx0XHRPQy5QbHVnaW5zLnJlZ2lzdGVyKCdPQ0EuU2VhcmNoJywgU2VhcmNoUHJveHkpO1xuXHRcdGlmICghXy5pc1VuZGVmaW5lZChPQ0EuU2VhcmNoKSkge1xuXHRcdFx0T0MuU2VhcmNoID0gbmV3IE9DQS5TZWFyY2goJCgnI3NlYXJjaGJveCcpLCAkKCcjc2VhcmNocmVzdWx0cycpKTtcblx0XHRcdCQoJyNzZWFyY2hib3gnKS5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFfLmlzVW5kZWZpbmVkKCQoJy5zZWFyY2hib3gnKSkpIHtcblx0XHQkKCcuc2VhcmNoYm94JylbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRpZihlLmtleUNvZGUgPT09IDEzKSB7XG5cdFx0XHRcdG5vdGlmeU9ic2VydmVycygnc3VibWl0U2VhcmNoJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZXR0aW5nc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0dmFyIHNldHRpbmdzID0ge1xuXHRcdGFkZHJlc3NCb29rczogW1xuXHRcdFx0J3Rlc3RBZGRyJ1xuXHRcdF1cblx0fTtcblxuXHR0aGlzLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRzZXR0aW5nc1trZXldID0gdmFsdWU7XG5cdH07XG5cblx0dGhpcy5nZXQgPSBmdW5jdGlvbihrZXkpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3Nba2V5XTtcblx0fTtcblxuXHR0aGlzLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZXR0aW5ncztcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTb3J0QnlTZXJ2aWNlJywgZnVuY3Rpb24gKCkge1xuXHR2YXIgc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR2YXIgc29ydEJ5ID0gJ3NvcnREaXNwbGF5TmFtZSc7XG5cblx0dmFyIGRlZmF1bHRPcmRlciA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY29udGFjdHNfZGVmYXVsdF9vcmRlcicpO1xuXHRpZiAoZGVmYXVsdE9yZGVyKSB7XG5cdFx0c29ydEJ5ID0gZGVmYXVsdE9yZGVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gbm90aWZ5T2JzZXJ2ZXJzICgpIHtcblx0XHRhbmd1bGFyLmZvckVhY2goc3Vic2NyaXB0aW9ucywgZnVuY3Rpb24gKHN1YnNjcmlwdGlvbikge1xuXHRcdFx0aWYgKHR5cGVvZiBzdWJzY3JpcHRpb24gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0c3Vic2NyaXB0aW9uKHNvcnRCeSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHN1YnNjcmliZTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG5cdFx0XHRzdWJzY3JpcHRpb25zLnB1c2ggKGNhbGxiYWNrKTtcblx0XHR9LFxuXHRcdHNldFNvcnRCeTogZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRzb3J0QnkgPSB2YWx1ZTtcblx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSAoJ2NvbnRhY3RzX2RlZmF1bHRfb3JkZXInLCB2YWx1ZSk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMgKCk7XG5cdFx0fSxcblx0XHRnZXRTb3J0Qnk6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBzb3J0Qnk7XG5cdFx0fSxcblx0XHRnZXRTb3J0QnlMaXN0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzb3J0RGlzcGxheU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0Rpc3BsYXkgbmFtZScpLFxuXHRcdFx0XHRzb3J0Rmlyc3ROYW1lOiB0KCdjb250YWN0cycsICdGaXJzdCBuYW1lJyksXG5cdFx0XHRcdHNvcnRMYXN0TmFtZTogdCgnY29udGFjdHMnLCAnTGFzdCBuYW1lJylcblx0XHRcdH07XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ3ZDYXJkUHJvcGVydGllc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0LyoqXG5cdCAqIG1hcCB2Q2FyZCBhdHRyaWJ1dGVzIHRvIGludGVybmFsIGF0dHJpYnV0ZXNcblx0ICpcblx0ICogcHJvcE5hbWU6IHtcblx0ICogXHRcdG11bHRpcGxlOiBbQm9vbGVhbl0sIC8vIGlzIHRoaXMgcHJvcCBhbGxvd2VkIG1vcmUgdGhhbiBvbmNlPyAoZGVmYXVsdCA9IGZhbHNlKVxuXHQgKiBcdFx0cmVhZGFibGVOYW1lOiBbU3RyaW5nXSwgLy8gaW50ZXJuYXRpb25hbGl6ZWQgcmVhZGFibGUgbmFtZSBvZiBwcm9wXG5cdCAqIFx0XHR0ZW1wbGF0ZTogW1N0cmluZ10sIC8vIHRlbXBsYXRlIG5hbWUgZm91bmQgaW4gL3RlbXBsYXRlcy9kZXRhaWxJdGVtc1xuXHQgKiBcdFx0Wy4uLl0gLy8gb3B0aW9uYWwgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiB3aGljaCBtaWdodCBnZXQgdXNlZCBieSB0aGUgdGVtcGxhdGVcblx0ICogfVxuXHQgKi9cblx0dGhpcy52Q2FyZE1ldGEgPSB7XG5cdFx0bmlja25hbWU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnTmlja25hbWUnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCdcblx0XHR9LFxuXHRcdG46IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRGV0YWlsZWQgbmFtZScpLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJywgJycsICcnLCAnJywgJyddXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGU6ICduJ1xuXHRcdH0sXG5cdFx0bm90ZToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdOb3RlcycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0YXJlYSdcblx0XHR9LFxuXHRcdHVybDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dlYnNpdGUnKSxcblx0XHRcdHRlbXBsYXRlOiAndXJsJ1xuXHRcdH0sXG5cdFx0Y2xvdWQ6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdGZWRlcmF0ZWQgQ2xvdWQgSUQnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVx0XHR9LFxuXHRcdGFkcjoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MnKSxcblx0XHRcdHRlbXBsYXRlOiAnYWRyJyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJycsICcnLCAnJywgJycsICcnLCAnJywgJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRjYXRlZ29yaWVzOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0dyb3VwcycpLFxuXHRcdFx0dGVtcGxhdGU6ICdncm91cHMnXG5cdFx0fSxcblx0XHRiZGF5OiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0JpcnRoZGF5JyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2RhdGUnXG5cdFx0fSxcblx0XHRhbm5pdmVyc2FyeToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdBbm5pdmVyc2FyeScpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0ZGVhdGhkYXRlOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0RhdGUgb2YgZGVhdGgnKSxcblx0XHRcdHRlbXBsYXRlOiAnZGF0ZSdcblx0XHR9LFxuXHRcdGVtYWlsOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRW1haWwnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6JycsXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdGltcHA6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdJbnN0YW50IG1lc3NhZ2luZycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHR0ZWw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdQaG9uZScpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZWwnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FLFZPSUNFJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FLFZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSyxWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ0NFTEwnLCBuYW1lOiB0KCdjb250YWN0cycsICdNb2JpbGUnKX0sXG5cdFx0XHRcdHtpZDogJ0ZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCcpfSxcblx0XHRcdFx0e2lkOiAnSE9NRSxGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXggaG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSyxGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXggd29yaycpfSxcblx0XHRcdFx0e2lkOiAnUEFHRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdQYWdlcicpfSxcblx0XHRcdFx0e2lkOiAnVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdWb2ljZScpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0J1gtU09DSUFMUFJPRklMRSc6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdTb2NpYWwgbmV0d29yaycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnZmFjZWJvb2snXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0ZBQ0VCT09LJywgbmFtZTogJ0ZhY2Vib29rJ30sXG5cdFx0XHRcdHtpZDogJ1RXSVRURVInLCBuYW1lOiAnVHdpdHRlcid9XG5cdFx0XHRdXG5cblx0XHR9XG5cdH07XG5cblx0dGhpcy5maWVsZE9yZGVyID0gW1xuXHRcdCdvcmcnLFxuXHRcdCd0aXRsZScsXG5cdFx0J3RlbCcsXG5cdFx0J2VtYWlsJyxcblx0XHQnYWRyJyxcblx0XHQnaW1wcCcsXG5cdFx0J25pY2snLFxuXHRcdCdiZGF5Jyxcblx0XHQnYW5uaXZlcnNhcnknLFxuXHRcdCdkZWF0aGRhdGUnLFxuXHRcdCd1cmwnLFxuXHRcdCdYLVNPQ0lBTFBST0ZJTEUnLFxuXHRcdCdub3RlJyxcblx0XHQnY2F0ZWdvcmllcycsXG5cdFx0J3JvbGUnXG5cdF07XG5cblx0dGhpcy5maWVsZERlZmluaXRpb25zID0gW107XG5cdGZvciAodmFyIHByb3AgaW4gdGhpcy52Q2FyZE1ldGEpIHtcblx0XHR0aGlzLmZpZWxkRGVmaW5pdGlvbnMucHVzaCh7aWQ6IHByb3AsIG5hbWU6IHRoaXMudkNhcmRNZXRhW3Byb3BdLnJlYWRhYmxlTmFtZSwgbXVsdGlwbGU6ICEhdGhpcy52Q2FyZE1ldGFbcHJvcF0ubXVsdGlwbGV9KTtcblx0fVxuXG5cdHRoaXMuZmFsbGJhY2tNZXRhID0gZnVuY3Rpb24ocHJvcGVydHkpIHtcblx0XHRmdW5jdGlvbiBjYXBpdGFsaXplKHN0cmluZykgeyByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpOyB9XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6ICd1bmtub3duLScgKyBwcm9wZXJ0eSxcblx0XHRcdHJlYWRhYmxlTmFtZTogY2FwaXRhbGl6ZShwcm9wZXJ0eSksXG5cdFx0XHR0ZW1wbGF0ZTogJ2hpZGRlbicsXG5cdFx0XHRuZWNlc3NpdHk6ICdvcHRpb25hbCdcblx0XHR9O1xuXHR9O1xuXG5cdHRoaXMuZ2V0TWV0YSA9IGZ1bmN0aW9uKHByb3BlcnR5KSB7XG5cdFx0cmV0dXJuIHRoaXMudkNhcmRNZXRhW3Byb3BlcnR5XSB8fCB0aGlzLmZhbGxiYWNrTWV0YShwcm9wZXJ0eSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ0pTT04ydkNhcmQnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIHZDYXJkLmdlbmVyYXRlKGlucHV0KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RDb2xvcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHQvLyBDaGVjayBpZiBjb3JlIGhhcyB0aGUgbmV3IGNvbG9yIGdlbmVyYXRvclxuXHRcdGlmKHR5cGVvZiBpbnB1dC50b0hzbCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dmFyIGhzbCA9IGlucHV0LnRvSHNsKCk7XG5cdFx0XHRyZXR1cm4gJ2hzbCgnK2hzbFswXSsnLCAnK2hzbFsxXSsnJSwgJytoc2xbMl0rJyUpJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWYgbm90LCB3ZSB1c2UgdGhlIG9sZCBvbmVcblx0XHRcdC8qIGdsb2JhbCBtZDUgKi9cblx0XHRcdHZhciBoYXNoID0gbWQ1KGlucHV0KS5zdWJzdHJpbmcoMCwgNCksXG5cdFx0XHRcdG1heFJhbmdlID0gcGFyc2VJbnQoJ2ZmZmYnLCAxNiksXG5cdFx0XHRcdGh1ZSA9IHBhcnNlSW50KGhhc2gsIDE2KSAvIG1heFJhbmdlICogMjU2O1xuXHRcdFx0cmV0dXJuICdoc2woJyArIGh1ZSArICcsIDkwJSwgNjUlKSc7XG5cdFx0fVxuXHR9O1xufSk7IiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RHcm91cEZpbHRlcicsIGZ1bmN0aW9uKCkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbiAoY29udGFjdHMsIGdyb3VwKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBjb250YWN0cztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBncm91cCA9PT0gJ3VuZGVmaW5lZCcgfHwgZ3JvdXAudG9Mb3dlckNhc2UoKSA9PT0gdCgnY29udGFjdHMnLCAnQWxsIGNvbnRhY3RzJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIGNvbnRhY3RzO1xuXHRcdH1cblx0XHR2YXIgZmlsdGVyID0gW107XG5cdFx0aWYgKGNvbnRhY3RzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY29udGFjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGdyb3VwLnRvTG93ZXJDYXNlKCkgPT09IHQoJ2NvbnRhY3RzJywgJ05vdCBncm91cGVkJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRmaWx0ZXIucHVzaChjb250YWN0c1tpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkuaW5kZXhPZihncm91cCkgPj0gMCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyLnB1c2goY29udGFjdHNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignZmllbGRGaWx0ZXInLCBmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24gKGZpZWxkcywgY29udGFjdCkge1xuXHRcdGlmICh0eXBlb2YgZmllbGRzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0dmFyIGZpbHRlciA9IFtdO1xuXHRcdGlmIChmaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGZpZWxkc1tpXS5tdWx0aXBsZSApIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKGNvbnRhY3QuZ2V0UHJvcGVydHkoZmllbGRzW2ldLmlkKSkpIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXI7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdmaXJzdENoYXJhY3RlcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQuY2hhckF0KDApO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignbG9jYWxlT3JkZXJCeScsIFtmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBmdW5jdGlvbiAoYXJyYXksIHNvcnRQcmVkaWNhdGUsIHJldmVyc2VPcmRlcikge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpIHJldHVybiBhcnJheTtcblx0XHRpZiAoIXNvcnRQcmVkaWNhdGUpIHJldHVybiBhcnJheTtcblxuXHRcdHZhciBhcnJheUNvcHkgPSBbXTtcblx0XHRhbmd1bGFyLmZvckVhY2goYXJyYXksIGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0XHRhcnJheUNvcHkucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdGFycmF5Q29weS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHR2YXIgdmFsdWVBID0gYVtzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVBKSkge1xuXHRcdFx0XHR2YWx1ZUEgPSBhW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgdmFsdWVCID0gYltzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVCKSkge1xuXHRcdFx0XHR2YWx1ZUIgPSBiW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzU3RyaW5nKHZhbHVlQSkpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEubG9jYWxlQ29tcGFyZSh2YWx1ZUIpIDogdmFsdWVCLmxvY2FsZUNvbXBhcmUodmFsdWVBKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFuZ3VsYXIuaXNOdW1iZXIodmFsdWVBKSB8fCB0eXBlb2YgdmFsdWVBID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEgLSB2YWx1ZUIgOiB2YWx1ZUIgLSB2YWx1ZUE7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzQXJyYXkodmFsdWVBKSkge1xuXHRcdFx0XHRpZiAodmFsdWVBWzBdID09PSB2YWx1ZUJbMF0pIHtcblx0XHRcdFx0XHRyZXR1cm4gIXJldmVyc2VPcmRlciA/IHZhbHVlQVsxXS5sb2NhbGVDb21wYXJlKHZhbHVlQlsxXSkgOiB2YWx1ZUJbMV0ubG9jYWxlQ29tcGFyZSh2YWx1ZUFbMV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAhcmV2ZXJzZU9yZGVyID8gdmFsdWVBWzBdLmxvY2FsZUNvbXBhcmUodmFsdWVCWzBdKSA6IHZhbHVlQlswXS5sb2NhbGVDb21wYXJlKHZhbHVlQVswXSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGFycmF5Q29weTtcblx0fTtcbn1dKTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCduZXdDb250YWN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiBpbnB1dCAhPT0gJycgPyBpbnB1dCA6IHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0Jyk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdvcmRlckRldGFpbEl0ZW1zJywgZnVuY3Rpb24odkNhcmRQcm9wZXJ0aWVzU2VydmljZSkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbihpdGVtcywgZmllbGQsIHJldmVyc2UpIHtcblxuXHRcdHZhciBmaWx0ZXJlZCA9IFtdO1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChpdGVtcywgZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0ZmlsdGVyZWQucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdHZhciBmaWVsZE9yZGVyID0gYW5ndWxhci5jb3B5KHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZmllbGRPcmRlcik7XG5cdFx0Ly8gcmV2ZXJzZSB0byBtb3ZlIGN1c3RvbSBpdGVtcyB0byB0aGUgZW5kIChpbmRleE9mID09IC0xKVxuXHRcdGZpZWxkT3JkZXIucmV2ZXJzZSgpO1xuXG5cdFx0ZmlsdGVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0aWYoZmllbGRPcmRlci5pbmRleE9mKGFbZmllbGRdKSA8IGZpZWxkT3JkZXIuaW5kZXhPZihiW2ZpZWxkXSkpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0XHRpZihmaWVsZE9yZGVyLmluZGV4T2YoYVtmaWVsZF0pID4gZmllbGRPcmRlci5pbmRleE9mKGJbZmllbGRdKSkge1xuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9KTtcblxuXHRcdGlmKHJldmVyc2UpIGZpbHRlcmVkLnJldmVyc2UoKTtcblx0XHRyZXR1cm4gZmlsdGVyZWQ7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCd0b0FycmF5JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihvYmopIHtcblx0XHRpZiAoIShvYmogaW5zdGFuY2VvZiBPYmplY3QpKSByZXR1cm4gb2JqO1xuXHRcdHJldHVybiBfLm1hcChvYmosIGZ1bmN0aW9uKHZhbCwga2V5KSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHZhbCwgJyRrZXknLCB7dmFsdWU6IGtleX0pO1xuXHRcdH0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcigndkNhcmQySlNPTicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gdkNhcmQucGFyc2UoaW5wdXQpO1xuXHR9O1xufSk7XG4iXX0=

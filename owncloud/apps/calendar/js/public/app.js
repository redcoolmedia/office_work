
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
* Configuration / App Initialization File
*/

var app = angular.module('Calendar', ['ui.bootstrap']);

app.config(['$provide', '$httpProvider', function ($provide, $httpProvider) {
	'use strict';

	$httpProvider.defaults.headers.common.requesttoken = oc_requesttoken;

	ICAL.design.defaultSet.param['x-oc-group-id'] = {
		allowXName: true
	};

	angular.forEach($.fullCalendar.locales, function (obj, locale) {
		$.fullCalendar.locale(locale, {
			timeFormat: obj.mediumTimeFormat
		});

		var propsToCheck = ['extraSmallTimeFormat', 'hourFormat', 'mediumTimeFormat', 'noMeridiemTimeFormat', 'smallTimeFormat'];

		angular.forEach(propsToCheck, function (propToCheck) {
			if (obj[propToCheck]) {
				var overwrite = {};
				overwrite[propToCheck] = obj[propToCheck].replace('HH', 'H');

				$.fullCalendar.locale(locale, overwrite);
			}
		});
	});
}]);

app.run(['$document', '$rootScope', '$window', function ($document, $rootScope, $window) {
	'use strict';

	var origin = $window.location.origin;
	var pathname = $window.location.pathname;
	var endsWithSlash = pathname.substr(-1) === '/';

	if (pathname.lastIndexOf('/calendar/public/') === -1) {
		$rootScope.baseUrl = origin + pathname;
		if (!endsWithSlash) {
			$rootScope.baseUrl += '/';
		}
	} else {
		var calendarPathname = pathname.substr(0, pathname.lastIndexOf('/calendar/public/')) + '/calendar/';
		$rootScope.baseUrl = origin + calendarPathname;
	}

	$rootScope.baseUrl += 'v1/';

	$document.click(function (event) {
		$rootScope.$broadcast('documentClicked', event);
	});
}]);

app.controller('AttendeeController', ["$scope", "AutoCompletionService", function ($scope, AutoCompletionService) {
	'use strict';

	$scope.newAttendeeGroup = -1;

	$scope.cutstats = [{ displayname: t('calendar', 'Individual'), val: 'INDIVIDUAL' }, { displayname: t('calendar', 'Group'), val: 'GROUP' }, { displayname: t('calendar', 'Resource'), val: 'RESOURCE' }, { displayname: t('calendar', 'Room'), val: 'ROOM' }, { displayname: t('calendar', 'Unknown'), val: 'UNKNOWN' }];

	$scope.partstats = [{ displayname: t('calendar', 'Required'), val: 'REQ-PARTICIPANT' }, { displayname: t('calendar', 'Optional'), val: 'OPT-PARTICIPANT' }, { displayname: t('calendar', 'Does not attend'), val: 'NON-PARTICIPANT' }];

	$scope.$parent.registerPostHook(function () {
		$scope.properties.attendee = $scope.properties.attendee || [];
		if ($scope.properties.attendee.length > 0 && $scope.properties.organizer === null) {
			$scope.properties.organizer = {
				value: 'MAILTO:' + $scope.$parent.emailAddress,
				parameters: {
					cn: OC.getCurrentUser().displayName
				}
			};
		}
	});

	$scope.add = function (email) {
		if (email !== '') {
			$scope.properties.attendee = $scope.properties.attendee || [];
			$scope.properties.attendee.push({
				value: 'MAILTO:' + email,
				group: $scope.newAttendeeGroup--,
				parameters: {
					'role': 'REQ-PARTICIPANT',
					'rsvp': true,
					'partstat': 'NEEDS-ACTION',
					'cutype': 'INDIVIDUAL'
				}
			});
		}
		$scope.attendeeoptions = false;
		$scope.nameofattendee = '';
	};

	$scope.remove = function (attendee) {
		$scope.properties.attendee = $scope.properties.attendee.filter(function (elem) {
			return elem.group !== attendee.group;
		});
	};

	$scope.search = function (value) {
		return AutoCompletionService.searchAttendee(value);
	};

	$scope.selectFromTypeahead = function (item) {
		$scope.properties.attendee = $scope.properties.attendee || [];
		$scope.properties.attendee.push({
			value: 'MAILTO:' + item.email,
			parameters: {
				cn: item.name,
				role: 'REQ-PARTICIPANT',
				rsvp: true,
				partstat: 'NEEDS-ACTION',
				cutype: 'INDIVIDUAL'
			}
		});
		$scope.nameofattendee = '';
	};
}]);

/**
* Controller: CalController
* Description: The fullcalendar controller.
*/

app.controller('CalController', ['$scope', 'Calendar', 'CalendarService', 'VEventService', 'SettingsService', 'TimezoneService', 'VEvent', 'is', 'fc', 'EventsEditorDialogService', 'PopoverPositioningUtility', '$window', function ($scope, Calendar, CalendarService, VEventService, SettingsService, TimezoneService, VEvent, is, fc, EventsEditorDialogService, PopoverPositioningUtility, $window) {
	'use strict';

	is.loading = true;

	$scope.calendars = [];
	$scope.eventSource = {};
	$scope.defaulttimezone = TimezoneService.current();
	$scope.eventModal = null;
	var switcher = [];

	function showCalendar(url) {
		if (switcher.indexOf(url) === -1 && $scope.eventSource[url].isRendering === false) {
			switcher.push(url);
			fc.elm.fullCalendar('removeEventSource', $scope.eventSource[url]);
			fc.elm.fullCalendar('addEventSource', $scope.eventSource[url]);
		}
	}

	function hideCalendar(url) {
		fc.elm.fullCalendar('removeEventSource', $scope.eventSource[url]);
		if (switcher.indexOf(url) !== -1) {
			switcher.splice(switcher.indexOf(url), 1);
		}
	}

	function createAndRenderEvent(calendar, data, start, end, tz) {
		VEventService.create(calendar, data).then(function (vevent) {
			if (calendar.enabled) {
				fc.elm.fullCalendar('refetchEventSources', calendar.fcEventSource);
			}
		});
	}

	function deleteAndRemoveEvent(vevent, fcEvent) {
		VEventService.delete(vevent).then(function () {
			fc.elm.fullCalendar('removeEvents', fcEvent.id);
		});
	}

	$scope.$watchCollection('calendars', function (newCalendars, oldCalendars) {
		newCalendars.filter(function (calendar) {
			return oldCalendars.indexOf(calendar) === -1;
		}).forEach(function (calendar) {
			$scope.eventSource[calendar.url] = calendar.fcEventSource;
			if (calendar.enabled) {
				showCalendar(calendar.url);
			}

			calendar.register(Calendar.hookEnabledChanged, function (enabled) {
				if (enabled) {
					showCalendar(calendar.url);
				} else {
					hideCalendar(calendar.url);
					//calendar.list.loading = false;
				}
			});

			calendar.register(Calendar.hookColorChanged, function () {
				if (calendar.enabled) {
					hideCalendar(calendar.url);
					showCalendar(calendar.url);
				}
			});
		});

		oldCalendars.filter(function (calendar) {
			return newCalendars.indexOf(calendar) === -1;
		}).forEach(function (calendar) {
			var url = calendar.url;
			hideCalendar(calendar.url);

			delete $scope.eventSource[url];
		});
	});

	TimezoneService.get($scope.defaulttimezone).then(function (timezone) {
		if (timezone) {
			ICAL.TimezoneService.register($scope.defaulttimezone, timezone.jCal);
		}
	}).catch(function () {
		OC.Notification.showTemporary(t('calendar', 'You are in an unknown timezone ({tz}), falling back to UTC', {
			tz: $scope.defaulttimezone
		}));

		$scope.defaulttimezone = 'UTC';
		$scope.uiConfig.calendar.timezone = 'UTC';
	});

	var isPublic = angular.element('#fullcalendar').attr('data-isPublic') === '1';
	if (!isPublic) {
		CalendarService.getAll().then(function (calendars) {
			$scope.calendars = calendars;
			is.loading = false;
			// TODO - scope.apply should not be necessary here
			$scope.$apply();
		});
	} else {
		var url = $window.location.toString();
		var token = url.substr(url.lastIndexOf('/') + 1);

		CalendarService.getPublicCalendar(token).then(function (calendar) {
			$scope.calendars = [calendar];
			is.loading = false;
			// TODO - scope.apply should not be necessary here
			$scope.$apply();
		});
	}

	/**
  * Calendar UI Configuration.
 */
	$scope.fcConfig = {
		timezone: $scope.defaulttimezone,
		select: function select(start, end, jsEvent, view) {
			var writableCalendars = $scope.calendars.filter(function (elem) {
				return elem.isWritable();
			});

			if (writableCalendars.length === 0) {
				if (!isPublic) {
					OC.Notification.showTemporary(t('calendar', 'Please create a calendar first.'));
				}
				return;
			}

			start.add(start.toDate().getTimezoneOffset(), 'minutes');
			end.add(end.toDate().getTimezoneOffset(), 'minutes');

			var vevent = VEvent.fromStartEnd(start, end, $scope.defaulttimezone);
			vevent.calendar = writableCalendars[0];

			var timestamp = Date.now();
			var fcEventClass = 'new-event-dummy-' + timestamp;

			var fcEvent = vevent.getFcEvent(view.start, view.end, $scope.defaulttimezone)[0];
			fcEvent.title = t('calendar', 'New event');
			fcEvent.className.push(fcEventClass);
			fcEvent.writable = false;
			fc.elm.fullCalendar('renderEvent', fcEvent);

			EventsEditorDialogService.open($scope, fcEvent, function () {
				var elements = angular.element('.' + fcEventClass);
				var isHidden = angular.element(elements[0]).parents('.fc-limited').length !== 0;
				if (isHidden) {
					return PopoverPositioningUtility.calculate(jsEvent.clientX, jsEvent.clientY, jsEvent.clientX, jsEvent.clientY, view);
				} else {
					return PopoverPositioningUtility.calculateByTarget(elements[0], view);
				}
			}, function () {
				return null;
			}, function () {
				fc.elm.fullCalendar('removeEvents', function (fcEventToCheck) {
					if (Array.isArray(fcEventToCheck.className)) {
						return fcEventToCheck.className.indexOf(fcEventClass) !== -1;
					} else {
						return false;
					}
				});
			}).then(function (result) {
				createAndRenderEvent(result.calendar, result.vevent.data, view.start, view.end, $scope.defaulttimezone);
			}).catch(function (reason) {
				//fcEvent is removed by unlock callback
				//no need to anything
				return null;
			});
		},
		eventClick: function eventClick(fcEvent, jsEvent, view) {
			var vevent = fcEvent.vevent;
			var oldCalendar = vevent.calendar;
			var fcEvt = fcEvent;

			EventsEditorDialogService.open($scope, fcEvent, function () {
				return PopoverPositioningUtility.calculateByTarget(jsEvent.currentTarget, view);
			}, function () {
				fcEvt.editable = false;
				fc.elm.fullCalendar('updateEvent', fcEvt);
			}, function () {
				fcEvt.editable = fcEvent.calendar.writable;
				fc.elm.fullCalendar('updateEvent', fcEvt);
			}).then(function (result) {
				// was the event moved to another calendar?
				if (result.calendar === oldCalendar) {
					VEventService.update(vevent).then(function () {
						fc.elm.fullCalendar('removeEvents', fcEvent.id);

						if (result.calendar.enabled) {
							fc.elm.fullCalendar('refetchEventSources', result.calendar.fcEventSource);
						}
					});
				} else {
					deleteAndRemoveEvent(vevent, fcEvent);
					createAndRenderEvent(result.calendar, result.vevent.data, view.start, view.end, $scope.defaulttimezone);
				}
			}).catch(function (reason) {
				if (reason === 'delete') {
					deleteAndRemoveEvent(vevent, fcEvent);
				}
			});
		},
		eventResize: function eventResize(fcEvent, delta, revertFunc) {
			fcEvent.resize(delta);
			VEventService.update(fcEvent.vevent).catch(function () {
				revertFunc();
			});
		},
		eventDrop: function eventDrop(fcEvent, delta, revertFunc) {
			fcEvent.drop(delta);
			VEventService.update(fcEvent.vevent).catch(function () {
				revertFunc();
			});
		},
		viewRender: function viewRender(view, element) {
			angular.element('#firstrow').find('.datepicker_current').html(view.title).text();
			angular.element('#datecontrol_date').datepicker('setDate', element.fullCalendar('getDate'));
			var newView = view.name;
			if (newView !== $scope.defaultView) {
				SettingsService.setView(newView);
				$scope.defaultView = newView;
			}
			if (newView === 'agendaDay') {
				angular.element('td.fc-state-highlight').css('background-color', '#ffffff');
			} else {
				angular.element('.fc-bg td.fc-state-highlight').css('background-color', '#ffc');
			}
			if (newView === 'agendaWeek') {
				element.fullCalendar('option', 'aspectRatio', 0.1);
			} else {
				element.fullCalendar('option', 'aspectRatio', 1.35);
			}
		},
		eventRender: function eventRender(event, element) {
			var status = event.getSimpleEvent().status;
			if (status !== null) {
				if (status.value === 'TENTATIVE') {
					element.css({ 'opacity': 0.5 });
				} else if (status.value === 'CANCELLED') {
					element.css({
						'text-decoration': 'line-through',
						'opacity': 0.5
					});
				}
			}
		}
	};
}]);

/**
* Controller: CalendarListController
* Description: Takes care of CalendarList in App Navigation.
*/

app.controller('CalendarListController', ['$scope', '$rootScope', '$window', 'CalendarService', 'WebCalService', 'is', 'CalendarListItem', 'Calendar', 'MailerService', 'ColorUtility', function ($scope, $rootScope, $window, CalendarService, WebCalService, is, CalendarListItem, Calendar, MailerService, ColorUtility) {
	'use strict';

	$scope.calendarListItems = [];
	$scope.is = is;
	$scope.newCalendarInputVal = '';
	$scope.newCalendarColorVal = '';

	$scope.subscription = {};
	$scope.subscription.newSubscriptionUrl = '';
	$scope.subscription.newSubscriptionLocked = false;
	$scope.publicdav = 'CalDAV';
	$scope.publicdavdesc = t('calendar', 'CalDAV address for clients');

	window.scope = $scope;

	$scope.$watchCollection('calendars', function (newCalendars, oldCalendars) {
		newCalendars = newCalendars || [];
		oldCalendars = oldCalendars || [];

		newCalendars.filter(function (calendar) {
			return oldCalendars.indexOf(calendar) === -1;
		}).forEach(function (calendar) {
			var item = CalendarListItem(calendar);
			if (item) {
				$scope.calendarListItems.push(item);
				$scope.publicdavurl = $scope.$parent.calendars[0].caldav;
				calendar.register(Calendar.hookFinishedRendering, function () {
					if (!$scope.$$phase) {
						$scope.$apply();
					}
				});
			}
		});

		oldCalendars.filter(function (calendar) {
			return newCalendars.indexOf(calendar) === -1;
		}).forEach(function (calendar) {
			$scope.calendarListItems = $scope.calendarListItems.filter(function (itemToCheck) {
				return itemToCheck.calendar !== calendar;
			});
		});
	});

	$scope.create = function (name, color) {
		CalendarService.create(name, color).then(function (calendar) {
			$scope.calendars.push(calendar);
			$rootScope.$broadcast('createdCalendar', calendar);
			$rootScope.$broadcast('reloadCalendarList');
		});

		$scope.newCalendarInputVal = '';
		$scope.newCalendarColorVal = '';
		angular.element('#new-calendar-button').click();
	};

	$scope.createSubscription = function (url) {
		$scope.subscription.newSubscriptionLocked = true;
		WebCalService.get(url, true).then(function (splittedICal) {
			var color = splittedICal.color || ColorUtility.randomColor();
			var name = splittedICal.name || url;
			CalendarService.createWebCal(name, color, url).then(function (calendar) {
				angular.element('#new-subscription-button').click();
				$scope.calendars.push(calendar);
				$scope.subscription.newSubscriptionUrl = '';
				$scope.$digest();
				$scope.$parent.$digest();
				$scope.subscription.newSubscriptionLocked = false;
			}).catch(function () {
				OC.Notification.showTemporary(t('calendar', 'Error saving WebCal-calendar'));
				$scope.subscription.newSubscriptionLocked = false;
			});
		}).catch(function (error) {
			OC.Notification.showTemporary(error);
			$scope.subscription.newSubscriptionLocked = false;
		});
	};

	$scope.download = function (item) {
		$window.open(item.calendar.downloadUrl);
	};

	$scope.integration = function (item) {
		return '<iframe width="400" height="215" src="' + item.calendar.publicurl + '"></iframe>';
	};

	$scope.$watch('publicdav', function (newvalue) {
		if ($scope.$parent.calendars[0]) {
			if (newvalue === 'CalDAV') {
				// CalDAV address
				$scope.publicdavurl = $scope.$parent.calendars[0].caldav;
				$scope.publicdavdesc = t('calendar', 'CalDAV address for clients');
			} else {
				// WebDAV address
				var url = $scope.$parent.calendars[0].url;
				// cut off last slash to have a fancy name for the ics
				if (url.slice(url.length - 1) === '/') {
					url = url.slice(0, url.length - 1);
				}
				url += '?export';
				$scope.publicdavurl = $window.location.origin + url;
				$scope.publicdavdesc = t('calendar', 'WebDAV address for subscriptions');
			}
		}
	});

	$scope.sendMail = function (item) {
		item.toggleSendingMail();
		MailerService.sendMail(item.email, item.calendar.publicurl, item.calendar.displayname).then(function (response) {
			if (response.status === 200) {
				item.email = '';
				OC.Notification.showTemporary(t('calendar', 'EMail has been sent.'));
			} else {
				OC.Notification.showTemporary(t('calendar', 'There was an issue while sending your EMail.'));
			}
		});
	};

	$scope.goPublic = function (item) {
		$window.open(item.calendar.publicurl);
	};

	$scope.toggleSharesEditor = function (calendar) {
		calendar.toggleSharesEditor();
	};

	$scope.togglePublish = function (item) {
		if (item.calendar.published) {
			CalendarService.publish(item.calendar).then(function (response) {
				if (response) {
					CalendarService.get(item.calendar.url).then(function (calendar) {
						item.calendar.publishurl = calendar.publishurl;
						item.calendar.publicurl = calendar.publicurl;
						item.calendar.published = true;
					});
				}
				$scope.$apply();
			});
		} else {
			CalendarService.unpublish(item.calendar).then(function (response) {
				if (response) {
					item.calendar.published = false;
				}
				$scope.$apply();
			});
		}
	};

	$scope.prepareUpdate = function (calendar) {
		calendar.prepareUpdate();
	};

	$scope.onSelectSharee = function (item, model, label, calendar) {
		// Remove content from text box
		calendar.selectedSharee = '';
		// Create a default share with the user/group, read only
		CalendarService.share(calendar, item.type, item.identifier, false, false).then(function () {
			$scope.$apply();
		});
	};

	$scope.updateExistingUserShare = function (calendar, userId, writable) {
		CalendarService.share(calendar, OC.Share.SHARE_TYPE_USER, userId, writable, true).then(function () {
			$scope.$apply();
		});
	};

	$scope.updateExistingGroupShare = function (calendar, groupId, writable) {
		CalendarService.share(calendar, OC.Share.SHARE_TYPE_GROUP, groupId, writable, true).then(function () {
			$scope.$apply();
		});
	};

	$scope.unshareFromUser = function (calendar, userId) {
		CalendarService.unshare(calendar, OC.Share.SHARE_TYPE_USER, userId).then(function () {
			$scope.$apply();
		});
	};

	$scope.unshareFromGroup = function (calendar, groupId) {
		CalendarService.unshare(calendar, OC.Share.SHARE_TYPE_GROUP, groupId).then(function () {
			$scope.$apply();
		});
	};

	$scope.findSharee = function (val, calendar) {
		return $.get(OC.linkToOCS('apps/files_sharing/api/v1') + 'sharees', {
			format: 'json',
			search: val.trim(),
			perPage: 200,
			itemType: 'principals'
		}).then(function (result) {
			var users = result.ocs.data.exact.users.concat(result.ocs.data.users);
			var groups = result.ocs.data.exact.groups.concat(result.ocs.data.groups);

			var userShares = calendar.shares.users;
			var groupShares = calendar.shares.groups;
			var userSharesLength = userShares.length;
			var groupSharesLength = groupShares.length;
			var i, j;

			// Filter out current user
			var usersLength = users.length;
			for (i = 0; i < usersLength; i++) {
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
			users = users.map(function (item) {
				return {
					display: item.value.shareWith,
					type: OC.Share.SHARE_TYPE_USER,
					identifier: item.value.shareWith
				};
			});

			groups = groups.map(function (item) {
				return {
					display: item.value.shareWith + ' (group)',
					type: OC.Share.SHARE_TYPE_GROUP,
					identifier: item.value.shareWith
				};
			});

			return groups.concat(users);
		});
	};

	$scope.performUpdate = function (item) {
		item.saveEditor();
		CalendarService.update(item.calendar).then(function () {
			$rootScope.$broadcast('updatedCalendar', item.calendar);
			$rootScope.$broadcast('reloadCalendarList');
		});
	};

	/**
  * Updates the shares of the calendar
  */
	$scope.performUpdateShares = function (calendar) {
		CalendarService.update(calendar).then(function () {
			calendar.dropPreviousState();
			calendar.list.edit = false;
			$rootScope.$broadcast('updatedCalendar', calendar);
			$rootScope.$broadcast('reloadCalendarList');
		});
	};

	$scope.triggerEnable = function (item) {
		item.calendar.toggleEnabled();

		CalendarService.update(item.calendar).then(function () {
			$rootScope.$broadcast('updatedCalendarsVisibility', item.calendar);
			$rootScope.$broadcast('reloadCalendarList');
		});
	};

	$scope.remove = function (item) {
		CalendarService.delete(item.calendar).then(function () {
			$scope.$parent.calendars = $scope.$parent.calendars.filter(function (elem) {
				return elem !== item.calendar;
			});
			if (!$scope.$$phase) {
				$scope.$apply();
			}
		});
	};

	$rootScope.$on('reloadCalendarList', function () {
		if (!$scope.$$phase) {
			$scope.$apply();
		}
	});
}]);

/**
* Controller: Date Picker Controller
* Description: Takes care for pushing dates from app navigation date picker and fullcalendar.
*/
app.controller('DatePickerController', ['$scope', 'fc', 'uibDatepickerConfig', function ($scope, fc, uibDatepickerConfig) {
	'use strict';

	$scope.datepickerOptions = {
		formatDay: 'd'
	};

	function getStepSizeFromView() {
		switch ($scope.selectedView) {
			case 'agendaDay':
				return 'day';

			case 'agendaWeek':
				return 'week';

			case 'month':
				return 'month';
		}
	}

	$scope.dt = new Date();
	$scope.visibility = false;

	$scope.selectedView = angular.element('#fullcalendar').attr('data-defaultView');

	angular.extend(uibDatepickerConfig, {
		showWeeks: false,
		startingDay: parseInt(moment().startOf('week').format('d'))
	});

	$scope.today = function () {
		$scope.dt = new Date();
	};

	$scope.prev = function () {
		$scope.dt = moment($scope.dt).subtract(1, getStepSizeFromView()).toDate();
	};

	$scope.next = function () {
		$scope.dt = moment($scope.dt).add(1, getStepSizeFromView()).toDate();
	};

	$scope.toggle = function () {
		$scope.visibility = !$scope.visibility;
	};

	$scope.$watch('dt', function (newValue) {
		if (fc) {
			fc.elm.fullCalendar('gotoDate', newValue);
		}
	});

	$scope.$watch('selectedView', function (newValue) {
		if (fc) {
			fc.elm.fullCalendar('changeView', newValue);
		}
	});
}]);

/**
 * Controller: Events Dialog Controller
 * Description: Takes care of anything inside the Events Modal.
 */

app.controller('EditorController', ['$scope', 'TimezoneService', 'AutoCompletionService', '$window', '$uibModalInstance', 'vevent', 'simpleEvent', 'calendar', 'isNew', 'emailAddress', function ($scope, TimezoneService, AutoCompletionService, $window, $uibModalInstance, vevent, simpleEvent, calendar, isNew, emailAddress) {
	'use strict';

	$scope.properties = simpleEvent;
	$scope.is_new = isNew;
	$scope.calendar = calendar;
	$scope.oldCalendar = isNew ? calendar : vevent.calendar;
	$scope.readOnly = !vevent.calendar.isWritable();
	$scope.accessibleViaCalDAV = vevent.calendar.eventsAccessibleViaCalDAV();
	$scope.selected = 0;
	$scope.timezones = [];
	$scope.emailAddress = emailAddress;
	$scope.edittimezone = $scope.properties.dtstart.parameters.zone !== 'floating' && $scope.properties.dtstart.parameters.zone !== $scope.defaulttimezone || $scope.properties.dtend.parameters.zone !== 'floating' && $scope.properties.dtend.parameters.zone !== $scope.defaulttimezone;

	$scope.preEditingHooks = [];
	$scope.postEditingHooks = [];

	$scope.tabs = [{ title: t('calendar', 'Details'), value: 0 }, { title: t('calendar', 'Attendees'), value: 1 }, { title: t('calendar', 'Reminders'), value: 2 }, { title: t('calendar', 'Repeating'), value: 3 }];

	$scope.classSelect = [{ displayname: t('calendar', 'When shared show full event'), type: 'PUBLIC' }, { displayname: t('calendar', 'When shared show only busy'), type: 'CONFIDENTIAL' }, { displayname: t('calendar', 'When shared hide this event'), type: 'PRIVATE' }];

	$scope.statusSelect = [{ displayname: t('calendar', 'Confirmed'), type: 'CONFIRMED' }, { displayname: t('calendar', 'Tentative'), type: 'TENTATIVE' }, { displayname: t('calendar', 'Cancelled'), type: 'CANCELLED' }];

	$scope.registerPreHook = function (callback) {
		$scope.preEditingHooks.push(callback);
	};

	$uibModalInstance.rendered.then(function () {
		if ($scope.properties.dtend.type === 'date') {
			$scope.properties.dtend.value = moment($scope.properties.dtend.value.subtract(1, 'days'));
		}

		angular.forEach($scope.preEditingHooks, function (callback) {
			callback();
		});

		$scope.tabopener(0);
	});

	$scope.registerPostHook = function (callback) {
		$scope.postEditingHooks.push(callback);
	};

	$scope.proceed = function () {
		$scope.prepareClose();
		$uibModalInstance.close({
			action: 'proceed',
			calendar: $scope.calendar,
			simple: $scope.properties,
			vevent: vevent
		});
	};

	$scope.save = function () {
		if (!$scope.validate()) {
			return;
		}

		$scope.prepareClose();
		$scope.properties.patch();
		$uibModalInstance.close({
			action: 'save',
			calendar: $scope.calendar,
			simple: $scope.properties,
			vevent: vevent
		});
	};

	$scope.validate = function () {
		var error = false;
		if ($scope.properties.summary === null || $scope.properties.summary.value.trim() === '') {
			OC.Notification.showTemporary(t('calendar', 'Please add a title!'));
			error = true;
		}
		if ($scope.calendar === null || typeof $scope.calendar === 'undefined') {
			OC.Notification.showTemporary(t('calendar', 'Please select a calendar!'));
			error = true;
		}

		return !error;
	};

	$scope.prepareClose = function () {
		if ($scope.properties.allDay) {
			$scope.properties.dtstart.type = 'date';
			$scope.properties.dtend.type = 'date';
			$scope.properties.dtend.value.add(1, 'days');
		} else {
			$scope.properties.dtstart.type = 'date-time';
			$scope.properties.dtend.type = 'date-time';
		}

		angular.forEach($scope.postEditingHooks, function (callback) {
			callback();
		});
	};

	$scope.cancel = function () {
		$uibModalInstance.dismiss('cancel');
	};

	$scope.delete = function () {
		$uibModalInstance.dismiss('delete');
	};

	$scope.export = function () {
		$window.open($scope.oldCalendar.url + vevent.uri);
	};

	/**
  * Everything tabs
  */
	$scope.tabopener = function (val) {
		$scope.selected = val;
		if (val === 0) {
			$scope.eventsdetailsview = true;
			$scope.eventsattendeeview = false;
			$scope.eventsalarmview = false;
			$scope.eventsrepeatview = false;
		} else if (val === 1) {
			$scope.eventsdetailsview = false;
			$scope.eventsattendeeview = true;
			$scope.eventsalarmview = false;
			$scope.eventsrepeatview = false;
		} else if (val === 2) {
			$scope.eventsdetailsview = false;
			$scope.eventsattendeeview = false;
			$scope.eventsalarmview = true;
			$scope.eventsrepeatview = false;
		} else if (val === 3) {
			$scope.eventsdetailsview = false;
			$scope.eventsattendeeview = false;
			$scope.eventsalarmview = false;
			$scope.eventsrepeatview = true;
		}
	};

	/**
  * Everything calendar select
  */
	$scope.showCalendarSelection = function () {
		var writableCalendars = $scope.calendars.filter(function (c) {
			return c.isWritable();
		});

		return writableCalendars.length > 1;
	};

	/**
  * Everything date and time
  */
	$scope.$watch('properties.dtstart.value', function (nv, ov) {
		var diff = nv.diff(ov, 'seconds');
		if (diff !== 0) {
			$scope.properties.dtend.value = moment($scope.properties.dtend.value.add(diff, 'seconds'));
		}
	});

	$scope.toggledAllDay = function () {
		if ($scope.properties.allDay) {
			return;
		}

		if ($scope.properties.dtstart.value.isSame($scope.properties.dtend.value)) {
			$scope.properties.dtend.value = moment($scope.properties.dtend.value.add(1, 'hours'));
		}

		if ($scope.properties.dtstart.parameters.zone === 'floating' && $scope.properties.dtend.parameters.zone === 'floating') {
			$scope.properties.dtstart.parameters.zone = $scope.defaulttimezone;
			$scope.properties.dtend.parameters.zone = $scope.defaulttimezone;
		}
	};

	/**
  * Everything timezones
  */
	TimezoneService.listAll().then(function (list) {
		if ($scope.properties.dtstart.parameters.zone !== 'floating' && list.indexOf($scope.properties.dtstart.parameters.zone) === -1) {
			list.push($scope.properties.dtstart.parameters.zone);
		}
		if ($scope.properties.dtend.parameters.zone !== 'floating' && list.indexOf($scope.properties.dtend.parameters.zone) === -1) {
			list.push($scope.properties.dtend.parameters.zone);
		}

		angular.forEach(list, function (timezone) {
			if (timezone === 'GMT' || timezone === 'Z') {
				return;
			}

			if (timezone.split('/').length === 1) {
				$scope.timezones.push({
					displayname: timezone,
					group: t('calendar', 'Global'),
					value: timezone
				});
			} else {
				$scope.timezones.push({
					displayname: timezone.split('/').slice(1).join('/'),
					group: timezone.split('/', 1),
					value: timezone
				});
			}
		});

		$scope.timezones.push({
			displayname: t('calendar', 'None'),
			group: t('calendar', 'Global'),
			value: 'floating'
		});
	});

	$scope.loadTimezone = function (tzId) {
		TimezoneService.get(tzId).then(function (timezone) {
			ICAL.TimezoneService.register(tzId, timezone.jCal);
		});
	};

	/**
  * Everything location
  */
	$scope.searchLocation = function (value) {
		return AutoCompletionService.searchLocation(value);
	};

	$scope.selectLocationFromTypeahead = function (item) {
		$scope.properties.location.value = item.label;
	};

	/**
  * Everything access class
  */
	$scope.setClassToDefault = function () {
		if ($scope.properties.class === null) {
			$scope.properties.class = {
				type: 'string',
				value: 'PUBLIC'
			};
		}
	};

	$scope.setStatusToDefault = function () {
		if ($scope.properties.status === null) {
			$scope.properties.status = {
				type: 'string',
				value: 'CONFIRMED'
			};
		}
	};
}]);

/**
 * Controller: ImportController
 * Description: Takes care of importing calendars
 */

app.controller('ImportController', ['$scope', '$filter', 'CalendarService', 'VEventService', '$uibModalInstance', 'files', 'ImportFileWrapper', 'ColorUtility', function ($scope, $filter, CalendarService, VEventService, $uibModalInstance, files, ImportFileWrapper, ColorUtility) {
	'use strict';

	$scope.nameSize = 25;

	$scope.rawFiles = files;
	$scope.files = [];

	$scope.showCloseButton = false;
	$scope.writableCalendars = $scope.calendars.filter(function (elem) {
		return elem.isWritable();
	});

	$scope.import = function (fileWrapper) {
		fileWrapper.state = ImportFileWrapper.stateScheduled;

		var importCalendar = function importCalendar(calendar) {
			var objects = fileWrapper.splittedICal.objects;

			angular.forEach(objects, function (object) {
				VEventService.create(calendar, object, false).then(function (response) {
					fileWrapper.state = ImportFileWrapper.stateImporting;
					fileWrapper.progress++;

					if (!response) {
						fileWrapper.errors++;
					}
				});
			});
		};

		if (fileWrapper.selectedCalendar === 'new') {
			var name = fileWrapper.splittedICal.name || fileWrapper.file.name;
			var color = fileWrapper.splittedICal.color || ColorUtility.randomColor();

			var components = [];
			if (fileWrapper.splittedICal.vevents.length > 0) {
				components.push('vevent');
				components.push('vtodo');
			}
			if (fileWrapper.splittedICal.vjournals.length > 0) {
				components.push('vjournal');
			}
			if (fileWrapper.splittedICal.vtodos.length > 0 && components.indexOf('vtodo') === -1) {
				components.push('vtodo');
			}

			CalendarService.create(name, color, components).then(function (calendar) {
				if (calendar.components.vevent) {
					$scope.calendars.push(calendar);
					$scope.writableCalendars.push(calendar);
				}
				importCalendar(calendar);
				fileWrapper.selectedCalendar = calendar.url;
			});
		} else {
			var calendar = $scope.calendars.filter(function (element) {
				return element.url === fileWrapper.selectedCalendar;
			})[0];
			importCalendar(calendar);
		}
	};

	$scope.preselectCalendar = function (fileWrapper) {
		var possibleCalendars = $filter('importCalendarFilter')($scope.writableCalendars, fileWrapper);
		if (possibleCalendars.length === 0) {
			fileWrapper.selectedCalendar = 'new';
		} else {
			fileWrapper.selectedCalendar = possibleCalendars[0].url;
		}
	};

	$scope.changeCalendar = function (fileWrapper) {
		if (fileWrapper.selectedCalendar === 'new') {
			fileWrapper.incompatibleObjectsWarning = false;
		} else {
			var possibleCalendars = $filter('importCalendarFilter')($scope.writableCalendars, fileWrapper);
			fileWrapper.incompatibleObjectsWarning = possibleCalendars.indexOf(fileWrapper.selectedCalendar) === -1;
		}
	};

	angular.forEach($scope.rawFiles, function (rawFile) {
		var fileWrapper = ImportFileWrapper(rawFile);
		fileWrapper.read(function () {
			$scope.preselectCalendar(fileWrapper);
			$scope.$apply();
		});

		fileWrapper.register(ImportFileWrapper.hookProgressChanged, function () {
			$scope.$apply();
		});

		fileWrapper.register(ImportFileWrapper.hookDone, function () {
			$scope.$apply();
			$scope.closeIfNecessary();

			var calendar = $scope.calendars.filter(function (element) {
				return element.url === fileWrapper.selectedCalendar;
			})[0];
			if (calendar.enabled) {
				calendar.enabled = false;
				calendar.enabled = true;
			}
		});

		fileWrapper.register(ImportFileWrapper.hookErrorsChanged, function () {
			$scope.$apply();
		});

		$scope.files.push(fileWrapper);
	});

	$scope.closeIfNecessary = function () {
		var unfinishedFiles = $scope.files.filter(function (fileWrapper) {
			return !fileWrapper.wasCanceled() && !fileWrapper.isDone();
		});
		var filesEncounteredErrors = $scope.files.filter(function (fileWrapper) {
			return fileWrapper.isDone() && fileWrapper.hasErrors();
		});

		if (unfinishedFiles.length === 0 && filesEncounteredErrors.length === 0) {
			$uibModalInstance.close();
		} else if (unfinishedFiles.length === 0 && filesEncounteredErrors.length !== 0) {
			$scope.showCloseButton = true;
			$scope.$apply();
		}
	};

	$scope.close = function () {
		$uibModalInstance.close();
	};

	$scope.cancelFile = function (fileWrapper) {
		fileWrapper.state = ImportFileWrapper.stateCanceled;
		$scope.closeIfNecessary();
	};
}]);

app.controller('RecurrenceController', ["$scope", function ($scope) {
	'use strict';

	$scope.rruleNotSupported = false;

	$scope.repeat_options_simple = [{ val: 'NONE', displayname: t('calendar', 'None') }, { val: 'DAILY', displayname: t('calendar', 'Every day') }, { val: 'WEEKLY', displayname: t('calendar', 'Every week') }, { val: 'MONTHLY', displayname: t('calendar', 'Every month') }, { val: 'YEARLY', displayname: t('calendar', 'Every year') } //,
	//{val: 'CUSTOM', displayname: t('calendar', 'Custom')}
	];

	$scope.selected_repeat_end = 'NEVER';
	$scope.repeat_end = [{ val: 'NEVER', displayname: t('calendar', 'never') }, { val: 'COUNT', displayname: t('calendar', 'after') } //,
	//{val: 'UNTIL', displayname: t('calendar', 'on date')}
	];

	$scope.$parent.registerPreHook(function () {
		if ($scope.properties.rrule.freq !== 'NONE') {
			var unsupportedFREQs = ['SECONDLY', 'MINUTELY', 'HOURLY'];
			if (unsupportedFREQs.indexOf($scope.properties.rrule.freq) !== -1) {
				$scope.rruleNotSupported = true;
			}

			if (typeof $scope.properties.rrule.parameters !== 'undefined') {
				var partIds = Object.getOwnPropertyNames($scope.properties.rrule.parameters);
				if (partIds.length > 0) {
					$scope.rruleNotSupported = true;
				}
			}

			if ($scope.properties.rrule.count !== null) {
				$scope.selected_repeat_end = 'COUNT';
			} else if ($scope.properties.rrule.until !== null) {
				$scope.rruleNotSupported = true;
				//$scope.selected_repeat_end = 'UNTIL';
			}

			/*if (!moment.isMoment($scope.properties.rrule.until)) {
    $scope.properties.rrule.until = moment();
    }*/

			if ($scope.properties.rrule.interval === null) {
				$scope.properties.rrule.interval = 1;
			}
		}
	});

	$scope.$parent.registerPostHook(function () {
		$scope.properties.rrule.dontTouch = $scope.rruleNotSupported;

		if ($scope.selected_repeat_end === 'NEVER') {
			$scope.properties.rrule.count = null;
			$scope.properties.rrule.until = null;
		}
	});

	$scope.resetRRule = function () {
		$scope.selected_repeat_end = 'NEVER';
		$scope.properties.rrule.freq = 'NONE';
		$scope.properties.rrule.count = null;
		//$scope.properties.rrule.until = null;
		$scope.properties.rrule.interval = 1;
		$scope.rruleNotSupported = false;
		$scope.properties.rrule.parameters = {};
	};
}]);

/**
 * Controller: SettingController
 * Description: Takes care of the Calendar Settings.
 */

app.controller('SettingsController', ['$scope', '$uibModal', 'SettingsService', 'fc', function ($scope, $uibModal, SettingsService, fc) {
	'use strict';

	$scope.settingsCalDavLink = OC.linkToRemote('dav') + '/';
	$scope.settingsCalDavPrincipalLink = OC.linkToRemote('dav') + '/principals/users/' + escapeHTML(encodeURIComponent(oc_current_user)) + '/';
	$scope.skipPopover = angular.element('#fullcalendar').attr('data-skipPopover');
	$scope.settingsShowWeekNr = angular.element('#fullcalendar').attr('data-weekNumbers');

	angular.element('#import').on('change', function () {
		var filesArray = [];
		for (var i = 0; i < this.files.length; i++) {
			filesArray.push(this.files[i]);
		}

		if (filesArray.length > 0) {
			$uibModal.open({
				templateUrl: 'import.html',
				controller: 'ImportController',
				windowClass: 'import',
				backdropClass: 'import-backdrop',
				keyboard: false,
				appendTo: angular.element('#importpopover-container'),
				resolve: {
					files: function files() {
						return filesArray;
					}
				},
				scope: $scope
			});
		}

		angular.element('#import').val(null);
	});

	$scope.updateSkipPopover = function () {
		var newValue = $scope.skipPopover;
		angular.element('#fullcalendar').attr('data-skipPopover', newValue);
		SettingsService.setSkipPopover(newValue);
	};

	$scope.updateShowWeekNr = function () {
		var newValue = $scope.settingsShowWeekNr;
		angular.element('#fullcalendar').attr('data-weekNumbers', newValue);
		SettingsService.setShowWeekNr(newValue);
		if (fc.elm) {
			fc.elm.fullCalendar('option', 'weekNumbers', newValue === 'yes');
		}
	};
}]);

/**
* Controller: SubscriptionController
* Description: Takes care of Subscription List in the App Navigation.
*/
app.controller('SubscriptionController', ['$scope', function ($scope) {}]);

app.controller('VAlarmController', ["$scope", function ($scope) {
	'use strict';

	$scope.newReminderId = -1;

	$scope.alarmFactors = [60, //seconds
	60, //minutes
	24, //hours
	7 //days
	];

	$scope.reminderSelect = [{ displayname: t('calendar', 'At time of event'), trigger: 0 }, { displayname: t('calendar', '5 minutes before'), trigger: -1 * 5 * 60 }, { displayname: t('calendar', '10 minutes before'), trigger: -1 * 10 * 60 }, { displayname: t('calendar', '15 minutes before'), trigger: -1 * 15 * 60 }, { displayname: t('calendar', '30 minutes before'), trigger: -1 * 30 * 60 }, { displayname: t('calendar', '1 hour before'), trigger: -1 * 60 * 60 }, { displayname: t('calendar', '2 hours before'), trigger: -1 * 2 * 60 * 60 }, { displayname: t('calendar', 'Custom'), trigger: 'custom' }];

	$scope.reminderSelectTriggers = $scope.reminderSelect.map(function (elem) {
		return elem.trigger;
	}).filter(function (elem) {
		return typeof elem === 'number';
	});

	$scope.reminderTypeSelect = [{ displayname: t('calendar', 'Audio'), type: 'AUDIO' }, { displayname: t('calendar', 'E Mail'), type: 'EMAIL' }, { displayname: t('calendar', 'Pop up'), type: 'DISPLAY' }];

	$scope.timeUnitReminderSelect = [{ displayname: t('calendar', 'sec'), factor: 1 }, { displayname: t('calendar', 'min'), factor: 60 }, { displayname: t('calendar', 'hours'), factor: 60 * 60 }, { displayname: t('calendar', 'days'), factor: 60 * 60 * 24 }, { displayname: t('calendar', 'week'), factor: 60 * 60 * 24 * 7 }];

	$scope.timePositionReminderSelect = [{ displayname: t('calendar', 'before'), factor: -1 }, { displayname: t('calendar', 'after'), factor: 1 }];

	$scope.startEndReminderSelect = [{ displayname: t('calendar', 'start'), type: 'start' }, { displayname: t('calendar', 'end'), type: 'end' }];

	$scope.$parent.registerPreHook(function () {
		angular.forEach($scope.properties.alarm, function (alarm) {
			$scope._addEditorProps(alarm);
		});
	});

	$scope.$parent.registerPostHook(function () {
		angular.forEach($scope.properties.alarm, function (alarm) {
			if (alarm.editor.triggerType === 'absolute') {
				alarm.trigger.value = alarm.editor.absMoment;
			}
		});
	});

	$scope._addEditorProps = function (alarm) {
		angular.extend(alarm, {
			editor: {
				triggerValue: 0,
				triggerBeforeAfter: -1,
				triggerTimeUnit: 1,
				absMoment: moment(),
				editing: false
			}
		});

		alarm.editor.reminderSelectValue = $scope.reminderSelectTriggers.indexOf(alarm.trigger.value) !== -1 ? alarm.editor.reminderSelectValue = alarm.trigger.value : alarm.editor.reminderSelectValue = 'custom';

		alarm.editor.triggerType = alarm.trigger.type === 'duration' ? 'relative' : 'absolute';

		if (alarm.editor.triggerType === 'relative') {
			$scope._prepareRelativeVAlarm(alarm);
		} else {
			$scope._prepareAbsoluteVAlarm(alarm);
		}

		$scope._prepareRepeat(alarm);
	};

	$scope._prepareRelativeVAlarm = function (alarm) {
		var unitAndValue = $scope._getUnitAndValue(Math.abs(alarm.trigger.value));

		angular.extend(alarm.editor, {
			triggerBeforeAfter: alarm.trigger.value < 0 ? -1 : 1,
			triggerTimeUnit: unitAndValue[0],
			triggerValue: unitAndValue[1]
		});
	};

	$scope._prepareAbsoluteVAlarm = function (alarm) {
		alarm.editor.absMoment = alarm.trigger.value;
	};

	$scope._prepareRepeat = function (alarm) {
		var unitAndValue = $scope._getUnitAndValue(alarm.duration && alarm.duration.value ? alarm.duration.value : 0);

		angular.extend(alarm.editor, {
			repeat: !(!alarm.repeat.value || alarm.repeat.value === 0),
			repeatNTimes: alarm.editor.repeat ? alarm.repeat.value : 0,
			repeatTimeUnit: unitAndValue[0],
			repeatNValue: unitAndValue[1]
		});
	};

	$scope._getUnitAndValue = function (value) {
		var unit = 1;

		var alarmFactors = [60, 60, 24, 7];

		for (var i = 0; i < alarmFactors.length && value !== 0; i++) {
			var mod = value % alarmFactors[i];
			if (mod !== 0) {
				break;
			}

			unit *= alarmFactors[i];
			value /= alarmFactors[i];
		}

		return [unit, value];
	};

	$scope.add = function () {
		var setTriggers = [];
		angular.forEach($scope.properties.alarm, function (alarm) {
			if (alarm.trigger && alarm.trigger.type === 'duration') {
				setTriggers.push(alarm.trigger.value);
			}
		});

		var triggersToSuggest = [];
		angular.forEach($scope.reminderSelect, function (option) {
			if (typeof option.trigger !== 'number' || option.trigger > -1 * 15 * 60) {
				return;
			}

			triggersToSuggest.push(option.trigger);
		});

		var triggerToSet = null;
		for (var i = 0; i < triggersToSuggest.length; i++) {
			if (setTriggers.indexOf(triggersToSuggest[i]) === -1) {
				triggerToSet = triggersToSuggest[i];
				break;
			}
		}
		if (triggerToSet === null) {
			triggerToSet = triggersToSuggest[triggersToSuggest.length - 1];
		}

		var alarm = {
			id: $scope.newReminderId--,
			action: {
				type: 'text',
				value: 'AUDIO'
			},
			trigger: {
				type: 'duration',
				value: triggerToSet,
				related: 'start'
			},
			repeat: {},
			duration: {}
		};

		$scope._addEditorProps(alarm);
		$scope.properties.alarm.push(alarm);
	};

	$scope.remove = function (alarm) {
		$scope.properties.alarm = $scope.properties.alarm.filter(function (elem) {
			return elem !== alarm;
		});
	};

	$scope.triggerEdit = function (alarm) {
		if (alarm.editor.editing === true) {
			alarm.editor.editing = false;
		} else {
			if ($scope.isEditingReminderSupported(alarm)) {
				alarm.editor.editing = true;
			} else {
				OC.Notification.showTemporary(t('calendar', 'Editing reminders of unknown type not supported.'));
			}
		}
	};

	$scope.isEditingReminderSupported = function (alarm) {
		//WE DON'T AIM TO SUPPORT PROCEDURE
		return ['AUDIO', 'DISPLAY', 'EMAIL'].indexOf(alarm.action.value) !== -1;
	};

	$scope.updateReminderSelectValue = function (alarm) {
		var factor = alarm.editor.reminderSelectValue;
		if (factor !== 'custom') {
			alarm.duration = {};
			alarm.repeat = {};
			alarm.trigger.related = 'start';
			alarm.trigger.type = 'duration';
			alarm.trigger.value = parseInt(factor);

			$scope._addEditorProps(alarm);
		}
	};

	$scope.updateReminderRelative = function (alarm) {
		alarm.trigger.value = parseInt(alarm.editor.triggerBeforeAfter) * parseInt(alarm.editor.triggerTimeUnit) * parseInt(alarm.editor.triggerValue);

		alarm.trigger.type = 'duration';
	};

	$scope.updateReminderAbsolute = function (alarm) {
		if (!moment.isMoment(alarm.trigger.value)) {
			alarm.trigger.value = moment();
		}

		alarm.trigger.type = 'date-time';
	};

	$scope.updateReminderRepeat = function (alarm) {
		alarm.repeat.type = 'string';
		alarm.repeat.value = alarm.editor.repeatNTimes;
		alarm.duration.type = 'duration';
		alarm.duration.value = parseInt(alarm.editor.repeatNValue) * parseInt(alarm.editor.repeatTimeUnit);
	};
}]);

/**
 * Directive: Colorpicker
 * Description: Colorpicker for the Calendar app.
 */
app.directive('colorpicker', ["ColorUtility", function (ColorUtility) {
	'use strict';

	return {
		scope: {
			selected: '=',
			customizedColors: '=colors'
		},
		restrict: 'AE',
		templateUrl: OC.filePath('calendar', 'templates', 'colorpicker.html'),
		link: function link(scope, element, attr) {
			scope.colors = scope.customizedColors || ColorUtility.colors;
			scope.selected = scope.selected || scope.colors[0];
			scope.random = "#000000";

			scope.randomizeColour = function () {
				scope.random = ColorUtility.randomColor();
				scope.pick(scope.random);
			};

			scope.pick = function (color) {
				scope.selected = color;
			};
		}
	};
}]);

app.directive('ocdatetimepicker', ["$compile", "$timeout", function ($compile, $timeout) {
	'use strict';

	return {
		restrict: 'E',
		require: 'ngModel',
		scope: {
			disabletime: '=disabletime'
		},
		link: function link(scope, element, attrs, ngModelCtrl) {
			var templateHTML = '<input type="text" ng-model="date" class="events--date" />';
			templateHTML += '<input type="text" ng-model="time" class="events--time" ng-disabled="disabletime"/>';
			var template = angular.element(templateHTML);

			scope.date = null;
			scope.time = null;

			$compile(template)(scope);
			element.append(template);

			function updateFromUserInput() {
				var date = element.find('.events--date').datepicker('getDate'),
				    hours = 0,
				    minutes = 0;

				if (!scope.disabletime) {
					hours = element.find('.events--time').timepicker('getHour');
					minutes = element.find('.events--time').timepicker('getMinute');
				}

				var m = moment(date);
				m.hours(hours);
				m.minutes(minutes);
				m.seconds(0);

				//Hiding the timepicker is an ugly hack to mitigate a bug in the timepicker
				//We might want to consider using another timepicker in the future
				element.find('.events--time').timepicker('hide');
				ngModelCtrl.$setViewValue(m);
			}

			var localeData = moment.localeData();
			function initDatePicker() {
				element.find('.events--date').datepicker({
					dateFormat: localeData.longDateFormat('L').toLowerCase().replace('yy', 'y').replace('yyy', 'yy'),
					monthNames: moment.months(),
					monthNamesShort: moment.monthsShort(),
					dayNames: moment.weekdays(),
					dayNamesMin: moment.weekdaysMin(),
					dayNamesShort: moment.weekdaysShort(),
					firstDay: +localeData.firstDayOfWeek(),
					minDate: null,
					showOtherMonths: true,
					selectOtherMonths: true,
					onClose: updateFromUserInput
				});
			}
			function initTimepicker() {
				element.find('.events--time').timepicker({
					showPeriodLabels: false,
					showLeadingZero: true,
					showPeriod: localeData.longDateFormat('LT').toLowerCase().indexOf('a') !== -1,
					duration: 0,
					onClose: updateFromUserInput
				});
			}

			initDatePicker();
			initTimepicker();

			scope.$watch(function () {
				return ngModelCtrl.$modelValue;
			}, function (value) {
				if (moment.isMoment(value)) {
					element.find('.events--date').datepicker('setDate', value.toDate());
					element.find('.events--time').timepicker('setTime', value.toDate());
				}
			});
			element.on('$destroy', function () {
				element.find('.events--date').datepicker('destroy');
				element.find('.events--time').timepicker('destroy');
			});
		}
	};
}]);

app.constant('fc', {}).directive('fc', ["fc", "$window", function (fc, $window) {
	'use strict';

	return {
		restrict: 'A',
		scope: {},
		link: function link(scope, elm, attrs) {
			var localeData = moment.localeData();
			var englishFallback = moment.localeData('en');

			var monthNames = [];
			var monthNamesShort = [];
			for (var i = 0; i < 12; i++) {
				var monthName = localeData.months(moment([0, i]), '');
				var shortMonthName = localeData.monthsShort(moment([0, i]), '');

				if (monthName) {
					monthNames.push(monthName);
				} else {
					monthNames.push(englishFallback.months(moment([0, i]), ''));
				}

				if (shortMonthName) {
					monthNamesShort.push(shortMonthName);
				} else {
					monthNamesShort.push(englishFallback.monthsShort(moment([0, i]), ''));
				}
			}

			var dayNames = [];
			var dayNamesShort = [];
			var momentWeekHelper = moment().startOf('week');
			momentWeekHelper.subtract(momentWeekHelper.format('d'));
			for (var _i = 0; _i < 7; _i++) {
				var dayName = localeData.weekdays(momentWeekHelper);
				var shortDayName = localeData.weekdaysShort(momentWeekHelper);

				if (dayName) {
					dayNames.push(dayName);
				} else {
					dayNames.push(englishFallback.weekdays(momentWeekHelper));
				}

				if (shortDayName) {
					dayNamesShort.push(shortDayName);
				} else {
					dayNamesShort.push(englishFallback.weekdaysShort(momentWeekHelper));
				}

				momentWeekHelper.add(1, 'days');
			}

			var firstDay = +moment().startOf('week').format('d');

			var headerSize = angular.element('#header').height();
			var windowElement = angular.element($window);
			windowElement.bind('resize', function () {
				var newHeight = windowElement.height() - headerSize;
				fc.elm.fullCalendar('option', 'height', newHeight);
			});

			var isPublic = attrs.ispublic === '1';

			var baseConfig = {
				dayNames: dayNames,
				dayNamesShort: dayNamesShort,
				defaultView: attrs.defaultview,
				editable: !isPublic,
				firstDay: firstDay,
				header: false,
				height: windowElement.height() - headerSize,
				locale: moment.locale(),
				monthNames: monthNames,
				monthNamesShort: monthNamesShort,
				nowIndicator: true,
				weekNumbers: attrs.weeknumbers === 'yes',
				weekNumbersWithinDays: true,
				selectable: !isPublic
			};
			var controllerConfig = scope.$parent.fcConfig;
			var config = angular.extend({}, baseConfig, controllerConfig);

			fc.elm = $(elm).fullCalendar(config);
		}
	};
}]);

/**
* Directive: Loading
* Description: Can be used to incorperate loading behavior, anywhere.
*/

app.directive('loading', [function () {
	'use strict';

	return {
		restrict: 'E',
		replace: true,
		template: "<div id='loading' class='icon-loading'></div>",
		link: function link($scope, element, attr) {
			$scope.$watch('loading', function (val) {
				if (val) {
					$(element).show();
				} else {
					$(element).hide();
				}
			});
		}
	};
}]);

/**
* Controller: Modal
* Description: The jQuery Model ported to angularJS as a directive.
*/

app.directive('openDialog', function () {
	'use strict';

	return {
		restrict: 'A',
		link: function link(scope, elem, attr, ctrl) {
			var dialogId = '#' + attr.openDialog;
			elem.bind('click', function (e) {
				$(dialogId).dialog('open');
			});
		}
	};
});

app.directive('onToggleShow', function () {
	'use strict';

	return {
		restrict: 'A',
		scope: {
			'onToggleShow': '@'
		},
		link: function link(scope, elem) {
			elem.click(function () {
				var target = $(scope.onToggleShow);
				target.toggle();
			});

			scope.$on('documentClicked', function (s, event) {
				var target = $(scope.onToggleShow);

				if (event.target !== elem[0]) {
					target.hide();
				}
			});
		}
	};
});

app.service('ICalFactory', function () {
	'use strict';

	var self = this;

	/**
  * create a new ICAL calendar object
  * @returns {ICAL.Component}
  */
	this.new = function () {
		var root = new ICAL.Component(['vcalendar', [], []]);

		var version = angular.element('#fullcalendar').attr('data-appVersion');
		root.updatePropertyWithValue('prodid', '-//ownCloud calendar v' + version);

		root.updatePropertyWithValue('version', '2.0');
		root.updatePropertyWithValue('calscale', 'GREGORIAN');

		return root;
	};

	/**
  * create a new ICAL calendar object that contains a calendar
  * @param uid
  * @returns ICAL.Component
  */
	this.newEvent = function (uid) {
		var comp = self.new();

		var event = new ICAL.Component('vevent');
		comp.addSubcomponent(event);

		event.updatePropertyWithValue('created', ICAL.Time.now());
		event.updatePropertyWithValue('dtstamp', ICAL.Time.now());
		event.updatePropertyWithValue('last-modified', ICAL.Time.now());
		event.updatePropertyWithValue('uid', uid);

		//add a dummy dtstart, so it's a valid ics
		event.updatePropertyWithValue('dtstart', ICAL.Time.now());

		return comp;
	};
});

app.filter('attendeeFilter', function () {
	'use strict';

	return function (attendee) {
		if ((typeof attendee === 'undefined' ? 'undefined' : _typeof(attendee)) !== 'object' || !attendee) {
			return '';
		} else if (_typeof(attendee.parameters) === 'object' && typeof attendee.parameters.cn === 'string') {
			return attendee.parameters.cn;
		} else if (typeof attendee.value === 'string' && attendee.value.startsWith('MAILTO:')) {
			return attendee.value.substr(7);
		} else {
			return attendee.value || '';
		}
	};
});

app.filter('attendeeNotOrganizerFilter', function () {
	'use strict';

	return function (attendees, organizer) {
		if (typeof organizer !== 'string' || organizer === '') {
			return Array.isArray(attendees) ? attendees : [];
		}

		if (!Array.isArray(attendees)) {
			return [];
		}

		var organizerValue = 'MAILTO:' + organizer;
		return attendees.filter(function (element) {
			if ((typeof element === 'undefined' ? 'undefined' : _typeof(element)) !== 'object') {
				return false;
			} else {
				return element.value !== organizerValue;
			}
		});
	};
});

app.filter('calendarFilter', function () {
	'use strict';

	return function (calendars) {
		if (!Array.isArray(calendars)) {
			return [];
		}

		return calendars.filter(function (element) {
			if ((typeof element === 'undefined' ? 'undefined' : _typeof(element)) !== 'object') {
				return false;
			} else {
				return element.isWritable();
			}
		});
	};
});

app.filter('calendarListFilter', ["CalendarListItem", function (CalendarListItem) {
	'use strict';

	return function (calendarListItems) {
		if (!Array.isArray(calendarListItems)) {
			return [];
		}

		return calendarListItems.filter(function (item) {
			if (!CalendarListItem.isCalendarListItem(item)) {
				return false;
			}
			return item.calendar.isWritable();
		});
	};
}]);

app.filter('calendarSelectorFilter', function () {
	'use strict';

	return function (calendars, calendar) {
		if (!Array.isArray(calendars)) {
			return [];
		}

		var options = calendars.filter(function (c) {
			return c.isWritable();
		});

		if ((typeof calendar === 'undefined' ? 'undefined' : _typeof(calendar)) !== 'object' || !calendar) {
			return options;
		}

		if (!calendar.isWritable()) {
			return [calendar];
		} else {
			if (options.indexOf(calendar) === -1) {
				options.push(calendar);
			}

			return options;
		}
	};
});

app.filter('datepickerFilter', function () {
	'use strict';

	return function (datetime, view) {
		if (!(datetime instanceof Date) || typeof view !== 'string') {
			return '';
		}

		switch (view) {
			case 'agendaDay':
				return moment(datetime).format('ll');

			case 'agendaWeek':
				return t('calendar', 'Week {number} of {year}', { number: moment(datetime).week(),
					year: moment(datetime).week() === 1 ? moment(datetime).add(1, 'week').year() : moment(datetime).year() });

			case 'month':
				return moment(datetime).week() === 1 ? moment(datetime).add(1, 'week').format('MMMM GGGG') : moment(datetime).format('MMMM GGGG');

			default:
				return '';
		}
	};
});

app.filter('importCalendarFilter', function () {
	'use strict';

	return function (calendars, file) {
		if (!Array.isArray(calendars) || (typeof file === 'undefined' ? 'undefined' : _typeof(file)) !== 'object' || !file || _typeof(file.splittedICal) !== 'object' || !file.splittedICal) {
			return [];
		}

		var events = file.splittedICal.vevents.length,
		    journals = file.splittedICal.vjournals.length,
		    todos = file.splittedICal.vtodos.length;

		return calendars.filter(function (calendar) {
			if (events !== 0 && !calendar.components.vevent) {
				return false;
			}
			if (journals !== 0 && !calendar.components.vjournal) {
				return false;
			}
			if (todos !== 0 && !calendar.components.vtodo) {
				return false;
			}

			return true;
		});
	};
});

app.filter('importErrorFilter', function () {
	'use strict';

	return function (file) {
		if ((typeof file === 'undefined' ? 'undefined' : _typeof(file)) !== 'object' || !file || typeof file.errors !== 'number') {
			return '';
		}

		//TODO - use n instead of t to use proper plurals in all translations
		switch (file.errors) {
			case 0:
				return t('calendar', 'Successfully imported');

			case 1:
				return t('calendar', 'Partially imported, 1 failure');

			default:
				return t('calendar', 'Partially imported, {n} failures', {
					n: file.errors
				});
		}
	};
});

app.filter('simpleReminderDescription', function () {
	'use strict';

	var actionMapper = {
		AUDIO: t('calendar', 'Audio alarm'),
		DISPLAY: t('calendar', 'Pop-up'),
		EMAIL: t('calendar', 'E-Mail'),
		NONE: t('calendar', 'None')
	};

	function getActionName(alarm) {
		var name = alarm.action.value;
		if (name && actionMapper.hasOwnProperty(name)) {
			return actionMapper[name];
		} else {
			return name;
		}
	}

	return function (alarm) {
		if ((typeof alarm === 'undefined' ? 'undefined' : _typeof(alarm)) !== 'object' || !alarm || _typeof(alarm.trigger) !== 'object' || !alarm.trigger) {
			return '';
		}

		var relative = alarm.trigger.type === 'duration';
		var relatedToStart = alarm.trigger.related === 'start';
		if (relative) {
			var timeString = moment.duration(Math.abs(alarm.trigger.value), 'seconds').humanize();
			if (alarm.trigger.value < 0) {
				if (relatedToStart) {
					return t('calendar', '{type} {time} before the event starts', { type: getActionName(alarm), time: timeString });
				} else {
					return t('calendar', '{type} {time} before the event ends', { type: getActionName(alarm), time: timeString });
				}
			} else if (alarm.trigger.value > 0) {
				if (relatedToStart) {
					return t('calendar', '{type} {time} after the event starts', { type: getActionName(alarm), time: timeString });
				} else {
					return t('calendar', '{type} {time} after the event ends', { type: getActionName(alarm), time: timeString });
				}
			} else {
				if (relatedToStart) {
					return t('calendar', '{type} at the event\'s start', { type: getActionName(alarm) });
				} else {
					return t('calendar', '{type} at the event\'s end', { type: getActionName(alarm) });
				}
			}
		} else {
			if (alarm.editor && moment.isMoment(alarm.editor.absMoment)) {
				return t('calendar', '{type} at {time}', {
					type: getActionName(alarm),
					time: alarm.editor.absMoment.format('LLLL')
				});
			} else {
				return '';
			}
		}
	};
});

app.filter('subscriptionFilter', function () {
	'use strict';

	return function (calendars) {
		if (!Array.isArray(calendars)) {
			return [];
		}

		return calendars.filter(function (element) {
			if ((typeof element === 'undefined' ? 'undefined' : _typeof(element)) !== 'object') {
				return false;
			} else {
				return !element.isWritable();
			}
		});
	};
});

app.filter('subscriptionListFilter', ["CalendarListItem", function (CalendarListItem) {
	'use strict';

	return function (calendarListItems) {
		if (!Array.isArray(calendarListItems)) {
			return [];
		}

		return calendarListItems.filter(function (item) {
			if (!CalendarListItem.isCalendarListItem(item)) {
				return false;
			}
			return !item.calendar.isWritable();
		});
	};
}]);

app.filter('timezoneFilter', ['$filter', function ($filter) {
	'use strict';

	return function (timezone) {
		if (typeof timezone !== 'string') {
			return '';
		}

		timezone = timezone.split('_').join(' ');

		var elements = timezone.split('/');
		if (elements.length === 1) {
			return elements[0];
		} else {
			var continent = elements[0];
			var city = $filter('timezoneWithoutContinentFilter')(elements.slice(1).join('/'));

			return city + ' (' + continent + ')';
		}
	};
}]);

app.filter('timezoneWithoutContinentFilter', function () {
	'use strict';

	return function (timezone) {
		timezone = timezone.split('_').join(' ');
		timezone = timezone.replace('St ', 'St. ');

		return timezone.split('/').join(' - ');
	};
});

app.factory('CalendarListItem', ["Calendar", "WebCal", function (Calendar, WebCal) {
	'use strict';

	function CalendarListItem(calendar) {
		var context = {
			calendar: calendar,
			isEditingShares: false,
			isEditingProperties: false,
			isDisplayingCalDAVUrl: false,
			isDisplayingWebCalUrl: false,
			isSendingMail: false
		};
		var iface = {
			_isACalendarListItemObject: true
		};

		if (!Calendar.isCalendar(calendar)) {
			return null;
		}

		Object.defineProperties(iface, {
			calendar: {
				get: function get() {
					return context.calendar;
				}
			}
		});

		iface.displayCalDAVUrl = function () {
			return context.isDisplayingCalDAVUrl;
		};

		iface.showCalDAVUrl = function () {
			context.isDisplayingCalDAVUrl = true;
		};

		iface.displayWebCalUrl = function () {
			return context.isDisplayingWebCalUrl;
		};

		iface.hideCalDAVUrl = function () {
			context.isDisplayingCalDAVUrl = false;
		};

		iface.showWebCalUrl = function () {
			context.isDisplayingWebCalUrl = true;
		};

		iface.hideWebCalUrl = function () {
			context.isDisplayingWebCalUrl = false;
		};

		iface.isEditingShares = function () {
			return context.isEditingShares;
		};

		iface.isSendingMail = function () {
			return context.isSendingMail;
		};

		iface.toggleEditingShares = function () {
			context.isEditingShares = !context.isEditingShares;
		};

		iface.toggleSendingMail = function () {
			context.isSendingMail = !context.isSendingMail;
		};

		iface.isEditing = function () {
			return context.isEditingProperties;
		};

		iface.displayActions = function () {
			return !iface.isEditing();
		};

		iface.displayColorIndicator = function () {
			return !iface.isEditing() && !context.calendar.isRendering();
		};

		iface.displaySpinner = function () {
			return !iface.isEditing() && context.calendar.isRendering();
		};

		iface.openEditor = function () {
			iface.color = context.calendar.color;
			iface.displayname = context.calendar.displayname;

			context.isEditingProperties = true;
		};

		iface.cancelEditor = function () {
			iface.color = '';
			iface.displayname = '';

			context.isEditingProperties = false;
		};

		iface.saveEditor = function () {
			context.calendar.color = iface.color;
			context.calendar.displayname = iface.displayname;

			iface.color = '';
			iface.displayname = '';

			context.isEditingProperties = false;
		};

		iface.isWebCal = function () {
			return WebCal.isWebCal(context.calendar);
		};

		//Properties for ng-model of calendar editor
		iface.color = '';
		iface.displayname = '';

		iface.order = 0;

		iface.selectedSharee = '';

		return iface;
	}

	CalendarListItem.isCalendarListItem = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isACalendarListItemObject === true;
	};

	return CalendarListItem;
}]);

app.factory('Calendar', ["$window", "Hook", "VEventService", "TimezoneService", "ColorUtility", "RandomStringService", function ($window, Hook, VEventService, TimezoneService, ColorUtility, RandomStringService) {
	'use strict';

	function Calendar(url, props) {
		url = url || '';
		props = props || {};

		var context = {
			fcEventSource: {},
			components: props.components,
			mutableProperties: {
				color: props.color,
				displayname: props.displayname,
				enabled: props.enabled,
				order: props.order,
				published: props.published
			},
			updatedProperties: [],
			tmpId: RandomStringService.generate(),
			url: url,
			owner: props.owner,
			shares: props.shares,
			publishurl: props.publishurl,
			publicurl: props.publicurl,
			publishable: props.publishable,
			warnings: [],
			shareable: props.shareable,
			writable: props.writable,
			writableProperties: props.writableProperties
		};
		var iface = {
			_isACalendarObject: true
		};

		context.fcEventSource.events = function (start, end, timezone, callback) {
			var fcAPI = this;
			context.fcEventSource.isRendering = true;
			iface.emit(Calendar.hookFinishedRendering);

			start = moment(start.stripZone().format());
			end = moment(end.stripZone().format());

			var TimezoneServicePromise = TimezoneService.get(timezone);
			var VEventServicePromise = VEventService.getAll(iface, start, end);
			Promise.all([TimezoneServicePromise, VEventServicePromise]).then(function (results) {
				var _results = _slicedToArray(results, 2),
				    tz = _results[0],
				    events = _results[1];

				var vevents = [];

				for (var i = 0; i < events.length; i++) {
					var vevent;
					try {
						vevent = events[i].getFcEvent(start, end, tz);
					} catch (err) {
						iface.addWarning(err.toString());
						console.log(err);
						console.log(events[i]);
						continue;
					}
					vevents = vevents.concat(vevent);
				}

				callback(vevents);
				fcAPI.reportEvents(fcAPI.clientEvents());
				context.fcEventSource.isRendering = false;

				iface.emit(Calendar.hookFinishedRendering);
			}).catch(function (reason) {
				console.log(reason);
			});
		};
		context.fcEventSource.editable = context.writable;
		context.fcEventSource.calendar = iface;
		context.fcEventSource.isRendering = false;

		context.setUpdated = function (property) {
			if (context.updatedProperties.indexOf(property) === -1) {
				context.updatedProperties.push(property);
			}
		};

		Object.defineProperties(iface, {
			color: {
				get: function get() {
					return context.mutableProperties.color;
				},
				set: function set(color) {
					var oldColor = context.mutableProperties.color;
					if (color === oldColor) {
						return;
					}
					context.mutableProperties.color = color;
					context.setUpdated('color');
					iface.emit(Calendar.hookColorChanged, color, oldColor);
				}
			},
			textColor: {
				get: function get() {
					var colors = ColorUtility.extractRGBFromHexString(context.mutableProperties.color);
					return ColorUtility.generateTextColorFromRGB(colors.r, colors.g, colors.b);
				}
			},
			displayname: {
				get: function get() {
					return context.mutableProperties.displayname;
				},
				set: function set(displayname) {
					var oldDisplayname = context.mutableProperties.displayname;
					if (displayname === oldDisplayname) {
						return;
					}
					context.mutableProperties.displayname = displayname;
					context.setUpdated('displayname');
					iface.emit(Calendar.hookDisplaynameChanged, displayname, oldDisplayname);
				}
			},
			enabled: {
				get: function get() {
					return context.mutableProperties.enabled;
				},
				set: function set(enabled) {
					var oldEnabled = context.mutableProperties.enabled;
					if (enabled === oldEnabled) {
						return;
					}
					context.mutableProperties.enabled = enabled;
					context.setUpdated('enabled');
					iface.emit(Calendar.hookEnabledChanged, enabled, oldEnabled);
				}
			},
			order: {
				get: function get() {
					return context.mutableProperties.order;
				},
				set: function set(order) {
					var oldOrder = context.mutableProperties.order;
					if (order === oldOrder) {
						return;
					}
					context.mutableProperties.order = order;
					context.setUpdated('order');
					iface.emit(Calendar.hookOrderChanged, order, oldOrder);
				}

			},
			components: {
				get: function get() {
					return context.components;
				}
			},
			url: {
				get: function get() {
					return context.url;
				}
			},
			downloadUrl: {
				get: function get() {
					var url = context.url;
					// cut off last slash to have a fancy name for the ics
					if (url.slice(url.length - 1) === '/') {
						url = url.slice(0, url.length - 1);
					}
					url += '?export';

					return url;
				},
				configurable: true
			},
			caldav: {
				get: function get() {
					return $window.location.origin + context.url;
				}
			},
			publishurl: {
				get: function get() {
					return context.publishurl;
				},
				set: function set(publishurl) {
					context.publishurl = publishurl;
				}
			},
			published: {
				get: function get() {
					return context.mutableProperties.published;
				},
				set: function set(published) {
					context.mutableProperties.published = published;
				}
			},
			publishable: {
				get: function get() {
					return context.publishable;
				}
			},
			publicurl: {
				get: function get() {
					return context.publicurl;
				},
				set: function set(publicurl) {
					context.publicurl = publicurl;
				}
			},
			fcEventSource: {
				get: function get() {
					return context.fcEventSource;
				}
			},
			shares: {
				get: function get() {
					return context.shares;
				}
			},
			tmpId: {
				get: function get() {
					return context.tmpId;
				}
			},
			warnings: {
				get: function get() {
					return context.warnings;
				}
			},
			owner: {
				get: function get() {
					return context.owner;
				}
			}
		});

		iface.hasUpdated = function () {
			return context.updatedProperties.length !== 0;
		};

		iface.getUpdated = function () {
			return context.updatedProperties;
		};

		iface.resetUpdated = function () {
			context.updatedProperties = [];
		};

		iface.addWarning = function (msg) {
			context.warnings.push(msg);
		};

		iface.hasWarnings = function () {
			return context.warnings.length > 0;
		};

		iface.resetWarnings = function () {
			context.warnings = [];
		};

		iface.toggleEnabled = function () {
			context.mutableProperties.enabled = !context.mutableProperties.enabled;
			context.setUpdated('enabled');
			iface.emit(Calendar.hookEnabledChanged, context.mutableProperties.enabled, !context.mutableProperties.enabled);
		};

		iface.isShared = function () {
			return context.shares.groups.length !== 0 || context.shares.users.length !== 0;
		};

		iface.isPublished = function () {
			return context.mutableProperties.published;
		};

		iface.isPublishable = function () {
			return context.publishable;
		};

		iface.isShareable = function () {
			return context.shareable;
		};

		iface.isRendering = function () {
			return context.fcEventSource.isRendering;
		};

		iface.isWritable = function () {
			return context.writable;
		};

		iface.arePropertiesWritable = function () {
			return context.writableProperties;
		};

		iface.eventsAccessibleViaCalDAV = function () {
			return true;
		};

		Object.assign(iface, Hook(context));

		return iface;
	}

	Calendar.isCalendar = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isACalendarObject === true;
	};

	Calendar.hookFinishedRendering = 1;
	Calendar.hookColorChanged = 2;
	Calendar.hookDisplaynameChanged = 3;
	Calendar.hookEnabledChanged = 4;
	Calendar.hookOrderChanged = 5;

	return Calendar;
}]);

app.factory('FcEvent', ["SimpleEvent", function (SimpleEvent) {
	'use strict';

	/**
  * @param {VEvent} vevent
  * @param {ICAL.Component} event
  * @param {ICAL.Time} start
  * @param {ICAL.Time} end
  */

	function FcEvent(vevent, event, start, end) {
		var context = { vevent: vevent, event: event, start: start, end: end };
		context.iCalEvent = new ICAL.Event(event);

		var id = context.vevent.uri;
		if (event.hasProperty('recurrence-id')) {
			id += context.event.getFirstPropertyValue('recurrence-id').toICALString();
		}

		var allDay = start.icaltype === 'date' && end.icaltype === 'date';

		var iface = {
			_isAFcEventObject: true,
			id: id,
			allDay: allDay,
			start: start.toJSDate(),
			end: end.toJSDate(),
			repeating: context.iCalEvent.isRecurring(),
			className: ['fcCalendar-id-' + vevent.calendar.tmpId],
			editable: vevent.calendar.isWritable(),
			backgroundColor: vevent.calendar.color,
			borderColor: vevent.calendar.color,
			textColor: vevent.calendar.textColor,
			title: event.getFirstPropertyValue('summary')
		};

		Object.defineProperties(iface, {
			vevent: {
				get: function get() {
					return context.vevent;
				},
				enumerable: true
			},
			event: {
				get: function get() {
					return context.event;
				},
				enumerable: true
			},
			calendar: {
				get: function get() {
					return context.vevent.calendar;
				},
				enumerable: true
			}
		});

		/**
   * get SimpleEvent for current fcEvent
   * @returns {SimpleEvent}
   */
		iface.getSimpleEvent = function () {
			return SimpleEvent(context.event);
		};

		/**
   * moves the event to a different position
   * @param {Duration} delta
   */
		iface.drop = function (delta) {
			delta = new ICAL.Duration().fromSeconds(delta.asSeconds());

			var dtstart = context.event.getFirstPropertyValue('dtstart');
			dtstart.addDuration(delta);
			context.event.updatePropertyWithValue('dtstart', dtstart);

			if (context.event.hasProperty('dtend')) {
				var dtend = context.event.getFirstPropertyValue('dtend');
				dtend.addDuration(delta);
				context.event.updatePropertyWithValue('dtend', dtend);
			}

			context.vevent.touch();
		};

		/**
   * resizes the event
   * @param {moment.duration} delta
   */
		iface.resize = function (delta) {
			delta = new ICAL.Duration().fromSeconds(delta.asSeconds());

			if (context.event.hasProperty('duration')) {
				var duration = context.event.getFirstPropertyValue('duration');
				duration.fromSeconds(delta.toSeconds() + duration.toSeconds());
				context.event.updatePropertyWithValue('duration', duration);
			} else if (context.event.hasProperty('dtend')) {
				var dtend = context.event.getFirstPropertyValue('dtend');
				dtend.addDuration(delta);
				context.event.updatePropertyWithValue('dtend', dtend);
			} else if (context.event.hasProperty('dtstart')) {
				var dtstart = event.getFirstProperty('dtstart');
				var _dtend = dtstart.getFirstValue().clone();
				_dtend.addDuration(delta);

				var prop = context.event.addPropertyWithValue('dtend', _dtend);

				var tzid = dtstart.getParameter('tzid');
				if (tzid) {
					prop.setParameter('tzid', tzid);
				}
			}

			context.vevent.touch();
		};

		/**
   * lock fc event for editing
   */
		iface.lock = function () {
			context.lock = true;
		};

		/**
   * unlock fc event
   */
		iface.unlock = function () {
			context.lock = false;
		};

		return iface;
	}

	FcEvent.isFcEvent = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isAFcEventObject === true;
	};

	return FcEvent;
}]);

app.factory('Hook', function () {
	'use strict';

	return function Hook(context) {
		context.hooks = {};
		var iface = {};

		iface.emit = function (identifier, newValue, oldValue) {
			if (Array.isArray(context.hooks[identifier])) {
				context.hooks[identifier].forEach(function (callback) {
					callback(newValue, oldValue);
				});
			}
		};

		iface.register = function (identifier, callback) {
			context.hooks[identifier] = context.hooks[identifier] || [];
			context.hooks[identifier].push(callback);
		};

		return iface;
	};
});

app.factory('ImportFileWrapper', ["Hook", "ICalSplitterUtility", function (Hook, ICalSplitterUtility) {
	'use strict';

	function ImportFileWrapper(file) {
		var context = {
			file: file,
			splittedICal: null,
			selectedCalendar: null,
			state: 0,
			errors: 0,
			progress: 0,
			progressToReach: 0
		};
		var iface = {
			_isAImportFileWrapperObject: true
		};

		context.checkIsDone = function () {
			if (context.progress === context.progressToReach) {
				context.state = ImportFileWrapper.stateDone;
				iface.emit(ImportFileWrapper.hookDone);
			}
		};

		Object.defineProperties(iface, {
			file: {
				get: function get() {
					return context.file;
				}
			},
			splittedICal: {
				get: function get() {
					return context.splittedICal;
				}
			},
			selectedCalendar: {
				get: function get() {
					return context.selectedCalendar;
				},
				set: function set(selectedCalendar) {
					context.selectedCalendar = selectedCalendar;
				}
			},
			state: {
				get: function get() {
					return context.state;
				},
				set: function set(state) {
					if (typeof state === 'number') {
						context.state = state;
					}
				}
			},
			errors: {
				get: function get() {
					return context.errors;
				},
				set: function set(errors) {
					if (typeof errors === 'number') {
						var oldErrors = context.errors;
						context.errors = errors;
						iface.emit(ImportFileWrapper.hookErrorsChanged, errors, oldErrors);
					}
				}
			},
			progress: {
				get: function get() {
					return context.progress;
				},
				set: function set(progress) {
					if (typeof progress === 'number') {
						var oldProgress = context.progress;
						context.progress = progress;
						iface.emit(ImportFileWrapper.hookProgressChanged, progress, oldProgress);

						context.checkIsDone();
					}
				}
			},
			progressToReach: {
				get: function get() {
					return context.progressToReach;
				}
			}
		});

		iface.wasCanceled = function () {
			return context.state === ImportFileWrapper.stateCanceled;
		};

		iface.isAnalyzing = function () {
			return context.state === ImportFileWrapper.stateAnalyzing;
		};

		iface.isAnalyzed = function () {
			return context.state === ImportFileWrapper.stateAnalyzed;
		};

		iface.isScheduled = function () {
			return context.state === ImportFileWrapper.stateScheduled;
		};

		iface.isImporting = function () {
			return context.state === ImportFileWrapper.stateImporting;
		};

		iface.isDone = function () {
			return context.state === ImportFileWrapper.stateDone;
		};

		iface.hasErrors = function () {
			return context.errors > 0;
		};

		iface.read = function (afterReadCallback) {
			var reader = new FileReader();

			reader.onload = function (event) {
				context.splittedICal = ICalSplitterUtility.split(event.target.result);
				context.progressToReach = context.splittedICal.vevents.length + context.splittedICal.vjournals.length + context.splittedICal.vtodos.length;
				iface.state = ImportFileWrapper.stateAnalyzed;
				afterReadCallback();
			};

			reader.readAsText(file);
		};

		Object.assign(iface, Hook(context));

		return iface;
	}

	ImportFileWrapper.isImportWrapper = function (obj) {
		return obj instanceof ImportFileWrapper || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isAImportFileWrapperObject !== null;
	};

	ImportFileWrapper.stateCanceled = -1;
	ImportFileWrapper.stateAnalyzing = 0;
	ImportFileWrapper.stateAnalyzed = 1;
	ImportFileWrapper.stateScheduled = 2;
	ImportFileWrapper.stateImporting = 3;
	ImportFileWrapper.stateDone = 4;

	ImportFileWrapper.hookProgressChanged = 1;
	ImportFileWrapper.hookDone = 2;
	ImportFileWrapper.hookErrorsChanged = 3;

	return ImportFileWrapper;
}]);

app.factory('SimpleEvent', function () {
	'use strict';

	var defaults = {
		'summary': null,
		'location': null,
		'organizer': null,
		'class': null,
		'description': null,
		//'url': null,
		'status': null,
		//'resources': null,
		'alarm': null,
		'attendee': null,
		//'categories': null,
		'dtstart': null,
		'dtend': null,
		'repeating': null,
		'rdate': null,
		'rrule': null,
		'exdate': null
	};

	var attendeeParameters = ['role', 'rvsp', 'partstat', 'cutype', 'cn', 'delegated-from', 'delegated-to'];

	var organizerParameters = ['cn'];

	/**
  * parsers of supported properties
  */
	var simpleParser = {
		date: function date(data, vevent, key, parameters) {
			parameters = (parameters || []).concat(['tzid']);
			simpleParser._parseSingle(data, vevent, key, parameters, function (p) {
				var first = p.getFirstValue();
				return p.type === 'duration' ? first.toSeconds() : moment(first.toJSDate());
			});
		},
		dates: function dates(data, vevent, key, parameters) {
			parameters = (parameters || []).concat(['tzid']);
			simpleParser._parseMultiple(data, vevent, key, parameters, function (p) {
				var values = p.getValues(),
				    usableValues = [];

				values.forEach(function (value) {
					if (p.type === 'duration') {
						usableValues.push(value.toSeconds());
					} else {
						usableValues.push(moment(value.toJSDate()));
					}
				});

				return usableValues;
			});
		},
		string: function string(data, vevent, key, parameters) {
			simpleParser._parseSingle(data, vevent, key, parameters, function (p) {
				return p.isMultiValue ? p.getValues() : p.getFirstValue();
			});
		},
		strings: function strings(data, vevent, key, parameters) {
			simpleParser._parseMultiple(data, vevent, key, parameters, function (p) {
				return p.isMultiValue ? p.getValues() : p.getFirstValue();
			});
		},
		_parseSingle: function _parseSingle(data, vevent, key, parameters, valueParser) {
			var prop = vevent.getFirstProperty(key);
			if (!prop) {
				return;
			}

			data[key] = {
				parameters: simpleParser._parseParameters(prop, parameters),
				type: prop.type
			};

			if (prop.isMultiValue) {
				data[key].values = valueParser(prop);
			} else {
				data[key].value = valueParser(prop);
			}
		},
		_parseMultiple: function _parseMultiple(data, vevent, key, parameters, valueParser) {
			data[key] = data[key] || [];

			var properties = vevent.getAllProperties(key);
			var group = 0;

			properties.forEach(function (property) {
				var currentElement = {
					group: group,
					parameters: simpleParser._parseParameters(property, parameters),
					type: property.type
				};

				if (property.isMultiValue) {
					currentElement.values = valueParser(property);
				} else {
					currentElement.value = valueParser(property);
				}

				data[key].push(currentElement);
				property.setParameter('x-nc-group-id', group.toString());
				group++;
			});
		},
		_parseParameters: function _parseParameters(prop, para) {
			var parameters = {};

			if (!para) {
				return parameters;
			}

			para.forEach(function (p) {
				parameters[p] = prop.getParameter(p);
			});

			return parameters;
		}
	};

	var simpleReader = {
		date: function date(vevent, oldSimpleData, newSimpleData, key, parameters) {
			parameters = (parameters || []).concat(['tzid']);
			simpleReader._readSingle(vevent, oldSimpleData, newSimpleData, key, parameters, function (v, isMultiValue) {
				return v.type === 'duration' ? ICAL.Duration.fromSeconds(v.value) : ICAL.Time.fromJSDate(v.value.toDate());
			});
		},
		dates: function dates(vevent, oldSimpleData, newSimpleData, key, parameters) {
			parameters = (parameters || []).concat(['tzid']);
			simpleReader._readMultiple(vevent, oldSimpleData, newSimpleData, key, parameters, function (v, isMultiValue) {
				var values = [];

				v.values.forEach(function (value) {
					if (v.type === 'duration') {
						values.push(ICAL.Duration.fromSeconds(value));
					} else {
						values.push(ICAL.Time.fromJSDate(value.toDate()));
					}
				});

				return values;
			});
		},
		string: function string(vevent, oldSimpleData, newSimpleData, key, parameters) {
			simpleReader._readSingle(vevent, oldSimpleData, newSimpleData, key, parameters, function (v, isMultiValue) {
				return isMultiValue ? v.values : v.value;
			});
		},
		strings: function strings(vevent, oldSimpleData, newSimpleData, key, parameters) {
			simpleReader._readMultiple(vevent, oldSimpleData, newSimpleData, key, parameters, function (v, isMultiValue) {
				return isMultiValue ? v.values : v.value;
			});
		},
		_readSingle: function _readSingle(vevent, oldSimpleData, newSimpleData, key, parameters, valueReader) {
			if (!newSimpleData[key]) {
				return;
			}
			if (!newSimpleData[key].hasOwnProperty('value') && !newSimpleData[key].hasOwnProperty('values')) {
				return;
			}
			var isMultiValue = newSimpleData[key].hasOwnProperty('values');

			var prop = vevent.updatePropertyWithValue(key, valueReader(newSimpleData[key], isMultiValue));
			simpleReader._readParameters(prop, newSimpleData[key], parameters);
		},
		_readMultiple: function _readMultiple(vevent, oldSimpleData, newSimpleData, key, parameters, valueReader) {
			var oldGroups = [];
			var properties = void 0,
			    pKey = void 0,
			    groupId = void 0;

			oldSimpleData[key] = oldSimpleData[key] || [];
			oldSimpleData[key].forEach(function (e) {
				oldGroups.push(e.group);
			});

			newSimpleData[key] = newSimpleData[key] || [];
			newSimpleData[key].forEach(function (e) {
				var isMultiValue = e.hasOwnProperty('values');
				var value = valueReader(e, isMultiValue);

				if (oldGroups.indexOf(e.group) === -1) {
					var property = new ICAL.Property(key);
					simpleReader._setProperty(property, value, isMultiValue);
					simpleReader._readParameters(property, e, parameters);
					vevent.addProperty(property);
				} else {
					oldGroups.splice(oldGroups.indexOf(e.group), 1);

					properties = vevent.getAllProperties(key);
					for (pKey in properties) {
						if (!properties.hasOwnProperty(pKey)) {
							continue;
						}

						groupId = properties[pKey].getParameter('x-nc-group-id');
						if (groupId === null) {
							continue;
						}
						if (parseInt(groupId) === e.group) {
							simpleReader._setProperty(properties[pKey], value, isMultiValue);
							simpleReader._readParameters(properties[pKey], e, parameters);
						}
					}
				}
			});

			properties = vevent.getAllProperties(key);
			properties.forEach(function (property) {
				groupId = property.getParameter('x-nc-group-id');
				if (oldGroups.indexOf(parseInt(groupId)) !== -1) {
					vevent.removeProperty(property);
				}
				property.removeParameter('x-nc-group-id');
			});
		},
		_readParameters: function _readParameters(prop, simple, para) {
			if (!para) {
				return;
			}
			if (!simple.parameters) {
				return;
			}

			para.forEach(function (p) {
				if (simple.parameters[p]) {
					prop.setParameter(p, simple.parameters[p]);
				} else {
					prop.removeParameter(simple.parameters[p]);
				}
			});
		},
		_setProperty: function _setProperty(prop, value, isMultiValue) {
			if (isMultiValue) {
				prop.setValues(value);
			} else {
				prop.setValue(value);
			}
		}
	};

	/**
  * properties supported by event editor
  */
	var simpleProperties = {
		//General
		'summary': { parser: simpleParser.string, reader: simpleReader.string },
		'location': { parser: simpleParser.string, reader: simpleReader.string },
		//'categories': {parser: simpleParser.strings, reader: simpleReader.strings},
		//attendees
		'attendee': {
			parser: simpleParser.strings,
			reader: simpleReader.strings,
			parameters: attendeeParameters
		},
		'organizer': {
			parser: simpleParser.string,
			reader: simpleReader.string,
			parameters: organizerParameters
		},
		//sharing
		'class': { parser: simpleParser.string, reader: simpleReader.string },
		//other
		'description': {
			parser: simpleParser.string,
			reader: simpleReader.string
		},
		//'url': {parser: simpleParser.string, reader: simpleReader.string},
		'status': { parser: simpleParser.string, reader: simpleReader.string }
		//'resources': {parser: simpleParser.strings, reader: simpleReader.strings}
	};

	/**
  * specific parsers that check only one property
  */
	var specificParser = {
		alarm: function alarm(data, vevent) {
			data.alarm = data.alarm || [];

			var alarms = vevent.getAllSubcomponents('valarm');
			var group = 0;
			alarms.forEach(function (alarm) {
				var alarmData = {
					group: group,
					action: {},
					trigger: {},
					repeat: {},
					duration: {},
					attendee: []
				};

				simpleParser.string(alarmData, alarm, 'action');
				simpleParser.date(alarmData, alarm, 'trigger');
				simpleParser.string(alarmData, alarm, 'repeat');
				simpleParser.date(alarmData, alarm, 'duration');
				simpleParser.strings(alarmData, alarm, 'attendee', attendeeParameters);

				//alarmData.attendeeCopy = [];
				//angular.copy(alarmData.attendee, alarmData.attendeeCopy);

				if (alarmData.trigger.type === 'duration' && alarm.hasProperty('trigger')) {
					var trigger = alarm.getFirstProperty('trigger');
					var related = trigger.getParameter('related');
					if (related) {
						alarmData.trigger.related = related;
					} else {
						alarmData.trigger.related = 'start';
					}
				}

				data.alarm.push(alarmData);

				alarm.getFirstProperty('action').setParameter('x-nc-group-id', group.toString());
				group++;
			});
		},
		date: function date(data, vevent) {
			var dtstart = vevent.getFirstPropertyValue('dtstart');
			var dtend = void 0;

			if (vevent.hasProperty('dtend')) {
				dtend = vevent.getFirstPropertyValue('dtend');
			} else if (vevent.hasProperty('duration')) {
				dtend = dtstart.clone();
				dtend.addDuration(vevent.getFirstPropertyValue('duration'));
			} else {
				dtend = dtstart.clone();
			}

			data.dtstart = {
				parameters: {
					zone: dtstart.zone.toString()
				},
				type: dtstart.icaltype,
				value: moment({
					years: dtstart.year,
					months: dtstart.month - 1,
					date: dtstart.day,
					hours: dtstart.hour,
					minutes: dtstart.minute,
					seconds: dtstart.seconds
				})
			};
			data.dtend = {
				parameters: {
					zone: dtend.zone.toString()
				},
				type: dtend.icaltype,
				value: moment({
					years: dtend.year,
					months: dtend.month - 1,
					date: dtend.day,
					hours: dtend.hour,
					minutes: dtend.minute,
					seconds: dtend.seconds
				})
			};
			data.allDay = dtstart.icaltype === 'date' && dtend.icaltype === 'date';
		},
		repeating: function repeating(data, vevent) {
			var iCalEvent = new ICAL.Event(vevent);

			data.repeating = iCalEvent.isRecurring();

			var rrule = vevent.getFirstPropertyValue('rrule');
			if (rrule) {
				data.rrule = {
					count: rrule.count,
					freq: rrule.freq,
					interval: rrule.interval,
					parameters: rrule.parts,
					until: null
				};

				/*if (rrule.until) {
     simpleParser.date(data.rrule, rrule, 'until');
     }*/
			} else {
				data.rrule = {
					freq: 'NONE'
				};
			}
		}
	};

	var specificReader = {
		alarm: function alarm(vevent, oldSimpleData, newSimpleData) {
			var components = {},
			    key = 'alarm';

			function getAlarmGroup(alarmData) {
				return alarmData.group;
			}

			oldSimpleData[key] = oldSimpleData[key] || [];
			var oldGroups = oldSimpleData[key].map(getAlarmGroup);

			newSimpleData[key] = newSimpleData[key] || [];
			var newGroups = newSimpleData[key].map(getAlarmGroup);

			//check for any alarms that are in the old data,
			//but have been removed from the new data
			var removedAlarms = oldGroups.filter(function (group) {
				return newGroups.indexOf(group) === -1;
			});

			//get all of the valarms and save them in an object keyed by their groupId
			vevent.getAllSubcomponents('valarm').forEach(function (alarm) {
				var group = alarm.getFirstProperty('action').getParameter('x-nc-group-id');
				components[group] = alarm;
			});

			//remove any valarm subcomponents have a groupId that matches one of the removedAlarms
			removedAlarms.forEach(function (group) {
				if (components[group]) {
					vevent.removeSubcomponent(components[group]);
					delete components[group];
				}
			});

			//update and create valarms using the new alarm data
			newSimpleData[key].forEach(function (alarmData) {
				var valarm = void 0,
				    oldSimpleAlarmData = void 0;

				if (oldGroups.indexOf(alarmData.group) === -1) {
					valarm = new ICAL.Component('VALARM');
					vevent.addSubcomponent(valarm);
					oldSimpleAlarmData = {};
				} else {
					valarm = components[alarmData.group];
					oldSimpleAlarmData = oldSimpleData.alarm.find(function (alarm) {
						return alarm.group === alarmData.group;
					});
				}

				simpleReader.string(valarm, oldSimpleAlarmData, alarmData, 'action', []);
				simpleReader.date(valarm, oldSimpleAlarmData, alarmData, 'trigger', []);
				simpleReader.string(valarm, oldSimpleAlarmData, alarmData, 'repeat', []);
				simpleReader.date(valarm, oldSimpleAlarmData, alarmData, 'duration', []);
				simpleReader.strings(valarm, oldSimpleAlarmData, alarmData, 'attendee', attendeeParameters);

				valarm.getFirstProperty('action').removeParameter('x-nc-group-id');
			});
		},
		date: function date(vevent, oldSimpleData, newSimpleData) {
			vevent.removeAllProperties('dtstart');
			vevent.removeAllProperties('dtend');
			vevent.removeAllProperties('duration');

			var isNewSimpleDataAllDay = newSimpleData.dtstart.type === 'date' && newSimpleData.dtend.type === 'date';
			// remove tzid property from allday events
			if (isNewSimpleDataAllDay) {
				newSimpleData.dtstart.parameters.zone = 'floating';
				newSimpleData.dtend.parameters.zone = 'floating';
			}

			newSimpleData.dtstart.parameters.zone = newSimpleData.dtstart.parameters.zone || 'floating';
			newSimpleData.dtend.parameters.zone = newSimpleData.dtend.parameters.zone || 'floating';

			if (newSimpleData.dtstart.parameters.zone !== 'floating' && !ICAL.TimezoneService.has(newSimpleData.dtstart.parameters.zone)) {
				throw {
					kind: 'timezone_missing',
					missing_timezone: newSimpleData.dtstart.parameters.zone
				};
			}
			if (newSimpleData.dtend.parameters.zone !== 'floating' && !ICAL.TimezoneService.has(newSimpleData.dtend.parameters.zone)) {
				throw {
					kind: 'timezone_missing',
					missing_timezone: newSimpleData.dtend.parameters.zone
				};
			}

			var start = ICAL.Time.fromJSDate(newSimpleData.dtstart.value.toDate(), false);
			start.isDate = isNewSimpleDataAllDay;
			var end = ICAL.Time.fromJSDate(newSimpleData.dtend.value.toDate(), false);
			end.isDate = isNewSimpleDataAllDay;

			var availableTimezones = [];
			var vtimezones = vevent.parent.getAllSubcomponents('vtimezone');
			vtimezones.forEach(function (vtimezone) {
				availableTimezones.push(vtimezone.getFirstPropertyValue('tzid'));
			});

			var dtstart = new ICAL.Property('dtstart', vevent);
			dtstart.setValue(start);
			if (newSimpleData.dtstart.parameters.zone !== 'floating') {
				dtstart.setParameter('tzid', newSimpleData.dtstart.parameters.zone);
				var startTz = ICAL.TimezoneService.get(newSimpleData.dtstart.parameters.zone);
				start.zone = startTz;
				if (availableTimezones.indexOf(newSimpleData.dtstart.parameters.zone) === -1) {
					vevent.parent.addSubcomponent(startTz.component);
					availableTimezones.push(newSimpleData.dtstart.parameters.zone);
				}
			}

			var dtend = new ICAL.Property('dtend', vevent);
			dtend.setValue(end);
			if (newSimpleData.dtend.parameters.zone !== 'floating') {
				dtend.setParameter('tzid', newSimpleData.dtend.parameters.zone);
				var endTz = ICAL.TimezoneService.get(newSimpleData.dtend.parameters.zone);
				end.zone = endTz;
				if (availableTimezones.indexOf(newSimpleData.dtend.parameters.zone) === -1) {
					vevent.parent.addSubcomponent(endTz.component);
				}
			}

			vevent.addProperty(dtstart);
			vevent.addProperty(dtend);
		},
		repeating: function repeating(vevent, oldSimpleData, newSimpleData) {
			// We won't support exrule, because it's deprecated and barely used in the wild
			if (newSimpleData.rrule === null || newSimpleData.rrule.freq === 'NONE') {
				vevent.removeAllProperties('rdate');
				vevent.removeAllProperties('rrule');
				vevent.removeAllProperties('exdate');

				return;
			}

			if (newSimpleData.rrule.dontTouch) {
				return;
			}

			var params = {
				interval: newSimpleData.rrule.interval,
				freq: newSimpleData.rrule.freq
			};

			if (newSimpleData.rrule.count) {
				params.count = newSimpleData.rrule.count;
			}

			var rrule = new ICAL.Recur(params);
			vevent.updatePropertyWithValue('rrule', rrule);
		}
	};

	function SimpleEvent(event) {
		var context = {
			event: event,
			patched: false,
			oldProperties: {}
		};

		var iface = {
			_isASimpleEventObject: true
		};
		angular.extend(iface, defaults);

		context.generateOldProperties = function () {
			context.oldProperties = {};

			for (var key in defaults) {
				context.oldProperties[key] = angular.copy(iface[key]);
			}
		};

		iface.patch = function () {
			if (context.patched) {
				throw new Error('SimpleEvent was already patched, patching not possible');
			}

			for (var simpleKey in simpleProperties) {
				var simpleProperty = simpleProperties[simpleKey];

				var reader = simpleProperty.reader;
				var parameters = simpleProperty.parameters;
				if (context.oldProperties[simpleKey] !== iface[simpleKey]) {
					if (iface[simpleKey] === null) {
						context.event.removeAllProperties(simpleKey);
					} else {
						reader(context.event, context.oldProperties, iface, simpleKey, parameters);
					}
				}
			}

			for (var specificKey in specificReader) {
				var _reader = specificReader[specificKey];
				_reader(context.event, context.oldProperties, iface);
			}

			context.patched = true;
		};

		for (var simpleKey in simpleProperties) {
			var simpleProperty = simpleProperties[simpleKey];

			var parser = simpleProperty.parser;
			var parameters = simpleProperty.parameters;
			if (context.event.hasProperty(simpleKey)) {
				parser(iface, context.event, simpleKey, parameters);
			}
		}

		for (var specificKey in specificParser) {
			var _parser = specificParser[specificKey];
			_parser(iface, context.event);
		}

		context.generateOldProperties();

		return iface;
	}

	SimpleEvent.isSimpleEvent = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isASimpleEventObject === true;
	};

	return SimpleEvent;
});

app.factory('SplittedICal', function () {
	'use strict';

	function SplittedICal(name, color) {
		var context = {
			name: name,
			color: color,
			vevents: [],
			vjournals: [],
			vtodos: []
		};
		var iface = {
			_isASplittedICalObject: true
		};

		Object.defineProperties(iface, {
			name: {
				get: function get() {
					return context.name;
				}
			},
			color: {
				get: function get() {
					return context.color;
				}
			},
			vevents: {
				get: function get() {
					return context.vevents;
				}
			},
			vjournals: {
				get: function get() {
					return context.vjournals;
				}
			},
			vtodos: {
				get: function get() {
					return context.vtodos;
				}
			},
			objects: {
				get: function get() {
					return [].concat(context.vevents).concat(context.vjournals).concat(context.vtodos);
				}
			}
		});

		iface.addObject = function (componentName, object) {
			switch (componentName) {
				case 'vevent':
					context.vevents.push(object);
					break;

				case 'vjournal':
					context.vjournals.push(object);
					break;

				case 'vtodo':
					context.vtodos.push(object);
					break;

				default:
					break;
			}
		};

		return iface;
	}

	SplittedICal.isSplittedICal = function (obj) {
		return obj instanceof SplittedICal || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isASplittedICalObject !== null;
	};

	return SplittedICal;
});

app.factory('Timezone', function () {
	'use strict';

	var timezone = function Timezone(data) {
		angular.extend(this, {
			_props: {}
		});

		if (data instanceof ICAL.Timezone) {
			this._props.jCal = data;
			this._props.name = data.tzid;
		} else if (typeof data === 'string') {
			var jCal = ICAL.parse(data);
			var components = new ICAL.Component(jCal);
			var iCalTimezone = null;
			if (components.name === 'vtimezone') {
				iCalTimezone = new ICAL.Timezone(components);
			} else {
				iCalTimezone = new ICAL.Timezone(components.getFirstSubcomponent('vtimezone'));
			}
			this._props.jCal = iCalTimezone;
			this._props.name = iCalTimezone.tzid;
		}
	};

	//Timezones are immutable
	timezone.prototype = {
		get jCal() {
			return this._props.jCal;
		},
		get name() {
			return this._props.name;
		}
	};

	return timezone;
});

app.factory('VEvent', ["FcEvent", "SimpleEvent", "ICalFactory", "StringUtility", function (FcEvent, SimpleEvent, ICalFactory, StringUtility) {
	'use strict';

	/**
  * get a VEvent object
  * @param {Calendar} calendar
  * @param {ICAL.Component} comp
  * @param {string} uri
  * @param {string} etag
  */

	function VEvent(calendar, comp, uri) {
		var etag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';

		var context = { calendar: calendar, comp: comp, uri: uri, etag: etag };
		var iface = {
			_isAVEventObject: true
		};

		if (!context.comp || !context.comp.jCal || context.comp.jCal.length === 0) {
			throw new TypeError('Given comp is not a valid calendar');
		}

		// read all timezones in the comp and register them
		var vtimezones = comp.getAllSubcomponents('vtimezone');
		vtimezones.forEach(function (vtimezone) {
			var timezone = new ICAL.Timezone(vtimezone);
			ICAL.TimezoneService.register(timezone.tzid, timezone);
		});

		if (!uri) {
			var vevent = context.comp.getFirstSubcomponent('vevent');
			context.uri = vevent.getFirstPropertyValue('uid');
		}

		/**
   * get DTEND from vevent
   * @param {ICAL.Component} vevent
   * @returns {ICAL.Time}
   */
		context.calculateDTEnd = function (vevent) {
			if (vevent.hasProperty('dtend')) {
				return vevent.getFirstPropertyValue('dtend');
			} else if (vevent.hasProperty('duration')) {
				var dtstart = vevent.getFirstPropertyValue('dtstart').clone();
				dtstart.addDuration(vevent.getFirstPropertyValue('duration'));

				return dtstart;
			} else {
				return vevent.getFirstPropertyValue('dtstart').clone();
			}
		};

		/**
   * convert a dt's timezone if necessary
   * @param {ICAL.Time} dt
   * @param {ICAL.Component} timezone
   * @returns {ICAL.Time}
   */
		context.convertTz = function (dt, timezone) {
			if (context.needsTzConversion(dt) && timezone) {
				dt = dt.convertToZone(timezone);
			}

			return dt;
		};

		/**
   * check if we need to convert the timezone of either dtstart or dtend
   * @param {ICAL.Time} dt
   * @returns {boolean}
   */
		context.needsTzConversion = function (dt) {
			return dt.icaltype !== 'date' && dt.zone !== ICAL.Timezone.utcTimezone && dt.zone !== ICAL.Timezone.localTimezone;
		};

		Object.defineProperties(iface, {
			calendar: {
				get: function get() {
					return context.calendar;
				},
				set: function set(calendar) {
					context.calendar = calendar;
				}
			},
			comp: {
				get: function get() {
					return context.comp;
				}
			},
			data: {
				get: function get() {
					return context.comp.toString();
				}
			},
			etag: {
				get: function get() {
					return context.etag;
				},
				set: function set(etag) {
					context.etag = etag;
				}
			},
			uri: {
				get: function get() {
					return context.uri;
				}
			}
		});

		/**
   * get fullcalendar event in a defined time-range
   * @param {moment} start
   * @param {moment} end
   * @param {Timezone} timezone
   * @returns {Array}
   */
		iface.getFcEvent = function (start, end, timezone) {
			var iCalStart = ICAL.Time.fromJSDate(start.toDate());
			var iCalEnd = ICAL.Time.fromJSDate(end.toDate());
			var fcEvents = [];

			var vevents = context.comp.getAllSubcomponents('vevent');
			vevents.forEach(function (vevent) {
				var iCalEvent = new ICAL.Event(vevent);

				if (!vevent.hasProperty('dtstart')) {
					return;
				}

				var rawDtstart = vevent.getFirstPropertyValue('dtstart');
				var rawDtend = context.calculateDTEnd(vevent);

				if (iCalEvent.isRecurring()) {
					var duration = rawDtend.subtractDate(rawDtstart);
					var iterator = new ICAL.RecurExpansion({
						component: vevent,
						dtstart: rawDtstart
					});

					var next = void 0;
					while (next = iterator.next()) {
						if (next.compare(iCalStart) < 0) {
							continue;
						}
						if (next.compare(iCalEnd) > 0) {
							break;
						}

						var singleDtStart = next.clone();
						var singleDtEnd = next.clone();
						singleDtEnd.addDuration(duration);

						var dtstart = context.convertTz(singleDtStart, timezone.jCal);
						var dtend = context.convertTz(singleDtEnd, timezone.jCal);
						var fcEvent = FcEvent(iface, vevent, dtstart, dtend);

						fcEvents.push(fcEvent);
					}
				} else {
					var _dtstart = context.convertTz(rawDtstart, timezone.jCal);
					var _dtend2 = context.convertTz(rawDtend, timezone.jCal);
					var _fcEvent = FcEvent(iface, vevent, _dtstart, _dtend2);

					fcEvents.push(_fcEvent);
				}
			});

			return fcEvents;
		};

		/**
   *
   * @param searchedRecurrenceId
   * @returns {SimpleEvent}
   */
		iface.getSimpleEvent = function (searchedRecurrenceId) {
			var vevents = context.comp.getAllSubcomponents('vevent');

			var veventsLength = vevents.length;
			for (var i = 0; i < veventsLength; i++) {
				var _vevent = vevents[i];
				var hasRecurrenceId = _vevent.hasProperty('recurrence-id');
				var recurrenceId = null;
				if (hasRecurrenceId) {
					recurrenceId = _vevent.getFirstPropertyValue('recurrence-id').toICALString();
				}

				if (!hasRecurrenceId && !searchedRecurrenceId || hasRecurrenceId && searchedRecurrenceId === recurrenceId) {
					return SimpleEvent(_vevent);
				}
			}

			throw new Error('Event not found');
		};

		/**
   * update events last-modified property to now
   */
		iface.touch = function () {
			var vevent = context.comp.getFirstSubcomponent('vevent');
			vevent.updatePropertyWithValue('last-modified', ICAL.Time.now());
		};

		return iface;
	}

	VEvent.isVEvent = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isAVEventObject === true;
	};

	/**
 * create all-day event from malformed input
 * @param {string} ics
 * @returns {string}
 */
	VEvent.sanDate = function (ics) {

		// console.log( ICAL.Time.now() );

		ics.split("\n").forEach(function (el, i) {

			var findTypes = ['DTSTART', 'DTEND'];
			var dateType = /[^:]*/.exec(el)[0];
			var icsDate = null;

			if (findTypes.indexOf(dateType) >= 0 && el.trim().substr(-3) === "T::") {
				// is date without time
				icsDate = el.replace(/[^0-9]/g, '');
				ics = ics.replace(el, dateType + ";VALUE=DATE:" + icsDate);
			}
		});

		return ics;
	};

	/**
  * create a VEvent object from raw ics data
  * @param {Calendar} calendar
  * @param {string} ics
  * @param {string} uri
  * @param {string} etag
  * @returns {VEvent}
  */
	VEvent.fromRawICS = function (calendar, ics, uri) {
		var etag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';

		var comp = void 0;

		if (ics.search("T::") > 0) {
			// no time
			ics = VEvent.sanDate(ics);
		}

		try {
			var jCal = ICAL.parse(ics);
			comp = new ICAL.Component(jCal);
		} catch (e) {
			console.log(e);
			throw new TypeError('given ics data was not valid');
		}

		return VEvent(calendar, comp, uri, etag);
	};

	/**
  * generates a new VEvent based on start and end
  * @param start
  * @param end
  * @param timezone
  * @returns {VEvent}
  */
	VEvent.fromStartEnd = function (start, end, timezone) {
		var uid = StringUtility.uid();
		var comp = ICalFactory.newEvent(uid);
		var uri = StringUtility.uid('ownCloud', 'ics');
		var vevent = VEvent(null, comp, uri);
		var simple = vevent.getSimpleEvent();

		simple.allDay = !start.hasTime() && !end.hasTime();
		simple.dtstart = {
			type: start.hasTime() ? 'datetime' : 'date',
			value: start,
			parameters: {
				zone: timezone
			}
		};
		simple.dtend = {
			type: end.hasTime() ? 'datetime' : 'date',
			value: end,
			parameters: {
				zone: timezone
			}
		};
		simple.patch();

		return vevent;
	};

	return VEvent;
}]);

app.factory('WebCal', ["$http", "Calendar", "VEvent", "TimezoneService", "WebCalService", "WebCalUtility", function ($http, Calendar, VEvent, TimezoneService, WebCalService, WebCalUtility) {
	'use strict';

	function WebCal(url, props) {
		var context = {
			storedUrl: props.href, //URL stored in CalDAV
			url: WebCalUtility.fixURL(props.href)
		};

		var iface = Calendar(url, props);
		iface._isAWebCalObject = true;

		Object.defineProperties(iface, {
			downloadUrl: {
				get: function get() {
					return context.url;
				}
			},
			storedUrl: {
				get: function get() {
					return context.storedUrl;
				}
			}
		});

		iface.fcEventSource.events = function (start, end, timezone, callback) {
			var fcAPI = this;
			iface.fcEventSource.isRendering = true;
			iface.emit(Calendar.hookFinishedRendering);

			var allowDowngradeToHttp = !context.storedUrl.startsWith('https://');

			var TimezoneServicePromise = TimezoneService.get(timezone);
			var WebCalServicePromise = WebCalService.get(context.url, allowDowngradeToHttp);
			Promise.all([TimezoneServicePromise, WebCalServicePromise]).then(function (results) {
				var _results2 = _slicedToArray(results, 2),
				    tz = _results2[0],
				    response = _results2[1];

				var vevents = [];

				response.vevents.forEach(function (ical) {
					try {
						var vevent = VEvent.fromRawICS(iface, ical);
						var events = vevent.getFcEvent(start, end, tz);
						vevents = vevents.concat(events);
					} catch (err) {
						iface.addWarning(err.toString());
						console.log(err);
						console.log(event);
					}
				});

				callback(vevents);
				fcAPI.reportEvents(fcAPI.clientEvents());

				iface.fcEventSource.isRendering = false;
				iface.emit(Calendar.hookFinishedRendering);
			}).catch(function (reason) {
				iface.addWarning(reason);
				console.log(reason);
				iface.fcEventSource.isRendering = false;
				iface.emit(Calendar.hookFinishedRendering);
			});
		};

		iface.eventsAccessibleViaCalDAV = function () {
			return false;
		};

		return iface;
	}

	WebCal.isWebCal = function (obj) {
		return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && obj !== null && obj._isAWebCalObject === true;
	};

	return WebCal;
}]);

app.service('AutoCompletionService', ['$rootScope', '$http', function ($rootScope, $http) {
	'use strict';

	this.searchAttendee = function (name) {
		return $http.get($rootScope.baseUrl + 'autocompletion/attendee', {
			params: {
				search: name
			}
		}).then(function (response) {
			return response.data;
		});
	};

	this.searchLocation = function (address) {
		return $http.get($rootScope.baseUrl + 'autocompletion/location', {
			params: {
				location: address
			}
		}).then(function (response) {
			return response.data;
		});
	};
}]);

app.service('CalendarService', ["DavClient", "StringUtility", "XMLUtility", "Calendar", "WebCal", function (DavClient, StringUtility, XMLUtility, Calendar, WebCal) {
	'use strict';

	var self = this;

	this._CALENDAR_HOME = null;

	this._currentUserPrincipal = null;

	this._takenUrls = [];

	this._PROPERTIES = ['{' + DavClient.NS_DAV + '}displayname', '{' + DavClient.NS_DAV + '}resourcetype', '{' + DavClient.NS_IETF + '}calendar-description', '{' + DavClient.NS_IETF + '}calendar-timezone', '{' + DavClient.NS_APPLE + '}calendar-order', '{' + DavClient.NS_APPLE + '}calendar-color', '{' + DavClient.NS_IETF + '}supported-calendar-component-set', '{' + DavClient.NS_CALENDARSERVER + '}publish-url', '{' + DavClient.NS_CALENDARSERVER + '}allowed-sharing-modes', '{' + DavClient.NS_OWNCLOUD + '}calendar-enabled', '{' + DavClient.NS_DAV + '}acl', '{' + DavClient.NS_DAV + '}owner', '{' + DavClient.NS_OWNCLOUD + '}invite', '{' + DavClient.NS_CALENDARSERVER + '}source'];

	this._xmls = new XMLSerializer();

	function discoverHome(callback) {
		return DavClient.propFind(DavClient.buildUrl(OC.linkToRemoteBase('dav')), ['{' + DavClient.NS_DAV + '}current-user-principal'], 0, { 'requesttoken': OC.requestToken }).then(function (response) {
			if (!DavClient.wasRequestSuccessful(response.status)) {
				throw "CalDAV client could not be initialized - Querying current-user-principal failed";
			}

			if (response.body.propStat.length < 1) {
				return;
			}
			var props = response.body.propStat[0].properties;
			self._currentUserPrincipal = props['{' + DavClient.NS_DAV + '}current-user-principal'][0].textContent;

			return DavClient.propFind(DavClient.buildUrl(self._currentUserPrincipal), ['{' + DavClient.NS_IETF + '}calendar-home-set'], 0, { 'requesttoken': OC.requestToken }).then(function (response) {
				if (!DavClient.wasRequestSuccessful(response.status)) {
					throw "CalDAV client could not be initialized - Querying calendar-home-set failed";
				}

				if (response.body.propStat.length < 1) {
					return;
				}
				var props = response.body.propStat[0].properties;
				self._CALENDAR_HOME = props['{' + DavClient.NS_IETF + '}calendar-home-set'][0].textContent;

				return callback();
			});
		});
	}

	function getResponseCodeFromHTTPResponse(t) {
		return parseInt(t.split(' ')[1]);
	}

	this.getAll = function () {
		if (this._CALENDAR_HOME === null) {
			return discoverHome(function () {
				return self.getAll();
			});
		}

		return DavClient.propFind(DavClient.buildUrl(this._CALENDAR_HOME), this._PROPERTIES, 1, { 'requesttoken': OC.requestToken }).then(function (response) {
			var calendars = [];

			if (!DavClient.wasRequestSuccessful(response.status)) {
				throw "CalDAV client could not be initialized - Querying calendars failed";
			}

			for (var i = 0; i < response.body.length; i++) {
				var body = response.body[i];
				if (body.propStat.length < 1) {
					continue;
				}

				self._takenUrls.push(body.href);

				var responseCode = getResponseCodeFromHTTPResponse(body.propStat[0].status);
				if (!DavClient.wasRequestSuccessful(responseCode)) {
					continue;
				}

				var props = self._getSimplePropertiesFromRequest(body.propStat[0].properties, false);
				if (!props || !props.components.vevent) {
					continue;
				}

				var resourceTypes = body.propStat[0].properties['{' + DavClient.NS_DAV + '}resourcetype'];
				if (!resourceTypes) {
					continue;
				}

				for (var j = 0; j < resourceTypes.length; j++) {
					var name = DavClient.getNodesFullName(resourceTypes[j]);

					if (name === '{' + DavClient.NS_IETF + '}calendar') {
						var calendar = Calendar(body.href, props);
						calendars.push(calendar);
					}
					if (name === '{' + DavClient.NS_CALENDARSERVER + '}subscribed') {
						var webcal = WebCal(body.href, props);
						calendars.push(webcal);
					}
				}
			}

			return calendars;
		});
	};

	this.get = function (url) {
		if (this._CALENDAR_HOME === null) {
			return discoverHome(function () {
				return self.get(url);
			});
		}

		return DavClient.propFind(DavClient.buildUrl(url), this._PROPERTIES, 0, { 'requesttoken': OC.requestToken }).then(function (response) {
			var body = response.body;
			if (body.propStat.length < 1) {
				//TODO - something went wrong
				return;
			}

			var responseCode = getResponseCodeFromHTTPResponse(body.propStat[0].status);
			if (!DavClient.wasRequestSuccessful(responseCode)) {
				//TODO - something went wrong
				return;
			}

			var props = self._getSimplePropertiesFromRequest(body.propStat[0].properties, false);
			if (!props || !props.components.vevent) {
				return;
			}

			var resourceTypes = body.propStat[0].properties['{' + DavClient.NS_DAV + '}resourcetype'];
			if (!resourceTypes) {
				return;
			}

			for (var j = 0; j < resourceTypes.length; j++) {
				var name = DavClient.getNodesFullName(resourceTypes[j]);

				if (name === '{' + DavClient.NS_IETF + '}calendar') {
					return Calendar(body.href, props);
				}
				if (name === '{' + DavClient.NS_CALENDARSERVER + '}subscribed') {
					return WebCal(body.href, props);
				}
			}
		});
	};

	this.getPublicCalendar = function (token) {
		var url = OC.linkToRemoteBase('dav') + '/public-calendars/' + token;
		return DavClient.propFind(DavClient.buildUrl(url), this._PROPERTIES, 0, { 'requesttoken': OC.requestToken }).then(function (response) {
			var body = response.body;
			if (body.propStat.length < 1) {
				//TODO - something went wrong
				return;
			}
			var responseCode = getResponseCodeFromHTTPResponse(body.propStat[0].status);
			if (!DavClient.wasRequestSuccessful(responseCode)) {
				//TODO - something went wrong
				return;
			}
			var props = self._getSimplePropertiesFromRequest(body.propStat[0].properties, true);
			if (!props) {
				return;
			}

			return Calendar(body.href, props);
		});
	};

	this.create = function (name, color, components) {
		if (this._CALENDAR_HOME === null) {
			return discoverHome(function () {
				return self.create(name, color);
			});
		}

		if (typeof components === 'undefined') {
			components = ['vevent', 'vtodo'];
		}

		var xmlDoc = document.implementation.createDocument('', '', null);
		var cMkcalendar = xmlDoc.createElement('d:mkcol');
		cMkcalendar.setAttribute('xmlns:c', 'urn:ietf:params:xml:ns:caldav');
		cMkcalendar.setAttribute('xmlns:d', 'DAV:');
		cMkcalendar.setAttribute('xmlns:a', 'http://apple.com/ns/ical/');
		cMkcalendar.setAttribute('xmlns:o', 'http://owncloud.org/ns');
		xmlDoc.appendChild(cMkcalendar);

		var dSet = xmlDoc.createElement('d:set');
		cMkcalendar.appendChild(dSet);

		var dProp = xmlDoc.createElement('d:prop');
		dSet.appendChild(dProp);

		var dResourceType = xmlDoc.createElement('d:resourcetype');
		dProp.appendChild(dResourceType);

		var dCollection = xmlDoc.createElement('d:collection');
		dResourceType.appendChild(dCollection);

		var cCalendar = xmlDoc.createElement('c:calendar');
		dResourceType.appendChild(cCalendar);

		dProp.appendChild(this._createXMLForProperty(xmlDoc, 'displayname', name));
		dProp.appendChild(this._createXMLForProperty(xmlDoc, 'enabled', true));
		dProp.appendChild(this._createXMLForProperty(xmlDoc, 'color', color));
		dProp.appendChild(this._createXMLForProperty(xmlDoc, 'components', components));

		var body = this._xmls.serializeToString(cMkcalendar);

		var uri = StringUtility.uri(name, function (suggestedUri) {
			return self._takenUrls.indexOf(self._CALENDAR_HOME + suggestedUri + '/') === -1;
		});
		var url = this._CALENDAR_HOME + uri + '/';
		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			'requesttoken': OC.requestToken
		};

		return DavClient.request('MKCOL', url, headers, body).then(function (response) {
			if (response.status === 201) {
				self._takenUrls.push(url);
				return self.get(url).then(function (calendar) {
					calendar.enabled = true;
					return self.update(calendar);
				});
			}
		});
	};

	this.createWebCal = function (name, color, source) {
		if (this._CALENDAR_HOME === null) {
			return discoverHome(function () {
				return self.createWebCal(name, color, source);
			});
		}

		var needsWorkaround = angular.element('#fullcalendar').attr('data-webCalWorkaround') === 'yes';

		var _XMLUtility$getRootSk = XMLUtility.getRootSkeleton('d:mkcol', 'd:set', 'd:prop'),
		    _XMLUtility$getRootSk2 = _slicedToArray(_XMLUtility$getRootSk, 2),
		    skeleton = _XMLUtility$getRootSk2[0],
		    dPropChildren = _XMLUtility$getRootSk2[1];

		dPropChildren.push({
			name: 'd:resourcetype',
			children: [{
				name: 'd:collection'
			}, {
				name: 'cs:subscribed'
			}]
		});
		dPropChildren.push({
			name: 'd:displayname',
			value: name
		});
		dPropChildren.push({
			name: 'a:calendar-color',
			value: color
		});
		dPropChildren.push({
			name: 'o:calendar-enabled',
			value: '1'
		});
		dPropChildren.push({
			name: 'cs:source',
			children: [{
				name: 'd:href',
				value: source
			}]
		});

		var uri = StringUtility.uri(name, function (suggestedUri) {
			return self._takenUrls.indexOf(self._CALENDAR_HOME + suggestedUri + '/') === -1;
		});
		var url = this._CALENDAR_HOME + uri + '/';
		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			'requesttoken': OC.requestToken
		};
		var xml = XMLUtility.serialize(skeleton);

		return DavClient.request('MKCOL', url, headers, xml).then(function (response) {
			if (response.status === 201) {
				self._takenUrls.push(url);

				return self.get(url).then(function (webcal) {
					if (needsWorkaround) {
						webcal.enabled = true;
						webcal.displayname = name;
						webcal.color = color;

						return self.update(webcal);
					} else {
						return webcal;
					}
				});
			}
		});
	};

	this.update = function (calendar) {
		var xmlDoc = document.implementation.createDocument('', '', null);
		var dPropUpdate = xmlDoc.createElement('d:propertyupdate');
		dPropUpdate.setAttribute('xmlns:c', 'urn:ietf:params:xml:ns:caldav');
		dPropUpdate.setAttribute('xmlns:d', 'DAV:');
		dPropUpdate.setAttribute('xmlns:a', 'http://apple.com/ns/ical/');
		dPropUpdate.setAttribute('xmlns:o', 'http://owncloud.org/ns');
		xmlDoc.appendChild(dPropUpdate);

		var dSet = xmlDoc.createElement('d:set');
		dPropUpdate.appendChild(dSet);

		var dProp = xmlDoc.createElement('d:prop');
		dSet.appendChild(dProp);

		var updatedProperties = calendar.getUpdated();
		if (updatedProperties.length === 0) {
			//nothing to do here
			return calendar;
		}
		for (var i = 0; i < updatedProperties.length; i++) {
			dProp.appendChild(this._createXMLForProperty(xmlDoc, updatedProperties[i], calendar[updatedProperties[i]]));
		}

		calendar.resetUpdated();

		var url = calendar.url;
		var body = this._xmls.serializeToString(dPropUpdate);
		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			'requesttoken': OC.requestToken
		};

		return DavClient.request('PROPPATCH', url, headers, body).then(function (response) {
			return calendar;
		});
	};

	this.delete = function (calendar) {
		if (WebCal.isWebCal(calendar)) {
			localStorage.removeItem(calendar.storedUrl);
		}
		return DavClient.request('DELETE', calendar.url, { 'requesttoken': OC.requestToken }, '').then(function (response) {
			if (response.status === 204) {
				return true;
			} else {
				// TODO - handle error case
				return false;
			}
		});
	};

	this.share = function (calendar, shareType, shareWith, writable, existingShare) {
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
		oSummary.textContent = t('calendar', '{calendar} shared by {owner}', {
			calendar: calendar.displayname,
			owner: calendar.owner
		});
		oSet.appendChild(oSummary);

		if (writable) {
			var oRW = xmlDoc.createElement('o:read-write');
			oSet.appendChild(oRW);
		}

		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			requesttoken: oc_requesttoken
		};
		var body = this._xmls.serializeToString(oShare);
		return DavClient.request('POST', calendar.url, headers, body).then(function (response) {
			if (response.status === 200) {
				if (!existingShare) {
					if (shareType === OC.Share.SHARE_TYPE_USER) {
						calendar.shares.users.push({
							id: shareWith,
							displayname: shareWith,
							writable: writable
						});
					} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
						calendar.shares.groups.push({
							id: shareWith,
							displayname: shareWith,
							writable: writable
						});
					}
				}
			}
		});
	};

	this.unshare = function (calendar, shareType, shareWith) {
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

		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			requesttoken: oc_requesttoken
		};
		var body = this._xmls.serializeToString(oShare);
		return DavClient.request('POST', calendar.url, headers, body).then(function (response) {
			if (response.status === 200) {
				if (shareType === OC.Share.SHARE_TYPE_USER) {
					calendar.shares.users = calendar.shares.users.filter(function (user) {
						return user.id !== shareWith;
					});
				} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
					calendar.shares.groups = calendar.shares.groups.filter(function (groups) {
						return groups.id !== shareWith;
					});
				}
				//todo - remove entry from calendar object
				return true;
			} else {
				return false;
			}
		});
	};

	this.publish = function (calendar) {
		var xmlDoc = document.implementation.createDocument('', '', null);
		var oShare = xmlDoc.createElement('o:publish-calendar');
		oShare.setAttribute('xmlns:d', 'DAV:');
		oShare.setAttribute('xmlns:o', 'http://calendarserver.org/ns/');
		xmlDoc.appendChild(oShare);

		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			requesttoken: oc_requesttoken
		};
		var body = this._xmls.serializeToString(oShare);
		return DavClient.request('POST', calendar.url, headers, body).then(function (response) {
			return response.status === 202;
		});
	};

	this.unpublish = function (calendar) {
		var xmlDoc = document.implementation.createDocument('', '', null);
		var oShare = xmlDoc.createElement('o:unpublish-calendar');
		oShare.setAttribute('xmlns:d', 'DAV:');
		oShare.setAttribute('xmlns:o', 'http://calendarserver.org/ns/');
		xmlDoc.appendChild(oShare);

		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			requesttoken: oc_requesttoken
		};
		var body = this._xmls.serializeToString(oShare);
		return DavClient.request('POST', calendar.url, headers, body).then(function (response) {
			return response.status === 200;
		});
	};

	this._createXMLForProperty = function (xmlDoc, propName, value) {
		switch (propName) {
			case 'enabled':
				var oEnabled = xmlDoc.createElement('o:calendar-enabled');
				oEnabled.textContent = value ? '1' : '0';
				return oEnabled;

			case 'displayname':
				var dDisplayname = xmlDoc.createElement('d:displayname');
				dDisplayname.textContent = value;
				return dDisplayname;

			case 'order':
				var aOrder = xmlDoc.createElement('a:calendar-order');
				aOrder.textContent = value;
				return aOrder;

			case 'color':
				var aColor = xmlDoc.createElement('a:calendar-color');
				aColor.textContent = value;
				return aColor;

			case 'components':
				var cComponents = xmlDoc.createElement('c:supported-calendar-component-set');
				for (var i = 0; i < value.length; i++) {
					var cComp = xmlDoc.createElement('c:comp');
					cComp.setAttribute('name', value[i].toUpperCase());
					cComponents.appendChild(cComp);
				}
				return cComponents;
		}
	};

	this._getSimplePropertiesFromRequest = function (props, publicMode) {
		if (!props['{' + DavClient.NS_IETF + '}supported-calendar-component-set']) {
			return;
		}

		this._getACLFromResponse(props);

		var simple = {
			displayname: props['{' + DavClient.NS_DAV + '}displayname'],
			color: props['{' + DavClient.NS_APPLE + '}calendar-color'],
			order: props['{' + DavClient.NS_APPLE + '}calendar-order'],
			published: false,
			publishable: false,
			components: {
				vevent: false,
				vjournal: false,
				vtodo: false
			},
			owner: null,
			shares: {
				users: [],
				groups: []
			},
			writable: publicMode ? false : props.canWrite
		};

		if ('{' + DavClient.NS_CALENDARSERVER + '}publish-url' in props) {
			simple.publishurl = props['{' + DavClient.NS_CALENDARSERVER + '}publish-url'][0].textContent;
			simple.published = true;

			// Take care of urls ending with #
			simple.publicurl = window.location.toString().endsWith('#') ? window.location.toString().slice(0, -1) : window.location.toString();

			// Take care of urls ending with /
			var publicpath = !simple.publicurl.endsWith('/') ? '/public/' : 'public/';

			if (!publicMode) {
				simple.publicurl += publicpath + simple.publishurl.substr(simple.publishurl.lastIndexOf('/') + 1);
			}
		}

		simple.publishable = false;
		simple.shareable = false;

		if (!publicMode && props.canWrite) {
			var sharingmodes = props['{' + DavClient.NS_CALENDARSERVER + '}allowed-sharing-modes'];
			if (typeof sharingmodes !== 'undefined' && sharingmodes.length !== 0) {
				var _iteratorNormalCompletion = true;
				var _didIteratorError = false;
				var _iteratorError = undefined;

				try {
					for (var _iterator = sharingmodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
						var sharemode = _step.value;

						simple.shareable = simple.shareable || sharemode.localName === 'can-be-shared';
						simple.publishable = simple.publishable || sharemode.localName === 'can-be-published';
					}
				} catch (err) {
					_didIteratorError = true;
					_iteratorError = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion && _iterator.return) {
							_iterator.return();
						}
					} finally {
						if (_didIteratorError) {
							throw _iteratorError;
						}
					}
				}
			} else {
				// Fallback if allowed-sharing-modes is not provided
				simple.shareable = props.canWrite;
			}
		}

		var components = props['{' + DavClient.NS_IETF + '}supported-calendar-component-set'];
		for (var i = 0; i < components.length; i++) {
			var name = components[i].attributes.getNamedItem('name').textContent.toLowerCase();
			if (simple.components.hasOwnProperty(name)) {
				simple.components[name] = true;
			}
		}

		var owner = props['{' + DavClient.NS_DAV + '}owner'];
		if (typeof owner !== 'undefined' && owner.length !== 0) {
			owner = owner[0].textContent.slice(0, -1);
			if (owner.indexOf('/remote.php/dav/principals/users/') !== -1) {
				simple.owner = owner.substr(33 + owner.indexOf('/remote.php/dav/principals/users/'));
			}
		}

		var shares = props['{' + DavClient.NS_OWNCLOUD + '}invite'];
		if (typeof shares !== 'undefined') {
			for (var j = 0; j < shares.length; j++) {
				var href = shares[j].getElementsByTagNameNS('DAV:', 'href');
				if (href.length === 0) {
					continue;
				}
				href = href[0].textContent;

				var access = shares[j].getElementsByTagNameNS(DavClient.NS_OWNCLOUD, 'access');
				if (access.length === 0) {
					continue;
				}
				access = access[0];

				var readWrite = access.getElementsByTagNameNS(DavClient.NS_OWNCLOUD, 'read-write');
				readWrite = readWrite.length !== 0;

				if (href.startsWith('principal:principals/users/') && href.substr(27) !== simple.owner) {
					simple.shares.users.push({
						id: href.substr(27),
						displayname: href.substr(27),
						writable: readWrite
					});
				} else if (href.startsWith('principal:principals/groups/')) {
					simple.shares.groups.push({
						id: href.substr(28),
						displayname: href.substr(28),
						writable: readWrite
					});
				}
			}
		}

		if (typeof props['{' + DavClient.NS_OWNCLOUD + '}calendar-enabled'] === 'undefined') {
			if (typeof simple.owner !== 'undefined') {
				simple.enabled = simple.owner === oc_current_user;
			} else {
				simple.enabled = false;
			}
		} else {
			simple.enabled = props['{' + DavClient.NS_OWNCLOUD + '}calendar-enabled'] === '1';
		}

		if (publicMode) {
			simple.enabled = true;
		}

		if (typeof simple.color !== 'undefined' && simple.color.length !== 0) {
			if (simple.color.length === 9) {
				simple.color = simple.color.substr(0, 7);
			}
		} else {
			simple.color = angular.element('#fullcalendar').attr('data-defaultColor');
		}

		simple.writableProperties = oc_current_user === simple.owner && simple.writable;

		var source = props['{' + DavClient.NS_CALENDARSERVER + '}source'];
		if (source) {
			for (var k = 0; k < source.length; k++) {
				if (DavClient.getNodesFullName(source[k]) === '{' + DavClient.NS_DAV + '}href') {
					simple.href = source[k].textContent;
					simple.writable = false; //this is a webcal calendar
					simple.writableProperties = oc_current_user === simple.owner;
				}
			}
		}

		return simple;
	};

	this._getACLFromResponse = function (props) {
		var canWrite = false;
		var acl = props['{' + DavClient.NS_DAV + '}acl'];
		if (acl) {
			for (var k = 0; k < acl.length; k++) {
				var href = acl[k].getElementsByTagNameNS(DavClient.NS_DAV, 'href');
				if (href.length === 0) {
					continue;
				}
				href = href[0].textContent;
				if (href !== self._currentUserPrincipal) {
					continue;
				}
				var writeNode = acl[k].getElementsByTagNameNS(DavClient.NS_DAV, 'write');
				if (writeNode.length > 0) {
					canWrite = true;
				}
			}
		}
		props.canWrite = canWrite;
	};
}]);
app.service('DavClient', ["$window", function ($window) {
	'use strict';

	var client = new dav.Client({
		baseUrl: OC.linkToRemote('dav/calendars'),
		xmlNamespaces: {
			'DAV:': 'd',
			'urn:ietf:params:xml:ns:caldav': 'c',
			'http://apple.com/ns/ical/': 'aapl',
			'http://owncloud.org/ns': 'oc',
			'http://nextcloud.com/ns': 'nc',
			'http://calendarserver.org/ns/': 'cs'
		}
	});

	client.NS_DAV = 'DAV:';
	client.NS_IETF = 'urn:ietf:params:xml:ns:caldav';
	client.NS_APPLE = 'http://apple.com/ns/ical/';
	client.NS_OWNCLOUD = 'http://owncloud.org/ns';
	client.NS_NEXTCLOUD = 'http://nextcloud.com/ns';
	client.NS_CALENDARSERVER = 'http://calendarserver.org/ns/';

	/**
  * get absolute url for path
  * @param {string} path
  * @returns {string}
  */
	client.buildUrl = function (path) {
		if (path.substr(0, 1) !== '/') {
			path = '/' + path;
		}

		return $window.location.origin + path;
	};

	/**
  * get a nodes full name including its namespace
  * @param {Node} node
  * @returns {string}
  */
	client.getNodesFullName = function (node) {
		return '{' + node.namespaceURI + '}' + node.localName;
	};

	/**
  * get response code from http response
  * @param {string} t
  * @returns {Number}
  */
	client.getResponseCodeFromHTTPResponse = function (t) {
		return parseInt(t.split(' ')[1]);
	};

	/**
  * check if request was successful
  * @param {Number} status
  * @returns {boolean}
  */
	client.wasRequestSuccessful = function (status) {
		return status >= 200 && status <= 299;
	};

	return client;
}]);

app.service('EventsEditorDialogService', ["$uibModal", function ($uibModal) {
	'use strict';

	var EDITOR_POPOVER = 'eventspopovereditor.html';
	var EDITOR_SIDEBAR = 'eventssidebareditor.html';
	var REPEAT_QUESTION = ''; //TODO in followup PR

	var self = this;

	self.calendar = null;
	self.eventModal = null;
	self.fcEvent = null;
	self.promise = null;
	self.scope = null;
	self.simpleEvent = null;
	self.unlockCallback = null;

	function cleanup() {
		self.calendar = null;
		self.eventModal = null;
		self.fcEvent = null;
		self.promise = null;
		self.scope = null;
		self.simpleEvent = null;
	}

	function openDialog(template, position, rejectDialog, resolveDialog) {
		self.eventModal = $uibModal.open({
			templateUrl: template,
			controller: 'EditorController',
			windowClass: template === EDITOR_POPOVER ? 'popover' : null,
			appendTo: template === EDITOR_POPOVER ? angular.element('#popover-container') : angular.element('#app-content'),
			resolve: {
				vevent: function vevent() {
					return self.fcEvent.vevent;
				},
				simpleEvent: function simpleEvent() {
					return self.simpleEvent;
				},
				calendar: function calendar() {
					return self.calendar;
				},
				isNew: function isNew() {
					return self.fcEvent.vevent.etag === null || self.fcEvent.vevent.etag === '';
				},
				emailAddress: function emailAddress() {
					return angular.element('#fullcalendar').attr('data-emailAddress');
				}
			},
			scope: self.scope
		});

		if (template === EDITOR_SIDEBAR) {
			angular.element('#app-content').addClass('with-app-sidebar');
		}

		self.eventModal.rendered.then(function (result) {
			angular.element('#popover-container').css('display', 'none');
			angular.forEach(position, function (v) {
				angular.element('.modal').css(v.name, v.value);
			});
			angular.element('#popover-container').css('display', 'block');
		});

		self.eventModal.result.then(function (result) {
			if (result.action === 'proceed') {
				self.calendar = result.calendar;
				openDialog(EDITOR_SIDEBAR, null, rejectDialog, resolveDialog);
			} else {
				if (template === EDITOR_SIDEBAR) {
					angular.element('#app-content').removeClass('with-app-sidebar');
				}

				self.unlockCallback();
				resolveDialog({
					calendar: result.calendar,
					vevent: result.vevent
				});
				cleanup();
			}
		}).catch(function (reason) {
			if (template === EDITOR_SIDEBAR) {
				angular.element('#app-content').removeClass('with-app-sidebar');
			}

			if (reason !== 'superseded') {
				self.unlockCallback();
				cleanup();
			}

			rejectDialog(reason);
		});
	}

	function openRepeatQuestion() {
		//TODO in followup PR
	}

	this.open = function (scope, fcEvent, positionCallback, lockCallback, unlockCallback) {
		var skipPopover = angular.element('#fullcalendar').attr('data-skipPopover') === 'yes';

		//don't reload editor for the same event
		if (self.fcEvent === fcEvent) {
			return self.promise;
		}

		//is an editor already open?
		if (self.fcEvent) {
			self.eventModal.dismiss('superseded');
		}

		cleanup();
		self.promise = new Promise(function (resolve, reject) {
			self.fcEvent = fcEvent;
			self.simpleEvent = fcEvent.getSimpleEvent();
			if (fcEvent.vevent) {
				self.calendar = fcEvent.vevent.calendar;
			}
			self.scope = scope;

			//calculate position of popover
			var position = positionCallback();

			//lock new fcEvent and unlock old fcEvent
			lockCallback();
			if (self.unlockCallback) {
				self.unlockCallback();
			}
			self.unlockCallback = unlockCallback;

			//skip popover on small devices
			if (angular.element(window).width() > 768 && !skipPopover) {
				openDialog(EDITOR_POPOVER, position, reject, resolve);
			} else {
				openDialog(EDITOR_SIDEBAR, null, reject, resolve);
			}
		});

		return self.promise;
	};

	return this;
}]);

app.factory('is', function () {
	'use strict';

	return {
		loading: false
	};
});

app.service('MailerService', ['$rootScope', 'DavClient', function ($rootScope, DavClient) {
	'use strict';

	this.sendMail = function (dest, url, name) {
		var headers = {
			'Content-Type': 'application/json; charset=utf-8',
			requesttoken: oc_requesttoken
		};
		var mailBody = {
			'to': dest,
			'url': url,
			'name': name
		};
		return DavClient.request('POST', $rootScope.baseUrl + 'public/sendmail', headers, JSON.stringify(mailBody));
	};
}]);

app.factory('RandomStringService', function () {
	'use strict';

	return {
		generate: function generate() {
			return Math.random().toString(36).substr(2);
		}
	};
});

app.service('SettingsService', ['$rootScope', '$http', function ($rootScope, $http) {
	'use strict';

	this.getView = function () {
		return $http({
			method: 'GET',
			url: $rootScope.baseUrl + 'config',
			params: { key: 'view' }
		}).then(function (response) {
			return response.data.value;
		});
	};

	this.setView = function (view) {
		return $http({
			method: 'POST',
			url: $rootScope.baseUrl + 'config',
			data: {
				key: 'view',
				value: view
			}
		}).then(function () {
			return true;
		});
	};

	this.getSkipPopover = function () {
		return $http({
			method: 'GET',
			url: $rootScope.baseUrl + 'config',
			params: { key: 'skipPopover' }
		}).then(function (response) {
			return response.data.value;
		});
	};

	this.setSkipPopover = function (value) {
		return $http({
			method: 'POST',
			url: $rootScope.baseUrl + 'config',
			data: {
				key: 'skipPopover',
				value: value
			}
		}).then(function () {
			return true;
		});
	};

	this.getShowWeekNr = function () {
		return $http({
			method: 'GET',
			url: $rootScope.baseUrl + 'config',
			params: { key: 'showWeekNr' }
		}).then(function (response) {
			return response.data.value;
		});
	};

	this.setShowWeekNr = function (value) {
		return $http({
			method: 'POST',
			url: $rootScope.baseUrl + 'config',
			data: {
				key: 'showWeekNr',
				value: value
			}
		}).then(function () {
			return true;
		});
	};
}]);

app.service('TimezoneService', ["$rootScope", "$http", "Timezone", function ($rootScope, $http, Timezone) {
	'use strict';

	var context = {
		map: {},
		self: this,
		timezones: {}
	};

	context.map['Etc/UTC'] = 'UTC';

	context.timezones.UTC = new Timezone(ICAL.TimezoneService.get('UTC'));
	context.timezones.GMT = context.timezones.UTC;
	context.timezones.Z = context.timezones.UTC;
	context.timezones.FLOATING = new Timezone(ICAL.Timezone.localTimezone);

	/**
  * get the browser's timezone id
  * @returns {string}
  */
	this.current = function () {
		var tz = jstz.determine();
		var tzname = tz ? tz.name() : 'UTC';

		if (context.map[tzname]) {
			tzname = context.map[tzname];
		}

		return tzname;
	};

	/**
  * get a timezone object by it's id
  * @param tzid
  * @returns {Promise}
  */
	this.get = function (tzid) {
		tzid = tzid.toUpperCase();

		if (context.timezones[tzid]) {
			return Promise.resolve(context.timezones[tzid]);
		}

		var url = $rootScope.baseUrl + 'timezones/' + tzid + '.ics';
		return $http({
			method: 'GET',
			url: url
		}).then(function (response) {
			var timezone = new Timezone(response.data);
			context.timezones[tzid] = timezone;

			return timezone;
		});
	};

	/**
  * list all timezone ids
  * @returns {Promise}
  */
	this.listAll = function () {
		return Promise.resolve(['Africa\/Abidjan', 'Africa\/Accra', 'Africa\/Addis_Ababa', 'Africa\/Algiers', 'Africa\/Asmara', 'Africa\/Asmera', 'Africa\/Bamako', 'Africa\/Bangui', 'Africa\/Banjul', 'Africa\/Bissau', 'Africa\/Blantyre', 'Africa\/Brazzaville', 'Africa\/Bujumbura', 'Africa\/Cairo', 'Africa\/Casablanca', 'Africa\/Ceuta', 'Africa\/Conakry', 'Africa\/Dakar', 'Africa\/Dar_es_Salaam', 'Africa\/Djibouti', 'Africa\/Douala', 'Africa\/El_Aaiun', 'Africa\/Freetown', 'Africa\/Gaborone', 'Africa\/Harare', 'Africa\/Johannesburg', 'Africa\/Juba', 'Africa\/Kampala', 'Africa\/Khartoum', 'Africa\/Kigali', 'Africa\/Kinshasa', 'Africa\/Lagos', 'Africa\/Libreville', 'Africa\/Lome', 'Africa\/Luanda', 'Africa\/Lubumbashi', 'Africa\/Lusaka', 'Africa\/Malabo', 'Africa\/Maputo', 'Africa\/Maseru', 'Africa\/Mbabane', 'Africa\/Mogadishu', 'Africa\/Monrovia', 'Africa\/Nairobi', 'Africa\/Ndjamena', 'Africa\/Niamey', 'Africa\/Nouakchott', 'Africa\/Ouagadougou', 'Africa\/Porto-Novo', 'Africa\/Sao_Tome', 'Africa\/Timbuktu', 'Africa\/Tripoli', 'Africa\/Tunis', 'Africa\/Windhoek', 'America\/Adak', 'America\/Anchorage', 'America\/Anguilla', 'America\/Antigua', 'America\/Araguaina', 'America\/Argentina\/Buenos_Aires', 'America\/Argentina\/Catamarca', 'America\/Argentina\/ComodRivadavia', 'America\/Argentina\/Cordoba', 'America\/Argentina\/Jujuy', 'America\/Argentina\/La_Rioja', 'America\/Argentina\/Mendoza', 'America\/Argentina\/Rio_Gallegos', 'America\/Argentina\/Salta', 'America\/Argentina\/San_Juan', 'America\/Argentina\/San_Luis', 'America\/Argentina\/Tucuman', 'America\/Argentina\/Ushuaia', 'America\/Aruba', 'America\/Asuncion', 'America\/Atikokan', 'America\/Bahia', 'America\/Bahia_Banderas', 'America\/Barbados', 'America\/Belem', 'America\/Belize', 'America\/Blanc-Sablon', 'America\/Boa_Vista', 'America\/Bogota', 'America\/Boise', 'America\/Cambridge_Bay', 'America\/Campo_Grande', 'America\/Cancun', 'America\/Caracas', 'America\/Cayenne', 'America\/Cayman', 'America\/Chicago', 'America\/Chihuahua', 'America\/Costa_Rica', 'America\/Creston', 'America\/Cuiaba', 'America\/Curacao', 'America\/Danmarkshavn', 'America\/Dawson', 'America\/Dawson_Creek', 'America\/Denver', 'America\/Detroit', 'America\/Dominica', 'America\/Edmonton', 'America\/Eirunepe', 'America\/El_Salvador', 'America\/Fortaleza', 'America\/Glace_Bay', 'America\/Godthab', 'America\/Goose_Bay', 'America\/Grand_Turk', 'America\/Grenada', 'America\/Guadeloupe', 'America\/Guatemala', 'America\/Guayaquil', 'America\/Guyana', 'America\/Halifax', 'America\/Havana', 'America\/Hermosillo', 'America\/Indiana\/Indianapolis', 'America\/Indiana\/Knox', 'America\/Indiana\/Marengo', 'America\/Indiana\/Petersburg', 'America\/Indiana\/Tell_City', 'America\/Indiana\/Vevay', 'America\/Indiana\/Vincennes', 'America\/Indiana\/Winamac', 'America\/Inuvik', 'America\/Iqaluit', 'America\/Jamaica', 'America\/Juneau', 'America\/Kentucky\/Louisville', 'America\/Kentucky\/Monticello', 'America\/Kralendijk', 'America\/La_Paz', 'America\/Lima', 'America\/Los_Angeles', 'America\/Louisville', 'America\/Lower_Princes', 'America\/Maceio', 'America\/Managua', 'America\/Manaus', 'America\/Marigot', 'America\/Martinique', 'America\/Matamoros', 'America\/Mazatlan', 'America\/Menominee', 'America\/Merida', 'America\/Metlakatla', 'America\/Mexico_City', 'America\/Miquelon', 'America\/Moncton', 'America\/Monterrey', 'America\/Montevideo', 'America\/Montreal', 'America\/Montserrat', 'America\/Nassau', 'America\/New_York', 'America\/Nipigon', 'America\/Nome', 'America\/Noronha', 'America\/North_Dakota\/Beulah', 'America\/North_Dakota\/Center', 'America\/North_Dakota\/New_Salem', 'America\/Ojinaga', 'America\/Panama', 'America\/Pangnirtung', 'America\/Paramaribo', 'America\/Phoenix', 'America\/Port-au-Prince', 'America\/Port_of_Spain', 'America\/Porto_Velho', 'America\/Puerto_Rico', 'America\/Rainy_River', 'America\/Rankin_Inlet', 'America\/Recife', 'America\/Regina', 'America\/Resolute', 'America\/Rio_Branco', 'America\/Santa_Isabel', 'America\/Santarem', 'America\/Santiago', 'America\/Santo_Domingo', 'America\/Sao_Paulo', 'America\/Scoresbysund', 'America\/Shiprock', 'America\/Sitka', 'America\/St_Barthelemy', 'America\/St_Johns', 'America\/St_Kitts', 'America\/St_Lucia', 'America\/St_Thomas', 'America\/St_Vincent', 'America\/Swift_Current', 'America\/Tegucigalpa', 'America\/Thule', 'America\/Thunder_Bay', 'America\/Tijuana', 'America\/Toronto', 'America\/Tortola', 'America\/Vancouver', 'America\/Whitehorse', 'America\/Winnipeg', 'America\/Yakutat', 'America\/Yellowknife', 'Antarctica\/Casey', 'Antarctica\/Davis', 'Antarctica\/DumontDUrville', 'Antarctica\/Macquarie', 'Antarctica\/Mawson', 'Antarctica\/McMurdo', 'Antarctica\/Palmer', 'Antarctica\/Rothera', 'Antarctica\/South_Pole', 'Antarctica\/Syowa', 'Antarctica\/Vostok', 'Arctic\/Longyearbyen', 'Asia\/Aden', 'Asia\/Almaty', 'Asia\/Amman', 'Asia\/Anadyr', 'Asia\/Aqtau', 'Asia\/Aqtobe', 'Asia\/Ashgabat', 'Asia\/Baghdad', 'Asia\/Bahrain', 'Asia\/Baku', 'Asia\/Bangkok', 'Asia\/Beirut', 'Asia\/Bishkek', 'Asia\/Brunei', 'Asia\/Calcutta', 'Asia\/Choibalsan', 'Asia\/Chongqing', 'Asia\/Colombo', 'Asia\/Damascus', 'Asia\/Dhaka', 'Asia\/Dili', 'Asia\/Dubai', 'Asia\/Dushanbe', 'Asia\/Gaza', 'Asia\/Harbin', 'Asia\/Hebron', 'Asia\/Ho_Chi_Minh', 'Asia\/Hong_Kong', 'Asia\/Hovd', 'Asia\/Irkutsk', 'Asia\/Istanbul', 'Asia\/Jakarta', 'Asia\/Jayapura', 'Asia\/Jerusalem', 'Asia\/Kabul', 'Asia\/Kamchatka', 'Asia\/Karachi', 'Asia\/Kashgar', 'Asia\/Kathmandu', 'Asia\/Katmandu', 'Asia\/Khandyga', 'Asia\/Kolkata', 'Asia\/Krasnoyarsk', 'Asia\/Kuala_Lumpur', 'Asia\/Kuching', 'Asia\/Kuwait', 'Asia\/Macau', 'Asia\/Magadan', 'Asia\/Makassar', 'Asia\/Manila', 'Asia\/Muscat', 'Asia\/Nicosia', 'Asia\/Novokuznetsk', 'Asia\/Novosibirsk', 'Asia\/Omsk', 'Asia\/Oral', 'Asia\/Phnom_Penh', 'Asia\/Pontianak', 'Asia\/Pyongyang', 'Asia\/Qatar', 'Asia\/Qyzylorda', 'Asia\/Rangoon', 'Asia\/Riyadh', 'Asia\/Saigon', 'Asia\/Sakhalin', 'Asia\/Samarkand', 'Asia\/Seoul', 'Asia\/Shanghai', 'Asia\/Singapore', 'Asia\/Taipei', 'Asia\/Tashkent', 'Asia\/Tbilisi', 'Asia\/Tehran', 'Asia\/Thimphu', 'Asia\/Tokyo', 'Asia\/Ulaanbaatar', 'Asia\/Urumqi', 'Asia\/Ust-Nera', 'Asia\/Vientiane', 'Asia\/Vladivostok', 'Asia\/Yakutsk', 'Asia\/Yekaterinburg', 'Asia\/Yerevan', 'Atlantic\/Azores', 'Atlantic\/Bermuda', 'Atlantic\/Canary', 'Atlantic\/Cape_Verde', 'Atlantic\/Faeroe', 'Atlantic\/Faroe', 'Atlantic\/Jan_Mayen', 'Atlantic\/Madeira', 'Atlantic\/Reykjavik', 'Atlantic\/South_Georgia', 'Atlantic\/St_Helena', 'Atlantic\/Stanley', 'Australia\/Adelaide', 'Australia\/Brisbane', 'Australia\/Broken_Hill', 'Australia\/Currie', 'Australia\/Darwin', 'Australia\/Eucla', 'Australia\/Hobart', 'Australia\/Lindeman', 'Australia\/Lord_Howe', 'Australia\/Melbourne', 'Australia\/Perth', 'Australia\/Sydney', 'Europe\/Amsterdam', 'Europe\/Andorra', 'Europe\/Athens', 'Europe\/Belfast', 'Europe\/Belgrade', 'Europe\/Berlin', 'Europe\/Bratislava', 'Europe\/Brussels', 'Europe\/Bucharest', 'Europe\/Budapest', 'Europe\/Busingen', 'Europe\/Chisinau', 'Europe\/Copenhagen', 'Europe\/Dublin', 'Europe\/Gibraltar', 'Europe\/Guernsey', 'Europe\/Helsinki', 'Europe\/Isle_of_Man', 'Europe\/Istanbul', 'Europe\/Jersey', 'Europe\/Kaliningrad', 'Europe\/Kiev', 'Europe\/Lisbon', 'Europe\/Ljubljana', 'Europe\/London', 'Europe\/Luxembourg', 'Europe\/Madrid', 'Europe\/Malta', 'Europe\/Mariehamn', 'Europe\/Minsk', 'Europe\/Monaco', 'Europe\/Moscow', 'Europe\/Nicosia', 'Europe\/Oslo', 'Europe\/Paris', 'Europe\/Podgorica', 'Europe\/Prague', 'Europe\/Riga', 'Europe\/Rome', 'Europe\/Samara', 'Europe\/San_Marino', 'Europe\/Sarajevo', 'Europe\/Simferopol', 'Europe\/Skopje', 'Europe\/Sofia', 'Europe\/Stockholm', 'Europe\/Tallinn', 'Europe\/Tirane', 'Europe\/Uzhgorod', 'Europe\/Vaduz', 'Europe\/Vatican', 'Europe\/Vienna', 'Europe\/Vilnius', 'Europe\/Volgograd', 'Europe\/Warsaw', 'Europe\/Zagreb', 'Europe\/Zaporozhye', 'Europe\/Zurich', 'Indian\/Antananarivo', 'Indian\/Chagos', 'Indian\/Christmas', 'Indian\/Cocos', 'Indian\/Comoro', 'Indian\/Kerguelen', 'Indian\/Mahe', 'Indian\/Maldives', 'Indian\/Mauritius', 'Indian\/Mayotte', 'Indian\/Reunion', 'Pacific\/Apia', 'Pacific\/Auckland', 'Pacific\/Chatham', 'Pacific\/Chuuk', 'Pacific\/Easter', 'Pacific\/Efate', 'Pacific\/Enderbury', 'Pacific\/Fakaofo', 'Pacific\/Fiji', 'Pacific\/Funafuti', 'Pacific\/Galapagos', 'Pacific\/Gambier', 'Pacific\/Guadalcanal', 'Pacific\/Guam', 'Pacific\/Honolulu', 'Pacific\/Johnston', 'Pacific\/Kiritimati', 'Pacific\/Kosrae', 'Pacific\/Kwajalein', 'Pacific\/Majuro', 'Pacific\/Marquesas', 'Pacific\/Midway', 'Pacific\/Nauru', 'Pacific\/Niue', 'Pacific\/Norfolk', 'Pacific\/Noumea', 'Pacific\/Pago_Pago', 'Pacific\/Palau', 'Pacific\/Pitcairn', 'Pacific\/Pohnpei', 'Pacific\/Ponape', 'Pacific\/Port_Moresby', 'Pacific\/Rarotonga', 'Pacific\/Saipan', 'Pacific\/Tahiti', 'Pacific\/Tarawa', 'Pacific\/Tongatapu', 'Pacific\/Truk', 'Pacific\/Wake', 'Pacific\/Wallis', 'Pacific\/Yap', 'UTC', 'GMT', 'Z']);
	};
}]);

app.service('VEventService', ["DavClient", "StringUtility", "XMLUtility", "VEvent", function (DavClient, StringUtility, XMLUtility, VEvent) {
	'use strict';

	var context = {
		calendarDataPropName: '{' + DavClient.NS_IETF + '}calendar-data',
		eTagPropName: '{' + DavClient.NS_DAV + '}getetag',
		self: this
	};

	/**
  * get url for event
  * @param {VEvent} event
  * @returns {string}
  */
	context.getEventUrl = function (event) {
		return event.calendar.url + event.uri;
	};

	/**
  * get a time-range string from moment object
  * @param {moment} momentObject
  * @returns {string}
  */
	context.getTimeRangeString = function (momentObject) {
		var utc = momentObject.utc();
		return utc.format('YYYYMMDD') + 'T' + utc.format('HHmmss') + 'Z';
	};

	/**
  * get all events from a calendar within a time-range
  * @param {Calendar} calendar
  * @param {moment} start
  * @param {moment} end
  * @returns {Promise}
  */
	this.getAll = function (calendar, start, end) {
		var _XMLUtility$getRootSk3 = XMLUtility.getRootSkeleton('c:calendar-query'),
		    _XMLUtility$getRootSk4 = _slicedToArray(_XMLUtility$getRootSk3, 2),
		    skeleton = _XMLUtility$getRootSk4[0],
		    dPropChildren = _XMLUtility$getRootSk4[1];

		dPropChildren.push({
			name: 'd:prop',
			children: [{
				name: 'd:getetag'
			}, {
				name: 'c:calendar-data'
			}]
		});
		dPropChildren.push({
			name: 'c:filter',
			children: [{
				name: 'c:comp-filter',
				attributes: {
					name: 'VCALENDAR'
				},
				children: [{
					name: 'c:comp-filter',
					attributes: {
						name: 'VEVENT'
					},
					children: [{
						name: 'c:time-range',
						attributes: {
							start: context.getTimeRangeString(start),
							end: context.getTimeRangeString(end)
						}
					}]
				}]
			}]
		});

		var url = calendar.url;
		var headers = {
			'Content-Type': 'application/xml; charset=utf-8',
			'Depth': 1,
			'requesttoken': OC.requestToken
		};
		var xml = XMLUtility.serialize(skeleton);

		return DavClient.request('REPORT', url, headers, xml).then(function (response) {
			if (!DavClient.wasRequestSuccessful(response.status)) {
				return Promise.reject(response.status);
			}

			var vevents = [];
			for (var key in response.body) {
				if (!response.body.hasOwnProperty(key)) {
					continue;
				}

				var obj = response.body[key];
				var props = obj.propStat[0].properties;
				var calendarData = props[context.calendarDataPropName];
				var etag = props[context.eTagPropName];
				var uri = obj.href.substr(obj.href.lastIndexOf('/') + 1);

				try {
					var vevent = VEvent.fromRawICS(calendar, calendarData, uri, etag);
					vevents.push(vevent);
				} catch (e) {
					console.log(e);
				}
			}

			return vevents;
		});
	};

	/**
  * get an event by uri from a calendar
  * @param {Calendar} calendar
  * @param {string} uri
  * @returns {Promise}
  */
	this.get = function (calendar, uri) {
		var url = calendar.url + uri;
		var headers = {
			'requesttoken': OC.requestToken
		};

		return DavClient.request('GET', url, headers, '').then(function (response) {
			if (!DavClient.wasRequestSuccessful(response.status)) {
				return Promise.reject(response.status);
			}

			var calendarData = response.body;
			var etag = response.xhr.getResponseHeader('ETag');

			try {
				return VEvent.fromRawICS(calendar, calendarData, uri, etag);
			} catch (e) {
				console.log(e);
				return Promise.reject(e);
			}
		});
	};

	/**
  * create a new event
  * @param {Calendar} calendar
  * @param {data} data
  * @param {boolean} returnEvent
  * @returns {Promise}
  */
	this.create = function (calendar, data) {
		var returnEvent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

		var headers = {
			'Content-Type': 'text/calendar; charset=utf-8',
			'requesttoken': OC.requestToken
		};
		var uri = StringUtility.uid('ownCloud', 'ics');
		var url = calendar.url + uri;

		return DavClient.request('PUT', url, headers, data).then(function (response) {
			if (!DavClient.wasRequestSuccessful(response.status)) {
				return Promise.reject(response.status);
			}

			if (returnEvent) {
				return context.self.get(calendar, uri);
			} else {
				return true;
			}
		});
	};

	/**
  * update an event
  * @param {VEvent} event
  * @returns {Promise}
  */
	this.update = function (event) {
		var url = context.getEventUrl(event);
		var headers = {
			'Content-Type': 'text/calendar; charset=utf-8',
			'If-Match': event.etag,
			'requesttoken': OC.requestToken
		};
		var payload = event.data;

		return DavClient.request('PUT', url, headers, payload).then(function (response) {
			if (!DavClient.wasRequestSuccessful(response.status)) {
				return Promise.reject(response.status);
			}

			// update etag of existing event
			event.etag = response.xhr.getResponseHeader('ETag');

			return true;
		});
	};

	/**
  * delete an event
  * @param {VEvent} event
  * @returns {Promise}
  */
	this.delete = function (event) {
		var url = context.getEventUrl(event);
		var headers = {
			'If-Match': event.etag,
			'requesttoken': OC.requestToken
		};

		return DavClient.request('DELETE', url, headers, '').then(function (response) {
			if (DavClient.wasRequestSuccessful(response.status)) {
				return true;
			} else {
				return Promise.reject(response.status);
			}
		});
	};
}]);

app.service('WebCalService', ["$http", "ICalSplitterUtility", "WebCalUtility", "SplittedICal", function ($http, ICalSplitterUtility, WebCalUtility, SplittedICal) {
	'use strict';

	var self = this;
	var context = {
		cachedSplittedICals: {}
	};

	this.get = function (webcalUrl, allowDowngradeToHttp) {
		if (context.cachedSplittedICals.hasOwnProperty(webcalUrl)) {
			return Promise.resolve(context.cachedSplittedICals[webcalUrl]);
		}

		webcalUrl = WebCalUtility.fixURL(webcalUrl);
		var url = WebCalUtility.buildProxyURL(webcalUrl);

		var localWebcal = JSON.parse(localStorage.getItem(webcalUrl));
		if (localWebcal && localWebcal.timestamp > new Date().getTime()) {
			return Promise.resolve(ICalSplitterUtility.split(localWebcal.value));
		}

		return $http.get(url).then(function (response) {
			var splitted = ICalSplitterUtility.split(response.data);

			if (!SplittedICal.isSplittedICal(splitted)) {
				return Promise.reject(t('calendar', 'Please enter a valid WebCal-URL'));
			}

			context.cachedSplittedICals[webcalUrl] = splitted;
			localStorage.setItem(webcalUrl, JSON.stringify({ value: response.data, timestamp: new Date().getTime() + 7200000 })); // That would be two hours in milliseconds

			return splitted;
		}).catch(function (e) {
			if (WebCalUtility.downgradePossible(webcalUrl, allowDowngradeToHttp)) {
				var httpUrl = WebCalUtility.downgradeURL(webcalUrl);

				return self.get(httpUrl, false).then(function (splitted) {
					context.cachedSplittedICals[webcalUrl] = splitted;
					return splitted;
				});
			}
			if (e.status < 200 || e.status > 299) {
				return Promise.reject(t('calendar', 'The remote server did not give us access to the calendar (HTTP {code} error)', { code: e.status }));
			}

			return Promise.reject(t('calendar', 'Please enter a valid WebCal-URL'));
		});
	};
}]);

app.service('ColorUtility', function () {
	'use strict';

	var self = this;

	/**
  * List of default colors
  * @type {string[]}
  */
	this.colors = [];

	/**
  * generate an appropriate text color based on background color
  * @param red
  * @param green
  * @param blue
  * @returns {string}
  */
	this.generateTextColorFromRGB = function (red, green, blue) {
		var brightness = (red * 299 + green * 587 + blue * 114) / 1000;
		return brightness > 130 ? '#000000' : '#FAFAFA';
	};

	/**
  * extract decimal values from hex rgb string
  * @param colorString
  * @returns {*}
  */
	this.extractRGBFromHexString = function (colorString) {
		var fallbackColor = {
			r: 255,
			g: 255,
			b: 255
		},
		    matchedString;

		if (typeof colorString !== 'string') {
			return fallbackColor;
		}

		switch (colorString.length) {
			case 4:
				matchedString = colorString.match(/^#([0-9a-f]{3})$/i);
				return Array.isArray(matchedString) && matchedString[1] ? {
					r: parseInt(matchedString[1].charAt(0), 16) * 0x11,
					g: parseInt(matchedString[1].charAt(1), 16) * 0x11,
					b: parseInt(matchedString[1].charAt(2), 16) * 0x11
				} : fallbackColor;

			case 7:
			case 9:
				var regex = new RegExp('^#([0-9a-f]{' + (colorString.length - 1) + '})$', 'i');
				matchedString = colorString.match(regex);
				return Array.isArray(matchedString) && matchedString[1] ? {
					r: parseInt(matchedString[1].substr(0, 2), 16),
					g: parseInt(matchedString[1].substr(2, 2), 16),
					b: parseInt(matchedString[1].substr(4, 2), 16)
				} : fallbackColor;

			default:
				return fallbackColor;
		}
	};

	/**
  * Make sure string for Hex always uses two digits
  * @param str
  * @returns {string}
  * @private
  */
	this._ensureTwoDigits = function (str) {
		return str.length === 1 ? '0' + str : str;
	};

	/**
  * convert three Numbers to rgb hex string
  * @param r
  * @param g
  * @param b
  * @returns {string}
  */
	this.rgbToHex = function (r, g, b) {
		if (Array.isArray(r)) {
			var _r = r;

			var _r2 = _slicedToArray(_r, 3);

			r = _r2[0];
			g = _r2[1];
			b = _r2[2];
		}

		return '#' + this._ensureTwoDigits(parseInt(r, 10).toString(16)) + this._ensureTwoDigits(parseInt(g, 10).toString(16)) + this._ensureTwoDigits(parseInt(b, 10).toString(16));
	};

	/**
  * convert HSL to RGB
  * @param h
  * @param s
  * @param l
  * @returns array
  */
	this._hslToRgb = function (h, s, l) {
		if (Array.isArray(h)) {
			var _h = h;

			var _h2 = _slicedToArray(_h, 3);

			h = _h2[0];
			s = _h2[1];
			l = _h2[2];
		}

		s /= 100;
		l /= 100;

		return hslToRgb(h, s, l);
	};

	/**
  * generates a random color
  * @returns {string}
  */
	this.randomColor = function () {
		if (typeof String.prototype.toHsl === 'function') {
			var hsl = Math.random().toString().toHsl();
			return self.rgbToHex(self._hslToRgb(hsl));
		} else {
			return self.colors[Math.floor(Math.random() * self.colors.length)];
		}
	};

	// initialize default colors
	if (typeof String.prototype.toHsl === 'function') {
		//0 40 80 120 160 200 240 280 320
		var hashValues = ['15', '9', '4', 'b', '6', '11', '74', 'f', '57'];
		angular.forEach(hashValues, function (hashValue) {
			var hsl = hashValue.toHsl();
			self.colors.push(self.rgbToHex(self._hslToRgb(hsl)));
		});
	} else {
		this.colors = ['#31CC7C', '#317CCC', '#FF7A66', '#F1DB50', '#7C31CC', '#CC317C', '#3A3B3D', '#CACBCD'];
	}
});

app.service('ICalSplitterUtility', ["ICalFactory", "SplittedICal", function (ICalFactory, SplittedICal) {
	'use strict';

	var calendarColorIdentifier = 'x-apple-calendar-color';
	var calendarNameIdentifier = 'x-wr-calname';
	var componentNames = ['vevent', 'vjournal', 'vtodo'];

	/**
  * split ics strings into a SplittedICal object
  * @param {string} iCalString
  * @returns {SplittedICal}
  */
	this.split = function (iCalString) {
		var jcal = ICAL.parse(iCalString);
		var components = new ICAL.Component(jcal);

		var objects = {};
		var timezones = components.getAllSubcomponents('vtimezone');

		componentNames.forEach(function (componentName) {
			var vobjects = components.getAllSubcomponents(componentName);
			objects[componentName] = {};

			vobjects.forEach(function (vobject) {
				var uid = vobject.getFirstPropertyValue('uid');
				objects[componentName][uid] = objects[componentName][uid] || [];
				objects[componentName][uid].push(vobject);
			});
		});

		var name = components.getFirstPropertyValue(calendarNameIdentifier);
		var color = components.getFirstPropertyValue(calendarColorIdentifier);

		var split = SplittedICal(name, color);
		componentNames.forEach(function (componentName) {
			var _loop = function _loop(objectKey) {
				/* jshint loopfunc:true */
				if (!objects[componentName].hasOwnProperty(objectKey)) {
					return 'continue';
				}

				var component = ICalFactory.new();
				timezones.forEach(function (timezone) {
					component.addSubcomponent(timezone);
				});
				objects[componentName][objectKey].forEach(function (object) {
					component.addSubcomponent(object);
				});
				split.addObject(componentName, component.toString());
			};

			for (var objectKey in objects[componentName]) {
				var _ret = _loop(objectKey);

				if (_ret === 'continue') continue;
			}
		});

		return split;
	};
}]);

app.service('PopoverPositioningUtility', ["$window", function ($window) {
	'use strict';

	var context = {
		popoverHeight: 300,
		popoverWidth: 450
	};

	Object.defineProperties(context, {
		headerHeight: {
			get: function get() {
				return angular.element('#header').height();
			}
		},
		navigationWidth: {
			get: function get() {
				return angular.element('#app-navigation').width();
			}
		},
		windowX: {
			get: function get() {
				return $window.innerWidth - context.navigationWidth;
			}
		},
		windowY: {
			get: function get() {
				return $window.innerHeight - context.headerHeight;
			}
		}
	});

	context.isAgendaDayView = function (view) {
		return view.name === 'agendaDay';
	};

	context.isAgendaView = function (view) {
		return view.name.startsWith('agenda');
	};

	context.isInTheUpperPart = function (top) {
		return (top - context.headerHeight) / context.windowY < 0.5;
	};

	context.isInTheLeftQuarter = function (left) {
		return (left - context.navigationWidth) / context.windowX < 0.25;
	};

	context.isInTheRightQuarter = function (left) {
		return (left - context.navigationWidth) / context.windowX > 0.75;
	};

	/**
  * calculate the position of a popover
  * @param {Number} left
  * @param {Number}top
  * @param {Number}right
  * @param {Number}bottom
  * @param {*} view
  */
	this.calculate = function (left, top, right, bottom, view) {
		var position = [],
		    eventWidth = right - left;

		if (context.isInTheUpperPart(top)) {
			if (context.isAgendaView(view)) {
				position.push({
					name: 'top',
					value: top - context.headerHeight + 30
				});
			} else {
				position.push({
					name: 'top',
					value: bottom - context.headerHeight + 20
				});
			}
		} else {
			position.push({
				name: 'top',
				value: top - context.headerHeight - context.popoverHeight - 20
			});
		}

		if (context.isAgendaDayView(view)) {
			position.push({
				name: 'left',
				value: left - context.popoverWidth / 2 - 20 + eventWidth / 2
			});
		} else {
			if (context.isInTheLeftQuarter(left)) {
				position.push({
					name: 'left',
					value: left - 20 + eventWidth / 2
				});
			} else if (context.isInTheRightQuarter(left)) {
				position.push({
					name: 'left',
					value: left - context.popoverWidth - 20 + eventWidth / 2
				});
			} else {
				position.push({
					name: 'left',
					value: left - context.popoverWidth / 2 - 20 + eventWidth / 2
				});
			}
		}

		return position;
	};

	/**
  * calculate the position of a popover by a given target
  * @param {*} target
  * @param {*} view
  */
	this.calculateByTarget = function (target, view) {
		var clientRect = target.getClientRects()[0];

		var left = clientRect.left,
		    top = clientRect.top,
		    right = clientRect.right,
		    bottom = clientRect.bottom;

		return this.calculate(left, top, right, bottom, view);
	};
}]);

app.service('StringUtility', function () {
	'use strict';

	this.uid = function (prefix, suffix) {
		prefix = prefix || '';
		suffix = suffix || '';

		if (prefix !== '') {
			prefix += '-';
		}
		if (suffix !== '') {
			suffix = '.' + suffix;
		}

		return prefix + Math.random().toString(36).substr(2).toUpperCase() + Math.random().toString(36).substr(2).toUpperCase() + suffix;
	};

	this.uri = function (start, isAvailable) {
		start = start || '';

		var uri = start.toString().toLowerCase().replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w\-]+/g, '') // Remove all non-word chars
		.replace(/\-\-+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text

		if (uri === '') {
			uri = '-';
		}

		if (isAvailable(uri)) {
			return uri;
		}

		if (uri.indexOf('-') === -1) {
			uri = uri + '-1';
			if (isAvailable(uri)) {
				return uri;
			}
		}

		// === false because !undefined = true, possible infinite loop
		do {
			var positionLastDash = uri.lastIndexOf('-');
			var firstPart = uri.substr(0, positionLastDash);
			var lastPart = uri.substr(positionLastDash + 1);

			if (lastPart.match(/^\d+$/)) {
				lastPart = parseInt(lastPart);
				lastPart++;

				uri = firstPart + '-' + lastPart;
			} else {
				uri = uri + '-1';
			}
		} while (isAvailable(uri) === false);

		return uri;
	};
});

app.service('WebCalUtility', ["$rootScope", function ($rootScope) {
	'use strict';

	this.downgradeURL = function (url) {
		if (url.startsWith('https://')) {
			return 'http://' + url.substr(8);
		}
	};

	this.downgradePossible = function (url, allowDowngradeToHttp) {
		return url.startsWith('https://') && allowDowngradeToHttp;
	};

	this.buildProxyURL = function (url) {
		return $rootScope.baseUrl + 'proxy?url=' + encodeURIComponent(url);
	};

	this.fixURL = function (url) {
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return url;
		} else if (url.startsWith('webcal://')) {
			return 'https://' + url.substr(9);
		} else {
			return 'https://' + url;
		}
	};
}]);

app.service('XMLUtility', function () {
	'use strict';

	var context = {};
	context.XMLify = function (xmlDoc, parent, json) {
		var element = xmlDoc.createElement(json.name);

		for (var key in json.attributes) {
			if (json.attributes.hasOwnProperty(key)) {
				element.setAttribute(key, json.attributes[key]);
			}
		}

		if (json.value) {
			element.textContent = json.value;
		} else if (json.children) {
			for (var _key in json.children) {
				if (json.children.hasOwnProperty(_key)) {
					context.XMLify(xmlDoc, element, json.children[_key]);
				}
			}
		}

		parent.appendChild(element);
	};

	var serializer = new XMLSerializer();

	this.getRootSkeleton = function () {
		if (arguments.length === 0) {
			return [{}, null];
		}

		var skeleton = {
			name: arguments[0],
			attributes: {
				'xmlns:c': 'urn:ietf:params:xml:ns:caldav',
				'xmlns:d': 'DAV:',
				'xmlns:a': 'http://apple.com/ns/ical/',
				'xmlns:o': 'http://owncloud.org/ns',
				'xmlns:n': 'http://nextcloud.com/ns',
				'xmlns:cs': 'http://calendarserver.org/ns/'
			},
			children: []
		};

		var childrenWrapper = skeleton.children;

		var args = Array.prototype.slice.call(arguments, 1);
		args.forEach(function (argument) {
			var level = {
				name: argument,
				children: []
			};
			childrenWrapper.push(level);
			childrenWrapper = level.children;
		});

		return [skeleton, childrenWrapper];
	};

	this.serialize = function (json) {
		json = json || {};
		if ((typeof json === 'undefined' ? 'undefined' : _typeof(json)) !== 'object' || !json.hasOwnProperty('name')) {
			return '';
		}

		var root = document.implementation.createDocument('', '', null);
		context.XMLify(root, root, json);

		return serializer.serializeToString(root.firstChild);
	};
});


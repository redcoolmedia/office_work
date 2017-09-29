<!DOCTYPE html>
<html class="ng-csp" data-placeholder-focus="false" lang="<?php p($_['language']); ?>" >
	<head data-user="<?php p($_['user_uid']); ?>" data-user-displayname="<?php p($_['user_displayname']); ?>" data-requesttoken="<?php p($_['requesttoken']); ?>">
		<meta charset="utf-8">
		<title>RedcoolMedia Cloud Apps 
			<?php
				p(!empty($_['application'])?$_['application'].' - ':'');
				p($theme->getTitle());
			?>
		</title>
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="referrer" content="never">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0">
		<meta name="apple-itunes-app" content="app-id=<?php p($theme->getiTunesAppId()); ?>">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-status-bar-style" content="black">
		<meta name="apple-mobile-web-app-title" content="<?php p((!empty($_['application']) && $_['appid']!='files')? $_['application']:'ownCloud'); ?>">
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="theme-color" content="<?php p($theme->getMailHeaderColor()); ?>">
		<link rel="icon" href="<?php print_unescaped(image_path($_['appid'], 'favicon.ico')); /* IE11+ supports png */ ?>">
		<link rel="apple-touch-icon-precomposed" href="<?php print_unescaped(image_path($_['appid'], 'favicon-touch.png')); ?>">
		<link rel="mask-icon" sizes="any" href="<?php print_unescaped(image_path($_['appid'], 'favicon-mask.svg')); ?>" color="#1d2d44">
		<link rel="manifest" href="<?php print_unescaped(image_path($_['appid'], 'manifest.json')); ?>">
		<?php foreach($_['cssfiles'] as $cssfile): ?>
			<link rel="stylesheet" href="<?php print_unescaped($cssfile); ?>">
		<?php endforeach; ?>
		<?php foreach($_['printcssfiles'] as $cssfile): ?>
			<link rel="stylesheet" href="<?php print_unescaped($cssfile); ?>" media="print">
		<?php endforeach; ?>
		<?php foreach($_['jsfiles'] as $jsfile): ?>
			<script src="<?php print_unescaped($jsfile); ?>"></script>
		<?php endforeach; ?>
		<?php print_unescaped($_['headers']); ?>
	</head>
	<body id="<?php p($_['bodyid']);?>">
	<?php include('layout.noscript.warning.php'); ?>
	<div id="notification-container">
		<div id="notification"></div>
	</div>
	<header role="banner">

<!-- Redcoolmedia Top Start-->
  <div style="color: #333; font-family: arial, helvetica, sans-serif;z-index:11112; position: fixed; top: 5px; width: 50px; right: 80px;">
     <ul style="border: 0; list-style-type: none;     display: block; margin: 0px 0px 1px 0px; text-align: right; list-style-type: none; padding: 10px 0px 10px 0px; width: 100%; height: 40px; ">
                 <li style="">
                        <a style="font-size:13px; margin-right: 6%; text-decoration: none; font-weight: bold; text-transform: uppercase; color: #fff; border-right: solid 1px #cc0000; background: #cc0000 !important; padding: 10px; position: absolute; top: 0px; right: 0px; " href="https://www.redcoolmedia.net/" >Home
                        </a>
                 </li>
         </ul>
 </div>
  <div style="color: #333; font-family: arial, helvetica, sans-serif;z-index:11111; position: fixed; text-align: center; width: 100%; top: 20px; height: 90px;">

<script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
<!-- webredcoolmedialeaderboard -->
<ins class="adsbygoogle"
     style="display:inline-block;width:728px;height:90px"
     data-ad-client="ca-pub-4378985322821128"
     data-ad-slot="3888406491"></ins>
<script>
(adsbygoogle = window.adsbygoogle || []).push({});
</script>


  </div>
 <!-- Redcoolmedia Top End-->

		<div id="header">

			<a href="<?php print_unescaped(link_to('', 'index.php')); ?>"
				id="owncloud" tabindex="1">
				<div class="logo-icon">
					<h1 class="hidden-visually">
						<?php p($theme->getName()); ?>
					</h1>
				</div>
			</a>

			<a href="#" class="header-appname-container menutoggle" tabindex="2">
				<h1 class="header-appname">
					<?php
						if(OC_Util::getEditionString() === OC_Util::EDITION_COMMUNITY) {
							p(!empty($_['application'])?$_['application']: $l->t('Apps'));
						} else {
							print_unescaped($theme->getHTMLName());
						}
					?>
				</h1>
				<img alt="" class="caret" src="<?php print_unescaped(image_path('', 'actions/caret.svg')); ?>">
			</a>

			<div id="logo-claim" style="display:none;"><?php p($theme->getLogoClaim()); ?></div>
			<div id="settings">
				<div id="expand" tabindex="6" role="link" class="menutoggle">
					<?php if ($_['enableAvatars']): ?>
					<div class="avatardiv<?php if ($_['userAvatarSet']) { print_unescaped(' avatardiv-shown'); } else { print_unescaped('" style="display: none'); } ?>">
						<?php if ($_['userAvatarSet']): ?>
							<img alt="" width="32" height="32"
							src="<?php p(\OC::$server->getURLGenerator()->linkToRoute('core.avatar.getAvatar', ['userId' => $_['user_uid'], 'size' => 32]));?>"
							srcset="<?php p(\OC::$server->getURLGenerator()->linkToRoute('core.avatar.getAvatar', ['userId' => $_['user_uid'], 'size' => 64]));?> 2x, <?php p(\OC::$server->getURLGenerator()->linkToRoute('core.avatar.getAvatar', ['userId' => $_['user_uid'], 'size' => 128]));?> 4x"
							>
						<?php endif; ?>
					</div>
					<?php endif; ?>
					<span id="expandDisplayName"><?php  p(trim($_['user_displayname']) != '' ? $_['user_displayname'] : $_['user_uid']) ?></span>
					<img alt="" src="<?php print_unescaped(image_path('', 'actions/caret.svg')); ?>">
				</div>
				<div id="expanddiv">
				<ul>
				<?php foreach($_['settingsnavigation'] as $entry):?>
					<li>
						<a href="<?php print_unescaped($entry['href']); ?>"
							<?php if( $entry["active"] ): ?> class="active"<?php endif; ?>>
							<img alt="" src="<?php print_unescaped($entry['icon']); ?>">
							<?php p($entry['name']) ?>
						</a>
					</li>
				<?php endforeach; ?>
					<li>
						<a id="logout" <?php print_unescaped(OC_User::getLogoutAttribute()); ?>>
							<img alt="" src="<?php print_unescaped(image_path('', 'actions/logout.svg')); ?>">
							<?php p($l->t('Log out'));?>
						</a>
					</li>
				</ul>
				</div>
			</div>

			<form class="searchbox" action="#" method="post" role="search" novalidate>
				<label for="searchbox" class="hidden-visually">
					<?php p($l->t('Search'));?>
				</label>
				<input id="searchbox" type="search" name="query"
					value="" required
					autocomplete="off" tabindex="5">
			</form>
		</div></header>

		<nav role="navigation"><div id="navigation">
			<div id="apps">
				<ul>
				<?php foreach($_['navigation'] as $entry): ?>
					<li data-id="<?php p($entry['id']); ?>">
						<a href="<?php print_unescaped($entry['href']); ?>" tabindex="3"
							<?php if( $entry['active'] ): ?> class="active"<?php endif; ?>>
							<img class="app-icon" alt="" src="<?php print_unescaped($entry['icon']); ?>">
							<div class="icon-loading-dark" style="display:none;"></div>
							<span>
								<?php p($entry['name']); ?>
							</span>
						</a>
					</li>
				<?php endforeach; ?>
				</ul>
			</div>
		</div></nav>


		<div id="content-wrapper">
			<div id="content" class="app-<?php p($_['appid']) ?>" role="main">
				<?php print_unescaped($_['content']); ?>
			</div>
		</div>
	</body>
</html>

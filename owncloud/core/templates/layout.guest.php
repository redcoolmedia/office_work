<!DOCTYPE html>
<html class="ng-csp" data-placeholder-focus="false" lang="<?php p($_['language']); ?>" >
	<head data-requesttoken="<?php p($_['requesttoken']); ?>">
		<meta charset="utf-8">
		<title>
		<?php p($theme->getTitle()); ?>
		</title>
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="referrer" content="never">
		<meta name="viewport" content="width=device-width, minimum-scale=1.0, maximum-scale=1.0">
		<meta name="apple-itunes-app" content="app-id=<?php p($theme->getiTunesAppId()); ?>">
		<meta name="theme-color" content="<?php p($theme->getMailHeaderColor()); ?>">
		<link rel="icon" href="<?php print_unescaped(image_path('', 'favicon.ico')); /* IE11+ supports png */ ?>">
		<link rel="apple-touch-icon-precomposed" href="<?php print_unescaped(image_path('', 'favicon-touch.png')); ?>">
		<link rel="mask-icon" sizes="any" href="<?php print_unescaped(image_path('', 'favicon-mask.svg')); ?>" color="#1d2d44">
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
<style>
#overlay {
     visibility: hidden;
     position: absolute;
     left: 0px;
     top: 0px;
     width:100%;
     height:100%;
     text-align:center;
     z-index: 1000;
}
#overlay div {
     width:400px;
     margin: 100px auto;
     background-color: #fff;
     border:1px solid #000;
     padding:15px;
     text-align:center;
}
#centerx {
	visibility: hidden;
        position: fixed;
        left: 0px;
        text-align: center;
        top: 44px;
        width: 100%;
        height: 100%;
        z-index: 9999;
        color: #ffffff;
}
</style>

	</head>
	<body id="<?php p($_['bodyid']);?>">
		<?php include('layout.noscript.warning.php'); ?>

<!-- Redcoolmedia Top Start-->
  <div style="background: #fff url(https://www.redcoolmedia.net/templates/beez5/images/header_outer.gif) repeat-x left 0; color: #333; font-family: arial, helvetica, sans-serif; z-index:11111; position: absolute; top: 0px; width: 100%;">
     <ul style="background: url(https://www.redcoolmedia.net/templates/beez5/images/navhoriz.png); border: 0; border-bottom: solid 1px #237D85; list-style-type: none;     display: block; margin: 0px 0px 1px 0px; text-align: right; list-style-type: none; padding: 10px 0px 10px 0px; width: 100%; height: 40px; ">
                 <li style="">
                        <a style="font-size:13px; margin-right: 6%; text-decoration: none; font-weight: bold; text-transform: uppercase; color: #fff; border-right: solid 1px #cc0000; background: #cc0000 !important; padding: 10px; position: absolute; top: 0px; right: 0px; " href="https://www.redcoolmedia.net/" >Home
                        </a>
                 </li>
         </ul>
 </div>
 <!-- Redcoolmedia Top End-->


		<div class="wrapper">
			<div class="v-align">
				<?php if ($_['bodyid'] === 'body-login' ): ?>
					<header role="banner">
						<div id="header">
							<div class="logo">
								<h1 class="hidden-visually">
									<?php p($theme->getName()); ?>
								</h1>
							</div>
							<div id="logo-claim" style="display:none;"><?php p($theme->getLogoClaim()); ?></div>
						</div>
					</header>
					<!--<div id="overlay">
     						<div>
          						<p>Please wait a few seconds while redirecting to the app ....</p>
     						</div>
					</div>-->
<div id="centerx" >
<br>
<br>
<br>
<h1 style="font-family: Times; color: rgb(255, 255, 255); display: block; font-size: 32px; font-weight: bold; height:37px; text-align: center; ">RedcoolMedia apps</h1>
<br>
<br>
<br>
<h2 style="font-family: Times; color: rgb(255, 255, 255); display: block; font-size: 24px; font-weight: bold; height:28px; text-align: center; ">Loading, please wait...</h2>
</div>

<div id="numberx" style="visibility: hidden; font-size: 80px; color: #ffffff; z-index: 10000; top: 44px; height: 100%; width: 100%; text-align: center; position: fixed; left: 0px; display: table;">
<span id="numberxx" style="display: table-cell; vertical-align: middle;">
</span>
</div>

				<?php endif; ?>
				<?php print_unescaped($_['content']); ?>
				<div class="push"></div><!-- for sticky footer -->
			</div>
		</div>
		<footer role="contentinfo">
			<p class="info">
				<?php print_unescaped($theme->getLongFooter()); ?>
			</p>
		</footer>
	</body>
</html>

<?php

// Adapt this file accordingly
// Change ROOTOWNCLOUDAUTHORIZATION, USERNAME and PASSWORD

$ch=curl_init('http://localhost:80/owncloud/ocs/v1.php/cloud/users');
$headers = array(
                "Authorization: Basic ROOTOWNCLOUDAUTHORIZATION"
        );
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch,CURLOPT_POST,1);
curl_setopt($ch,CURLOPT_POSTFIELDS,"userid=USERNAME&password=PASSWORD");
curl_setopt($ch, CURLOPT_RETURNTRANSFER,1);
$data = curl_exec($ch);

header('Location: https://www.redcoolmedia.net/owncloud/login?redirect_url=%252Fowncloud%252Fapps%252Ffiles%252F&username=USERNAME', true,  301);


?>
